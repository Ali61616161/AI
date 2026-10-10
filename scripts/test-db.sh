#!/usr/bin/env bash
# Migration'ları boş bir PostgreSQL + PostGIS veritabanına uygulayıp şema testlerini çalıştırır.
# Supabase CLI veya Docker gerektirmez; Supabase'e özgü nesneler tests/db/supabase_stubs.sql
# ile taklit edilir.
#
# Kullanım: PGHOST=/tmp PGPORT=5432 PGUSER=postgres scripts/test-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
DB="${TEST_DB:-yola_schema_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
# Yerel sunucuda logical replication kapalı olabilir; publication uyarısını gizle.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=error"

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
trap '"${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null' EXIT

"${PSQL[@]}" -d "$DB" -f tests/db/supabase_stubs.sql
for migration in supabase/migrations/*.sql; do
  echo "→ $migration"
  "${PSQL[@]}" -d "$DB" -f "$migration"
done
"${PSQL[@]}" -d "$DB" -f tests/db/schema_test.sql
