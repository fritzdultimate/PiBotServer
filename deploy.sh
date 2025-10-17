#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/root/PiBotServer"
LOGFILE="/root/PiBotServer/deploy.log"
BRANCH="main"

# simple lock to prevent concurrent runs
LOCKFILE="/tmp/deploy.lock"
if [ -e "$LOCKFILE" ] && kill -0 "$(cat "$LOCKFILE")" 2>/dev/null; then
  echo "Another deploy in progress (pid $(cat $LOCKFILE)). Exiting." | tee -a "$LOGFILE"
  exit 0
fi
echo $$ > "$LOCKFILE"

{
  echo "=== Deploy started at $(date -u) ==="

  cd "$REPO_DIR" || { echo "Repo dir not found"; rm -f "$LOCKFILE"; exit 1; }

  # ensure clean working tree
  git fetch origin "$BRANCH" --quiet
  git reset --hard "origin/$BRANCH" --quiet

  echo "Installing dependencies..."
  if [ -f package-lock.json ]; then
    npm ci --silent
  else
    npm install --silent
  fi

  # optional build step (uncomment if you have a build)
  if grep -q "\"build\":" package.json 2>/dev/null; then
    echo "Running build..."
    npm run build --silent
  fi

  echo "Restarting app with pm2..."
  # restart only your main process name (replace mainServer if different)
  pm2 restart mainServer || pm2 start server.js --name mainServer --cwd "$REPO_DIR"

  echo "✅ Deployment complete at $(date -u)"
  echo
} >> "$LOGFILE" 2>&1

rm -f "$LOCKFILE"
