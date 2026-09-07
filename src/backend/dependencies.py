"""Shared FastAPI dependencies."""

from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from psycopg import Connection

from . import database


def get_database() -> Generator[Connection, None, None]:
    connection = database.get_postgres_connection()
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable.",
        )

    try:
        yield connection
    finally:
        connection.close()


DatabaseConnection = Annotated[Connection, Depends(get_database)]
