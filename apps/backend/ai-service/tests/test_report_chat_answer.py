from fastapi.testclient import TestClient

import app.main as main

ADMIN = {'x-actor-role': 'ADMIN', 'x-actor-user-id': 'admin-1'}
TOP_ITEM_ROW = {'menuItemId': 'cm1', 'menuItemName': 'Ca phe sua', 'qty': 3000}


def _gemini_sql_path(monkeypatch, rows, summary):
    """Admin question answered by Gemini-written SQL; `summary` is what summarize_with_gemini does."""
    monkeypatch.setattr(main, 'AI_SENTIMENT_GEMINI_API_KEY', 'test-key')
    monkeypatch.setattr(main, 'REPORT_DATABASE_URL', 'postgresql://example.invalid/reportdb')
    monkeypatch.setattr(main, 'generate_sql_with_gemini', lambda _q, _b: 'SELECT 1')
    monkeypatch.setattr(main, 'validate_generated_sql', lambda sql: sql)
    monkeypatch.setattr(main, 'execute_untrusted_report_sql', lambda _sql: rows)
    monkeypatch.setattr(main, 'summarize_with_gemini', summary)
    monkeypatch.setattr(main, 'log_audit', lambda *args, **kwargs: None)


def _ask(question):
    return TestClient(main.app).post(
        '/api/ai/report-chat',
        json={'question': question, 'branchId': 'branch-a'},
        headers=ADMIN,
    ).json()


def test_a_slow_summary_still_answers_from_the_rows(monkeypatch):
    def timed_out(_question, _rows):
        raise TimeoutError('The read operation timed out')

    _gemini_sql_path(monkeypatch, [TOP_ITEM_ROW], timed_out)
    body = _ask('tháng nào khách đông nhất')

    assert body['isSuccessful'] is True
    assert body['rowCount'] == 1
    assert 'Ca phe sua' in body['answer']
    assert '3.000' in body['answer']
    assert 'Khong the' not in body['answer']


def test_the_gemini_summary_is_used_when_it_answers(monkeypatch):
    _gemini_sql_path(monkeypatch, [TOP_ITEM_ROW], lambda _q, _r: 'Cà phê sữa bán chạy nhất với 3.000 ly.')
    assert _ask('tháng nào khách đông nhất')['answer'] == 'Cà phê sữa bán chạy nhất với 3.000 ly.'


def test_a_failing_query_is_still_reported_as_an_error(monkeypatch):
    def broken(_sql):
        raise RuntimeError('relation does not exist')

    _gemini_sql_path(monkeypatch, [], lambda _q, _r: 'unused')
    monkeypatch.setattr(main, 'execute_untrusted_report_sql', broken)
    body = _ask('tháng nào khách đông nhất')

    assert body['isSuccessful'] is False
    assert body['answer'].startswith('Không thể thực hiện truy vấn')


def test_describe_rows_is_readable():
    assert main.describe_rows([TOP_ITEM_ROW]) == 'Dẫn đầu: Ca phe sua (số lượng 3.000).'
    two = main.describe_rows([
        {'date': '2026-11-16', 'revenue': 5200000},
        {'date': '2026-11-17', 'revenue': 4800000},
    ])
    assert two == 'Kết quả: 1. 16/11/2026 (doanh thu 5.200.000đ); 2. 17/11/2026 (doanh thu 4.800.000đ).'
    assert main.describe_rows([]).startswith('Không tìm thấy')
    forecast = main.describe_rows([{'forecastDate': '2026-11-24 00:00:00', 'predictedRevenue': 4564876}])
    assert forecast == 'Kết quả: 24/11/2026 (doanh thu dự báo 4.564.876đ).'
