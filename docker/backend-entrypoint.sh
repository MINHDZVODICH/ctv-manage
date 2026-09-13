#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "==> ERROR: DATABASE_URL environment variable is required." >&2
  exit 1
fi

echo "==> Running database migrations via Prisma CLI..."
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma
echo "==> Database migrations completed successfully."

exec "$@"
