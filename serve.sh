#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')

echo "Serveur lancé sur http://localhost:$PORT"
open "http://localhost:$PORT" 2>/dev/null || true

python3 -m http.server "$PORT"
