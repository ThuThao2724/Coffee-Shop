import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import main
from app.main import authorize_request, validate_generated_sql


def make_request(headers: dict[str, str]) -> Request:
    raw = [(key.lower().encode(), value.encode()) for key, value in headers.items()]
    return Request({"type": "http", "method": "GET", "path": "/", "headers": raw, "query_string": b""})


# ---- L22: LLM-generated SQL must stay inside the report tables -------------------------------

@pytest.mark.parametrize(
    "sql",
    [
        "SELECT COALESCE(SUM(revenue), 0) AS revenue FROM daily_revenue WHERE date >= CURRENT_DATE - 7",
        'SELECT "menuItemId", SUM(quantity)::int AS qty FROM item_sales GROUP BY "menuItemId" ORDER BY qty DESC LIMIT 5',
        'SELECT COUNT(*)::int AS count FROM anomaly_alert WHERE "isResolved" = false',
        'SELECT a.severity FROM anomaly_alert a JOIN sales_forecast f ON f."branchId" = a."branchId"',
    ],
)
def test_validate_generated_sql_accepts_report_queries(sql):
    assert validate_generated_sql(sql) is not None


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT usename, passwd FROM pg_shadow",
        "SELECT pg_read_file('/etc/passwd')",
        "SELECT * FROM information_schema.tables",
        "SELECT * FROM users",
        "SELECT * INTO leaked FROM daily_revenue",
        "SELECT current_setting('data_directory')",
        "SELECT version()",
        "SELECT * FROM dblink('dbname=userdb', 'select 1') AS t(x int)",
        "SELECT 1",
        "SELECT revenue FROM daily_revenue /* hidden */",
        "SELECT * FROM daily_revenue; DROP TABLE daily_revenue",
    ],
)
def test_validate_generated_sql_rejects_escapes(sql):
    assert validate_generated_sql(sql) is None


# ---- L12: role/branch enforcement -------------------------------------------------------------

def test_missing_role_is_rejected_when_rbac_enforced(monkeypatch):
    monkeypatch.setattr(main, "AI_ENFORCE_RBAC", True)
    monkeypatch.setattr(main, "AI_ALLOW_LEGACY_NO_AUTH", False)
    with pytest.raises(HTTPException) as err:
        authorize_request(make_request({}), "b1", {"ADMIN", "MANAGER"})
    assert err.value.status_code == 401


def test_manager_is_bound_to_own_branch():
    manager = {"x-actor-role": "MANAGER", "x-actor-branch-id": "b1"}
    assert authorize_request(make_request(manager), "b1", {"ADMIN", "MANAGER"})["branchId"] == "b1"
    with pytest.raises(HTTPException) as err:
        authorize_request(make_request(manager), "b2", {"ADMIN", "MANAGER"})
    assert err.value.status_code == 403


def test_manager_without_branch_claim_is_rejected():
    with pytest.raises(HTTPException) as err:
        authorize_request(make_request({"x-actor-role": "MANAGER"}), "b2", {"ADMIN", "MANAGER"})
    assert err.value.status_code == 403


def test_admin_can_read_any_branch():
    admin = {"x-actor-role": "ADMIN"}
    assert authorize_request(make_request(admin), "b2", {"ADMIN", "MANAGER"})["role"] == "ADMIN"


def test_report_chat_ignores_role_claimed_in_body(monkeypatch):
    """A manager claiming role=ADMIN in the body must not get the SQL (admin-only) in the response."""
    monkeypatch.setattr(main, "AI_ENFORCE_RBAC", True)
    monkeypatch.setattr(main, "AI_ALLOW_LEGACY_NO_AUTH", False)
    from fastapi.testclient import TestClient

    client = TestClient(main.app)
    response = client.post(
        "/api/ai/report-chat",
        headers={"x-actor-role": "MANAGER", "x-actor-branch-id": "b1"},
        json={"branchId": "b1", "role": "ADMIN", "question": "Doanh thu hom nay la bao nhieu?"},
    )
    assert response.status_code == 200
    assert response.json().get("sql") is None
