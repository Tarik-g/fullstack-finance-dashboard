"""HTTP tests with a mocked database boundary; local data is never accessed."""

import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.backend import database
from src.backend.main import app


TRANSACTION = {
    "id": 7,
    "booking_date": date(2026, 9, 2),
    "counterparty": "Demo Shop",
    "iban": None,
    "purpose": "Test purchase",
    "amount": Decimal("-45.82"),
    "category": "Lebensmittel",
    "status": "Gebucht",
}
PAYLOAD = {
    "booking_date": "2026-09-02",
    "counterparty": "Demo Shop",
    "purpose": "Test purchase",
    "amount": "-45.82",
    "category": "Lebensmittel",
    "status": "Gebucht",
}
TRANSACTIONS_PATH = "/api/v1/transactions"


class ApiTests(unittest.TestCase):
    def setUp(self):
        guard = patch.object(
            database.psycopg,
            "connect",
            side_effect=AssertionError("Live database access forbidden in tests"),
        )
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

    def test_health_does_not_use_the_database(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.connect.assert_not_called()

    def test_list_serializes_english_fields_and_forwards_filters(self):
        query = self.mock_db(
            "get_paginated_transactions",
            {
                "items": [TRANSACTION],
                "total": 11,
                "page": 2,
                "page_size": 10,
                "total_pages": 2,
            },
        )
        parameters = {
            "page": 2,
            "search": "Shop",
            "transaction_type": "expense",
            "category": "Lebensmittel",
            "year": 2026,
            "month": 9,
            "sort_by": "amount",
            "sort_direction": "asc",
        }
        response = self.client.get(TRANSACTIONS_PATH, params=parameters)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["amount"], "-45.82")
        self.assertEqual(response.json()["items"][0]["booking_date"], "2026-09-02")
        query.assert_called_once_with(
            self.connection,
            page=2,
            page_size=10,
            search="Shop",
            transaction_type="expense",
            category="Lebensmittel",
            year=2026,
            month=9,
            sort_by="amount",
            sort_direction="asc",
        )
        self.connection.close.assert_called_once()

    def test_invalid_query_parameters_return_422(self):
        for parameters in (
            {"page": 0},
            {"page_size": 101},
            {"year": 2026, "month": 13},
            {"transaction_type": "other"},
            {"sort_by": "amount; DROP TABLE transactions"},
        ):
            with self.subTest(parameters=parameters):
                self.assertEqual(
                    self.client.get(TRANSACTIONS_PATH, params=parameters).status_code,
                    422,
                )

    def test_month_requires_a_year(self):
        self.assertEqual(
            self.client.get(f"{TRANSACTIONS_PATH}?month=9").status_code, 422
        )
        for endpoint in ("timeline", "categories"):
            self.assertEqual(
                self.client.get(f"/api/v1/analytics/{endpoint}?month=9").status_code,
                422,
            )

    def test_summary_timeline_and_category_responses(self):
        self.mock_db(
            "get_transaction_summary",
            {
                "transaction_count": 2,
                "income": Decimal("3000.00"),
                "expenses": Decimal("45.82"),
                "balance": Decimal("2954.18"),
            },
        )
        self.mock_db(
            "get_transaction_timeline",
            [
                {
                    "period": date(2026, 9, 2),
                    "income": Decimal("0"),
                    "expenses": Decimal("45.82"),
                }
            ],
        )
        self.mock_db(
            "get_expenses_by_category",
            [{"category": "Lebensmittel", "amount": Decimal("45.82")}],
        )
        self.assertEqual(
            self.client.get("/api/v1/analytics/summary").json()["balance"],
            "2954.18",
        )
        self.assertEqual(
            self.client.get("/api/v1/analytics/timeline").json()[0]["period"],
            "2026-09-02",
        )
        self.assertEqual(
            self.client.get("/api/v1/analytics/categories").json(),
            [{"category": "Lebensmittel", "amount": "45.82"}],
        )

    def test_metadata_comes_from_the_database(self):
        self.mock_db("get_available_years", [2026, 2025])
        self.mock_db("get_all_categories", ["Gehalt", "Lebensmittel"])
        self.assertEqual(self.client.get("/api/v1/years").json(), [2026, 2025])
        self.assertEqual(
            self.client.get("/api/v1/categories").json(),
            ["Gehalt", "Lebensmittel"],
        )

    def test_create_returns_the_created_transaction(self):
        insert = self.mock_db("insert_transaction", TRANSACTION)
        response = self.client.post(TRANSACTIONS_PATH, json=PAYLOAD)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["id"], 7)
        insert.assert_called_once_with(
            self.connection,
            {
                "booking_date": date(2026, 9, 2),
                "counterparty": "Demo Shop",
                "iban": None,
                "purpose": "Test purchase",
                "amount": Decimal("-45.82"),
                "category": "Lebensmittel",
                "status": "Gebucht",
            },
        )

    def test_duplicate_create_returns_conflict(self):
        self.mock_db("insert_transaction", None)
        self.assertEqual(self.client.post(TRANSACTIONS_PATH, json=PAYLOAD).status_code, 409)

    def test_invalid_create_payloads_return_422(self):
        for payload in (
            {},
            {**PAYLOAD, "booking_date": "2026-02-30"},
            {**PAYLOAD, "amount": "not money"},
            {**PAYLOAD, "counterparty": "   "},
        ):
            with self.subTest(payload=payload):
                self.assertEqual(
                    self.client.post(TRANSACTIONS_PATH, json=payload).status_code,
                    422,
                )

    def test_read_update_and_delete_use_versioned_routes(self):
        read = self.mock_db("get_transaction_by_id", TRANSACTION)
        update = self.mock_db("update_transaction_by_id", TRANSACTION)
        delete = self.mock_db("delete_transaction_by_id", True)

        self.assertEqual(self.client.get(f"{TRANSACTIONS_PATH}/7").status_code, 200)
        read.assert_called_once_with(self.connection, 7)

        response = self.client.patch(
            f"{TRANSACTIONS_PATH}/7", json={"amount": "-12.50"}
        )
        self.assertEqual(response.status_code, 200)
        update.assert_called_once_with(
            self.connection, 7, {"amount": Decimal("-12.50")}
        )

        self.assertEqual(self.client.delete(f"{TRANSACTIONS_PATH}/7").status_code, 204)
        delete.assert_called_once_with(self.connection, 7)

    def test_missing_transactions_return_404(self):
        self.mock_db("get_transaction_by_id", None)
        self.mock_db("update_transaction_by_id", None)
        self.mock_db("delete_transaction_by_id", False)
        self.assertEqual(self.client.get(f"{TRANSACTIONS_PATH}/999").status_code, 404)
        self.assertEqual(
            self.client.patch(f"{TRANSACTIONS_PATH}/999", json={"amount": "1.00"}).status_code,
            404,
        )
        self.assertEqual(self.client.delete(f"{TRANSACTIONS_PATH}/999").status_code, 404)

    def test_empty_patch_returns_400(self):
        response = self.client.patch(f"{TRANSACTIONS_PATH}/7", json={})
        self.assertEqual(response.status_code, 400)

    def test_required_fields_cannot_be_cleared(self):
        for field in ("booking_date", "counterparty", "amount"):
            with self.subTest(field=field):
                response = self.client.patch(
                    f"{TRANSACTIONS_PATH}/7", json={field: None}
                )
                self.assertEqual(response.status_code, 422)

    def test_database_unavailable_returns_503(self):
        self.connect.return_value = None
        self.assertEqual(self.client.get(TRANSACTIONS_PATH).status_code, 503)
        self.assertEqual(self.client.get("/api/v1/analytics/summary").status_code, 503)

    def test_database_errors_are_hidden_and_connections_are_closed(self):
        self.mock_db(
            "get_paginated_transactions",
            error=RuntimeError("private database details"),
        )
        response = self.client.get(TRANSACTIONS_PATH)
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private database details", response.text)
        self.connection.close.assert_called_once()

    def test_legacy_routes_are_removed(self):
        self.assertEqual(self.client.get("/transactions").status_code, 404)
        self.assertEqual(self.client.get("/categories").status_code, 404)

    def test_cors_allows_the_frontend_origin(self):
        response = self.client.options(
            TRANSACTIONS_PATH,
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["access-control-allow-origin"],
            "http://localhost:5173",
        )


if __name__ == "__main__":
    unittest.main()
