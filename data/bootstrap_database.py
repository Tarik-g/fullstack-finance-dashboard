"""Create the schema and optionally reset a demo database with synthetic data."""

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from data.seed_database import build_transactions, replace_database_transactions
from src.backend.config import get_settings
from src.backend.database import get_postgres_connection


SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def apply_schema():
    connection = get_postgres_connection()
    if connection is None:
        raise ConnectionError("Could not connect to PostgreSQL.")

    try:
        with connection.cursor() as cursor:
            cursor.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main():
    apply_schema()
    print("Database schema is ready.")

    if get_settings().demo_mode:
        replace_database_transactions(build_transactions())
        print("Demo database reset to the synthetic 2025-2026 dataset.")


if __name__ == "__main__":
    main()
