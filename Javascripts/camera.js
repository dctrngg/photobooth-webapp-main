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
};

let photoStage = 0; // 0=top,1=bottom,2=done
let currentFacing = "user"; // "user" = front, "environment" = back
let stream = null;

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
        facingMode: currentFacing, // Safari requires DIRECT string
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);

    elements.video.srcObject = stream;

    elements.video.onloadedmetadata = () => {
      elements.video.play();

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
  setupCamera();
};

// ======================================================
// Event listeners
// ======================================================
const setupEventListeners = () => {
  const { takePhotoBtn, toggleCameraBtn } = elements;

  takePhotoBtn.addEventListener("click", () => {
    if (photoStage > 1) return;

    takePhotoBtn.disabled = true;
    startCountdown(capturePhoto);
  });

  toggleCameraBtn.addEventListener("click", toggleCamera);

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