@echo off
cd /d %~dp0
set MUSE_DEMO_MODE=1
start http://localhost:8000
python server.py
