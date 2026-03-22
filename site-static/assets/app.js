const EPS = 1e-8;
const MIN_PERIOD = 2;
const MAX_PERIOD = 24;
const REFINE_STEP = 0.05;
const SCORE_TOLERANCE = 0.01;

const form = document.getElementById("detect-form");
const fileInput = document.getElementById("file-input");
const submitBtn = document.getElementById("submit-btn");
const clearBtn = document.getElementById("clear-btn");
const statusText = document.getElementById("status-text");
const dropzone = document.querySelector(".dropzone");
const emptyState = document.getElementById("empty-state");
const resultBody = document.getElementById("result-body");
const previewImage = document.getElementById("preview-image");
const previewPlaceholder = document.getElementById("preview-placeholder");
const showOriginalBtn = document.getElementById("show-original-btn");
const showOverlayBtn = document.getElementById("show-overlay-btn");
const fileCard = document.getElementById("file-card");
const fileStateBadge = document.getElementById("file-state-badge");
const fileThumb = document.getElementById("file-thumb");
const thumbPlaceholder = document.getElementById("thumb-placeholder");
const fileName = document.getElementById("file-name");
const fileMetaLine = document.getElementById("file-meta-line");

let originalObjectUrl = "";
let overlayUrl = "";
let currentImageElement = null;
let currentResult = null;

function setStatus(text, kind = "idle") {
  statusText.textContent = text;
  statusText.className = `status ${kind}`;
}

function setFileState(text, kind) {
  fileStateBadge.textContent = text;
  fileStateBadge.className = `file-state-badge ${kind}`;
  fileCard.className = `file-card ${kind === "idle" ? "empty" : kind}`;
}

function setMetric(id, value) {
  document.getElementById(id).textContent = value;
}

function setActiveView(mode) {
  const showOriginal = mode === "original";
  showOriginalBtn.classList.toggle("active", showOriginal);
  showOverlayBtn.classList.toggle("active", !showOriginal);
  previewImage.src = showOriginal || !overlayUrl ? originalObjectUrl : overlayUrl;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function resetFileCard() {
  fileName.textContent = "未选择文件";
  fileMetaLine.textContent = "请选择一张图片";
  setStatus("等待上传", "idle");
  setFileState("未导入", "idle");
  fileThumb.style.display = "none";
  thumbPlaceholder.style.display = "block";
  previewImage.style.display = "none";
  previewPlaceholder.style.display = "block";
  previewImage.removeAttribute("src");
  dropzone.classList.remove("has-file");
  showOriginalBtn.classList.add("active");
  showOverlayBtn.classList.remove("active");
}

function clearResults() {
  currentResult = null;
  overlayUrl = "";
  emptyState.classList.remove("hidden");
  resultBody.classList.add("hidden");
}

function resetSelection() {
  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
    originalObjectUrl = "";
  }
  currentImageElement = null;
  fileInput.value = "";
  fileThumb.removeAttribute("src");
  clearResults();
  resetFileCard();
}

function applyFileSelection(file) {
  const lowerName = file.name.toLowerCase();
  const gifHint = lowerName.endsWith(".gif") ? " · GIF 使用首帧检测" : "";
  fileName.textContent = file.name;
  fileMetaLine.textContent = `${formatBytes(file.size)} · ${file.type || "未知格式"}${gifHint}`;
  setStatus("文件已导入，可以开始检测", "success");
  setFileState("已导入", "ready");
  dropzone.classList.add("has-file");
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = url;
  });
}

function buildGrayImage(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Float32Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const alpha = data[i + 3] / 255;
    const weight = Math.max(alpha, 0.2);
    gray[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * weight;
  }

  return { gray, width, height };
}

function projectionSignal(gray, width, height, axis) {
  if (axis === "x") {
    const signal = new Float32Array(width - 1);
    for (let x = 0; x < width - 1; x += 1) {
      let sum = 0;
      for (let y = 0; y < height; y += 1) {
        const idx = y * width + x;
        sum += Math.abs(gray[idx + 1] - gray[idx]);
      }
      signal[x] = sum / height;
    }
    return centerAndClip(signal);
  }

  const signal = new Float32Array(height - 1);
  for (let y = 0; y < height - 1; y += 1) {
    let sum = 0;
    const row = y * width;
    const nextRow = (y + 1) * width;
    for (let x = 0; x < width; x += 1) {
      sum += Math.abs(gray[nextRow + x] - gray[row + x]);
    }
    signal[y] = sum / width;
  }
  return centerAndClip(signal);
}

function centerAndClip(signal) {
  const values = Array.from(signal);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const centered = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i += 1) {
    centered[i] = Math.max(0, signal[i] - median);
  }
  return centered;
}

function autocorrelationCandidates(signal, minPeriod, maxPeriod, topk = 8) {
  const n = signal.length;
  let mean = 0;
  for (let i = 0; i < n; i += 1) {
    mean += signal[i];
  }
  mean /= Math.max(n, 1);

  const centered = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    centered[i] = signal[i] - mean;
  }

  let zeroLag = 0;
  for (let i = 0; i < n; i += 1) {
    zeroLag += centered[i] * centered[i];
  }
  zeroLag = Math.max(zeroLag, EPS);

  const values = [];
  for (let lag = minPeriod; lag <= Math.min(maxPeriod, n - 1); lag += 1) {
    let sum = 0;
    for (let i = 0; i < n - lag; i += 1) {
      sum += centered[i] * centered[i + lag];
    }
    values.push({ period: lag, score: sum / zeroLag });
  }

  values.sort((a, b) => b.score - a.score);
  return values.slice(0, topk).map((item) => item.period);
}

function mergeCandidates(...candidateSets) {
  const merged = [];
  for (const set of candidateSets) {
    for (const value of set) {
      const rounded = Math.round(Number(value) * 1000) / 1000;
      const exists = merged.some((item) => Math.abs(item - rounded) < 0.2);
      if (!exists) {
        merged.push(rounded);
      }
      if (merged.length >= 10) {
        return merged;
      }
    }
  }
  return merged;
}

function periodicityScore(signal, period) {
  let real = 0;
  let imag = 0;
  let sumAbs = 0;
  const factor = (2 * Math.PI) / period;

  for (let i = 0; i < signal.length; i += 1) {
    const value = signal[i];
    real += value * Math.cos(factor * i);
    imag -= value * Math.sin(factor * i);
    sumAbs += Math.abs(value);
  }

  const magnitude = Math.hypot(real, imag);
  const score = magnitude / Math.max(sumAbs, EPS);
  const angle = Math.atan2(imag, real);
  let origin = ((-angle * period) / (2 * Math.PI)) % period;
  if (origin < 0) {
    origin += period;
  }

  return { score, origin };
}

function refineAxis(signal, candidates, length) {
  if (!candidates.length) {
    throw new Error("没有可用候选周期");
  }

  let bestPeriod = candidates[0];
  let bestOrigin = 0;
  let bestScore = -1;

  for (const candidate of candidates) {
    const start = Math.max(MIN_PERIOD, candidate - 0.75);
    const stop = Math.min(MAX_PERIOD, candidate + 0.75);

    for (let period = start; period <= stop + 0.0001; period += REFINE_STEP) {
      const { score, origin } = periodicityScore(signal, period);
      const betterScore = score > bestScore + SCORE_TOLERANCE;
      const closeScore = Math.abs(score - bestScore) <= SCORE_TOLERANCE;
      const preferLarger = closeScore && period > bestPeriod + 0.25;

      if (betterScore || preferLarger) {
        bestPeriod = period;
        bestOrigin = origin;
        bestScore = score;
      }
    }
  }

  const peaks = [];
  for (let value = bestOrigin; value < length; value += bestPeriod) {
    const rounded = Math.round(value);
    if (rounded >= 0 && rounded < length) {
      peaks.push(rounded);
    }
  }

  return {
    period: Math.round(bestPeriod * 1000) / 1000,
    origin: Math.round(bestOrigin * 1000) / 1000,
    confidence: Math.round(bestScore * 10000) / 10000,
    lineCount: peaks.length,
  };
}

function inferLogicalDimension(size, period) {
  if (period <= EPS) {
    return { logical: null, scale: null };
  }

  const ratio = size / period;
  const rounded = Math.round(ratio);
  if (rounded > 0 && Math.abs(ratio - rounded) < 0.08) {
    return {
      logical: rounded,
      scale: Math.round((size / rounded) * 1000) / 1000,
    };
  }

  return { logical: null, scale: null };
}

function drawOverlay(image, result) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 0, 0, 0.38)";
  ctx.beginPath();
  for (let x = result.origin[0]; x < result.rasterWidth; x += result.dx) {
    const px = Math.round(x) + 0.5;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, result.rasterHeight);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(0, 220, 255, 0.38)";
  ctx.beginPath();
  for (let y = result.origin[1]; y < result.rasterHeight; y += result.dy) {
    const py = Math.round(y) + 0.5;
    ctx.moveTo(0, py);
    ctx.lineTo(result.rasterWidth, py);
  }
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

function detectGrid(image) {
  const { gray, width, height } = buildGrayImage(image);
  const signalX = projectionSignal(gray, width, height, "x");
  const signalY = projectionSignal(gray, width, height, "y");

  const candidatesX = mergeCandidates(autocorrelationCandidates(signalX, MIN_PERIOD, MAX_PERIOD));
  const candidatesY = mergeCandidates(autocorrelationCandidates(signalY, MIN_PERIOD, MAX_PERIOD));

  const axisX = refineAxis(signalX, candidatesX, width);
  const axisY = refineAxis(signalY, candidatesY, height);
  const logicalX = inferLogicalDimension(width, axisX.period);
  const logicalY = inferLogicalDimension(height, axisY.period);

  return {
    dx: axisX.period,
    dy: axisY.period,
    confidence: Math.round(((axisX.confidence + axisY.confidence) / 2) * 10000) / 10000,
    candidates: mergeCandidates(candidatesX, candidatesY),
    origin: [axisX.origin, axisY.origin],
    lineCountX: axisX.lineCount,
    lineCountY: axisY.lineCount,
    rasterWidth: width,
    rasterHeight: height,
    logicalWidth: logicalX.logical,
    logicalHeight: logicalY.logical,
    scaleX: logicalX.scale,
    scaleY: logicalY.scale,
  };
}

function showResult(result) {
  emptyState.classList.add("hidden");
  resultBody.classList.remove("hidden");

  setMetric("dx-value", `${result.dx.toFixed(3)} px`);
  setMetric("dy-value", `${result.dy.toFixed(3)} px`);
  setMetric("confidence-value", `${(result.confidence * 100).toFixed(1)}%`);
  setMetric("raster-size-value", `${result.rasterWidth} × ${result.rasterHeight}`);
  setMetric(
    "logical-size-value",
    result.logicalWidth && result.logicalHeight
      ? `${result.logicalWidth} × ${result.logicalHeight}`
      : "无法稳定推断",
  );
  setMetric(
    "scale-value",
    result.scaleX && result.scaleY
      ? `${result.scaleX.toFixed(3)} × ${result.scaleY.toFixed(3)}`
      : "无法稳定推断",
  );
  setMetric("candidates-value", result.candidates.map((x) => x.toFixed(3)).join(", "));
  setMetric("origin-value", `${result.origin[0].toFixed(3)}, ${result.origin[1].toFixed(3)}`);
  setMetric("line-count-value", `${result.lineCountX} / ${result.lineCountY}`);
}

async function detect() {
  submitBtn.disabled = true;
  submitBtn.textContent = "检测中...";
  setStatus("正在浏览器本地分析...", "processing");
  setFileState("检测中", "processing");

  try {
    const result = detectGrid(currentImageElement);
    currentResult = result;
    overlayUrl = drawOverlay(currentImageElement, result);
    showResult(result);
    previewImage.style.display = "block";
    previewPlaceholder.style.display = "none";
    setActiveView("overlay");
    setStatus("检测完成", "success");
    setFileState("已完成", "success");
  } catch (error) {
    setStatus(error.message || "检测失败", "error");
    setFileState("失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "开始检测";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    setStatus("请先选择图片", "error");
    setFileState("缺少文件", "error");
    return;
  }

  if (!currentImageElement) {
    setStatus("图片还没准备好，请重新选择一次", "error");
    setFileState("失败", "error");
    return;
  }

  await detect();
});

showOriginalBtn.addEventListener("click", () => {
  if (originalObjectUrl) {
    setActiveView("original");
  }
});

showOverlayBtn.addEventListener("click", () => {
  if (overlayUrl) {
    setActiveView("overlay");
  } else {
    setStatus("还没有叠加结果，先执行一次检测", "processing");
  }
});

clearBtn.addEventListener("click", () => {
  resetSelection();
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

async function handleSelectedFile(file, fileList = null) {
  if (!file) {
    resetSelection();
    return;
  }

  clearResults();
  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
  }

  if (fileList) {
    fileInput.files = fileList;
  }

  originalObjectUrl = URL.createObjectURL(file);
  currentImageElement = await loadImage(originalObjectUrl);
  fileThumb.src = originalObjectUrl;
  fileThumb.style.display = "block";
  thumbPlaceholder.style.display = "none";
  previewImage.style.display = "block";
  previewPlaceholder.style.display = "none";
  previewImage.src = originalObjectUrl;
  applyFileSelection(file);
}

dropzone.addEventListener("drop", async (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) {
    return;
  }
  await handleSelectedFile(file, event.dataTransfer.files);
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  await handleSelectedFile(file, fileInput.files);
});

resetSelection();
