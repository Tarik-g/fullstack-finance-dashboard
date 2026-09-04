"""HTTP-level API tests with a mocked database boundary; never use local data."""

import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.backend import database
from src.backend.main import app


ROW = (7, date(2026, 9, 2), "Demo Shop", None, "Test purchase",
       Decimal("-45.82"), "Lebensmittel", "Gebucht")
PAYLOAD = {
    "datum": "2026-09-02", "empfaenger_sender": "Demo Shop",
    "verwendungszweck": "Test purchase", "betrag_euro": "-45.82",
    "kategorie": "Lebensmittel", "status": "Gebucht",
}


class ApiTests(unittest.TestCase):
    def setUp(self):
        # Fail closed if a future endpoint bypasses the mocked connection factory.
        guard = patch.object(database.psycopg, "connect",
                             side_effect=AssertionError("Live database access forbidden in tests"))
        guard.start()
        self.addCleanup(guard.stop)
        self.connection = MagicMock()
        self.connect = self.mock_db("get_postgres_connection", self.connection)
        self.client = TestClient(app, raise_server_exceptions=False)
        self.addCleanup(self.client.close)

    def mock_db(self, name, result=None, error=None):
        patcher = patch.object(database, name, return_value=result, side_effect=error)
        mocked = patcher.start()
        self.addCleanup(patcher.stop)
        return mocked

    def test_health_does_not_need_a_database(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.connect.assert_not_called()

    def test_list_serializes_dates_and_decimals_and_passes_query_parameters(self):
        query = self.mock_db("get_paginated_transactions", {
            "items": [ROW], "total": 11, "page": 2, "page_size": 10, "total_pages": 2,
        })
        response = self.client.get("/api/v1/transactions", params={
            "page": 2, "search": "Shop", "transaction_type": "expense",
            "category": "Lebensmittel", "year": 2026, "month": 9,
            "sort_by": "amount", "sort_direction": "asc",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["betrag_euro"], "-45.82")
        self.assertEqual(response.json()["items"][0]["datum"], "2026-09-02")
        self.assertEqual(response.json()["total_pages"], 2)
        query.assert_called_once_with(
            self.connection, page=2, page_size=10, search="Shop",
            transaction_type="expense", category="Lebensmittel", year=2026, month=9,
            sort_by="amount", sort_direction="asc",
        )
        self.connection.close.assert_called_once()

    def test_invalid_query_parameters_are_rejected_before_database_access(self):
        for parameters in [
            {"page": 0}, {"page_size": 101}, {"page_size": 0}, {"month": 9},
            {"year": 2026, "month": 13}, {"year": 1999}, {"search": "x" * 101},
            {"category": "x" * 101}, {"transaction_type": "other"},
            {"sort_by": "amount; DROP TABLE transactions"}, {"sort_direction": "invalid"},
        ]:
            with self.subTest(parameters=parameters):
                self.assertEqual(self.client.get("/api/v1/transactions", params=parameters).status_code, 422)
        self.connect.assert_not_called()

    def test_analytics_validate_periods_before_database_access(self):
        for path in ["timeline", "categories"]:
            with self.subTest(path=path):
                response = self.client.get(f"/api/v1/analytics/{path}?month=9")
                self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/api/v1/analytics/timeline?granularity=week").status_code, 422)
        self.connect.assert_not_called()

    def test_empty_paginated_result(self):
        self.mock_db("get_paginated_transactions", {
            "items": [], "total": 0, "page": 1, "page_size": 10, "total_pages": 1,
        })
        response = self.client.get("/api/v1/transactions")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"], [])

    def test_summary_serializes_decimal_values(self):
        self.mock_db("get_transaction_summary", {
            "transaction_count": 2, "income": Decimal("3000.00"),
            "expenses": Decimal("45.82"), "balance": Decimal("2954.18"),
        })
        response = self.client.get("/api/v1/analytics/summary")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["balance"], "2954.18")
        self.connection.close.assert_called_once()

    def test_timeline_and_categories_pass_the_same_filters(self):
        timeline = self.mock_db("get_transaction_timeline", [(date(2026, 9, 2), Decimal("0"), Decimal("45.82"))])
        categories = self.mock_db("get_expenses_by_category", [("Lebensmittel", Decimal("45.82"))])
        filters = dict(search="Shop", transaction_type="expense", category="Lebensmittel", year=2026, month=9)
        response = self.client.get("/api/v1/analytics/timeline", params={**filters, "granularity": "day"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["period"], "2026-09-02")
        timeline.assert_called_once_with(self.connection, granularity="day", **filters)
        response = self.client.get("/api/v1/analytics/categories", params=filters)
        self.assertEqual(response.json(), [{"category": "Lebensmittel", "amount": "45.82"}])
        categories.assert_called_once_with(self.connection, **filters)

    def test_metadata_endpoints_use_database_values(self):
        self.mock_db("get_available_years", [2026, 2025])
        self.mock_db("get_all_categories", ["Gehalt", "Lebensmittel"])
        self.assertEqual(self.client.get("/api/v1/years").json(), [2026, 2025])
        self.assertEqual(self.client.get("/api/v1/categories").json(), ["Gehalt", "Lebensmittel"])

    def test_create_converts_request_values_and_returns_201(self):
        insert = self.mock_db("insert_transaction", True)
        response = self.client.post("/transactions", json=PAYLOAD)
        self.assertEqual(response.status_code, 201)
        insert.assert_called_once_with(self.connection, ROW[1:])
        self.connection.close.assert_called_once()

    def test_invalid_create_payloads_do_not_reach_the_database(self):
        for payload in [{}, {**PAYLOAD, "datum": "2026-02-30"},
                        {**PAYLOAD, "betrag_euro": "not money"},
                        {**PAYLOAD, "betrag_euro": "NaN"},
                        {**PAYLOAD, "empfaenger_sender": None}]:
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post("/transactions", json=payload).status_code, 422)
        self.connect.assert_not_called()

    def test_failed_insert_is_not_reported_as_created(self):
        self.mock_db("insert_transaction", False)
        self.assertEqual(self.client.post("/transactions", json=PAYLOAD).status_code, 400)
        self.connection.close.assert_called_once()

    def test_read_existing_and_missing_transaction(self):
        query = self.mock_db("get_transaction_by_id", ROW)
        response = self.client.get("/transactions/7")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 7)
        query.assert_called_once_with(self.connection, 7)
        query.return_value = None
        self.assertEqual(self.client.get("/transactions/999").status_code, 404)

    def test_patch_only_passes_explicit_fields_and_returns_updated_row(self):
        updated = (*ROW[:5], Decimal("-12.50"), *ROW[6:])
        update = self.mock_db("update_transaction_by_id", updated)
        response = self.client.patch("/transactions/7", json={"betrag_euro": "-12.50"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["betrag_euro"], "-12.50")
        update.assert_called_once_with(self.connection, 7, {"betrag_euro": Decimal("-12.50")})
        self.connection.close.assert_called_once()

    def test_patch_can_explicitly_clear_an_optional_field(self):
        update = self.mock_db("update_transaction_by_id", (*ROW[:4], None, *ROW[5:]))
        self.assertEqual(self.client.patch("/transactions/7", json={"verwendungszweck": None}).status_code, 200)
        update.assert_called_once_with(self.connection, 7, {"verwendungszweck": None})

    def test_empty_or_invalid_patch_is_rejected_before_database_access(self):
        self.assertEqual(self.client.patch("/transactions/7", json={}).status_code, 400)
        self.assertEqual(self.client.patch("/transactions/7", json={"betrag_euro": "oops"}).status_code, 422)
        self.connect.assert_not_called()

    def test_patch_of_missing_id_returns_404(self):
        self.mock_db("update_transaction_by_id", None)
        response = self.client.patch("/transactions/999", json={"betrag_euro": "1.00"})
        self.assertEqual(response.status_code, 404)
        self.connection.close.assert_called_once()

    def test_delete_existing_and_missing_transaction(self):
        delete = self.mock_db("delete_transaction_by_id", True)
        self.assertEqual(self.client.delete("/transactions/7").status_code, 200)
        delete.assert_called_once_with(self.connection, 7)
        delete.return_value = False
        self.assertEqual(self.client.delete("/transactions/999").status_code, 404)
        self.assertEqual(self.connection.close.call_count, 2)

    def test_invalid_id_does_not_reach_the_database(self):
        self.assertEqual(self.client.get("/transactions/not-an-id").status_code, 422)
        self.assertEqual(self.client.patch("/transactions/not-an-id", json={"status": "Gebucht"}).status_code, 422)
        self.assertEqual(self.client.delete("/transactions/not-an-id").status_code, 422)
        self.connect.assert_not_called()

    def test_unavailable_database_returns_500(self):
        self.connect.return_value = None
        requests = [
            ("GET", "/api/v1/transactions", None), ("GET", "/api/v1/analytics/summary", None),
            ("POST", "/transactions", PAYLOAD), ("PATCH", "/transactions/7", {"status": "Gebucht"}),
            ("DELETE", "/transactions/7", None),
        ]
        for method, path, payload in requests:
            with self.subTest(method=method, path=path):
                response = self.client.request(method, path, json=payload)
                self.assertEqual(response.status_code, 500)
                self.assertIn("Could not connect", response.json()["detail"]["error"])

    def test_query_failure_returns_500_and_closes_connection(self):
        self.mock_db("get_paginated_transactions", error=RuntimeError("private database details"))
        response = self.client.get("/api/v1/transactions")
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private database details", response.text)
        self.connection.close.assert_called_once()

    def test_patch_failure_returns_500_and_closes_connection(self):
        self.mock_db("update_transaction_by_id", error=RuntimeError("private database details"))
        response = self.client.patch("/transactions/7", json={"status": "Gebucht"})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private database details", response.text)
        self.connection.close.assert_called_once()

    def test_create_exception_still_closes_connection(self):
        self.mock_db("insert_transaction", error=RuntimeError("database error"))
        self.assertEqual(self.client.post("/transactions", json=PAYLOAD).status_code, 500)
        self.connection.close.assert_called_once()

    def test_delete_exception_still_closes_connection(self):
        self.mock_db("delete_transaction_by_id", error=RuntimeError("database error"))
        self.assertEqual(self.client.delete("/transactions/7").status_code, 500)
        self.connection.close.assert_called_once()

    def test_cors_allows_the_frontend_origin(self):
        response = self.client.options("/transactions", headers={
            "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:5173")
        self.connect.assert_not_called()


if __name__ == "__main__":
    unittest.main()
