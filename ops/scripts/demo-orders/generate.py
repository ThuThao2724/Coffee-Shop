"""Generate realistic demo orders and payments for revenue reports and AI analysis.

Usage:  python generate.py <workdir> [--days 181] [--end YYYY-MM-DD]

Reads <workdir>/tables.csv and <workdir>/menu.csv (written by run.sh export) and writes
orders.csv, order_items.csv and payments.csv there. Every id starts with "demo_" so the whole
set can be removed with remove.sql. Times are generated in shop time (UTC+7) and stored as naive
UTC, like the services store them. The random seed is fixed, so a run is reproducible.

Patterns (so forecasts have something to learn): morning/lunch/afternoon/evening peaks per
branch, busier weekends, a growth trend, rainy days (fewer guests, more hot drinks), holidays,
time-of-day item mix, size/ice/sugar options, cash vs SePay with SePay growing, ~2% cancelled.
"""
import argparse
import csv
import json
import random
import string
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

rng = random.Random(20261118)
TZ_OFFSET = timedelta(hours=7)

# Known branches of this shop get their own rhythm; any other branch uses DEFAULT_PROFILE.
OFFICE_PROFILE = {  # office area: strong morning rush
    'base': 58,
    'hours': {7: 9, 8: 12, 9: 9, 10: 5, 11: 6, 12: 8, 13: 6, 14: 4, 15: 6, 16: 6, 17: 4, 18: 4, 19: 6, 20: 6, 21: 3},
    'rain_mult': 0.9,
}
RIVERSIDE_PROFILE = {  # terrace by the river: slow mornings, busy afternoons and evenings
    'base': 36,
    'hours': {7: 3, 8: 5, 9: 6, 10: 5, 11: 5, 12: 6, 13: 5, 14: 5, 15: 8, 16: 9, 17: 8, 18: 7, 19: 10, 20: 10, 21: 6},
    'rain_mult': 0.84,
}
BRANCH_PROFILES = {
    '5771ec7d-56ec-4c1b-aa94-ea30a14e0528': OFFICE_PROFILE,      # Chi nhanh Trung Tam
    '104aeb39-4582-4b88-bbce-6fc17ee3b414': RIVERSIDE_PROFILE,   # Chi nhanh Riverside
}
DEFAULT_PROFILE = {**OFFICE_PROFILE, 'base': 40}

WEEKEND_HOUR_BOOST = {9: 1.4, 10: 1.6, 11: 1.3, 15: 1.3, 16: 1.3, 7: 0.7, 8: 0.75}
DOW_MULT = {0: 0.88, 1: 0.90, 2: 0.94, 3: 0.97, 4: 1.06, 5: 1.28, 6: 1.22}   # Mon..Sun
RAIN_PROB = {1: 0.05, 2: 0.05, 3: 0.08, 4: 0.15, 5: 0.35, 6: 0.45, 7: 0.50, 8: 0.55, 9: 0.60,
             10: 0.50, 11: 0.30, 12: 0.12}
SPECIAL_DAYS = {  # (month, day): multiplier
    (6, 1): 1.15,    # Quoc te Thieu nhi
    (9, 1): 1.20,    # nghi le Quoc khanh
    (9, 2): 1.45,    # Quoc khanh
    (9, 25): 1.25,   # Trung thu 2026
    (10, 20): 1.30,  # Phu nu Viet Nam
    (3, 8): 1.25,    # Quoc te Phu nu
    (2, 14): 1.30,   # Valentine
}

DAYPART_WEIGHTS = {
    'morning': {'Ca phe sua': 22, 'Ca phe den': 18, 'Bac xiu': 15, 'Espresso': 8, 'Cappuccino': 8, 'Latte': 8,
                'Croissant': 13, 'Tra dao': 4, 'Matcha Latte': 3, 'Sinh to bo': 2},
    'noon': {'Ca phe sua': 14, 'Tra dao': 15, 'Bac xiu': 10, 'Latte': 8, 'Matcha Latte': 8, 'Sinh to bo': 11,
             'Cappuccino': 7, 'Ca phe den': 9, 'Croissant': 5, 'Espresso': 4},
    'afternoon': {'Tra dao': 19, 'Sinh to bo': 15, 'Matcha Latte': 14, 'Latte': 10, 'Cappuccino': 9,
                  'Ca phe sua': 10, 'Bac xiu': 8, 'Croissant': 6, 'Ca phe den': 5, 'Espresso': 3},
    'evening': {'Tra dao': 15, 'Latte': 12, 'Matcha Latte': 12, 'Cappuccino': 10, 'Sinh to bo': 10,
                'Ca phe sua': 10, 'Bac xiu': 9, 'Ca phe den': 6, 'Espresso': 5, 'Croissant': 5},
}
HOT_DRINKS = {'Ca phe den', 'Cappuccino', 'Latte', 'Espresso'}
HOT_ONLY = {'Espresso'}
FOOD = {'Croissant'}
SIZE_DELTA = {'S': 0, 'M': 5000, 'L': 10000}


def daypart(hour: int) -> str:
    if hour < 11:
        return 'morning'
    if hour < 14:
        return 'noon'
    if hour < 18:
        return 'afternoon'
    return 'evening'


def pick(weights: dict):
    keys = list(weights)
    return rng.choices(keys, weights=[weights[k] for k in keys], k=1)[0]


def new_id(prefix: str, used: set) -> str:
    while True:
        value = prefix + ''.join(rng.choices(string.ascii_lowercase + string.digits, k=12))
        if value not in used:
            used.add(value)
            return value


def fmt(ts: datetime) -> str:
    return ts.strftime('%Y-%m-%d %H:%M:%S')


def item_options(name: str, rainy: bool):
    if name in FOOD:
        heat = 'warm_up' if rng.random() < (0.6 if rainy else 0.4) else 'serve_now'
        return {'selections': {'heat': heat, 'note': ''}, 'extraAmount': 0}, 0
    size = rng.choices(['S', 'M', 'L'], weights=[58, 32, 10], k=1)[0]
    selections = {'size': size}
    if name not in HOT_ONLY:
        selections['ice'] = rng.choices(['normal_ice', 'less_ice', 'no_ice'], weights=[55, 30, 15], k=1)[0]
        selections['sugar'] = rng.choices(['normal_sugar', 'less_sugar', 'no_sugar'], weights=[50, 38, 12], k=1)[0]
    selections['note'] = ''
    delta = SIZE_DELTA[size]
    return {'selections': selections, 'extraAmount': delta}, delta


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('workdir')
    parser.add_argument('--days', type=int, default=181)
    parser.add_argument('--end', help='last day (YYYY-MM-DD), default: yesterday')
    args = parser.parse_args()
    work = Path(args.workdir)
    end = date.fromisoformat(args.end) if args.end else date.today() - timedelta(days=1)
    start = end - timedelta(days=args.days - 1)

    tables = defaultdict(list)
    with open(work / 'tables.csv', encoding='utf-8') as fh:
        for branch_id, table_id, _number in csv.reader(fh):
            tables[branch_id].append(table_id)
    menu = defaultdict(dict)
    with open(work / 'menu.csv', encoding='utf-8') as fh:
        for branch_id, item_id, name, price in csv.reader(fh):
            menu[branch_id][name] = (item_id, int(price))
    branches = [b for b in menu if tables.get(b)]
    if not branches:
        raise SystemExit('No branch has both tables and menu items.')

    used_ids: set = set()
    orders, items, payments = [], [], []
    total_days = (end - start).days
    rainy_count = 0

    day = start
    while day <= end:
        progress = (day - start).days / max(1, total_days)
        rainy = rng.random() < RAIN_PROB.get(day.month, 0.3)
        rainy_count += rainy
        weekend = day.weekday() >= 5
        for branch_id in branches:
            profile = BRANCH_PROFILES.get(branch_id, DEFAULT_PROFILE)
            mult = (0.86 + 0.28 * progress) * DOW_MULT[day.weekday()] * SPECIAL_DAYS.get((day.month, day.day), 1.0)
            if rainy:
                mult *= profile['rain_mult']
            count = max(5, round(profile['base'] * mult * rng.gauss(1.0, 0.08)))
            hours = dict(profile['hours'])
            if weekend:
                hours = {h: w * WEEKEND_HOUR_BOOST.get(h, 1.0) for h, w in hours.items()}
            if rainy:
                hours = {h: w * (0.7 if 14 <= h <= 19 else 1.0) for h, w in hours.items()}
            sepay_share = 0.30 + 0.20 * progress   # bank transfers grow over time
            for _ in range(count):
                hour = pick(hours)
                local = datetime(day.year, day.month, day.day, hour, rng.randrange(60), rng.randrange(60))
                created = local - TZ_OFFSET
                order_id = new_id('demo_o_', used_ids)
                weights = {n: w for n, w in DAYPART_WEIGHTS[daypart(hour)].items() if n in menu[branch_id]}
                for name in menu[branch_id]:
                    weights.setdefault(name, 3)   # items outside the built-in list still sell a little
                if rainy:
                    weights = {n: w * (1.25 if n in HOT_DRINKS else 1.0) for n, w in weights.items()}
                lines = rng.choices([1, 2, 3, 4], weights=[52, 31, 13, 4], k=1)[0]
                chosen = []
                for _ in range(lines):
                    name = pick(weights)
                    if name not in chosen:
                        chosen.append(name)
                cancelled = rng.random() < 0.02
                subtotal = 0
                for name in chosen:
                    item_id, base = menu[branch_id][name]
                    qty = rng.choices([1, 2, 3], weights=[76, 19, 5], k=1)[0]
                    options, delta = item_options(name, rainy)
                    unit = base + delta   # like order-service: stored price includes the size surcharge
                    subtotal += unit * qty
                    items.append({
                        'id': new_id('demo_i_', used_ids), 'orderId': order_id, 'menuItemId': item_id,
                        'quantity': qty, 'price': unit, 'note': '',
                        'options': json.dumps(options, separators=(',', ':')),
                        'status': 'WAITING' if cancelled else 'DONE',
                    })
                served = created + timedelta(minutes=rng.randint(8, 25))
                paid_at = served + timedelta(minutes=rng.randint(5, 40))
                table_id = rng.choice(tables[branch_id])
                orders.append({
                    'id': order_id, 'tableId': table_id, 'branchId': branch_id,
                    'status': 'CANCELLED' if cancelled else 'COMPLETED',
                    'subtotalAmount': subtotal, 'discountAmount': 0, 'pointsEarned': 0, 'totalAmount': subtotal,
                    'createdAt': fmt(created),
                    'updatedAt': fmt(created + timedelta(minutes=rng.randint(2, 6)) if cancelled else paid_at),
                })
                if cancelled:
                    continue
                sepay = rng.random() < sepay_share
                payments.append({
                    'id': new_id('demo_p_', used_ids), 'orderId': order_id, 'tableId': table_id,
                    'amount': subtotal, 'status': 'PAID', 'provider': 'SEPAY' if sepay else 'CASH',
                    'transactionId': ('FT26' + ''.join(rng.choices(string.digits, k=10))) if sepay else '',
                    'transferContent': f'DH{order_id[-6:].upper()}' if sepay else '',
                    'paidAt': fmt(paid_at), 'createdAt': fmt(paid_at - timedelta(minutes=rng.randint(1, 4))),
                    'updatedAt': fmt(paid_at),
                })
        day += timedelta(days=1)

    def write(name, rows, columns):
        with open(work / name, 'w', encoding='utf-8', newline='') as fh:
            writer = csv.DictWriter(fh, fieldnames=columns, lineterminator='\n')
            writer.writeheader()
            for row in rows:
                writer.writerow({c: row.get(c, '') for c in columns})

    write('orders.csv', orders, ['id', 'tableId', 'branchId', 'status', 'subtotalAmount', 'discountAmount',
                                 'pointsEarned', 'totalAmount', 'createdAt', 'updatedAt'])
    write('order_items.csv', items, ['id', 'orderId', 'menuItemId', 'quantity', 'price', 'note', 'options', 'status'])
    write('payments.csv', payments, ['id', 'orderId', 'tableId', 'amount', 'status', 'provider', 'transactionId',
                                     'transferContent', 'paidAt', 'createdAt', 'updatedAt'])

    completed = [o for o in orders if o['status'] == 'COMPLETED']
    by_branch = defaultdict(lambda: [0, 0])
    for o in completed:
        by_branch[o['branchId']][0] += 1
        by_branch[o['branchId']][1] += o['totalAmount']
    print(f'{start} -> {end}: {total_days + 1} days ({rainy_count} rainy), orders={len(orders)} '
          f'completed={len(completed)} items={len(items)} payments={len(payments)}')
    for branch_id, (n, revenue) in by_branch.items():
        print(f'  {branch_id}: {n} orders, revenue {revenue:,} VND, {n / (total_days + 1):.1f}/day')


if __name__ == '__main__':
    main()
