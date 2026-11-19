#!/usr/bin/env bash
# Spustí migrace + seed + RLS testy proti čistému PostgreSQL (bez Dockeru / Supabase CLI).
# Použití: DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres scripts/test-db-local.sh
# S Supabase CLI použij místo toho: npm run db:test
set -euo pipefail
BASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
DB="haccp_test_$$"
ADMIN_URL="$BASE_URL"
psql "$ADMIN_URL" -qc "create database $DB" >/dev/null
trap 'psql "$ADMIN_URL" -qc "drop database if exists $DB with (force)" >/dev/null' EXIT
URL="${BASE_URL%/*}/$DB"
run() { psql "$URL" -v ON_ERROR_STOP=1 -q -f "$1" >/dev/null; echo "✓ $1"; }
run supabase/tests/shim/supabase_shim.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
for f in supabase/tests/*.test.sql; do
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f"
  echo "✓ $f"
done
