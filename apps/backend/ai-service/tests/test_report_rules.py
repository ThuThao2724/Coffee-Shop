from app.main import map_question_to_sql, summarize_sql_result


def test_top_items_rule_is_branch_scoped_for_managers():
    # item_sales now carries branchId, so the manager's branch filter is valid SQL.
    sql = map_question_to_sql("món bán chạy nhất", "branch-a")
    assert 'FROM item_sales WHERE "branchId" = %s' in sql
    assert '"menuItemName"' in sql


def test_top_items_rule_without_branch_reads_all_branches():
    sql = map_question_to_sql("món bán chạy nhất", None)
    assert "WHERE" not in sql
    assert 'GROUP BY "menuItemId"' in sql


def test_top_items_answer_shows_the_item_name():
    rows = [{"menuItemId": "cm123", "menuItemName": "Cà phê sữa", "qty": 42}]
    assert summarize_sql_result("TOP_ITEMS_QUERY", rows) == "Món dẫn đầu hiện tại là Cà phê sữa với số lượng 42."


def test_top_items_answer_falls_back_to_the_id():
    rows = [{"menuItemId": "cm123", "menuItemName": None, "qty": 5}]
    assert "cm123" in summarize_sql_result("TOP_ITEMS_QUERY", rows)
