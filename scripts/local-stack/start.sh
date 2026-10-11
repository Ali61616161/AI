#!/usr/bin/env bash
# Yerel test ortamını başlatır: boş bir veritabanına migration'ları uygular,
# PostgREST'i, istenen Edge Function'ı ve Supabase taklidi geçidi çalıştırır.
#
# Gerekenler: PostgreSQL + PostGIS (PGHOST/PGPORT/PGUSER), postgrest ikili dosyası
# (POSTGREST_BIN), Deno (npx deno).
#
# Kullanım:
#   POSTGREST_BIN=/yol/postgrest PGHOST=/tmp PGPORT=5432 scripts/local-stack/start.sh [fonksiyon-adı]
#
# Uygulamayı bu ortama bağlamak için çıktıdaki EXPO_PUBLIC_* değerlerini kullanın.
# SADECE yerel geliştirme ve test içindir.
set -euo pipefail
cd "$(dirname "$0")/../.."

FUNCTION="${1:-generate-itinerary}"
DB="${DEV_DB:-yola_dev}"
export DEV_DB="$DB"
export JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-must-be-32-chars-long}"
POSTGREST_PORT=54330
GATEWAY_PORT=54321
LOG_DIR="${LOG_DIR:-$(mktemp -d)}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=error"

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f tests/db/supabase_stubs.sql
for m in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$DB" -f "$m"; done
"${PSQL[@]}" -d postgres <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'authenticator' noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
SQL

cat > "$LOG_DIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:authenticator@127.0.0.1:${PGPORT:-5432}/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = $POSTGREST_PORT
CONF

"${POSTGREST_BIN:?POSTGREST_BIN gerekli}" "$LOG_DIR/postgrest.conf" >"$LOG_DIR/postgrest.log" 2>&1 &
echo $! >"$LOG_DIR/pids"

ANON_KEY=$(node -e "
const c=require('crypto');const b=(o)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'anon',iss:'local',exp:Math.floor(Date.now()/1000)+3650*86400});
console.log(h+'.'+p+'.'+c.createHmac('sha256',process.env.JWT_SECRET).update(h+'.'+p).digest('base64url'))")

(cd supabase/functions && SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" SUPABASE_ANON_KEY="$ANON_KEY" \
  npx deno run --allow-net --allow-env --allow-read "$FUNCTION/index.ts" >"$LOG_DIR/function.log" 2>&1) &
echo $! >>"$LOG_DIR/pids"

GATEWAY_PORT=$GATEWAY_PORT node scripts/local-stack/gateway.mjs >"$LOG_DIR/gateway.log" 2>&1 &
echo $! >>"$LOG_DIR/pids"

for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://127.0.0.1:$POSTGREST_PORT/" && curl -s -o /dev/null "http://127.0.0.1:$GATEWAY_PORT/auth/v1/otp" -X POST && break
  sleep 0.5
done

echo "LOG_DIR=$LOG_DIR"
echo "EXPO_PUBLIC_SUPABASE_URL=http://localhost:$GATEWAY_PORT"
echo "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY"
echo "Durdurmak için: kill \$(cat $LOG_DIR/pids)"
