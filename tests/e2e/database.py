"""Database helpers for disposable E2E runs. Never read the developer's .env."""

import json
import os
from pathlib import Path
import re
import sys

import psycopg
from psycopg.conninfo import conninfo_to_dict


def test_connection_info(environment=None):
    environment = os.environ if environment is None else environment
    run_id = environment.get("E2E_RUN_ID", "")
    if not re.fullmatch(r"[a-f0-9]{32}", run_id):
        raise ValueError("A generated E2E_RUN_ID is required.")
    dsn = environment.get("E2E_DATABASE_URL")
    if not dsn:
        raise ValueError("E2E_DATABASE_URL is required; DB_* and .env are never used.")
    info = conninfo_to_dict(dsn)
    if info.get("dbname") != f"finance_e2e_{run_id}":
        raise ValueError("Refusing a database that does not belong to this E2E run.")
    if info.get("host") not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("E2E only supports a local PostgreSQL instance.")
    if not all(info.get(key) for key in ("user", "password", "port")):
        raise ValueError("Explicit test connection credentials and port are required.")
    allowed = {"dbname", "host", "port", "user", "password"}
    if set(info) - allowed:
        raise ValueError("Unexpected PostgreSQL connection options.")
    return info


def connect():
    info = test_connection_info()
    connection = psycopg.connect(**info, connect_timeout=5)
    if connection.info.dbname != info["dbname"]:
        connection.close()
        raise RuntimeError("Connected database does not match the E2E run.")
    return connection


def seed():
    """Reset ONLY the generated database, before every browser test/retry."""
    with connect() as connection, connection.cursor() as cursor:
        schema_path = Path(__file__).resolve().parents[2] / "data" / "schema.sql"
        cursor.execute(schema_path.read_text(encoding="utf-8"))
        cursor.execute("TRUNCATE public.transactions RESTART IDENTITY")
        cursor.executemany("""
            INSERT INTO public.transactions
                (datum, empfaenger_sender, iban, verwendungszweck, betrag_euro, kategorie, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, [
            ("2026-09-01", "E2E Arbeitgeber", None, "Testgehalt", "3000.00", "Gehalt", "Gebucht"),
            ("2026-09-02", "E2E Vermieter", None, "Testmiete", "-1000.00", "Wohnen", "Gebucht"),
            ("2026-09-03", "E2E Supermarkt", None, "Testeinkauf", "-100.00", "Lebensmittel", "Gebucht"),
        ])


def snapshot():
    with connect() as connection, connection.cursor() as cursor:
        cursor.execute("""
            SELECT id, empfaenger_sender, betrag_euro, kategorie
            FROM public.transactions ORDER BY id
        """)
        return [{"id": row[0], "counterparty": row[1], "amount": str(row[2]), "category": row[3]}
                for row in cursor.fetchall()]


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "seed":
        seed()
    elif len(sys.argv) == 2 and sys.argv[1] == "snapshot":
        print(json.dumps(snapshot()))
    else:
        raise SystemExit("Expected seed or snapshot.")
