"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import analytics, health, imports, transactions


settings = get_settings()
app = FastAPI(
    title="Finance Dashboard API",
    version="1.0.0",
    description="REST API for synthetic finance dashboard transactions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(transactions.router)
app.include_router(analytics.router)
app.include_router(imports.router)


@app.get("/", include_in_schema=False)
def root():
    return {
        "message": "Finance Dashboard API is running.",
        "documentation": "/docs",
    }
