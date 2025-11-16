// ======================================================
// CONSTANTS
// ======================================================
const WIDTH = 1176, HEIGHT = 1470, HALF = HEIGHT / 2;

// Get selected frame
const selectedFramePath =
  localStorage.getItem("selectedFramePath") ||
  "Assets/fish-photobooth/camerapage/teky.png";

// DOM elements
const elements = {
  video: document.getElementById("liveVideo"),
  canvas: document.getElementById("finalCanvas"),
  ctx: document.getElementById("finalCanvas").getContext("2d"),
  takePhotoBtn: document.getElementById("takePhoto"),
  toggleCameraBtn: document.getElementById("toggleCamera"),
  countdownEl: document.querySelector(".countdown-timer"),
  zoomSlider: document.getElementById("zoomSlider"),
  zoomValue: document.getElementById("zoomValue"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
};

let photoStage = 0; // 0=top,1=bottom,2=done
let currentFacing = "user"; // "user" = front, "environment" = back
let stream = null;
let currentZoom = 1; // Zoom level (1 = no zoom)
let videoTrack = null; // Current video track for zoom capabilities

// ======================================================
// Move video to top/bottom half
// ======================================================
const moveVideoToHalf = (i) => {
  const { video } = elements;
  video.style.display = "block";
  video.style.top = i === 0 ? "0" : "50%";
  video.style.left = "0";
  video.style.width = "100%";
  video.style.height = "50%";
};

// ======================================================
// Countdown timer
// ======================================================
const startCountdown = (callback) => {
  let count = 3;
  elements.countdownEl.textContent = count;
  elements.countdownEl.style.display = "flex";

  const intervalId = setInterval(() => {
    count--;
    if (count > 0) elements.countdownEl.textContent = count;
    else {
      clearInterval(intervalId);
      elements.countdownEl.style.display = "none";
      callback();
    }
  }, 1000);
};

// ======================================================
// Apply zoom to video (hardware zoom if supported)
// ======================================================
const applyZoom = async (zoomLevel) => {
  if (!videoTrack) return;

  const capabilities = videoTrack.getCapabilities();
  
  // Check if device supports hardware zoom
  if (capabilities.zoom) {
    const { min, max } = capabilities.zoom;
    const clampedZoom = Math.max(min, Math.min(max, zoomLevel));
    
    try {
      await videoTrack.applyConstraints({
        advanced: [{ zoom: clampedZoom }]
      });
      currentZoom = clampedZoom;
      
      if (elements.zoomValue) {
        elements.zoomValue.textContent = `${clampedZoom.toFixed(1)}x`;
      }
      if (elements.zoomSlider) {
        elements.zoomSlider.value = clampedZoom;
      }
    } catch (err) {
      console.warn("Zoom constraint failed:", err);
    }
  } else {
    // Fallback: CSS transform zoom (visual only)
    currentZoom = zoomLevel;
    elements.video.style.transform = 
      currentFacing === "user" 
        ? `scaleX(-1) scale(${zoomLevel})` 
        : `scale(${zoomLevel})`;
    
    if (elements.zoomValue) {
      elements.zoomValue.textContent = `${zoomLevel.toFixed(1)}x`;
    }
    if (elements.zoomSlider) {
      elements.zoomSlider.value = zoomLevel;
    }
  }
};

// ======================================================
// Setup zoom controls
// ======================================================
const setupZoomControls = () => {
  if (!videoTrack) return;

  const capabilities = videoTrack.getCapabilities();
  
  if (elements.zoomSlider) {
    if (capabilities.zoom) {
      // Hardware zoom available
      const { min, max } = capabilities.zoom;
      elements.zoomSlider.min = min;
      elements.zoomSlider.max = max;
      elements.zoomSlider.step = (max - min) / 20; // 20 steps
      elements.zoomSlider.value = currentZoom;
    } else {
      // Software zoom fallback
      elements.zoomSlider.min = 1;
      elements.zoomSlider.max = 3;
      elements.zoomSlider.step = 0.1;
      elements.zoomSlider.value = 1;
    }
  }
};

// ======================================================
// Capture photo into canvas
// ======================================================
const capturePhoto = () => {
  const { video, ctx } = elements;

  const vW = video.videoWidth;
  const vH = video.videoHeight;

  if (vW === 0 || vH === 0) {
    console.warn("Video not ready.");
    return;
  }

  const yOffset = photoStage === 0 ? 0 : HALF;

  const targetAspect = WIDTH / HALF;
  const vAspect = vW / vH;

  let sx, sy, sw, sh;

  if (vAspect > targetAspect) {
    sh = vH;
    sw = vH * targetAspect;
    sx = (vW - sw) / 2;
    sy = 0;
  } else {
    sw = vW;
    sh = vW / targetAspect;
    sx = 0;
    sy = (vH - sh) / 2;
  }

  // Apply zoom to capture area (if using software zoom)
  const capabilities = videoTrack?.getCapabilities();
  if (!capabilities?.zoom && currentZoom > 1) {
    const zoomFactor = 1 / currentZoom;
    const newW = sw * zoomFactor;
    const newH = sh * zoomFactor;
    sx += (sw - newW) / 2;
    sy += (sh - newH) / 2;
    sw = newW;
    sh = newH;
  }

  // Flip canvas nếu đang dùng camera trước
  ctx.save();
  if (currentFacing === "user") {
    ctx.translate(WIDTH, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, yOffset, WIDTH, HALF);

  ctx.restore();

  photoStage++;

  if (photoStage === 1) {
    moveVideoToHalf(1);
    elements.takePhotoBtn.disabled = false;
  } else if (photoStage === 2) {
    finalizePhotoStrip();
  }
};

// ======================================================
// Finalize photostrip
// ======================================================
const finalizePhotoStrip = () => {
  const { video, ctx, canvas } = elements;

  video.style.display = "none";

  const frame = new Image();
  frame.src = selectedFramePath;

  frame.onload = () => {
    ctx.drawImage(frame, 0, 0, WIDTH, HEIGHT);
    localStorage.setItem("photoStrip", canvas.toDataURL("image/png"));
    setTimeout(() => (window.location.href = "final.html"), 50);
  };

  if (frame.complete) frame.onload();
};

// ======================================================
// Setup camera (FIXED FOR IOS + ANDROID)
// ======================================================
const setupCamera = async () => {
  // Stop old stream
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    elements.video.srcObject = null;
  }

  try {
    const constraints = {
      video: {
        facingMode: currentFacing,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoTrack = stream.getVideoTracks()[0];

    elements.video.srcObject = stream;

    elements.video.onloadedmetadata = () => {
      elements.video.play();

      // Setup zoom controls after video is ready
      setupZoomControls();

      // Flip only front camera
      if (currentFacing === "user") {
        elements.video.style.transform = "scaleX(-1)";
      } else {
        elements.video.style.transform = "scaleX(1)";
      }

      moveVideoToHalf(photoStage === 0 ? 0 : 1);
    };
  } catch (err) {
    alert("Camera error: " + err);
  }
};

// ======================================================
// Toggle camera (front/back)
// ======================================================
const toggleCamera = () => {
  currentFacing = currentFacing === "user" ? "environment" : "user";
  currentZoom = 1; // Reset zoom when switching cameras
  setupCamera();
};

// ======================================================
// Zoom in/out functions
// ======================================================
const zoomIn = () => {
  const step = parseFloat(elements.zoomSlider.step) || 0.1;
  const max = parseFloat(elements.zoomSlider.max) || 3;
  const newZoom = Math.min(currentZoom + step, max);
  applyZoom(newZoom);
};

const zoomOut = () => {
  const step = parseFloat(elements.zoomSlider.step) || 0.1;
  const min = parseFloat(elements.zoomSlider.min) || 1;
  const newZoom = Math.max(currentZoom - step, min);
  applyZoom(newZoom);
};

// ======================================================
// Event listeners
// ======================================================
const setupEventListeners = () => {
  const { takePhotoBtn, toggleCameraBtn, zoomSlider, zoomIn: zoomInBtn, zoomOut: zoomOutBtn } = elements;

  takePhotoBtn.addEventListener("click", () => {
    if (photoStage > 1) return;

    takePhotoBtn.disabled = true;
    startCountdown(capturePhoto);
  });

  toggleCameraBtn.addEventListener("click", toggleCamera);

  // Zoom slider
  if (zoomSlider) {
    zoomSlider.addEventListener("input", (e) => {
      const zoomLevel = parseFloat(e.target.value);
      applyZoom(zoomLevel);
    });
  }

  // Zoom buttons
  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", zoomIn);
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", zoomOut);
  }

  window.addEventListener("resize", () => moveVideoToHalf(photoStage));
};

// ======================================================
// Init
// ======================================================
const initPhotoBooth = () => {
  setupCamera();
  setupEventListeners();
};

initPhotoBooth();