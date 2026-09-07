from fastapi import APIRouter

from ..config import get_settings


router = APIRouter(prefix="/api/v1", tags=["system"])


@router.get("/health")
def get_health():
    return {"status": "ok", "demo_mode": get_settings().demo_mode}
