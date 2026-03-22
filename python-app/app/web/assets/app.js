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
  previewImage.src = showOriginal ? originalObjectUrl : overlayUrl;
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
}

function applyFileSelection(file) {
  const lowerName = file.name.toLowerCase();
  const gifHint = lowerName.endsWith(".gif") ? " · GIF 按第一帧检测" : "";
  fileName.textContent = file.name;
  fileMetaLine.textContent = `${formatBytes(file.size)} · ${file.type || "未知格式"}${gifHint}`;
  setStatus("文件已导入，可以开始检测", "success");
  setFileState("已导入", "ready");
  dropzone.classList.add("has-file");
}

function showResult(data) {
  emptyState.classList.add("hidden");
  resultBody.classList.remove("hidden");

  setMetric("dx-value", `${data.dx.toFixed(3)} px`);
  setMetric("dy-value", `${data.dy.toFixed(3)} px`);
  setMetric("confidence-value", `${(data.confidence * 100).toFixed(1)}%`);
  setMetric("raster-size-value", `${data.raster_width} × ${data.raster_height}`);
  setMetric(
    "logical-size-value",
    data.logical_width && data.logical_height
      ? `${data.logical_width} × ${data.logical_height}`
      : "无法稳定推断",
  );
  setMetric(
    "scale-value",
    data.scale_x && data.scale_y
      ? `${data.scale_x.toFixed(3)} × ${data.scale_y.toFixed(3)}`
      : "无法稳定推断",
  );
  setMetric("candidates-value", data.candidates.map((x) => x.toFixed(3)).join(", "));
  setMetric("origin-value", `${data.origin[0].toFixed(3)}, ${data.origin[1].toFixed(3)}`);
  setMetric("line-count-value", `${data.line_count_x} / ${data.line_count_y}`);

  overlayUrl = `${data.preview_url}?t=${Date.now()}`;
  previewImage.style.display = "block";
  previewPlaceholder.style.display = "none";
  setActiveView("overlay");
  setFileState("已完成", "success");
}

async function detect(file) {
  const formData = new FormData();
  formData.append("file", file);

  submitBtn.disabled = true;
  setStatus("正在检测...", "processing");
  setFileState("检测中", "processing");
  submitBtn.textContent = "检测中...";

  try {
    const response = await fetch("/api/v1/detect", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "检测失败");
    }

    showResult(data);
    setStatus(`完成: ${file.name}`, "success");
  } catch (error) {
    setStatus(error.message || "检测失败", "error");
    setFileState("失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "开始检测";
  }
}

function clearSelection() {
  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
    originalObjectUrl = "";
  }
  overlayUrl = "";
  fileInput.value = "";
  fileThumb.removeAttribute("src");
  resetFileCard();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    setStatus("请先选择图片", "error");
    setFileState("缺少文件", "error");
    return;
  }

  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
  }
  originalObjectUrl = URL.createObjectURL(file);
  fileThumb.src = originalObjectUrl;
  fileThumb.style.display = "block";
  thumbPlaceholder.style.display = "none";
  previewPlaceholder.style.display = "none";
  await detect(file);
});

showOriginalBtn.addEventListener("click", () => {
  if (originalObjectUrl) {
    setActiveView("original");
  }
});

showOverlayBtn.addEventListener("click", () => {
  if (overlayUrl) {
    setActiveView("overlay");
  }
});

clearBtn.addEventListener("click", () => {
  clearSelection();
  emptyState.classList.remove("hidden");
  resultBody.classList.add("hidden");
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

dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) {
    return;
  }
  fileInput.files = event.dataTransfer.files;
  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
  }
  originalObjectUrl = URL.createObjectURL(file);
  fileThumb.src = originalObjectUrl;
  fileThumb.style.display = "block";
  thumbPlaceholder.style.display = "none";
  previewImage.style.display = "block";
  previewPlaceholder.style.display = "none";
  previewImage.src = originalObjectUrl;
  applyFileSelection(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) {
    resetFileCard();
    return;
  }
  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
  }
  originalObjectUrl = URL.createObjectURL(file);
  fileThumb.src = originalObjectUrl;
  fileThumb.style.display = "block";
  thumbPlaceholder.style.display = "none";
  previewImage.style.display = "block";
  previewPlaceholder.style.display = "none";
  previewImage.src = originalObjectUrl;
  applyFileSelection(file);
});

resetFileCard();
