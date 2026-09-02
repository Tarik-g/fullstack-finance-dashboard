from fastapi import FastAPI
from fastapi import HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
    
    success = insert_transaction(connection, transaction_tuple)
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
    
    success = delete_transaction_by_id(connection, transaction_id)
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
