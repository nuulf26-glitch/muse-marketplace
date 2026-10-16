#!/bin/bash
cd "$(dirname "$0")"
MUSE_DEMO_MODE=1 python3 server.py &
PID=$!
sleep 1
open "http://localhost:8000" 2>/dev/null || true
wait $PID
