import { create } from 'zustand';

import type { ParsedItem } from '../../../supabase/functions/_shared/documents.ts';
import type { DraftItem } from './build-trip';
import { parseDocument, uploadDocument, UploadError, validateFile, type LocalFile, type UploadErrorCode } from './upload';

export type UploadStatus = 'queued' | 'uploading' | 'reading' | 'done' | 'failed';

export type UploadEntry = {
  id: string;
  file: LocalFile;
  status: UploadStatus;
  documentId?: string;
  errorCode?: UploadErrorCode;
};

type UploadState = {
  entries: UploadEntry[];
  /** İnceleme ekranında düzenlenen kalemler. */
  items: DraftItem[];
  /** Kullanıcının seyahate eklemek istemediği kalemler. */
  excluded: string[];

  addFiles: (files: LocalFile[]) => void;
  remove: (id: string) => void;
  processAll: (userId: string) => Promise<void>;
  retry: (id: string, userId: string) => Promise<void>;
  updateItem: (key: string, patch: (item: DraftItem) => DraftItem) => void;
  toggleItem: (key: string) => void;
  reset: () => void;
};

let counter = 0;

export const useUploadStore = create<UploadState>()((set, get) => {
  const patchEntry = (id: string, patch: Partial<UploadEntry>) =>
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  async function processOne(entry: UploadEntry, userId: string) {
    try {
      let documentId = entry.documentId;
      if (!documentId) {
        patchEntry(entry.id, { status: 'uploading', errorCode: undefined });
        documentId = await uploadDocument(entry.file, userId);
        patchEntry(entry.id, { documentId });
      }
      patchEntry(entry.id, { status: 'reading', errorCode: undefined });
      const parsed = await parseDocument(documentId);
      const newItems: DraftItem[] = parsed.items.map((item: ParsedItem, i: number) => ({
        ...item,
        key: `${documentId}:${i}`,
        documentId: documentId!,
      }));
      set((s) => ({
        items: [...s.items.filter((it) => it.documentId !== documentId), ...newItems],
      }));
      patchEntry(entry.id, { status: 'done' });
    } catch (e) {
      patchEntry(entry.id, { status: 'failed', errorCode: e instanceof UploadError ? e.code : 'network' });
    }
  }

  return {
    entries: [],
    items: [],
    excluded: [],

    addFiles: (files) =>
      set((s) => ({
        entries: [
          ...s.entries,
          ...files.map((file) => {
            const invalid = validateFile(file);
            return {
              id: `f${++counter}`,
              file,
              status: invalid ? ('failed' as const) : ('queued' as const),
              errorCode: invalid ?? undefined,
            };
          }),
        ],
      })),

    remove: (id) =>
      set((s) => {
        const entry = s.entries.find((e) => e.id === id);
        return {
          entries: s.entries.filter((e) => e.id !== id),
          items: entry?.documentId ? s.items.filter((it) => it.documentId !== entry.documentId) : s.items,
        };
      }),

    // Sırayla işlenir: aynı anda çok sayıda AI isteği limitleri ve kotayı zorlar.
    processAll: async (userId) => {
      for (const entry of get().entries.filter((e) => e.status === 'queued')) {
        await processOne(entry, userId);
      }
    },

    retry: async (id, userId) => {
      const entry = get().entries.find((e) => e.id === id);
      if (entry && validateFile(entry.file) === null) await processOne(entry, userId);
    },

    updateItem: (key, patch) => set((s) => ({ items: s.items.map((it) => (it.key === key ? patch(it) : it)) })),

    toggleItem: (key) =>
      set((s) => ({
        excluded: s.excluded.includes(key) ? s.excluded.filter((k) => k !== key) : [...s.excluded, key],
      })),

    reset: () => set({ entries: [], items: [], excluded: [] }),
  };
});
