from fastapi.testclient import TestClient

from app.main import app


# ai-service refuses requests without the actor headers the gateway adds; act as an admin by default.
client = TestClient(app, headers={'x-actor-role': 'ADMIN', 'x-actor-user-id': 'contract-test'})


def test_health():
    response = client.get('/api/ai/health')
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'ok'


def test_live_and_ready():
    live = client.get('/api/ai/live')
    assert live.status_code == 200
    assert live.json().get('status') == 'alive'

    ready = client.get('/api/ai/ready')
    assert ready.status_code == 200
    assert ready.json().get('status') in ['ready', 'degraded']
    assert 'checks' in ready.json()


def test_quality_summary_contract():
    response = client.get('/api/ai/ops/quality-summary')
    assert response.status_code == 200
    payload = response.json()
    assert 'quality' in payload
    assert 'fallbackRatios' in payload
    assert 'modelQuality' in payload


def test_fallback_trend_contract():
    response = client.get('/api/ai/ops/fallback-trend', params={'windowMinutes': 60})
    assert response.status_code == 200
    payload = response.json()
    assert 'points' in payload
    assert isinstance(payload.get('points'), list)


def test_fallback_trend_summary_contract():
    response = client.get('/api/ai/ops/fallback-trend-summary', params={'windowMinutes': 120, 'threshold': 0.2})
    assert response.status_code == 200
    payload = response.json()
    assert 'items' in payload
    assert isinstance(payload.get('items'), list)
    if payload['items']:
        first = payload['items'][0]
        assert 'riskScore' in first
        assert 'priority' in first


def test_recommend_get_contract():
    response = client.get('/api/ai/recommend', params={'branchId': 'branch-e2e', 'limit': 3, 'sessionId': 'sess-a'})
    assert response.status_code == 200
    payload = response.json()
    assert payload['branchId'] == 'branch-e2e'
    assert len(payload['items']) == 3
    assert payload['strategy'] in ['popularity', 'hybrid-cf-popularity']
    assert payload.get('experiment', {}).get('group') in ['control', 'treatment']


def test_recommend_post_contract():
    response = client.post(
        '/api/ai/recommend',
        json={
            'branchId': 'branch-e2e',
            'cartItemIds': ['item-1', 'item-2'],
            'limit': 3,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['branchId'] == 'branch-e2e'
    assert len(payload['recommendations']) == 3
    assert payload['strategy'] in ['item-based-cf+popularity', 'popularity']
    assert payload.get('experiment', {}).get('group') in ['control', 'treatment']


def test_recommend_ab_summary_contract():
    client.post(
        '/api/ai/recommend/feedback',
        json={'branchId': 'branch-e2e', 'action': 'click', 'event': 'click', 'experimentGroup': 'treatment'},
    )
    response = client.get('/api/ai/recommend/ab-summary', params={'branchId': 'branch-e2e', 'lookbackHours': 24})
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('branchId') == 'branch-e2e'
    assert 'groups' in payload
    assert 'uplift' in payload
    assert 'significance' in payload
    assert 'decisionReady' in payload.get('significance', {})


def test_recommend_feedback_contract():
    response = client.post(
        '/api/ai/recommend/feedback',
        json={'branchId': 'branch-e2e', 'action': 'click', 'event': 'add_to_cart', 'experimentGroup': 'control'},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('event') == 'add_to_cart'
    assert payload.get('experimentGroup') in ['control', 'treatment']


def test_sentiment_analyze_contract():
    response = client.post(
        '/api/ai/sentiment/analyze',
        json={'branchId': 'branch-e2e', 'text': 'Phuc vu rat te va cho lau. Goi 0912345678'},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['label'] in ['POSITIVE', 'NEUTRAL', 'NEGATIVE']
    assert 'scores' in payload
    assert 'sanitized' in payload
    assert payload.get('source') in ['gemini', 'fallback']


def test_model_quality_contract():
    response = client.get('/api/ai/ops/model-quality')
    assert response.status_code == 200
    payload = response.json()
    assert 'sentiment' in payload
    assert 'ratios' in payload.get('sentiment', {})


def test_chat_contract():
    response = client.post(
        '/api/ai/chat',
        json={
            'sessionId': 's1',
            'tableId': 't1',
            'branchId': 'branch-e2e',
            'message': 'Khuyen mai hien tai la gi?',
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['intent'] in ['FAQ', 'ORDER', 'ESCALATE']
    assert isinstance(payload['confidence'], float)
    assert 'reply' in payload


def test_recommend_invalid_limit():
    response = client.get('/api/ai/recommend', params={'branchId': 'branch-e2e', 'limit': 99})
    assert response.status_code == 400
    assert 'limit' in response.json().get('detail', '')


def test_recommend_missing_branch():
    response = client.post(
        '/api/ai/recommend',
        json={
            'branchId': '',
            'cartItemIds': ['item-1'],
            'limit': 3,
        },
    )
    assert response.status_code == 400
    assert 'branchId' in response.json().get('detail', '')


def test_chat_missing_message():
    response = client.post('/api/ai/chat', json={'branchId': 'branch-e2e'})
    assert response.status_code == 400


def test_kb_reload_endpoint():
    response = client.post('/api/ai/kb/reload')
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('success') is True
    assert int(payload.get('itemCount', 0)) > 0


def test_forecast_rebuild_endpoint():
    response = client.post(
        '/api/ai/forecast/revenue/rebuild',
        json={'branchId': 'branch-e2e', 'days': 3, 'granularity': 'daily'},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('branchId') == 'branch-e2e'
    assert int(payload.get('days', 0)) == 3
    assert isinstance(payload.get('items'), list)


def test_sentiment_issues_top_contract():
    response = client.get('/api/ai/sentiment/issues-top', params={'branchId': 'branch-e2e', 'days': 7, 'limit': 3})
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('branchId') == 'branch-e2e'
    assert isinstance(payload.get('issues'), list)


def test_anomaly_detect_contract():
    response = client.post(
        '/api/ai/anomalies/detect',
        json={
            'branchId': 'branch-e2e',
            'type': 'ORDER_QTY',
            'value': 120,
            'baselineMean': 20,
            'baselineStd': 10,
            'referenceId': 'order-1',
            'referenceType': 'ORDER',
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('branchId') == 'branch-e2e'
    assert payload.get('severity') in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    assert 'zScore' in payload
    assert 'notified' in payload


def test_report_chat_admin_contract():
    response = client.post(
        '/api/ai/report-chat',
        json={
            'branchId': 'branch-e2e',
            'userId': 'admin-1',
            'role': 'ADMIN',
            'question': 'Doanh thu hôm nay là bao nhiêu?',
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('intent') in ['REVENUE_QUERY', 'TOP_ITEMS_QUERY', 'ANOMALY_QUERY', 'SENTIMENT_QUERY', 'GENERAL_QUERY']
    assert isinstance(payload.get('executionTimeMs'), int)
    assert payload.get('sql') is None or isinstance(payload.get('sql'), str)


def test_report_chat_manager_hides_sql():
    response = client.post(
        '/api/ai/report-chat',
        json={
            'branchId': 'branch-e2e',
            'userId': 'manager-1',
            'role': 'MANAGER',
            'question': 'Có cảnh báo bất thường nào không?',
        },
        headers={'x-actor-role': 'MANAGER', 'x-actor-branch-id': 'branch-e2e', 'x-actor-user-id': 'manager-1'},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('sql') is None


# ai-service must not rely on the gateway alone: every data endpoint checks the actor itself.
GUARDED_GETS = [
    '/api/ai/forecast/top-products?branchId=branch-a&date=2026-11-15',
    '/api/ai/forecast/hourly-profile?branchId=branch-a',
    '/api/ai/forecast/weather?branchId=branch-a',
    '/api/ai/forecast/ingredients?branchId=branch-a',
    '/api/ai/recommend?branchId=branch-a',
    '/api/ai/recommend/popular?branchId=branch-a',
]


def test_data_endpoints_refuse_requests_without_an_actor():
    anonymous = TestClient(app)
    for path in GUARDED_GETS:
        assert anonymous.get(path).status_code == 401, path
    assert anonymous.post('/api/ai/kb/reload').status_code == 401
    assert anonymous.post('/api/ai/chat', json={'message': 'Doanh thu hôm nay?'}).status_code == 401
    assert anonymous.post('/api/ai/recommend/feedback', json={
        'branchId': 'branch-a', 'sourceItemId': 'i1', 'targetItemId': 'i2', 'action': 'click',
    }).status_code == 401


def test_data_endpoints_keep_managers_in_their_branch():
    other_branch_manager = {'x-actor-role': 'MANAGER', 'x-actor-branch-id': 'branch-b', 'x-actor-user-id': 'm2'}
    for path in GUARDED_GETS:
        assert client.get(path, headers=other_branch_manager).status_code == 403, path
    waiter = {'x-actor-role': 'WAITER', 'x-actor-branch-id': 'branch-a', 'x-actor-user-id': 'w1'}
    assert client.get('/api/ai/recommend/popular?branchId=branch-a', headers=waiter).status_code == 403
