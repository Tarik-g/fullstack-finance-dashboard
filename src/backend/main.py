from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Finance Dashboard API is running."}

@app.get("/transactions")
async def get_transactions():
    """
    Endpoint to retrieve all transactions from the database as json Objects

    Returns:
        list: A list of transactions.
    """
    from .database import get_postgres_connection, get_all_transactions
    connection = get_postgres_connection()
    if connection is None:
        return {"error": "Could not connect to the database."}
    
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