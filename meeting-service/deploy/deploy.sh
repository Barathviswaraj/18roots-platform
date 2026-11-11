#!/usr/bin/env bash
# Run this on the laptop. It puts the whole service on one Ubuntu server over SSH,
# then builds an APK that points at it.
#
#   bash deploy/deploy.sh root@SERVER_IP               free hostnames from sslip.io
#   bash deploy/deploy.sh root@SERVER_IP example.com   needs DNS for api.example.com
#                                                      and livekit.example.com
#
# Safe to run again after a code change. Existing secrets are kept.
set -euo pipefail

SERVER=${1:?Usage: bash deploy/deploy.sh root@SERVER_IP [domain]}
DOMAIN=${2:-}
PUBLIC_IP=${SERVER#*@}
if ! [[ $PUBLIC_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Use the server's public IPv4 address, for example root@203.0.113.5" >&2
  exit 1
fi

if [ -n "$DOMAIN" ]; then
  API_DOMAIN="api.$DOMAIN"
  LIVEKIT_DOMAIN="livekit.$DOMAIN"
else
  API_DOMAIN="api-${PUBLIC_IP//./-}.sslip.io"
  LIVEKIT_DOMAIN="livekit-${PUBLIC_IP//./-}.sslip.io"
fi

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="$ROOT/deploy/.env"
REMOTE_DIR=18roots-meeting

node "$ROOT/mobile/scripts/make-hosted-env.js" >/dev/null

if [ ! -f "$ENV_FILE" ]; then
  (umask 077; cat > "$ENV_FILE" <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SECRET_KEY_BASE=$(openssl rand -hex 64)
LIVEKIT_API_KEY=API$(openssl rand -hex 8)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
EOF
  )
fi
sed -i -E '/^(PLATFORM_JWT_SECRET|PUBLIC_IP|API_DOMAIN|LIVEKIT_DOMAIN)=/d' "$ENV_FILE"
cat >> "$ENV_FILE" <<EOF
PLATFORM_JWT_SECRET=$(cat "$ROOT/.hosted-test-secret")
PUBLIC_IP=$PUBLIC_IP
API_DOMAIN=$API_DOMAIN
LIVEKIT_DOMAIN=$LIVEKIT_DOMAIN
EOF

echo "Uploading to $SERVER..."
tar -C "$ROOT" --exclude=api/log --exclude=api/tmp --exclude=api/storage -czf - api deploy |
  ssh "$SERVER" "rm -rf $REMOTE_DIR/api && mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"

echo "Installing and starting. The first build takes several minutes..."
ssh -t "$SERVER" "bash $REMOTE_DIR/deploy/server-setup.sh"

echo "Waiting for https://$API_DOMAIN/health/ready ..."
ready=""
for _ in $(seq 1 60); do
  if [ "$(curl -s -m 10 -o /dev/null -w '%{http_code}' "https://$API_DOMAIN/health/ready" || true)" = 200 ]; then
    ready=yes
    break
  fi
  sleep 5
done
if [ -z "$ready" ]; then
  echo "The API did not become ready. On the server, run: cd $REMOTE_DIR/deploy && docker compose logs --tail 50" >&2
  echo "Check that ports 80 and 443 (TCP), 7881 (TCP) and 7882 (UDP) are open in your provider's firewall." >&2
  exit 1
fi
echo "API is ready at https://$API_DOMAIN"

node "$ROOT/mobile/scripts/make-hosted-env.js" "https://$API_DOMAIN"
bash "$ROOT/mobile/scripts/build-hosted-apk.sh"
