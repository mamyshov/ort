#!/usr/bin/env bash
# Локальная база PostgreSQL для разработки (нужны серверные программы postgresql-16).
# Использование: db/dev-db.sh start | stop | reset | status
# Строка подключения: postgres://app@127.0.0.1:54329/ort_prep
set -euo pipefail

BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DATA=${PG_DATA:-/var/tmp/ort-prep-pg}
PORT=${PG_PORT:-54329}
DB=ort_prep
RUNAS=()
if [ "$(id -u)" = "0" ]; then RUNAS=(su postgres -s /bin/bash -c); fi

run() { if [ "${#RUNAS[@]}" -gt 0 ]; then "${RUNAS[@]}" "$*"; else bash -c "$*"; fi; }

init() {
  if [ ! -d "$DATA" ]; then
    mkdir -p "$DATA"; [ "$(id -u)" = "0" ] && chown postgres "$DATA"
    run "$BIN/initdb -D $DATA --auth=trust -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null"
  fi
}

start() {
  init
  run "$BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp -c listen_addresses=127.0.0.1' -l $DATA/server.log -w start >/dev/null" || true
  run "$BIN/psql -h 127.0.0.1 -p $PORT -U postgres -tAc \"select 1 from pg_roles where rolname='app'\"" | grep -q 1 \
    || run "$BIN/psql -h 127.0.0.1 -p $PORT -U postgres -c \"create role app login createrole\" >/dev/null"
  run "$BIN/psql -h 127.0.0.1 -p $PORT -U postgres -tAc \"select 1 from pg_database where datname='$DB'\"" | grep -q 1 \
    || run "$BIN/createdb -h 127.0.0.1 -p $PORT -U postgres -O app $DB"
  echo "postgres://app@127.0.0.1:$PORT/$DB"
}

stop() { run "$BIN/pg_ctl -D $DATA -m fast stop >/dev/null" || true; }

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  reset) stop; rm -rf "$DATA"; start ;;
  status) run "$BIN/pg_ctl -D $DATA status" ;;
  *) echo "Использование: $0 start|stop|reset|status"; exit 1 ;;
esac
