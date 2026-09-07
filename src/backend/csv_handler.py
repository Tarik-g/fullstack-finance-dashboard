"""Parse and validate transaction CSV uploads."""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pandas as pd
from pydantic import ValidationError

from .schemas import TransactionCreate


MAX_CSV_BYTES = 2 * 1024 * 1024
MAX_CSV_ROWS = 5_000

COLUMN_ALIASES = {
    "booking_date": ("booking_date", "Datum"),
    "counterparty": ("counterparty", "Empfänger_Sender", "Empfaenger_Sender"),
    "iban": ("iban", "IBAN"),
    "purpose": ("purpose", "Verwendungszweck"),
    "amount": ("amount", "Betrag_EURO", "Betrag_Euro"),
    "category": ("category", "Kategorie"),
    "status": ("status", "Status"),
}
REQUIRED_COLUMNS = ("booking_date", "counterparty", "amount")


class CsvFormatError(ValueError):
    """Raised when the file itself cannot be processed as a transaction CSV."""


@dataclass(frozen=True)
class CsvParseResult:
    total_rows: int
    transactions: list[dict]
    errors: list[str]


def _find_columns(columns) -> dict[str, str]:
    normalized = {str(column).strip(): column for column in columns}
    mapping = {}
    for public_name, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                mapping[public_name] = normalized[alias]
                break

    missing = [column for column in REQUIRED_COLUMNS if column not in mapping]
    if missing:
        raise CsvFormatError(
            "Required columns are missing: " + ", ".join(missing) + "."
        )
    return mapping


def _parse_amount(value) -> Decimal:
    text = str(value).strip().replace(" ", "")
    if not text:
        raise InvalidOperation
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    return Decimal(text)


def _validation_message(error: ValidationError) -> str:
    first_error = error.errors()[0]
    field = ".".join(str(part) for part in first_error["loc"])
    return f"{field}: {first_error['msg']}"


def parse_transaction_csv(content: bytes) -> CsvParseResult:
    if not content:
        raise CsvFormatError("The CSV file is empty.")
    if len(content) > MAX_CSV_BYTES:
        raise CsvFormatError("The CSV file exceeds the 2 MB limit.")

    try:
        frame = pd.read_csv(
            BytesIO(content),
            sep=None,
            engine="python",
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
        )
    except (UnicodeDecodeError, pd.errors.ParserError) as error:
        raise CsvFormatError("The file must be a valid UTF-8 CSV.") from error

    if len(frame.index) > MAX_CSV_ROWS:
        raise CsvFormatError(f"The CSV file may contain at most {MAX_CSV_ROWS} rows.")

    column_mapping = _find_columns(frame.columns)
    transactions = []
    errors = []

    for index, source_row in frame.iterrows():
        row_number = index + 2
        values = {
            public_name: source_row[source_name]
            for public_name, source_name in column_mapping.items()
        }
        for optional_field in ("iban", "purpose", "category", "status"):
            values.setdefault(optional_field, None)

        try:
            values["amount"] = _parse_amount(values["amount"])
            transaction = TransactionCreate.model_validate(values)
        except (InvalidOperation, ValidationError) as error:
            if isinstance(error, ValidationError):
                reason = _validation_message(error)
            else:
                reason = "amount: value is not a valid number"
            errors.append(f"Row {row_number}: {reason}")
            continue

        transactions.append(transaction.model_dump())

    return CsvParseResult(
        total_rows=len(frame.index),
        transactions=transactions,
        errors=errors,
    )
