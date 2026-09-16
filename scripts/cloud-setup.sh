#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd -- "${script_directory}/.." && pwd)"
required_node="$(tr -d '[:space:]' < "${repository_root}/.nvmrc")"

cd "${repository_root}"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
fi

if [[ "$(node --version 2>/dev/null || true)" != "v${required_node}" ]]; then
  pnpm env use --global "${required_node}"
  hash -r
fi

corepack enable

if ! command -v pg_ctl >/dev/null 2>&1 && ! command -v pg_config >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y postgresql
  else
    echo "PostgreSQL server tools are required for the native database backend." >&2
    exit 1
  fi
fi

pnpm install --frozen-lockfile
node scripts/dev.mjs cloud-prepare

echo "Cloud setup complete. Run pnpm dev to initialize PostgreSQL and start Domainstack."
