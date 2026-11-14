#!/usr/bin/env bash
# Pre-deploy check for the secrets in .env. Never prints a secret value.
#
#   bash scripts/check-deploy-env.sh            # checks ./.env
#   ENV_FILE=/path/to/.env bash scripts/check-deploy-env.sh
#
# Fails (exit 1) when a required secret is missing, still a known public/demo default, or too short.
# Warns (does not fail) about default database passwords. Ends with `docker compose config -q`.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
MIN_LEN=32

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL  missing env file: $ENV_FILE" >&2
  exit 1
fi

# Read KEY=VALUE without sourcing the file (no shell expansion, nothing echoed).
get_value() {
  local key="$1" line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}

# Values that are public (in the repo, docs or old compose defaults) and must never be used.
is_known_default() {
  case "$1" in
    dev-internal-token*|internal-service-token*|dev-jwt-secret*|secret|changeme|change-me|your-secret*|\
    demo_*|ci-only-*|CHANGE_ME*|change_me*|postgres|password|admin) return 0 ;;
    *) return 1 ;;
  esac
}

# True when the exact value is written in any file tracked by git (i.e. published with the repo).
appears_in_repo() {
  command -v git >/dev/null 2>&1 || return 1
  git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 1
  local hits
  # Capture instead of piping into `grep -q`: with pipefail, xargs exits 123 whenever one grep batch
  # has no match, which would hide a real hit.
  hits="$(git -C "$ROOT_DIR" ls-files -z | (cd "$ROOT_DIR" && xargs -0 grep -I -l -F -e "$1" -- 2>/dev/null) || true)"
  [[ -n "$hits" ]]
}

fail=0
check_secret() {
  local key="$1" value
  value="$(get_value "$key")"
  if [[ -z "$value" ]]; then
    echo "FAIL  $key is missing or empty"; fail=1
  elif (( ${#value} >= 16 )) && appears_in_repo "$value"; then
    echo "FAIL  $key equals a value written in a file of the repository (public); generate one: openssl rand -hex 32"; fail=1
  elif is_known_default "$value"; then
    echo "FAIL  $key is a public/demo default value; generate one: openssl rand -hex 32"; fail=1
  elif (( ${#value} < MIN_LEN )); then
    echo "FAIL  $key is too short (${#value} chars, need >= $MIN_LEN); generate one: openssl rand -hex 32"; fail=1
  else
    echo "OK    $key (${#value} chars)"
  fi
}

warn_password() {
  local key="$1" value
  value="$(get_value "$key")"
  if [[ -z "$value" ]]; then
    echo "WARN  $key not set (compose falls back to its default)"
  elif is_known_default "$value" || (( ${#value} < 16 )); then
    echo "WARN  $key looks weak/default; change it before exposing the server (plan: ALTER USER + every *_DATABASE_URL)"
  else
    echo "OK    $key"
  fi
}

echo "Checking $ENV_FILE"
check_secret JWT_SECRET
check_secret INTERNAL_SERVICE_TOKEN
for key in POSTGRES_PASSWORD USER_DB_PASSWORD TABLE_DB_PASSWORD; do
  warn_password "$key"
done

sepay_key="$(get_value SEPAY_IPN_API_KEY)"
if [[ -z "$sepay_key" ]]; then
  echo "WARN  SEPAY_IPN_API_KEY empty: SePay webhooks are not authenticated by API key"
fi

if [[ "$(get_value SEED_TEST_ACCOUNTS)" == "true" ]]; then
  echo "FAIL  SEED_TEST_ACCOUNTS=true resets the demo accounts (passwords published in the repo) on every start"; fail=1
fi

admin_pw="$(get_value BOOTSTRAP_ADMIN_PASSWORD)"
if [[ -n "$admin_pw" ]]; then
  if is_known_default "$admin_pw" || { (( ${#admin_pw} >= 8 )) && appears_in_repo "$admin_pw"; }; then
    echo "FAIL  BOOTSTRAP_ADMIN_PASSWORD is a public/demo value; choose your own"; fail=1
  elif (( ${#admin_pw} < 12 )); then
    echo "FAIL  BOOTSTRAP_ADMIN_PASSWORD is too short (${#admin_pw} chars, need >= 12)"; fail=1
  else
    echo "OK    BOOTSTRAP_ADMIN_PASSWORD (only used while no ADMIN exists; remove it after the first start)"
  fi
fi

if (( fail )); then
  echo "Deploy check FAILED: fix the items above in .env (then re-encrypt .env.enc if you deploy from it)." >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  (cd "$ROOT_DIR" && docker compose --env-file "$ENV_FILE" config -q)
  echo "OK    docker compose config"
fi
echo "Deploy check passed."
