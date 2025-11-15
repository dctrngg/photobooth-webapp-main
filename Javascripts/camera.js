// constants
const WIDTH = 1176, HEIGHT = 1470, HALF = HEIGHT / 2;

// Get selected frame
const selectedFramePath = localStorage.getItem('selectedFramePath') || 'Assets/fish-photobooth/camerapage/teky.png';

// dom elements
const elements = {
  video: document.getElementById('liveVideo'),
  canvas: document.getElementById('finalCanvas'),
  ctx: document.getElementById('finalCanvas').getContext('2d'),
  takePhotoBtn: document.getElementById('takePhoto'),
  downloadBtn: document.getElementById('downloadBtn'),
  toggleCameraBtn: document.getElementById('toggleCamera'),
  countdownEl: document.querySelector('.countdown-timer')
};

let photoStage = 0; // 0=top,1=bottom,2=done
let currentFacing = "user"; // default: front camera
let stream = null;

// =======================
// Move video to half
// =======================
const moveVideoToHalf = i => {
  const { video } = elements;
  video.style.display = 'block';
  video.style.top = i === 0 ? '0' : '50%';
  video.style.left = '0';
  video.style.width = '100%';
  video.style.height = '50%';
};

// =======================
// Countdown
// =======================
const startCountdown = callback => {
  let count = 3;
  const { countdownEl } = elements;
  countdownEl.textContent = count;
  countdownEl.style.display = 'flex';

  const intervalId = setInterval(() => {
    count--;
    if (count > 0) countdownEl.textContent = count;
    else {
      clearInterval(intervalId);
      countdownEl.style.display = 'none';
      callback();
    }
  }, 1000);
};

// =======================
// Capture photo
// =======================
const capturePhoto = () => {
  const { video, ctx } = elements;

  const yOffset = photoStage === 0 ? 0 : HALF;
  const vW = video.videoWidth;
  const vH = video.videoHeight;

  if (vW === 0 || vH === 0) {
    console.warn("Video not ready!");
    return;
  }

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

  // No flip here — flip is via CSS
  ctx.drawImage(video, sx, sy, sw, sh, 0, yOffset, WIDTH, HALF);

  photoStage++;
  if (photoStage === 1) {
    moveVideoToHalf(1);
    elements.takePhotoBtn.disabled = false;
  } else if (photoStage === 2) {
    finalizePhotoStrip();
  }
};

// =======================
// Final photo strip
// =======================
const finalizePhotoStrip = () => {
  const { video, ctx, canvas } = elements;

  video.style.display = 'none';
  const frame = new Image();
  frame.src = selectedFramePath;

  frame.onload = () => {
    ctx.drawImage(frame, 0, 0, WIDTH, HEIGHT);
    localStorage.setItem('photoStrip', canvas.toDataURL('image/png'));
    setTimeout(() => window.location.href = 'final.html', 50);
  };

  if (frame.complete) frame.onload();
};

// =======================
// Download photo
// =======================
const downloadPhoto = () => {
  elements.canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'photo-strip.png';
    a.click();
  }, 'image/png');
};

// =======================
// Setup camera
// =======================
const setupCamera = async () => {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: currentFacing },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    elements.video.srcObject = stream;

    // Wait until metadata loads (mobile fix)
    elements.video.onloadedmetadata = () => {
      elements.video.play();
      moveVideoToHalf(photoStage === 0 ? 0 : 1);
    };

  } catch (err) {
    alert("Camera error: " + err);
  }
};

// =======================
// Toggle Camera Front/Back
// =======================
const toggleCamera = () => {
  currentFacing = currentFacing === "user" ? "environment" : "user";
  setupCamera();
};

// =======================
// Event Listeners
// =======================
const setupEventListeners = () => {
  const { takePhotoBtn, downloadBtn, toggleCameraBtn } = elements;

  takePhotoBtn.addEventListener('click', () => {
    if (photoStage > 1) return;
    takePhotoBtn.disabled = true;
    startCountdown(capturePhoto);
  });

  downloadBtn.addEventListener('click', downloadPhoto);
  toggleCameraBtn.addEventListener('click', toggleCamera);

  window.addEventListener('resize', () => {
    moveVideoToHalf(photoStage);
  });
};

// =======================
// Init
// =======================
const initPhotoBooth = () => {
  setupCamera();
  setupEventListeners();
};

initPhotoBooth();

// redirect on logo
document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('.logo');
  if (logo) logo.addEventListener('click', () => window.location.href = 'index.html');
});
