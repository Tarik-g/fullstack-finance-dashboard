"""The browser-test harness must never fall back to a development database."""

import unittest
from unittest.mock import patch

from e2e.database import connect, test_connection_info


class E2ESafetyTests(unittest.TestCase):
    def environment(self):
        run_id = "a" * 32
        return {"E2E_RUN_ID": run_id,
                "E2E_DATABASE_URL": f"postgresql://test:synthetic@127.0.0.1:5433/finance_e2e_{run_id}"}

    def test_accepts_only_the_generated_database(self):
        self.assertEqual(test_connection_info(self.environment())["dbname"], "finance_e2e_" + "a" * 32)

    def test_regular_database_and_environment_fallback_are_rejected(self):
        for environment in [
            {}, {"DB_NAME": "finance", "DATABASE_URL": "postgresql://localhost/finance"},
            {**self.environment(), "E2E_DATABASE_URL": "postgresql://test:synthetic@127.0.0.1:5433/finance"},
            {**self.environment(), "E2E_DATABASE_URL": "postgresql://test:synthetic@127.0.0.1:5433/postgres"},
            {**self.environment(), "E2E_RUN_ID": "invalid"},
        ]:
            with self.subTest(environment=environment), self.assertRaises(ValueError):
                test_connection_info(environment)

    def test_remote_host_is_rejected(self):
        environment = self.environment()
        environment["E2E_DATABASE_URL"] = environment["E2E_DATABASE_URL"].replace("127.0.0.1", "remote.example")
        with self.assertRaises(ValueError):
            test_connection_info(environment)

    def test_invalid_target_is_rejected_before_any_connection(self):
        with patch.dict("os.environ", {}, clear=True), patch("e2e.database.psycopg.connect") as connection:
            with self.assertRaises(ValueError):
                connect()
            connection.assert_not_called()


if __name__ == "__main__":
    unittest.main()
