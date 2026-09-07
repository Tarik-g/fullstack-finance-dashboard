"""CSV parsing and import endpoint tests without a live database."""

import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.backend import database
from src.backend.csv_handler import CsvFormatError, MAX_CSV_BYTES, parse_transaction_csv
from src.backend.main import app


GERMAN_CSV = """Datum;Empfänger_Sender;IBAN;Verwendungszweck;Betrag_EURO;Kategorie;Status
2026-09-02;Demo Shop;;Wocheneinkauf;-45,82;Lebensmittel;Gebucht
2026-02-30;Invalid Shop;;;12.00;;Gebucht
""".encode()


class CsvParserTests(unittest.TestCase):
    def test_parses_german_headers_and_reports_invalid_rows(self):
        result = parse_transaction_csv(GERMAN_CSV)
        self.assertEqual(result.total_rows, 2)
        self.assertEqual(len(result.transactions), 1)
        self.assertEqual(result.transactions[0]["booking_date"], date(2026, 9, 2))
        self.assertEqual(result.transactions[0]["amount"], Decimal("-45.82"))
        self.assertEqual(len(result.errors), 1)
        self.assertTrue(result.errors[0].startswith("Row 3:"))

    def test_accepts_the_public_english_headers(self):
        content = (
            "booking_date,counterparty,amount,category\n"
            "2026-09-02,Demo Shop,-12.50,Shopping\n"
        ).encode()
        result = parse_transaction_csv(content)
        self.assertEqual(result.transactions[0]["counterparty"], "Demo Shop")

    def test_rejects_missing_columns_empty_and_oversized_files(self):
        with self.assertRaises(CsvFormatError):
            parse_transaction_csv(b"")
        with self.assertRaises(CsvFormatError):
            parse_transaction_csv(b"only,headers\n1,2\n")
        with self.assertRaises(CsvFormatError):
            parse_transaction_csv(b"x" * (MAX_CSV_BYTES + 1))


class CsvImportApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        connection_patch = patch.object(
            database, "get_postgres_connection", return_value=self.connection
        )
        connection_patch.start()
        self.addCleanup(connection_patch.stop)
        self.client = TestClient(app, raise_server_exceptions=False)
        self.addCleanup(self.client.close)

    def test_import_reports_inserted_skipped_and_failed_rows(self):
        importer = patch.object(
            database, "import_transactions", return_value=(0, 1)
        )
        mocked_importer = importer.start()
        self.addCleanup(importer.stop)

        response = self.client.post(
            "/api/v1/imports/csv",
            files={"file": ("transactions.csv", GERMAN_CSV, "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "total_rows": 2,
                "inserted": 0,
                "skipped": 1,
                "failed": 1,
                "errors": response.json()["errors"],
            },
        )
        mocked_importer.assert_called_once()
        self.connection.close.assert_called_once()

    def test_rejects_non_csv_files(self):
        response = self.client.post(
            "/api/v1/imports/csv",
            files={"file": ("transactions.txt", b"not csv", "text/plain")},
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
