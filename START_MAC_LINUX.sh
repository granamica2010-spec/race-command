#!/usr/bin/env sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js non trovato. Installa Node.js 22 o più recente: https://nodejs.org"
  exit 1
fi
node server.js
