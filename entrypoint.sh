#!/bin/sh

# 1. Jalankan UDP Relay di background
node server.js &

# 2. Jalankan Cloudflare Tunnel
if [ -n "$TUNNEL_TOKEN" ]; then
  # Jika pakai Named Tunnel (pakai Token)
  echo "[ARGO] Starting Named Tunnel with Token..."
  exec cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN"
else
  # Jika pakai Quick Tunnel (domain acak trycloudflare.com)
  echo "[ARGO] Starting Quick Tunnel..."
  exec cloudflared tunnel --no-autoupdate --url tcp://localhost:8880
fi
