"""Shared FastAPI dependencies."""

from collections.abc import Generator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from psycopg import Connection

from . import database
from .config import get_settings


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


def get_demo_session_id(
    connection: DatabaseConnection,
    demo_session_header: Annotated[
        str | None,
        Header(
            alias="X-Demo-Session-ID",
            description=(
                "Anonymous browser UUID used to isolate data when DEMO_MODE is enabled."
            ),
        ),
    ] = None,
) -> str | None:
    """Validate and initialise an isolated browser session in demo mode."""
    if not get_settings().demo_mode:
        return None

    if demo_session_header is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Demo-Session-ID header is required in demo mode.",
        )

    try:
        demo_session_id = str(UUID(demo_session_header))
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Demo-Session-ID must be a valid UUID.",
        ) from error

    database.prepare_demo_session(connection, demo_session_id)
    return demo_session_id


DemoSessionId = Annotated[str | None, Depends(get_demo_session_id)]
