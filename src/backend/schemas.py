"""Pydantic models for the public, English REST API."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransactionBase(BaseModel):
    booking_date: date
    counterparty: str = Field(min_length=1, max_length=255)
    iban: str | None = Field(default=None, max_length=34)
    purpose: str | None = None
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    category: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=50)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("iban", "purpose", "category", "status", mode="before")
    @classmethod
    def empty_string_to_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    booking_date: date | None = None
    counterparty: str | None = Field(default=None, min_length=1, max_length=255)
    iban: str | None = Field(default=None, max_length=34)
    purpose: str | None = None
    amount: Decimal | None = Field(default=None, max_digits=12, decimal_places=2)
    category: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=50)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("booking_date", "counterparty", "amount", mode="before")
    @classmethod
    def required_fields_cannot_be_cleared(cls, value):
        if value is None:
            raise ValueError("field cannot be null")
        return value

    @field_validator("iban", "purpose", "category", "status", mode="before")
    @classmethod
    def empty_string_to_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value


class TransactionResponse(TransactionBase):
    id: int


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


class CsvImportResponse(BaseModel):
    total_rows: int
    inserted: int
    skipped: int
    failed: int
    errors: list[str]
