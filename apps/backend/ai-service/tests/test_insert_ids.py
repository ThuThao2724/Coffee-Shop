"""The report-service tables ai-service writes to are created by Prisma, which generates ids in the
client (`@default(cuid())`): the id columns have no database default. An INSERT without an id fails
with a NOT NULL violation, and ai-service swallowed that error, so nothing was ever stored."""

import re
import uuid
from pathlib import Path

import app.main as main

MAIN_SOURCE = Path(main.__file__).read_text(encoding="utf-8")


class _FakeCursor:
    def __init__(self, calls):
        self.calls = calls

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeConnection:
    def __init__(self, calls):
        self.calls = calls

    def cursor(self):
        return _FakeCursor(self.calls)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_every_insert_sends_an_id():
    inserts = re.findall(r"INSERT INTO\s+(\w+)\s*\(([^)]*)\)", MAIN_SOURCE)
    assert inserts, "expected INSERT statements in app/main.py"
    missing = [table for table, columns in inserts if columns.split(",")[0].strip() != "id"]
    assert missing == [], f"INSERT without an id column: {missing}"


def test_log_audit_inserts_a_row_with_a_uuid(monkeypatch):
    calls = []
    monkeypatch.setattr(main, "REPORT_DATABASE_URL", "postgresql://fake")
    monkeypatch.setattr(main.psycopg, "connect", lambda *a, **k: _FakeConnection(calls))

    main.log_audit("/api/ai/anomalies", "list", True, "branch-a")

    assert len(calls) == 1
    sql, params = calls[0]
    assert re.search(r"INSERT INTO ai_audit_log \(id,", sql)
    assert sql.count("%s") == len(params)
    uuid.UUID(params[0])
    assert params[1] == "branch-a"


def test_new_row_ids_are_unique():
    assert len({main.new_row_id() for _ in range(100)}) == 100
