#!/usr/bin/env bash
# Demo order data for reports and AI analysis. See README.md in this folder.
#
#   bash run.sh export <workdir>          # real tables and branch menus -> tables.csv, menu.csv
#   python generate.py <workdir>          # -> orders.csv, order_items.csv, payments.csv
#   bash run.sh load <workdir>            # replace earlier demo rows with the generated ones
#   bash run.sh remove                    # delete all demo rows
#
# Works with the docker compose stack: PG_CONTAINER (default coffe-shop-postgres-1) must run.
set -euo pipefail
export MSYS_NO_PATHCONV=1
PG_CONTAINER="${PG_CONTAINER:-coffe-shop-postgres-1}"
HERE="$(cd "$(dirname "$0")" && pwd)"

psql_db() { # db [psql args...]  (args are passed through as-is, never re-parsed by a shell)
  local db="$1"; shift
  docker exec -i "$PG_CONTAINER" sh -c 'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$@"' psql -d "$db" "$@"
}

cmd="${1:-}"
case "$cmd" in
  export)
    work="${2:?workdir}"; mkdir -p "$work"
    psql_db tabledb -At -F, -c 'select branch_id, id, number from tables where branch_id is not null order by 1, 3' > "$work/tables.csv"
    psql_db orderdb -At -F, -c 'select b."branchId", m.id, m.name, b.price from branch_menu_items b join menu_items m on m.id = b."menuItemId" where b."isAvailable" and m.available order by 1, 3' > "$work/menu.csv"
    echo "tables: $(wc -l < "$work/tables.csv"), menu rows: $(wc -l < "$work/menu.csv")"
    ;;
  load)
    work="${2:?workdir}"
    for f in orders.csv order_items.csv payments.csv; do
      [ -f "$work/$f" ] || { echo "missing $work/$f (run generate.py first)" >&2; exit 1; }
    done
    docker exec "$PG_CONTAINER" mkdir -p /tmp/demo-orders
    for f in orders.csv order_items.csv payments.csv; do docker cp "$work/$f" "$PG_CONTAINER:/tmp/demo-orders/$f" >/dev/null; done
    psql_db orderdb -At <<'SQL'
BEGIN;
DELETE FROM orders WHERE id LIKE 'demo\_o\_%';
COPY orders(id, "tableId", "branchId", status, "subtotalAmount", "discountAmount", "pointsEarned", "totalAmount", "createdAt", "updatedAt")
  FROM '/tmp/demo-orders/orders.csv' WITH (FORMAT csv, HEADER true);
COPY order_items(id, "orderId", "menuItemId", quantity, price, note, options, status)
  FROM '/tmp/demo-orders/order_items.csv' WITH (FORMAT csv, HEADER true);
COMMIT;
SQL
    psql_db paymentdb -At <<'SQL'
BEGIN;
DELETE FROM payments WHERE id LIKE 'demo\_p\_%';
COPY payments(id, "orderId", "tableId", amount, status, provider, "transactionId", "transferContent", "paidAt", "createdAt", "updatedAt")
  FROM '/tmp/demo-orders/payments.csv' WITH (FORMAT csv, HEADER true);
COMMIT;
SQL
    docker exec "$PG_CONTAINER" sh -c 'rm /tmp/demo-orders/orders.csv /tmp/demo-orders/order_items.csv /tmp/demo-orders/payments.csv && rmdir /tmp/demo-orders'
    echo "Loaded. Restart report-service to rebuild the report tables now: docker compose restart report-service"
    ;;
  remove)
    for db in orderdb paymentdb; do psql_db "$db" < "$HERE/remove.sql"; done
    echo "Removed. Restart report-service to rebuild the report tables now: docker compose restart report-service"
    ;;
  *)
    sed -n '2,9p' "$0"; exit 1 ;;
esac
