#!/usr/bin/env bash
# start.sh'in başlattığı servisleri (süreç gruplarıyla birlikte) durdurur.
# Kullanım: LOG_DIR=<start.sh çıktısındaki klasör> scripts/local-stack/stop.sh
set -uo pipefail
PIDS="${LOG_DIR:?LOG_DIR gerekli}/pids"
[ -f "$PIDS" ] || { echo "pids dosyası yok: $PIDS"; exit 0; }
while read -r pid; do
  [ -n "$pid" ] && kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
done <"$PIDS"
rm -f "$PIDS"
echo "durduruldu"
