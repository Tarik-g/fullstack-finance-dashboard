"""SQL regression tests; no live database connection or data changes required."""

import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

from src.backend.database import (
    _build_transaction_filters,
    get_expenses_by_category,
    get_paginated_transactions,
    get_transaction_summary,
    get_transaction_timeline,
)


def mock_connection(count=0, rows=None):
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = (count,)
    cursor.fetchall.return_value = rows or []
    return connection, cursor


class DashboardQueryTests(unittest.TestCase):
    def test_no_filters_uses_all_rows(self):
        where, parameters = _build_transaction_filters()
        self.assertEqual(where.as_string(), " WHERE demo_session_id IS NULL")
        self.assertEqual(parameters, [])

    def test_demo_session_is_the_first_bound_filter(self):
        session_id = "887a9cf3-7c96-4c5c-91c9-9b54dc21de6d"
        where, parameters = _build_transaction_filters(
            search="REWE", demo_session_id=session_id
        )
        self.assertIn("demo_session_id = %s", where.as_string())
        self.assertEqual(parameters, [session_id, "%REWE%"])

    def test_filters_use_bound_parameters(self):
        where, parameters = _build_transaction_filters(
            search="  REWE  ", transaction_type="expense",
            category="Lebensmittel", year=2026, month=9,
        )
        self.assertNotIn("REWE", where.as_string())
        self.assertIn("betrag_euro < 0", where.as_string())
        self.assertEqual(parameters, [
            "%REWE%", "Lebensmittel", date(2026, 9, 1), date(2026, 10, 1),
        ])

    def test_search_wildcards_are_literal(self):
        _, parameters = _build_transaction_filters(search="50%_off")
        self.assertEqual(parameters, [r"%50\%\_off%"])

    def test_december_and_whole_year_have_exclusive_end_dates(self):
        _, december = _build_transaction_filters(year=2026, month=12)
        _, year = _build_transaction_filters(year=2025)
        self.assertEqual(december, [date(2026, 12, 1), date(2027, 1, 1)])
        self.assertEqual(year, [date(2025, 1, 1), date(2026, 1, 1)])

    def test_second_page_uses_limit_offset_and_stable_order(self):
        row = (
            7,
            date(2026, 9, 2),
            "Demo Shop",
            None,
            "Test purchase",
            Decimal("-45.82"),
            "Lebensmittel",
            "Gebucht",
        )
        connection, cursor = mock_connection(count=400, rows=[row])
        result = get_paginated_transactions(
            connection, page=2, page_size=10, sort_by="amount", sort_direction="asc",
        )
        query, parameters = cursor.execute.call_args.args
        self.assertIn('ORDER BY "betrag_euro" ASC, id DESC', query.as_string())
        self.assertEqual(parameters, [10, 10])
        self.assertEqual(result["total_pages"], 40)
        self.assertEqual(result["page"], 2)
        self.assertEqual(result["items"][0]["counterparty"], "Demo Shop")

    def test_page_is_clamped_after_last_row_disappears(self):
        connection, cursor = mock_connection(count=10)
        result = get_paginated_transactions(connection, page=2, page_size=10)
        self.assertEqual(result["page"], 1)
        self.assertEqual(cursor.execute.call_args.args[1], [10, 0])

    def test_empty_results_have_one_empty_page(self):
        connection, _ = mock_connection()
        result = get_paginated_transactions(connection, page=99)
        self.assertEqual(result["total"], 0)
        self.assertEqual(result["total_pages"], 1)
        self.assertEqual(result["page"], 1)
        self.assertEqual(result["items"], [])

    def test_sort_column_is_allowlisted(self):
        connection, cursor = mock_connection()
        with self.assertRaises(KeyError):
            get_paginated_transactions(connection, sort_by="amount; DROP TABLE transactions")
        cursor.execute.assert_not_called()

    def test_analytics_share_the_same_filters_as_the_table(self):
        connection, cursor = mock_connection()
        filters = dict(search="REWE", category="Lebensmittel", year=2025, month=1)
        _, expected_parameters = _build_transaction_filters(**filters)
        get_transaction_timeline(connection, granularity="day", **filters)
        query, parameters = cursor.execute.call_args.args
        self.assertIn("DATE_TRUNC('day', datum)", query.as_string())
        self.assertEqual(parameters, expected_parameters)

        get_expenses_by_category(connection, **filters)
        query, parameters = cursor.execute.call_args.args
        self.assertIn("AND betrag_euro < 0", query.as_string())
        self.assertEqual(parameters, expected_parameters)

    def test_income_filter_cannot_leak_expenses_into_category_chart(self):
        connection, cursor = mock_connection()
        get_expenses_by_category(connection, transaction_type="income")
        query = cursor.execute.call_args.args[0].as_string()
        self.assertIn("betrag_euro >= 0", query)
        self.assertIn("AND betrag_euro < 0", query)

    def test_summary_keeps_decimal_precision(self):
        connection, cursor = mock_connection()
        cursor.fetchone.return_value = (400, Decimal("79460.82"), Decimal("44181.16"))
        result = get_transaction_summary(connection)
        self.assertEqual(result["balance"], Decimal("35279.66"))
        self.assertEqual(result["transaction_count"], 400)


if __name__ == "__main__":
    unittest.main()
