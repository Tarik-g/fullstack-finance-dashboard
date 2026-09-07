"""Exercise SQL mutation helpers with mocked cursors, never PostgreSQL."""

import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

from src.backend.database import (
    delete_transaction_by_id,
    import_transactions,
    insert_transaction,
    update_transaction_by_id,
)


ROW = (
    7,
    date(2026, 9, 2),
    "Demo Shop",
    None,
    "Test purchase",
    Decimal("-12.50"),
    "Lebensmittel",
    "Gebucht",
)
TRANSACTION = {
    "booking_date": date(2026, 9, 2),
    "counterparty": "Demo Shop",
    "iban": None,
    "purpose": "Test purchase",
    "amount": Decimal("-12.50"),
    "category": "Lebensmittel",
    "status": "Gebucht",
}


class DatabaseMutationTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = self.connection.cursor.return_value.__enter__.return_value

    def test_insert_binds_values_returns_row_and_commits(self):
        self.cursor.fetchone.return_value = ROW
        result = insert_transaction(self.connection, TRANSACTION)
        query, parameters = self.cursor.execute.call_args.args
        self.assertNotIn("Demo Shop", query)
        self.assertEqual(parameters, tuple(TRANSACTION.values()))
        self.assertEqual(result["counterparty"], "Demo Shop")
        self.connection.commit.assert_called_once()

    def test_duplicate_insert_returns_none(self):
        self.cursor.fetchone.return_value = None
        self.assertIsNone(insert_transaction(self.connection, TRANSACTION))
        self.connection.commit.assert_called_once()

    def test_insert_failure_rolls_back_and_propagates(self):
        self.cursor.execute.side_effect = RuntimeError("test failure")
        with self.assertRaises(RuntimeError):
            insert_transaction(self.connection, TRANSACTION)
        self.connection.rollback.assert_called_once()
        self.connection.commit.assert_not_called()

    def test_patch_maps_public_fields_to_sql_columns(self):
        self.cursor.fetchone.return_value = ROW
        result = update_transaction_by_id(
            self.connection,
            7,
            {"amount": Decimal("-12.50"), "status": "Gebucht", "unknown": "ignored"},
        )
        query, parameters = self.cursor.execute.call_args.args
        self.assertIn('"betrag_euro" = %s', query.as_string())
        self.assertNotIn("unknown", query.as_string())
        self.assertEqual(parameters, [Decimal("-12.50"), "Gebucht", 7])
        self.assertEqual(result["id"], 7)
        self.connection.commit.assert_called_once()

    def test_patch_failure_rolls_back_and_propagates(self):
        self.cursor.execute.side_effect = RuntimeError("test failure")
        with self.assertRaises(RuntimeError):
            update_transaction_by_id(self.connection, 7, {"status": "Gebucht"})
        self.connection.rollback.assert_called_once()

    def test_delete_checks_rowcount_and_binds_id(self):
        self.cursor.rowcount = 1
        self.assertTrue(delete_transaction_by_id(self.connection, 7))
        self.assertEqual(self.cursor.execute.call_args.args[1], (7,))
        self.connection.commit.assert_called_once()

    def test_delete_failure_rolls_back_and_propagates(self):
        self.cursor.execute.side_effect = RuntimeError("test failure")
        with self.assertRaises(RuntimeError):
            delete_transaction_by_id(self.connection, 7)
        self.connection.rollback.assert_called_once()

    def test_csv_import_counts_inserted_and_skipped_rows(self):
        self.cursor.fetchone.side_effect = [(1,), None]
        inserted, skipped = import_transactions(
            self.connection, [TRANSACTION, TRANSACTION]
        )
        self.assertEqual((inserted, skipped), (1, 1))
        self.assertEqual(self.cursor.execute.call_count, 2)
        self.connection.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
