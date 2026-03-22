from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.detection import DetectionResponse, HealthResponse
from app.services.detection_service import DetectionService


router = APIRouter()
service = DetectionService()


@router.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.post("/api/v1/detect", response_model=DetectionResponse)
async def detect(file: UploadFile = File(...)) -> DetectionResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")
    try:
        return service.detect_bytes(content, file.filename or "upload.png")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
