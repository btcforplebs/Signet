#!/bin/sh
set -e

echo "Running database migrations..."
pnpm exec prisma migrate deploy

echo "Starting Signet..."
exec node ./dist/index.js "$@"
