"""Environment based application settings."""

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv


load_dotenv()


def _as_bool(value: str | None) -> bool:
    return value is not None and value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str | None
    cors_origins: tuple[str, ...]
    demo_mode: bool


@lru_cache
def get_settings() -> Settings:
    origins = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )
    return Settings(
        database_url=os.getenv("DATABASE_URL"),
        cors_origins=origins,
        demo_mode=_as_bool(os.getenv("DEMO_MODE")),
    )
