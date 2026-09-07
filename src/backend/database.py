"""PostgreSQL queries for the finance dashboard.

The public API uses English names. The SQL in this module deliberately maps
those names to the existing German database columns so local data remains
compatible while the application is being modernised.
"""

import os
from datetime import date

import psycopg
from psycopg import OperationalError, sql

from .config import get_settings


TRANSACTION_COLUMNS = """
    id,
    datum,
    empfaenger_sender,
    iban,
    verwendungszweck,
    betrag_euro,
    kategorie,
    status
"""

API_TO_DATABASE_COLUMNS = {
    "booking_date": "datum",
    "counterparty": "empfaenger_sender",
    "iban": "iban",
    "purpose": "verwendungszweck",
    "amount": "betrag_euro",
    "category": "kategorie",
    "status": "status",
}


def _transaction_from_row(row):
    if row is None:
        return None
    return {
        "id": row[0],
        "booking_date": row[1],
        "counterparty": row[2],
        "iban": row[3],
        "purpose": row[4],
        "amount": row[5],
        "category": row[6],
        "status": row[7],
    }


def get_postgres_connection():
    """Connect using DATABASE_URL, falling back to the legacy DB_* variables."""
    settings = get_settings()
    try:
        if settings.database_url:
            return psycopg.connect(settings.database_url)

        connection_parameters = {
            "dbname": os.getenv("DB_NAME"),
            "user": os.getenv("DB_USER"),
            "password": os.getenv("DB_PASSWORD"),
            "host": os.getenv("DB_HOST"),
            "port": os.getenv("DB_PORT"),
        }
        return psycopg.connect(
            **{key: value for key, value in connection_parameters.items() if value}
        )
    except OperationalError:
        return None


def _build_transaction_filters(
    search=None,
    transaction_type="all",
    category=None,
    year=None,
    month=None,
):
    """Build a reusable, parameterised WHERE clause for dashboard queries."""
    conditions = []
    parameters = []

    if search and search.strip():
        conditions.append(
            sql.SQL(
                """
                CONCAT_WS(
                    ' ',
                    empfaenger_sender,
                    iban,
                    verwendungszweck,
                    kategorie,
                    status
                ) ILIKE %s
                """
            )
        )
        literal_search = (
            search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        parameters.append(f"%{literal_search}%")

    if transaction_type == "income":
        conditions.append(sql.SQL("betrag_euro >= 0"))
    elif transaction_type == "expense":
        conditions.append(sql.SQL("betrag_euro < 0"))

    if category:
        conditions.append(sql.SQL("kategorie = %s"))
        parameters.append(category)

    if year is not None:
        period_start = date(year, month or 1, 1)
        if month is None or month == 12:
            period_end = date(year + 1, 1, 1)
        else:
            period_end = date(year, month + 1, 1)

        conditions.extend((sql.SQL("datum >= %s"), sql.SQL("datum < %s")))
        parameters.extend((period_start, period_end))

    if not conditions:
        return sql.SQL(" WHERE TRUE"), parameters
    return sql.SQL(" WHERE ") + sql.SQL(" AND ").join(conditions), parameters


def get_paginated_transactions(
    connection,
    page=1,
    page_size=10,
    search=None,
    transaction_type="all",
    category=None,
    year=None,
    month=None,
    sort_by="booking_date",
    sort_direction="desc",
):
    """Return a filtered transaction page with pagination metadata."""
    where_clause, parameters = _build_transaction_filters(
        search=search,
        transaction_type=transaction_type,
        category=category,
        year=year,
        month=month,
    )
    sort_columns = {
        "booking_date": sql.Identifier("datum"),
        "amount": sql.Identifier("betrag_euro"),
    }
    sort_column = sort_columns[sort_by]
    sort_order = sql.SQL("ASC" if sort_direction == "asc" else "DESC")

    with connection.cursor() as cursor:
        cursor.execute(
            sql.SQL("SELECT COUNT(*) FROM public.transactions{where_clause};").format(
                where_clause=where_clause
            ),
            parameters,
        )
        total = cursor.fetchone()[0]
        total_pages = max(1, (total + page_size - 1) // page_size)
        effective_page = min(page, total_pages)
        offset = (effective_page - 1) * page_size

        cursor.execute(
            sql.SQL(
                f"""
                SELECT {TRANSACTION_COLUMNS}
                FROM public.transactions
                {{where_clause}}
                ORDER BY {{sort_column}} {{sort_order}}, id DESC
                LIMIT %s OFFSET %s;
                """
            ).format(
                where_clause=where_clause,
                sort_column=sort_column,
                sort_order=sort_order,
            ),
            [*parameters, page_size, offset],
        )
        items = [_transaction_from_row(row) for row in cursor.fetchall()]

    return {
        "items": items,
        "total": total,
        "page": effective_page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_transaction_summary(connection):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                COUNT(*),
                COALESCE(SUM(betrag_euro) FILTER (WHERE betrag_euro > 0), 0),
                ABS(COALESCE(SUM(betrag_euro) FILTER (WHERE betrag_euro < 0), 0))
            FROM public.transactions;
            """
        )
        transaction_count, income, expenses = cursor.fetchone()

    return {
        "transaction_count": transaction_count,
        "income": income,
        "expenses": expenses,
        "balance": income - expenses,
    }


def get_transaction_timeline(
    connection,
    granularity="month",
    search=None,
    transaction_type="all",
    category=None,
    year=None,
    month=None,
):
    where_clause, parameters = _build_transaction_filters(
        search=search,
        transaction_type=transaction_type,
        category=category,
        year=year,
        month=month,
    )
    query = sql.SQL(
        """
        SELECT
            DATE_TRUNC({trunc_unit}, datum)::date AS period,
            COALESCE(SUM(betrag_euro) FILTER (WHERE betrag_euro >= 0), 0),
            ABS(COALESCE(SUM(betrag_euro) FILTER (WHERE betrag_euro < 0), 0))
        FROM public.transactions
        {where_clause}
        GROUP BY period
        ORDER BY period;
        """
    ).format(
        trunc_unit=sql.Literal("day" if granularity == "day" else "month"),
        where_clause=where_clause,
    )

    with connection.cursor() as cursor:
        cursor.execute(query, parameters)
        return [
            {"period": row[0], "income": row[1], "expenses": row[2]}
            for row in cursor.fetchall()
        ]


def get_expenses_by_category(
    connection,
    search=None,
    transaction_type="all",
    category=None,
    year=None,
    month=None,
):
    where_clause, parameters = _build_transaction_filters(
        search=search,
        transaction_type=transaction_type,
        category=category,
        year=year,
        month=month,
    )
    where_clause += sql.SQL(" AND betrag_euro < 0")
    query = sql.SQL(
        """
        SELECT
            COALESCE(NULLIF(TRIM(kategorie), ''), 'Ohne Kategorie'),
            ABS(SUM(betrag_euro))
        FROM public.transactions
        {where_clause}
        GROUP BY 1
        ORDER BY 2 DESC, 1;
        """
    ).format(where_clause=where_clause)

    with connection.cursor() as cursor:
        cursor.execute(query, parameters)
        return [
            {"category": row[0], "amount": row[1]} for row in cursor.fetchall()
        ]


def get_all_categories(connection):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT kategorie
            FROM public.transactions
            WHERE kategorie IS NOT NULL AND TRIM(kategorie) <> ''
            ORDER BY kategorie;
            """
        )
        return [row[0] for row in cursor.fetchall()]


def get_available_years(connection):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT EXTRACT(YEAR FROM datum)::integer
            FROM public.transactions
            ORDER BY 1 DESC;
            """
        )
        return [row[0] for row in cursor.fetchall()]


def get_transaction_by_id(connection, transaction_id):
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT {TRANSACTION_COLUMNS}
            FROM public.transactions
            WHERE id = %s;
            """,
            (transaction_id,),
        )
        return _transaction_from_row(cursor.fetchone())


def insert_transaction(connection, transaction):
    """Insert one transaction and return it, or None when it is a duplicate."""
    ordered_fields = tuple(API_TO_DATABASE_COLUMNS)
    values = tuple(transaction[field] for field in ordered_fields)
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                INSERT INTO public.transactions (
                    datum, empfaenger_sender, iban, verwendungszweck,
                    betrag_euro, kategorie, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING {TRANSACTION_COLUMNS};
                """,
                values,
            )
            created = _transaction_from_row(cursor.fetchone())
        connection.commit()
        return created
    except Exception:
        connection.rollback()
        raise


def update_transaction_by_id(connection, transaction_id, transaction):
    fields = {
        API_TO_DATABASE_COLUMNS[field]: value
        for field, value in transaction.items()
        if field in API_TO_DATABASE_COLUMNS
    }
    if not fields:
        return get_transaction_by_id(connection, transaction_id)

    assignments = [
        sql.SQL("{} = %s").format(sql.Identifier(column)) for column in fields
    ]
    query = sql.SQL(
        f"""
        UPDATE public.transactions
        SET {{assignments}}
        WHERE id = %s
        RETURNING {TRANSACTION_COLUMNS};
        """
    ).format(assignments=sql.SQL(", ").join(assignments))

    try:
        with connection.cursor() as cursor:
            cursor.execute(query, [*fields.values(), transaction_id])
            updated = _transaction_from_row(cursor.fetchone())
        connection.commit()
        return updated
    except Exception:
        connection.rollback()
        raise


def delete_transaction_by_id(connection, transaction_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM public.transactions WHERE id = %s;",
                (transaction_id,),
            )
            deleted = cursor.rowcount > 0
        connection.commit()
        return deleted
    except Exception:
        connection.rollback()
        raise


def import_transactions(connection, transactions):
    """Insert validated CSV rows atomically and return inserted/skipped counts."""
    inserted = 0
    skipped = 0
    ordered_fields = tuple(API_TO_DATABASE_COLUMNS)
    query = f"""
        INSERT INTO public.transactions (
            datum, empfaenger_sender, iban, verwendungszweck,
            betrag_euro, kategorie, status
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        RETURNING id;
    """

    try:
        with connection.cursor() as cursor:
            for transaction in transactions:
                cursor.execute(query, tuple(transaction[field] for field in ordered_fields))
                if cursor.fetchone() is None:
                    skipped += 1
                else:
                    inserted += 1
        connection.commit()
    except Exception:
        connection.rollback()
        raise

    return inserted, skipped
