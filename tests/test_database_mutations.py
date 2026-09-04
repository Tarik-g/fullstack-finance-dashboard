"""Exercise the real SQL mutation helpers with mocked cursors, not PostgreSQL."""

import unittest
from decimal import Decimal
from unittest.mock import MagicMock

from src.backend.database import delete_transaction_by_id, insert_transaction, update_transaction_by_id


class DatabaseMutationTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = self.connection.cursor.return_value.__enter__.return_value

    def test_insert_binds_values_and_commits(self):
        values = ("2026-09-02", "Demo Shop", None, None, Decimal("-12.50"), None, "Gebucht")
        self.cursor.rowcount = 1
        self.assertTrue(insert_transaction(self.connection, values))
        query, parameters = self.cursor.execute.call_args.args
        self.assertNotIn("Demo Shop", query)
        self.assertEqual(parameters, values)
        self.connection.commit.assert_called_once()

    def test_duplicate_insert_is_not_reported_as_inserted(self):
        self.cursor.rowcount = 0
        self.assertFalse(insert_transaction(self.connection, ()))
        self.connection.commit.assert_called_once()

    def test_insert_failure_rolls_back(self):
        self.cursor.execute.side_effect = RuntimeError("test failure")
        self.assertFalse(insert_transaction(self.connection, ()))
        self.connection.rollback.assert_called_once()
        self.connection.commit.assert_not_called()

    def test_patch_binds_values_uses_only_allowed_columns_and_commits(self):
        self.cursor.fetchone.return_value = (7, "updated row")
        result = update_transaction_by_id(self.connection, 7, {
            "betrag_euro": Decimal("-12.50"), "status": "Gebucht", "not_a_column": "ignore",
        })
        query, parameters = self.cursor.execute.call_args.args
        self.assertIn('"betrag_euro" = %s', query.as_string())
        self.assertNotIn("not_a_column", query.as_string())
        self.assertEqual(parameters, [Decimal("-12.50"), "Gebucht", 7])
        self.assertEqual(result, (7, "updated row"))
        self.connection.commit.assert_called_once()

    def test_patch_failure_rolls_back_and_propagates(self):
        self.cursor.execute.side_effect = RuntimeError("test failure")
        with self.assertRaises(RuntimeError):
            update_transaction_by_id(self.connection, 7, {"status": "Gebucht"})
        self.connection.rollback.assert_called_once()
        self.connection.commit.assert_not_called()

    def test_delete_checks_rowcount_and_binds_id(self):
        self.cursor.rowcount = 1
        self.assertTrue(delete_transaction_by_id(self.connection, 7))
        self.assertEqual(self.cursor.execute.call_args.args[1], (7,))
        self.cursor.rowcount = 0
        self.assertFalse(delete_transaction_by_id(self.connection, 999))
        self.assertEqual(self.connection.commit.call_count, 2)

    def test_delete_failure_rolls_back(self):
        self.cursor.execute.side_effect = RuntimeError("test failure")
        self.assertFalse(delete_transaction_by_id(self.connection, 7))
        self.connection.rollback.assert_called_once()
        self.connection.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
