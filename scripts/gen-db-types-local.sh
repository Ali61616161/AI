#!/usr/bin/env bash
# Tipleri Supabase projesi olmadan, yerel PostgreSQL + PostGIS üzerinde üretir:
# migration'lar boş bir veritabanına uygulanır ve Supabase CLI o veritabanından okur.
# Kullanım: PGHOST=/tmp PGPORT=5432 PGUSER=postgres scripts/gen-db-types-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=yola_types
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=error"
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f tests/db/supabase_stubs.sql
for m in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$DB" -f "$m"; done
OUT=$(mktemp)
npx supabase gen types typescript \
  --db-url "postgresql://${PGUSER:-postgres}@127.0.0.1:${PGPORT:-5432}/$DB?sslmode=disable" \
  --schema public > "$OUT"
{ echo '// Bu dosya otomatik üretilir, elle düzenlemeyin. Şema değişince: npm run db:types'; echo; cat "$OUT"; } > src/types/database.ts
npx prettier --single-quote --print-width 110 --write src/types/database.ts >/dev/null
rm -f "$OUT"
echo "src/types/database.ts güncellendi"
