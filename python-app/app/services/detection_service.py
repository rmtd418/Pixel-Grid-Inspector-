from __future__ import annotations

import hashlib
from io import BytesIO
from pathlib import Path
import re

from PIL import Image, UnidentifiedImageError

from app.algorithms.grid_detector import detect_grid, save_overlay
from app.schemas.detection import DetectionResponse


class DetectionService:
    SUPPORTED_EXTENSIONS = {
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".bmp",
        ".gif",
        ".tif",
        ".tiff",
        ".ico",
    }

    def __init__(self, output_dir: Path | None = None) -> None:
        self.output_dir = output_dir or Path("outputs")

    @staticmethod
    def _safe_stem(filename: str) -> str:
        stem = Path(filename).stem
        sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._")
        if sanitized:
            return sanitized
        digest = hashlib.sha1(filename.encode("utf-8", errors="ignore")).hexdigest()[:8]
        return f"upload_{digest}"

    @classmethod
    def _validate_extension(cls, filename: str) -> None:
        suffix = Path(filename).suffix.lower()
        if suffix and suffix not in cls.SUPPORTED_EXTENSIONS:
            supported = ", ".join(sorted(ext.lstrip(".") for ext in cls.SUPPORTED_EXTENSIONS))
            raise ValueError(f"Unsupported file type: {suffix}. Supported: {supported}.")

    @staticmethod
    def _prepare_image(image: Image.Image) -> tuple[Image.Image, bool, int]:
        frame_count = int(getattr(image, "n_frames", 1) or 1)
        is_animated = frame_count > 1
        if is_animated:
            image.seek(0)
        prepared = image.copy()
        return prepared, is_animated, frame_count

    def detect_bytes(self, content: bytes, filename: str) -> DetectionResponse:
        self._validate_extension(filename)
        try:
            image = Image.open(BytesIO(content))
        except UnidentifiedImageError as exc:
            raise ValueError("Unsupported or corrupted image file.") from exc

        prepared_image, is_animated, frame_count = self._prepare_image(image)
        source_format = image.format
        result = detect_grid(prepared_image)

        preview_name = f"{self._safe_stem(filename)}_overlay.png"
        preview_path = save_overlay(prepared_image, result, self.output_dir / "previews" / preview_name)
        preview_url = f"/outputs/previews/{preview_name}"

        return DetectionResponse(
            grid_detected=result.grid_detected,
            dx=result.dx,
            dy=result.dy,
            angle=result.angle,
            origin=result.origin,
            confidence=result.confidence,
            candidates=result.candidates,
            line_count_x=result.line_count_x,
            line_count_y=result.line_count_y,
            raster_width=result.raster_width,
            raster_height=result.raster_height,
            logical_width=result.logical_width,
            logical_height=result.logical_height,
            scale_x=result.scale_x,
            scale_y=result.scale_y,
            source_format=source_format,
            is_animated=is_animated,
            frame_count=frame_count,
            analyzed_frame=0,
            preview_path=str(preview_path),
            preview_url=preview_url,
        )

    def detect_path(self, image_path: Path) -> DetectionResponse:
        content = image_path.read_bytes()
        return self.detect_bytes(content, image_path.name)
