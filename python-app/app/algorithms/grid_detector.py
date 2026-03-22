from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


EPS = 1e-8


@dataclass
class AxisEstimate:
    period: float
    origin: float
    confidence: float
    candidates: list[float]
    line_count: int
    projection_peaks: list[int]


@dataclass
class DetectionResult:
    grid_detected: bool
    dx: float
    dy: float
    angle: float
    origin: tuple[float, float]
    confidence: float
    candidates: list[float]
    line_count_x: int
    line_count_y: int
    raster_width: int
    raster_height: int
    logical_width: int | None
    logical_height: int | None
    scale_x: float | None
    scale_y: float | None


def _rgba_to_gray(array: np.ndarray) -> np.ndarray:
    rgb = array[..., :3].astype(np.float32)
    alpha = array[..., 3].astype(np.float32) / 255.0
    gray = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    return gray * np.maximum(alpha, 0.2)


def _projection_signal(gray: np.ndarray, axis: int) -> np.ndarray:
    diff_axis = 1 if axis == 0 else 0
    diff = np.abs(np.diff(gray, axis=diff_axis))
    projection = diff.mean(axis=axis)
    centered = projection - np.median(projection)
    return np.clip(centered, 0.0, None)


def _autocorrelation_candidates(signal: np.ndarray, min_period: int, max_period: int, topk: int = 6) -> list[float]:
    centered = signal - signal.mean()
    ac = np.correlate(centered, centered, mode="full")[len(centered) - 1 :]
    ac = ac / (ac[0] + EPS)
    values = [(period, float(ac[period])) for period in range(min_period, min(max_period + 1, len(ac)))]
    values.sort(key=lambda item: item[1], reverse=True)
    return [float(period) for period, _ in values[:topk]]


def _fft_candidates(signal: np.ndarray, min_period: int, max_period: int, topk: int = 6) -> list[float]:
    centered = signal - signal.mean()
    windowed = centered * np.hanning(len(centered))
    spectrum = np.abs(np.fft.rfft(windowed))
    freqs = np.fft.rfftfreq(len(windowed), d=1.0)
    candidates: list[tuple[float, float]] = []
    for magnitude, freq in zip(spectrum[1:], freqs[1:]):
        if freq <= EPS:
            continue
        period = 1.0 / freq
        if min_period <= period <= max_period:
            candidates.append((period, float(magnitude)))
    candidates.sort(key=lambda item: item[1], reverse=True)
    return [round(period, 3) for period, _ in candidates[:topk]]


def _merge_candidates(*candidate_sets: list[float], limit: int = 8) -> list[float]:
    merged: list[float] = []
    for candidate_set in candidate_sets:
        for candidate in candidate_set:
            rounded = round(float(candidate), 3)
            if not any(abs(existing - rounded) < 0.2 for existing in merged):
                merged.append(rounded)
            if len(merged) >= limit:
                return merged
    return merged


def _periodicity_score(signal: np.ndarray, period: float) -> tuple[float, float]:
    n = np.arange(signal.size, dtype=np.float32)
    complex_wave = np.exp(-2j * np.pi * n / period)
    response = np.sum(signal * complex_wave)
    score = float(np.abs(response) / (np.sum(np.abs(signal)) + EPS))
    origin = float((-np.angle(response) * period / (2 * np.pi)) % period)
    return score, origin


def _find_projection_peaks(signal: np.ndarray, period: float, origin: float, length: int) -> list[int]:
    positions: list[int] = []
    value = origin
    while value < length:
        positions.append(int(round(value)))
        value += period
    return [position for position in positions if 0 <= position < length]


def _refine_axis(signal: np.ndarray, candidates: list[float], length: int) -> AxisEstimate:
    if not candidates:
        raise ValueError("No candidates available for refinement.")

    best_period = candidates[0]
    best_origin = 0.0
    best_score = -1.0
    score_tolerance = 0.01

    for candidate in candidates:
        start = max(2.0, candidate - 0.75)
        stop = min(24.0, candidate + 0.75)
        grid = np.arange(start, stop + 0.001, 0.05)
        for period in grid:
            score, origin = _periodicity_score(signal, float(period))
            is_better_score = score > best_score + score_tolerance
            is_close_score = abs(score - best_score) <= score_tolerance
            prefers_larger_fundamental = is_close_score and float(period) > best_period + 0.25

            if is_better_score or prefers_larger_fundamental:
                best_period = float(period)
                best_origin = origin
                best_score = score

    peaks = _find_projection_peaks(signal, best_period, best_origin, length)
    line_count = len(peaks)
    rounded_candidates = sorted(round(candidate, 3) for candidate in candidates)
    return AxisEstimate(
        period=round(best_period, 3),
        origin=round(best_origin, 3),
        confidence=round(best_score, 4),
        candidates=rounded_candidates,
        line_count=line_count,
        projection_peaks=peaks,
    )


def detect_grid(image: Image.Image, min_period: int = 2, max_period: int = 24) -> DetectionResult:
    rgba = image.convert("RGBA")
    array = np.array(rgba)
    gray = _rgba_to_gray(array)

    signal_x = _projection_signal(gray, axis=0)
    signal_y = _projection_signal(gray, axis=1)

    candidates_x = _merge_candidates(
        _autocorrelation_candidates(signal_x, min_period, max_period),
        _fft_candidates(signal_x, min_period, max_period),
    )
    candidates_y = _merge_candidates(
        _autocorrelation_candidates(signal_y, min_period, max_period),
        _fft_candidates(signal_y, min_period, max_period),
    )

    axis_x = _refine_axis(signal_x, candidates_x, rgba.width)
    axis_y = _refine_axis(signal_y, candidates_y, rgba.height)

    joint_confidence = round((axis_x.confidence + axis_y.confidence) / 2.0, 4)
    candidate_union = _merge_candidates(axis_x.candidates, axis_y.candidates, limit=10)
    grid_detected = joint_confidence >= 0.18
    logical_width = None
    logical_height = None
    scale_x = None
    scale_y = None

    width_ratio = rgba.width / axis_x.period if axis_x.period > EPS else 0.0
    height_ratio = rgba.height / axis_y.period if axis_y.period > EPS else 0.0
    width_ratio_rounded = round(width_ratio)
    height_ratio_rounded = round(height_ratio)

    if width_ratio_rounded > 0 and abs(width_ratio - width_ratio_rounded) < 0.08:
        logical_width = int(width_ratio_rounded)
        scale_x = round(rgba.width / logical_width, 3)

    if height_ratio_rounded > 0 and abs(height_ratio - height_ratio_rounded) < 0.08:
        logical_height = int(height_ratio_rounded)
        scale_y = round(rgba.height / logical_height, 3)

    return DetectionResult(
        grid_detected=grid_detected,
        dx=axis_x.period,
        dy=axis_y.period,
        angle=0.0,
        origin=(axis_x.origin, axis_y.origin),
        confidence=joint_confidence,
        candidates=candidate_union,
        line_count_x=axis_x.line_count,
        line_count_y=axis_y.line_count,
        raster_width=rgba.width,
        raster_height=rgba.height,
        logical_width=logical_width,
        logical_height=logical_height,
        scale_x=scale_x,
        scale_y=scale_y,
    )


def save_overlay(image: Image.Image, result: DetectionResult, output_path: Path) -> Path:
    rgba = image.convert("RGBA")
    overlay = rgba.copy()
    draw = ImageDraw.Draw(overlay)

    x = result.origin[0]
    while x < result.raster_width:
        x_pos = int(round(x))
        draw.line([(x_pos, 0), (x_pos, result.raster_height)], fill=(255, 0, 0, 110), width=1)
        x += result.dx

    y = result.origin[1]
    while y < result.raster_height:
        y_pos = int(round(y))
        draw.line([(0, y_pos), (result.raster_width, y_pos)], fill=(0, 255, 255, 110), width=1)
        y += result.dy

    output_path.parent.mkdir(parents=True, exist_ok=True)
    overlay.save(output_path)
    return output_path
