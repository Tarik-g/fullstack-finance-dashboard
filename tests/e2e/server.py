"""Start the real FastAPI app, configured exclusively for this E2E database."""

import os
from pathlib import Path
import sys

from database import test_connection_info
import uvicorn


if __name__ == "__main__":
    info = test_connection_info()
    os.environ.update({
        "DB_NAME": info["dbname"], "DB_HOST": info["host"], "DB_PORT": info["port"],
        "DB_USER": info["user"], "DB_PASSWORD": info["password"],
        "CORS_ORIGINS": "http://127.0.0.1:4173",
        "PYTHON_DOTENV_DISABLED": "1",
    })
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    uvicorn.run("src.backend.main:app", host="127.0.0.1", port=8001, log_level="warning")
