"""Configuration tests without real environment files or database access."""

import os
import unittest
from unittest.mock import MagicMock, patch

from src.backend import database
from src.backend.config import get_settings


class ConfigurationTests(unittest.TestCase):
    def tearDown(self):
        get_settings.cache_clear()

    def test_database_url_takes_precedence(self):
        connection = MagicMock()
        with (
            patch.dict(
                os.environ,
                {
                    "DATABASE_URL": "postgresql://demo:secret@localhost/finance",
                    "DB_NAME": "legacy",
                },
                clear=True,
            ),
            patch.object(database.psycopg, "connect", return_value=connection) as connect,
        ):
            get_settings.cache_clear()
            self.assertIs(database.get_postgres_connection(), connection)
            connect.assert_called_once_with(
                "postgresql://demo:secret@localhost/finance"
            )

    def test_legacy_database_variables_remain_supported(self):
        with (
            patch.dict(
                os.environ,
                {
                    "DB_NAME": "finance",
                    "DB_USER": "postgres",
                    "DB_PASSWORD": "secret",
                    "DB_HOST": "localhost",
                    "DB_PORT": "5432",
                },
                clear=True,
            ),
            patch.object(database.psycopg, "connect") as connect,
        ):
            get_settings.cache_clear()
            database.get_postgres_connection()
            connect.assert_called_once_with(
                dbname="finance",
                user="postgres",
                password="secret",
                host="localhost",
                port="5432",
            )

    def test_cors_and_demo_mode_are_parsed(self):
        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": "https://one.example, https://two.example",
                "DEMO_MODE": "true",
            },
            clear=True,
        ):
            get_settings.cache_clear()
            settings = get_settings()
            self.assertEqual(
                settings.cors_origins,
                ("https://one.example", "https://two.example"),
            )
            self.assertTrue(settings.demo_mode)


if __name__ == "__main__":
    unittest.main()
