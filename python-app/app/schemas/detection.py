from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str


class DetectionResponse(BaseModel):
    grid_detected: bool
    dx: float = Field(..., description="Estimated horizontal visible pixel pitch in raster pixels.")
    dy: float = Field(..., description="Estimated vertical visible pixel pitch in raster pixels.")
    angle: float
    origin: tuple[float, float]
    confidence: float
    candidates: list[float]
    line_count_x: int
    line_count_y: int
    raster_width: int
    raster_height: int
    logical_width: int | None = None
    logical_height: int | None = None
    scale_x: float | None = None
    scale_y: float | None = None
    source_format: str | None = None
    is_animated: bool = False
    frame_count: int = 1
    analyzed_frame: int = 0
    preview_path: str | None = None
    preview_url: str | None = None
