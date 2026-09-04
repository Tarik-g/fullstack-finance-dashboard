import os

from fastapi import FastAPI
from fastapi import HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Literal

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", status_code=status.HTTP_200_OK)
async def root():
    return {"message": "Finance Dashboard API is running."}




from pydantic import BaseModel
from datetime import date
from decimal import Decimal


class TransactionCreate(BaseModel):
    datum: date
    empfaenger_sender: str
    iban: str | None = None
    verwendungszweck: str | None = None
    betrag_euro: Decimal
    kategorie: str | None = None
    status: str | None = None


class TransactionUpdate(BaseModel):
    datum: date | None = None
    empfaenger_sender: str | None = None
    iban: str | None = None
    verwendungszweck: str | None = None
    betrag_euro: Decimal | None = None
    kategorie: str | None = None
    status: str | None = None


class TransactionResponse(BaseModel):
    id: int
    datum: date
    empfaenger_sender: str
    iban: str | None = None
    verwendungszweck: str | None = None
    betrag_euro: Decimal
    kategorie: str | None = None
    status: str | None = None


class PaginatedTransactionsResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class FinancialSummaryResponse(BaseModel):
    transaction_count: int
    income: Decimal
    expenses: Decimal
    balance: Decimal


class TimelinePointResponse(BaseModel):
    period: date
    income: Decimal
    expenses: Decimal


class CategoryTotalResponse(BaseModel):
    category: str
    amount: Decimal


def transaction_to_response(transaction):
    return {
        "id": transaction[0],
        "datum": transaction[1],
        "empfaenger_sender": transaction[2],
        "iban": transaction[3],
        "verwendungszweck": transaction[4],
        "betrag_euro": transaction[5],
        "kategorie": transaction[6],
        "status": transaction[7],
    }


def validate_period(year, month):
    if month is not None and year is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"error": "A year is required when filtering by month."},
        )


@app.get("/api/v1/health", status_code=status.HTTP_200_OK)
def get_health():
    return {"status": "ok"}


@app.get(
    "/api/v1/transactions",
    response_model=PaginatedTransactionsResponse,
    status_code=status.HTTP_200_OK,
)
def get_paginated_transactions_v1(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    transaction_type: Literal["all", "income", "expense"] = "all",
    category: str | None = Query(default=None, max_length=100),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    sort_by: Literal["booking_date", "amount"] = "booking_date",
    sort_direction: Literal["asc", "desc"] = "desc",
):
    """Return a filtered, sorted and paginated transaction list."""
    from .database import get_paginated_transactions, get_postgres_connection

    validate_period(year, month)
    connection = get_postgres_connection()

    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not connect to the database."},
        )

    try:
        result = get_paginated_transactions(
            connection,
            page=page,
            page_size=page_size,
            search=search,
            transaction_type=transaction_type,
            category=category,
            year=year,
            month=month,
            sort_by=sort_by,
            sort_direction=sort_direction,
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not retrieve transactions."},
        ) from error
    finally:
        connection.close()

    return {
        **result,
        "items": [transaction_to_response(item) for item in result["items"]],
    }


@app.get(
    "/api/v1/analytics/summary",
    response_model=FinancialSummaryResponse,
    status_code=status.HTTP_200_OK,
)
def get_financial_summary_v1():
    """Return overall values for the persistent summary cards."""
    from .database import get_postgres_connection, get_transaction_summary

    connection = get_postgres_connection()
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not connect to the database."},
        )

    try:
        return get_transaction_summary(connection)
    finally:
        connection.close()


@app.get(
    "/api/v1/analytics/timeline",
    response_model=list[TimelinePointResponse],
    status_code=status.HTTP_200_OK,
)
def get_timeline_v1(
    granularity: Literal["month", "day"] = "month",
    search: str | None = Query(default=None, max_length=100),
    transaction_type: Literal["all", "income", "expense"] = "all",
    category: str | None = Query(default=None, max_length=100),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
):
    """Return server-side timeline aggregations for the bar chart."""
    from .database import get_postgres_connection, get_transaction_timeline

    validate_period(year, month)
    connection = get_postgres_connection()
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not connect to the database."},
        )

    try:
        rows = get_transaction_timeline(
            connection,
            granularity=granularity,
            search=search,
            transaction_type=transaction_type,
            category=category,
            year=year,
            month=month,
        )
        return [
            {"period": row[0], "income": row[1], "expenses": row[2]}
            for row in rows
        ]
    finally:
        connection.close()


@app.get(
    "/api/v1/analytics/categories",
    response_model=list[CategoryTotalResponse],
    status_code=status.HTTP_200_OK,
)
def get_category_totals_v1(
    search: str | None = Query(default=None, max_length=100),
    transaction_type: Literal["all", "income", "expense"] = "all",
    category: str | None = Query(default=None, max_length=100),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
):
    """Return server-side expense totals grouped by category."""
    from .database import get_expenses_by_category, get_postgres_connection

    validate_period(year, month)
    connection = get_postgres_connection()
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not connect to the database."},
        )

    try:
        rows = get_expenses_by_category(
            connection,
            search=search,
            transaction_type=transaction_type,
            category=category,
            year=year,
            month=month,
        )
        return [{"category": row[0], "amount": row[1]} for row in rows]
    finally:
        connection.close()


@app.get(
    "/api/v1/categories",
    response_model=list[str],
    status_code=status.HTTP_200_OK,
)
def get_categories_v1():
    from .database import get_all_categories, get_postgres_connection

    connection = get_postgres_connection()
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not connect to the database."},
        )

    try:
        return get_all_categories(connection)
    finally:
        connection.close()


@app.get(
    "/api/v1/years",
    response_model=list[int],
    status_code=status.HTTP_200_OK,
)
def get_years_v1():
    from .database import get_available_years, get_postgres_connection

    connection = get_postgres_connection()
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not connect to the database."},
        )

    try:
        return get_available_years(connection)
    finally:
        connection.close()


@app.get("/transactions", response_model=list[TransactionResponse], status_code=status.HTTP_200_OK, responses={
        500: {"description": "Database connection failed"}
    })
async def get_transactions():
    """
    Endpoint to retrieve all transactions from the database as json Objects

    Returns:
        list: A list of transactions.
    """
    from .database import get_postgres_connection, get_all_transactions
    connection = get_postgres_connection()
    if connection is None:
        # statuscodes
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"error": "Could not connect to the database."})
    transactions = get_all_transactions(connection)
    connection.close()
    
    # Convert transactions to a list of dictionaries for JSON response
    transactions_list = [
        {
            "id": t[0],
            "datum": t[1],
            "empfaenger_sender": t[2],
            "iban": t[3],
            "verwendungszweck": t[4],
            "betrag_euro": t[5],
            "kategorie": t[6],
            "status": t[7]
        }
        for t in transactions
    ]
    
    return transactions_list

@app.get("/transactions/{transaction_id}", response_model=TransactionResponse,status_code=status.HTTP_200_OK, responses={
        404: {"description": "Transaction not found"},
        422: {"description": "Invalid transaction ID"},
        500: {"description": "Database connection failed"}
    })
async def get_transaction(transaction_id: int):
    """
    Endpoint to retrieve a specific transaction by its ID.

    Args:
        transaction_id (int): The ID of the transaction to retrieve.

    Returns:
        dict: A dictionary containing the transaction details or an error message.
    """
    from .database import get_postgres_connection, get_transaction_by_id
    connection = get_postgres_connection()
    if connection is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"error": "Could not connect to the database."})
    
    transaction = get_transaction_by_id(connection, transaction_id)
    connection.close()
    
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": f"Transaction with ID {transaction_id} not found."})
    
    # Convert transaction to a dictionary for JSON response
    transaction_dict = {
        "id": transaction[0],
        "datum": transaction[1],
        "empfaenger_sender": transaction[2],
        "iban": transaction[3],
        "verwendungszweck": transaction[4],
        "betrag_euro": transaction[5],
        "kategorie": transaction[6],
        "status": transaction[7]
    }
    
    return transaction_dict


# POST   /transactions
@app.post("/transactions", status_code=status.HTTP_201_CREATED, responses={
        400: {"description": "Invalid transaction data"},
        422: {"description": "Validation error"},
        500: {"description": "Database connection failed"}
    })
async def create_transaction(transaction_data: TransactionCreate):
    """
    Endpoint to insert a new transaction into the database.

    Args:
        transaction_data (TransactionCreate): A Pydantic model containing the transaction data.

    Returns:
        dict: A dictionary indicating success or failure of the insertion.
    """
    from .database import get_postgres_connection, insert_transaction
    connection = get_postgres_connection()
    if connection is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"error": "Could not connect to the database."})
    
    # Convert the incoming JSON data to a tuple for insertion
    transaction_tuple = (
        transaction_data.datum,
        transaction_data.empfaenger_sender,
        transaction_data.iban,
        transaction_data.verwendungszweck,
        transaction_data.betrag_euro,
        transaction_data.kategorie,
        transaction_data.status
    )
    
    try:
        success = insert_transaction(connection, transaction_tuple)
    finally:
        connection.close()
    
    if success:
        raise HTTPException(status_code=status.HTTP_201_CREATED, detail={"message": "Transaction inserted successfully."})
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": "Failed to insert transaction."})


# PATCH /transactions/{id}
@app.patch(
    "/transactions/{transaction_id}",
    response_model=TransactionResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "No fields supplied"},
        404: {"description": "Transaction not found"},
        422: {"description": "Invalid transaction data"},
        500: {"description": "Database operation failed"},
    },
)
async def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
):
    """Updates only the transaction fields included in the request body."""
    from .database import get_postgres_connection, update_transaction_by_id

    updates = transaction_data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "At least one field must be supplied."},
        )

    connection = get_postgres_connection()

    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not connect to the database."},
        )

    try:
        updated_transaction = update_transaction_by_id(
            connection,
            transaction_id,
            updates,
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not update the transaction."},
        ) from error
    finally:
        connection.close()

    if updated_transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": f"Transaction with ID {transaction_id} not found."},
        )

    return {
        "id": updated_transaction[0],
        "datum": updated_transaction[1],
        "empfaenger_sender": updated_transaction[2],
        "iban": updated_transaction[3],
        "verwendungszweck": updated_transaction[4],
        "betrag_euro": updated_transaction[5],
        "kategorie": updated_transaction[6],
        "status": updated_transaction[7],
    }


# DELETE /transactions/{id}
@app.delete("/transactions/{transaction_id}", status_code=status.HTTP_200_OK, responses={
        404: {"description": "Transaction not found"},
        422: {"description": "Invalid transaction ID"},
        500: {"description": "Database connection failed"}
    })
async def delete_transaction(transaction_id: int):
    """
    Endpoint to delete a specific transaction by its ID.

    Args:
        transaction_id (int): The ID of the transaction to delete.

    Returns:
        dict: A dictionary indicating success or failure of the deletion.
    """
    from .database import get_postgres_connection, delete_transaction_by_id
    connection = get_postgres_connection()
    if connection is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"error": "Could not connect to the database."})
    
    try:
        success = delete_transaction_by_id(connection, transaction_id)
    finally:
        connection.close()
    
    if success:
        raise HTTPException(status_code=status.HTTP_200_OK, detail={"message": f"Transaction with ID {transaction_id} deleted successfully."})
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": f"Failed to delete transaction with ID {transaction_id}."})


@app.get(
    "/categories",
    response_model=list[str],
    status_code=status.HTTP_200_OK,
    responses={
        500: {"description": "Database connection failed"}
    }
)
async def get_categories():
    from .database import get_postgres_connection, get_all_categories

    connection = get_postgres_connection()

    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Could not connect to the database."},
        )

    categories = get_all_categories(connection)
    connection.close()

    return categories
