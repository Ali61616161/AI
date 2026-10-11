// Google'a gönderilen isteği ve okunan yanıt alanlarını resmi discovery şemasının
// alt kümesiyle (schema.json) karşılaştırır. Testlerde ve yerel test ikizinde kullanılır.
import schema from './schema.json' with { type: 'json' };

type Prop = string | null | { enum: string[] };
type Schemas = Record<string, Record<string, Prop>>;

export const GOOGLE_SCHEMA = schema as unknown as {
  places: { schemas: Schemas; methods: Record<string, string[]> };
  weather: { schemas: Schemas; methods: Record<string, string[]> };
};

/** Nesnedeki her alanın şemada olduğunu ve enum değerlerinin geçerli olduğunu doğrular. */
export function validateObject(schemas: Schemas, name: string, value: unknown, path = ''): string[] {
  const props = schemas[name];
  if (!props) return [`${path || name}: schema ${name} not in subset`];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path || name}: expected object`];
  const errors: string[] = [];
  for (const [key, v] of Object.entries(value)) {
    const at = path ? `${path}.${key}` : key;
    if (!(key in props)) {
      errors.push(`${at}: unknown field`);
      continue;
    }
    const prop = props[key];
    const values = Array.isArray(v) ? v : [v];
    if (prop && typeof prop === 'object') {
      for (const x of values) if (!prop.enum.includes(String(x))) errors.push(`${at}: invalid enum value ${x}`);
    } else if (typeof prop === 'string') {
      for (const x of values) errors.push(...validateObject(schemas, prop, x, at));
    }
  }
  return errors;
}

/** "a.b.c" yolunun şemada var olduğunu doğrular (alan maskesi ve okunan alanlar için). */
export function validatePath(schemas: Schemas, root: string, path: string): string | null {
  let current: string | null = root;
  for (const part of path.split('.')) {
    if (!current || !schemas[current]) return `${path}: cannot resolve ${part}`;
    if (!(part in schemas[current])) return `${path}: unknown field ${part}`;
    const prop: Prop = schemas[current][part];
    current = typeof prop === 'string' ? prop : null;
  }
  return null;
}

/** Weather GET isteğinin yolunu ve sorgu parametrelerini doğrular ("key" standart parametredir). */
export function validateWeatherUrl(url: string): string[] {
  const u = new URL(url);
  const params = GOOGLE_SCHEMA.weather.methods[u.pathname.slice(1)];
  if (!params) return [`${u.pathname}: unknown method`];
  return [...u.searchParams.keys()].filter((k) => k !== 'key' && !params.includes(k)).map((k) => `${k}: unknown query parameter`);
}
