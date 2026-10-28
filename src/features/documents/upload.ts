import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { normalizeParsedDocument, type ParsedDocument } from '../../../supabase/functions/_shared/documents.ts';
import { getSupabase } from '@/lib/supabase';

export type LocalFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Yapıştırılan metin en fazla bu kadar karakter olabilir (sunucu 40 bin karakteri okur). */
export const MAX_PASTED_CHARS = 40_000;

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'text/plain',
] as const;

/** Sunucunun döndürdüğü veya istemcide oluşan, arayüzün mesajını bildiği hata kodları. */
export type UploadErrorCode =
  | 'permission_denied'
  | 'unsupported_file'
  | 'file_too_large'
  | 'quota_exceeded'
  | 'not_configured'
  | 'ai_failed'
  | 'no_reservations'
  | 'network';

export class UploadError extends Error {
  constructor(readonly code: UploadErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'UploadError';
  }
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'text/plain': 'txt',
};

function guessMimeType(name: string, given?: string | null): string {
  if (given && given !== 'application/octet-stream') return given.toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase();
  const found = Object.entries(EXTENSIONS).find(([, e]) => e === ext || (ext === 'jpeg' && e === 'jpg'));
  return found?.[0] ?? 'application/octet-stream';
}

function fromImageAssets(result: ImagePicker.ImagePickerResult): LocalFile[] {
  if (result.canceled) return [];
  return result.assets.map((a, i) => {
    const name = a.fileName ?? `photo-${Date.now()}-${i}.jpg`;
    return { uri: a.uri, name, mimeType: guessMimeType(name, a.mimeType), size: a.fileSize ?? null };
  });
}

export async function pickFromCamera(): Promise<LocalFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new UploadError('permission_denied');
  return fromImageAssets(await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85 }));
}

export async function pickFromLibrary(): Promise<LocalFile[]> {
  return fromImageAssets(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    }),
  );
}

/** Yapıştırılan e-posta / rezervasyon metnini geçici bir düz metin dosyasına çevirir (diğer belgelerle aynı hattan geçer). */
export function textToLocalFile(text: string): LocalFile {
  const body = text.trim().slice(0, MAX_PASTED_CHARS);
  const name = `pasted-${Date.now()}.txt`;
  if (Platform.OS === 'web') {
    const uri = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    return { uri, name, mimeType: 'text/plain', size: body.length };
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(body);
  return { uri: file.uri, name, mimeType: 'text/plain', size: file.size };
}

export async function pickDocuments(): Promise<LocalFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...SUPPORTED_MIME_TYPES],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    uri: a.uri,
    name: a.name,
    mimeType: guessMimeType(a.name, a.mimeType),
    size: a.size ?? null,
  }));
}

/** Seçilen dosyanın yüklenebilir olup olmadığını kontrol eder. */
export function validateFile(file: LocalFile): UploadErrorCode | null {
  if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(file.mimeType)) return 'unsupported_file';
  if (file.size !== null && file.size > MAX_FILE_BYTES) return 'file_too_large';
  return null;
}

async function readBytes(file: LocalFile): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(file.uri)).arrayBuffer();
  return new File(file.uri).arrayBuffer();
}

/**
 * Dosyayı kullanıcının storage klasörüne yükler ve documents tablosuna kaydeder.
 * Dönen kimlik parseDocument'a verilir.
 */
export async function uploadDocument(file: LocalFile, userId: string): Promise<string> {
  const invalid = validateFile(file);
  if (invalid) throw new UploadError(invalid);

  const bytes = await readBytes(file);
  if (bytes.byteLength > MAX_FILE_BYTES) throw new UploadError('file_too_large');

  const supabase = getSupabase();
  const path = `${userId}/${Crypto.randomUUID()}.${EXTENSIONS[file.mimeType]}`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, bytes, { contentType: file.mimeType, upsert: false });
  if (uploadError) throw new UploadError('network', uploadError.message);

  const { data, error } = await supabase
    .from('documents')
    .insert({ storage_path: path, mime_type: file.mimeType })
    .select('id')
    .single();
  if (error) throw new UploadError('network', error.message);
  return data.id;
}

const SERVER_CODES: Record<string, UploadErrorCode> = {
  quota_exceeded: 'quota_exceeded',
  unsupported_file: 'unsupported_file',
  file_too_large: 'file_too_large',
  not_configured: 'not_configured',
  ai_failed: 'ai_failed',
};

/** parse-document fonksiyonunu çağırır ve AI'ın okuduğu, doğrulanmış veriyi döndürür. */
export async function parseDocument(documentId: string): Promise<ParsedDocument> {
  const { data, error } = await getSupabase().functions.invoke('parse-document', {
    body: { document_id: documentId },
  });
  if (error) {
    let code: UploadErrorCode = 'network';
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      code = SERVER_CODES[body?.error?.code] ?? 'ai_failed';
    }
    throw new UploadError(code, error.message);
  }
  // Sunucu zaten doğruladı; istemci yine de kendi tarafında aynı kontrolden geçirir.
  const parsed = normalizeParsedDocument(data?.document?.parsed_data);
  if (parsed.items.length === 0) throw new UploadError('no_reservations');
  return parsed;
}
