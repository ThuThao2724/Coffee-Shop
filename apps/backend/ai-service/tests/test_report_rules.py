import pytest

from app.main import (
    infer_report_intent,
    is_generic_fallback_question,
    map_question_to_sql,
    summarize_sql_result,
    top_items_direction,
)


def test_top_items_rule_is_branch_scoped_for_managers():
    # item_sales now carries branchId, so the manager's branch filter is valid SQL.
    sql = map_question_to_sql("món bán chạy nhất", "branch-a")
    assert 'FROM item_sales WHERE "branchId" = %s' in sql
    assert '"menuItemName"' in sql


def test_top_items_rule_without_branch_reads_all_branches():
    sql = map_question_to_sql("món bán chạy nhất", None)
    assert "WHERE" not in sql
    assert 'GROUP BY "menuItemId"' in sql


@pytest.mark.parametrize("question", [
    "nước nào bán nhiều nhất",
    "món nào bán chạy nhất",
    "đồ uống nào phổ biến nhất",
    "món nào được gọi nhiều nhất",
    "top món bán chạy tuần này",
])
def test_best_seller_questions_use_the_rule_not_gemini(question):
    # These used to go to Gemini, which timed out and fell back to the revenue forecast query.
    assert top_items_direction(question) == "DESC"
    assert infer_report_intent(question) == "TOP_ITEMS_QUERY"
    assert is_generic_fallback_question(question) is False
    assert "ORDER BY qty DESC" in map_question_to_sql(question, "branch-a")


@pytest.mark.parametrize("question", ["nước nào bán ít nhất", "món nào bán chậm", "món nào bán ế nhất"])
def test_least_sold_questions_sort_ascending(question):
    assert top_items_direction(question) == "ASC"
    assert "ORDER BY qty ASC" in map_question_to_sql(question, "branch-a")


def test_other_questions_are_not_top_items():
    assert top_items_direction("có cảnh báo bất thường nào không") is None
    assert infer_report_intent("doanh thu hôm nay") == "REVENUE_QUERY"


def test_top_items_answer_names_the_leader_and_runners_up():
    rows = [
        {"menuItemId": "cm1", "menuItemName": "Cà phê sữa", "qty": 3000},
        {"menuItemId": "cm2", "menuItemName": "Bạc xỉu", "qty": 2150},
        {"menuItemId": "cm3", "menuItemName": "Trà đào", "qty": 2100},
    ]
    assert summarize_sql_result("TOP_ITEMS_QUERY", rows, "nước nào bán nhiều nhất") == (
        "Bán chạy nhất là Cà phê sữa với 3.000 phần đã bán, tiếp theo là Bạc xỉu (2.150) và Trà đào (2.100)."
    )


def test_least_sold_answer_says_so():
    rows = [{"menuItemId": "cm9", "menuItemName": "Espresso", "qty": 42}]
    assert summarize_sql_result("TOP_ITEMS_QUERY", rows, "món nào bán ít nhất") == (
        "Bán ít nhất là Espresso với 42 phần đã bán."
    )


def test_top_items_answer_falls_back_to_the_id():
    rows = [{"menuItemId": "cm123", "menuItemName": None, "qty": 5}]
    assert "cm123" in summarize_sql_result("TOP_ITEMS_QUERY", rows)
