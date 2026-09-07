from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Response, status

from .. import database
from ..dependencies import DatabaseConnection
from ..schemas import (
    PaginatedTransactionsResponse,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)


router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


def _validate_period(year: int | None, month: int | None) -> None:
    if month is not None and year is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A year is required when filtering by month.",
        )


@router.get("", response_model=PaginatedTransactionsResponse)
def list_transactions(
    connection: DatabaseConnection,
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
    _validate_period(year, month)
    return database.get_paginated_transactions(
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


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, connection: DatabaseConnection):
    transaction = database.get_transaction_by_id(connection, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return transaction


@router.post("", response_model=TransactionResponse, status_code=201)
def create_transaction(
    transaction: TransactionCreate,
    connection: DatabaseConnection,
):
    created = database.insert_transaction(connection, transaction.model_dump())
    if created is None:
        raise HTTPException(status_code=409, detail="Transaction already exists.")
    return created


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    transaction: TransactionUpdate,
    connection: DatabaseConnection,
):
    updates = transaction.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    updated = database.update_transaction_by_id(connection, transaction_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return updated


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, connection: DatabaseConnection):
    if not database.delete_transaction_by_id(connection, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return Response(status_code=204)
