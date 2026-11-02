#!/bin/sh
set -e
node src/migrate.ts
exec node src/index.ts