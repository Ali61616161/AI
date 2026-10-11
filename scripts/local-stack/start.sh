#!/usr/bin/env bash
# Yerel test ortamını başlatır: boş bir veritabanına migration'ları uygular,
# PostgREST'i, Edge Function'ları ve Supabase taklidi geçidi çalıştırır.
#
# FAKE_GEMINI=1 verilirse Gemini ve Google Places/Weather yerine testler için
# öngörülebilir cevap veren test ikizleri (fake-gemini.mjs, fake-google.mjs)
# kullanılır; verilmezse GEMINI_API_KEY ve GOOGLE_MAPS_API_KEY ortamdan okunur.
#
# Gerekenler: PostgreSQL + PostGIS (PGHOST/PGPORT/PGUSER), postgrest ikili dosyası
# (POSTGREST_BIN), Deno (npx deno).
#
# Kullanım:
#   POSTGREST_BIN=/yol/postgrest PGHOST=/tmp PGPORT=5432 [FAKE_GEMINI=1] scripts/local-stack/start.sh
#
# Uygulamayı bu ortama bağlamak için çıktıdaki EXPO_PUBLIC_* değerlerini kullanın.
# SADECE yerel geliştirme ve test içindir.
set -euo pipefail
cd "$(dirname "$0")/../.."

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

# Her servis kendi süreç grubunda başlar; stop.sh grubu alt süreçleriyle birlikte durdurur.
setsid "${POSTGREST_BIN:?POSTGREST_BIN gerekli}" "$LOG_DIR/postgrest.conf" >"$LOG_DIR/postgrest.log" 2>&1 &
echo $! >"$LOG_DIR/pids"

ANON_KEY=$(node -e "
const c=require('crypto');const b=(o)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'anon',iss:'local',exp:Math.floor(Date.now()/1000)+3650*86400});
console.log(h+'.'+p+'.'+c.createHmac('sha256',process.env.JWT_SECRET).update(h+'.'+p).digest('base64url'))")

SERVICE_ROLE_KEY=$(node -e "
const c=require('crypto');const b=(o)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'service_role',iss:'local',exp:Math.floor(Date.now()/1000)+3650*86400});
console.log(h+'.'+p+'.'+c.createHmac('sha256',process.env.JWT_SECRET).update(h+'.'+p).digest('base64url'))")

if [ "${FAKE_GEMINI:-}" = "1" ]; then
  setsid node scripts/local-stack/fake-gemini.mjs >"$LOG_DIR/fake-gemini.log" 2>&1 &
  echo $! >>"$LOG_DIR/pids"
  export GEMINI_API_KEY=test-key GEMINI_API_BASE=http://127.0.0.1:54340
  setsid node scripts/local-stack/fake-google.mjs >"$LOG_DIR/fake-google.log" 2>&1 &
  echo $! >>"$LOG_DIR/pids"
  export REVENUECAT_SECRET_KEY=test-rc-secret REVENUECAT_WEBHOOK_AUTH=test-webhook-auth REVENUECAT_API_BASE=http://127.0.0.1:54341
  export GOOGLE_MAPS_API_KEY=test-key GOOGLE_PLACES_API_BASE=http://127.0.0.1:54341 GOOGLE_WEATHER_API_BASE=http://127.0.0.1:54341 GOOGLE_TRANSLATE_API_BASE=http://127.0.0.1:54341
fi

SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  setsid npx deno run --allow-net --allow-env --allow-read --config supabase/functions/deno.json \
  scripts/local-stack/functions-router.ts >"$LOG_DIR/functions.log" 2>&1 &
echo $! >>"$LOG_DIR/pids"

GATEWAY_PORT=$GATEWAY_PORT setsid node scripts/local-stack/gateway.mjs >"$LOG_DIR/gateway.log" 2>&1 &
echo $! >>"$LOG_DIR/pids"

for _ in $(seq 1 240); do
  curl -s -o /dev/null "http://127.0.0.1:$POSTGREST_PORT/" && curl -s -o /dev/null "http://127.0.0.1:$GATEWAY_PORT/auth/v1/otp" -X POST \
    && curl -s -o /dev/null "http://127.0.0.1:8000/replan" && break
  sleep 0.5
done

echo "LOG_DIR=$LOG_DIR"
echo "EXPO_PUBLIC_SUPABASE_URL=http://localhost:$GATEWAY_PORT"
echo "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY"
echo "$ANON_KEY" >"$LOG_DIR/anon-key"
echo "Durdurmak için: LOG_DIR=$LOG_DIR scripts/local-stack/stop.sh"
