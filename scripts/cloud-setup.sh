#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd -- "${script_directory}/.." && pwd)"
required_node="$(tr -d '[:space:]' < "${repository_root}/.nvmrc")"
required_node_major="${required_node%%.*}"

cd "${repository_root}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js ${required_node} or newer is required; install Node before running cloud setup." >&2
  exit 1
fi

installed_node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if (( installed_node_major < required_node_major )); then
  echo "Node.js ${required_node} or newer is required (found $(node --version))." >&2
  exit 1
fi

corepack enable

add_postgres_to_path() {
  local postgres_bindir=""
  if command -v pg_config >/dev/null 2>&1; then
    postgres_bindir="$(pg_config --bindir)"
  elif compgen -G '/usr/lib/postgresql/*/bin' >/dev/null; then
    postgres_bindir="$(find /usr/lib/postgresql -mindepth 2 -maxdepth 2 -type d -name bin -print | sort -V | tail -1)"
  fi
  if [[ -n "${postgres_bindir}" ]]; then
    export PATH="${postgres_bindir}:${PATH}"
  fi
}

postgres_server_tools_available() {
  command -v pg_ctl >/dev/null 2>&1 &&
    command -v initdb >/dev/null 2>&1 &&
    command -v createdb >/dev/null 2>&1
}

add_postgres_to_path
if ! postgres_server_tools_available; then
  if command -v apt-get >/dev/null 2>&1; then
    if [[ "$(id -u)" -eq 0 ]]; then
      apt-get update
      apt-get install -y postgresql
    elif command -v sudo >/dev/null 2>&1; then
      sudo apt-get update
      sudo apt-get install -y postgresql
    else
      echo "PostgreSQL is missing and installation requires root access or sudo." >&2
      exit 1
    fi
    add_postgres_to_path
  else
    echo "PostgreSQL server tools are required for the native database backend." >&2
    exit 1
  fi
fi

if ! postgres_server_tools_available; then
  echo "PostgreSQL installation completed, but pg_ctl, initdb, or createdb is unavailable." >&2
  exit 1
fi

pnpm install --frozen-lockfile
node scripts/dev.mjs cloud-prepare

echo "Cloud setup complete. Run pnpm dev to initialize PostgreSQL and start Domainstack."
