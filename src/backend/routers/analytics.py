from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status

from .. import database
from ..dependencies import DatabaseConnection, DemoSessionId
from ..schemas import (
    CategoryTotalResponse,
    FinancialSummaryResponse,
    TimelinePointResponse,
)


router = APIRouter(prefix="/api/v1", tags=["analytics"])


def _validate_period(year: int | None, month: int | None) -> None:
    if month is not None and year is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A year is required when filtering by month.",
        )


@router.get("/analytics/summary", response_model=FinancialSummaryResponse)
def get_summary(connection: DatabaseConnection, demo_session_id: DemoSessionId):
    return database.get_transaction_summary(
        connection, demo_session_id=demo_session_id
    )


@router.get("/analytics/timeline", response_model=list[TimelinePointResponse])
def get_timeline(
    connection: DatabaseConnection,
    demo_session_id: DemoSessionId,
    granularity: Literal["month", "day"] = "month",
    search: str | None = Query(default=None, max_length=100),
    transaction_type: Literal["all", "income", "expense"] = "all",
    category: str | None = Query(default=None, max_length=100),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
):
    _validate_period(year, month)
    return database.get_transaction_timeline(
        connection,
        granularity=granularity,
        search=search,
        transaction_type=transaction_type,
        category=category,
        year=year,
        month=month,
        demo_session_id=demo_session_id,
    )


@router.get("/analytics/categories", response_model=list[CategoryTotalResponse])
def get_categories(
    connection: DatabaseConnection,
    demo_session_id: DemoSessionId,
    search: str | None = Query(default=None, max_length=100),
    transaction_type: Literal["all", "income", "expense"] = "all",
    category: str | None = Query(default=None, max_length=100),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
):
    _validate_period(year, month)
    return database.get_expenses_by_category(
        connection,
        search=search,
        transaction_type=transaction_type,
        category=category,
        year=year,
        month=month,
        demo_session_id=demo_session_id,
    )


@router.get("/categories", response_model=list[str], tags=["metadata"])
def get_transaction_categories(
    connection: DatabaseConnection, demo_session_id: DemoSessionId
):
    return database.get_all_categories(
        connection, demo_session_id=demo_session_id
    )


@router.get("/years", response_model=list[int], tags=["metadata"])
def get_years(connection: DatabaseConnection, demo_session_id: DemoSessionId):
    return database.get_available_years(
        connection, demo_session_id=demo_session_id
    )
