from fastapi.testclient import TestClient

import app.main as main

MANAGER = {'x-actor-role': 'MANAGER', 'x-actor-branch-id': 'branch-a', 'x-actor-user-id': 'm1'}
LOCAL_TS = """((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')"""


def test_hourly_profile_reads_hours_in_shop_time(monkeypatch):
    # createdAt is stored as UTC: a 07:30 morning order is 00:30 in the database. The profile must
    # convert it before taking the hour, otherwise the morning rush falls outside 6h-22h.
    captured: list[str] = []

    def fake_sql(_url, sql, _params=None):
        captured.append(sql)
        return [{'dow': 1, 'h': 7, 'revenue': 300000, 'orders': 5, 'days': 1}]

    monkeypatch.setattr(main, 'ORDER_DATABASE_URL', 'postgresql://example.invalid/orderdb')
    monkeypatch.setattr(main, 'execute_sql_with_url', fake_sql)

    response = TestClient(main.app).get('/api/ai/forecast/hourly-profile?branchId=branch-a', headers=MANAGER)

    assert response.status_code == 200
    sql = captured[0]
    assert f'EXTRACT(HOUR FROM {LOCAL_TS})' in sql
    assert f'EXTRACT(DOW FROM {LOCAL_TS})' in sql
    assert 'EXTRACT(HOUR FROM o."createdAt")' not in sql


def test_daily_revenue_history_groups_by_shop_day(monkeypatch):
    captured: list[str] = []

    def fake_sql(_url, sql, _params=None):
        captured.append(sql)
        return []

    monkeypatch.setattr(main, 'ORDER_DATABASE_URL', 'postgresql://example.invalid/orderdb')
    monkeypatch.setattr(main, 'execute_sql_with_url', fake_sql)

    main.historical_daily_revenue('branch-a', 30)

    assert f'DATE{LOCAL_TS}' in captured[0]
    assert 'DATE(o."createdAt")' not in captured[0]
