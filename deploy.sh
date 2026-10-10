#!/usr/bin/env bash
# Build the web version and publish it behind the server's Caddy.
# One-time: the Caddy container must mount DEPLOY_DIR (see docker-compose.yml on the server).
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "Missing .env (copy .env.example)"; exit 1; }
set -a; source .env; set +a

bun install --frozen-lockfile
bun run build

ssh "$DEPLOY_HOST" "mkdir -p '$DEPLOY_DIR'"
rsync -az --delete dist/ "$DEPLOY_HOST:$DEPLOY_DIR/"

sed "s|DOMAIN|$DOMAIN|; s|DEPLOY_DIR|$DEPLOY_DIR|" deploy/site.caddy \
  | ssh "$DEPLOY_HOST" "cat > $CADDY_SITES_DIR/$DOMAIN.caddy"
ssh "$DEPLOY_HOST" "docker exec $CADDY_CONTAINER caddy reload --config /etc/caddy/Caddyfile"

echo "Deployed to https://$DOMAIN"
