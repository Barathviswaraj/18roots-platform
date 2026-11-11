#!/usr/bin/env bash
# Runs on the server. Installs Docker from Ubuntu's own packages, opens the
# firewall if ufw is on, then builds and starts every service.
set -euo pipefail
cd "$(dirname "$0")"

SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

if ! command -v docker >/dev/null 2>&1 || ! $SUDO docker compose version >/dev/null 2>&1; then
  $SUDO apt-get update -qq
  $SUDO apt-get install -y docker.io docker-compose-v2
  $SUDO systemctl enable --now docker
fi

if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
  for rule in 22/tcp 80/tcp 443/tcp 7881/tcp 7882/udp; do
    $SUDO ufw allow "$rule"
  done
fi

$SUDO docker compose up -d --build
$SUDO docker compose ps
