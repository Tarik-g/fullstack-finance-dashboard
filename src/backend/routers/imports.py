from fastapi import APIRouter, File, HTTPException, UploadFile

from .. import database
from ..csv_handler import CsvFormatError, MAX_CSV_BYTES, parse_transaction_csv
from ..dependencies import DatabaseConnection
from ..schemas import CsvImportResponse


router = APIRouter(prefix="/api/v1/imports", tags=["imports"])


@router.post("/csv", response_model=CsvImportResponse)
def import_csv(
    connection: DatabaseConnection,
    file: UploadFile = File(description="UTF-8 CSV with transaction rows"),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please select a CSV file.")

    content = file.file.read(MAX_CSV_BYTES + 1)
    try:
        parsed = parse_transaction_csv(content)
    except CsvFormatError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        file.file.close()

    inserted = skipped = 0
    if parsed.transactions:
        inserted, skipped = database.import_transactions(
            connection, parsed.transactions
        )

    return {
        "total_rows": parsed.total_rows,
        "inserted": inserted,
        "skipped": skipped,
        "failed": len(parsed.errors),
        "errors": parsed.errors,
    }
