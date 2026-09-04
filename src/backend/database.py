import os
from datetime import date

import psycopg

from dotenv import load_dotenv
from psycopg import OperationalError
from psycopg import sql

load_dotenv()


def get_postgres_connection():
    """
    Establishes a connection to the PostgreSQL database using the provided configuration.

    Returns:
        connection: A psycopg connection object to the PostgreSQL database.
    """
    import psycopg
    from psycopg import OperationalError

    # Database configuration parameters
    db_config = {
        'dbname': os.getenv('DB_NAME'),
        'user': os.getenv('DB_USER'),
        'password': os.getenv('DB_PASSWORD'),
        'host': os.getenv('DB_HOST'),
        'port': os.getenv('DB_PORT')
    }

    try:
        # Establishing the connection
        connection = psycopg.connect(**db_config)
        print("Connection to PostgreSQL database established successfully.")
        return connection
    except OperationalError as e:
        print(f"Error: Could not connect to the PostgreSQL database. {e}")
        return None


def get_all_transactions(connection):
    """
    Retrieves all transactions from the 'transactions' table in the PostgreSQL database.

    Args:
        connection: A psycopg connection object to the PostgreSQL database.

    Returns:
        transactions: A list of tuples containing all transactions from the 'transactions' table.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    datum,
                    empfaenger_sender,
                    iban,
                    verwendungszweck,
                    betrag_euro,
                    kategorie,
                    status
                FROM public.transactions
                ORDER BY datum DESC, id DESC;
                """
            )
            transactions = cursor.fetchall()
            return transactions
    except Exception as e:
        print(f"Error: Could not retrieve transactions. {e}")
        return []


def _build_transaction_filters(
    search=None,
    transaction_type="all",
    category=None,
    year=None,
    month=None,
):
    """Build a reusable, parameterized WHERE clause for dashboard queries."""
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
        # Treat user input as literal text, not as SQL LIKE wildcards.
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

        if month is None:
            period_end = date(year + 1, 1, 1)
        elif month == 12:
            period_end = date(year + 1, 1, 1)
        else:
            period_end = date(year, month + 1, 1)

        conditions.extend(
            [sql.SQL("datum >= %s"), sql.SQL("datum < %s")]
        )
        parameters.extend([period_start, period_end])

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
    """Return one filtered and sorted transaction page plus its metadata."""
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
        count_query = sql.SQL(
            "SELECT COUNT(*) FROM public.transactions{where_clause};"
        ).format(where_clause=where_clause)
        cursor.execute(count_query, parameters)
        total = cursor.fetchone()[0]

        total_pages = max(1, (total + page_size - 1) // page_size)
        effective_page = min(page, total_pages)
        offset = (effective_page - 1) * page_size

        select_query = sql.SQL(
            """
            SELECT
                id,
                datum,
                empfaenger_sender,
                iban,
                verwendungszweck,
                betrag_euro,
                kategorie,
                status
            FROM public.transactions
            {where_clause}
            ORDER BY {sort_column} {sort_order}, id DESC
            LIMIT %s OFFSET %s;
            """
        ).format(
            where_clause=where_clause,
            sort_column=sort_column,
            sort_order=sort_order,
        )
        cursor.execute(select_query, [*parameters, page_size, offset])
        items = cursor.fetchall()

    return {
        "items": items,
        "total": total,
        "page": effective_page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_transaction_summary(connection):
    """Return overall totals used by the dashboard summary cards."""
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
    """Aggregate filtered income and expenses by month or day."""
    where_clause, parameters = _build_transaction_filters(
        search=search,
        transaction_type=transaction_type,
        category=category,
        year=year,
        month=month,
    )
    trunc_unit = sql.Literal("day" if granularity == "day" else "month")
    query = sql.SQL(
        """
        SELECT
            DATE_TRUNC({trunc_unit}, datum)::date AS period,
            COALESCE(SUM(betrag_euro) FILTER (WHERE betrag_euro >= 0), 0) AS income,
            ABS(COALESCE(SUM(betrag_euro) FILTER (WHERE betrag_euro < 0), 0)) AS expenses
        FROM public.transactions
        {where_clause}
        GROUP BY period
        ORDER BY period;
        """
    ).format(trunc_unit=trunc_unit, where_clause=where_clause)

    with connection.cursor() as cursor:
        cursor.execute(query, parameters)
        return cursor.fetchall()


def get_expenses_by_category(
    connection,
    search=None,
    transaction_type="all",
    category=None,
    year=None,
    month=None,
):
    """Aggregate filtered expenses by category."""
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
            COALESCE(NULLIF(TRIM(kategorie), ''), 'Ohne Kategorie') AS category,
            ABS(SUM(betrag_euro)) AS amount
        FROM public.transactions
        {where_clause}
        GROUP BY category
        ORDER BY amount DESC, category;
        """
    ).format(where_clause=where_clause)

    with connection.cursor() as cursor:
        cursor.execute(query, parameters)
        return cursor.fetchall()


def get_available_years(connection):
    """Return all years represented in the transaction table."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT EXTRACT(YEAR FROM datum)::integer AS year
            FROM public.transactions
            ORDER BY year DESC;
            """
        )
        return [row[0] for row in cursor.fetchall()]


def get_transaction_by_id(connection, transaction_id):
    """
    Retrieves a specific transaction by its ID from the 'transactions' table in the PostgreSQL database.

    Args:
        connection: A psycopg connection object to the PostgreSQL database.
        transaction_id: The ID of the transaction to retrieve.#
    
    Returns:
        transaction: A tuple containing the transaction details, or None if not found.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM public.transactions WHERE id = %s;", (transaction_id,))
            transaction = cursor.fetchone()
            return transaction
    except Exception as e:
        print(f"Error: Could not retrieve transaction with ID {transaction_id}. {e}")
        return None

def delete_transaction_by_id(connection, transaction_id):
    """
    Deletes a specific transaction by its ID from the 'transactions' table in the PostgreSQL database.

    Args:
        connection: A psycopg connection object to the PostgreSQL database.
        transaction_id: The ID of the transaction to delete.

    Returns:
        success: A boolean indicating whether the deletion was successful.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM public.transactions WHERE id = %s;", (transaction_id,))
            was_deleted = cursor.rowcount > 0
            connection.commit()

            if was_deleted:
                print(f"Transaction with ID {transaction_id} deleted successfully.")

            return was_deleted
    except Exception as e:
        print(f"Error: Could not delete transaction with ID {transaction_id}. {e}")
        connection.rollback()
        return False


def update_transaction_by_id(connection, transaction_id, transaction_data):
    """
    Updates only the provided fields of a transaction and returns the updated row.

    Args:
        connection: A psycopg connection object to the PostgreSQL database.
        transaction_id: The ID of the transaction to update.
        transaction_data: A dictionary containing the fields to update.

    Returns:
        tuple | None: The updated transaction, or None if the ID does not exist.
    """
    allowed_columns = {
        "datum",
        "empfaenger_sender",
        "iban",
        "verwendungszweck",
        "betrag_euro",
        "kategorie",
        "status",
    }
    fields_to_update = {
        column: value
        for column, value in transaction_data.items()
        if column in allowed_columns
    }

    if not fields_to_update:
        return get_transaction_by_id(connection, transaction_id)

    assignments = [
        sql.SQL("{} = %s").format(sql.Identifier(column))
        for column in fields_to_update
    ]
    update_query = sql.SQL(
        """
        UPDATE public.transactions
        SET {assignments}
        WHERE id = %s
        RETURNING
            id,
            datum,
            empfaenger_sender,
            iban,
            verwendungszweck,
            betrag_euro,
            kategorie,
            status;
        """
    ).format(assignments=sql.SQL(", ").join(assignments))
    query_values = [*fields_to_update.values(), transaction_id]

    try:
        with connection.cursor() as cursor:
            cursor.execute(update_query, query_values)
            updated_transaction = cursor.fetchone()
            connection.commit()
            return updated_transaction
    except Exception as error:
        print(f"Error: Could not update transaction with ID {transaction_id}. {error}")
        connection.rollback()
        raise

# insert_transaction() selbst mit cursor.execute(...) connection.commit()

def insert_transaction(connection, transaction_data):
    """
    Inserts a new transaction into the 'transactions' table in the PostgreSQL database.

    Args:
        connection: A psycopg connection object to the PostgreSQL database.
        transaction_data: A tuple containing the transaction data to be inserted.

    Returns:
        success: A boolean indicating whether the insertion was successful.
    """
    try:
        with connection.cursor() as cursor:
            # only insert if ist not duplicate via UNIQUE constraint and on conflict do nothing

            insert_query = """
                INSERT INTO public.transactions (
                    datum,
                    empfaenger_sender,
                    iban,
                    verwendungszweck,
                    betrag_euro,
                    kategorie,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING;
            """
            cursor.execute(insert_query, transaction_data)
            was_inserted = cursor.rowcount > 0
            connection.commit()
            if was_inserted:
                print("Transaction inserted successfully.")
            return was_inserted
    except Exception as e:
        print(f"Error: Could not insert transaction. {e}")
        connection.rollback()
        return False


def insert_csv_into_database(connection, csv_file_path):
    """
    Reads a CSV file and inserts its data into the 'transactions' table in the PostgreSQL database.

    Args:
        connection: A psycopg connection object to the PostgreSQL database.
        csv_file_path: The file path to the CSV file containing transaction data.
    Returns:
        success: A boolean indicating whether the insertion was successful.
    """
    import csv_handler

    # Read the CSV file into a DataFrame
    df = csv_handler.read_csv(csv_file_path)

    # Validate the DataFrame
    if not csv_handler.validate_csv(df):
        print("Error: CSV file is not valid.")
        return False


    # Insert each row of the DataFrame into the database
    for index, row in df.iterrows():
        transaction_data = (
            row['Datum'],
            row['Empfänger_Sender'],
            row['IBAN'],
            row['Verwendungszweck'],
            row['Betrag_EURO'],
            row['Kategorie'],
            row['Status']
        )
        if not insert_transaction(connection, transaction_data):
            print(f"Error: Could not insert transaction at index {index}.")
            return False

    print("All transactions from CSV inserted successfully.")
    return True


def remove_database_duplicates(connection):
    """
    Removes duplicate transactions from the 'transactions' table in the PostgreSQL database.
    """
    try:
        with connection.cursor() as cursor:
            delete_query = """
                DELETE FROM public.transactions a
                USING public.transactions b
                WHERE a.id > b.id
                AND a.datum = b.datum
                AND a.empfaenger_sender = b.empfaenger_sender
                AND a.iban = b.iban
                AND a.verwendungszweck = b.verwendungszweck
                AND a.betrag_euro = b.betrag_euro
                AND a.kategorie = b.kategorie
                AND a.status = b.status;
            """

            cursor.execute(delete_query)
            connection.commit()

            print("Duplicate transactions removed successfully.")
            return True

    except Exception as e:
        print(f"Error: Could not remove duplicates. {e}")
        connection.rollback()
        return False

def get_all_categories(connection):
    """
    Returns all distinct, non-empty transaction categories.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT DISTINCT kategorie
                FROM public.transactions
                WHERE kategorie IS NOT NULL
                  AND TRIM(kategorie) <> ''
                ORDER BY kategorie;
                """
            )

            rows = cursor.fetchall()
            return [row[0] for row in rows]

    except Exception as error:
        print(f"Error: Could not retrieve categories. {error}")
        return []


if __name__ == "__main__":
    connection = get_postgres_connection()
    transactions = get_all_transactions(connection)
    print(transactions)

    # insert_transaction(connection, ('2024-06-01', 'John Doe', 'DE12345678901234567890', 'Payment for services', 100.00, 'Services', 'Completed'))

    insert_csv_into_database(connection, 'data/transactions.csv')

    remove_database_duplicates(connection)

    transactions = get_all_transactions(connection)
    print(transactions)


    if connection:
        connection.close()
        print("Connection closed.")
