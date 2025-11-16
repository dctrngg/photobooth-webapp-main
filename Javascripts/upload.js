// clear local storage
window.addEventListener('DOMContentLoaded', () => localStorage.removeItem('photoStrip'));

// constants
const WIDTH = 1176, HEIGHT = 1470, HALF = HEIGHT / 2;

// Get selected frame
const selectedFramePath = localStorage.getItem('selectedFramePath') || 'Assets/fish-photobooth/camerapage/teky.png';

// dom elements
const elements = {
  canvas: document.getElementById('finalCanvas'),
  ctx: document.getElementById('finalCanvas').getContext('2d'),
  uploadInput: document.getElementById('uploadPhotoInput'),
  uploadBtn: document.getElementById('uploadPhoto'),
  readyBtn: document.getElementById('readyButton'),
  downloadBtn: document.getElementById('downloadBtn'),
  zoomInBtn: document.getElementById('zoomIn'),
  zoomOutBtn: document.getElementById('zoomOut'),
  zoomControls: document.getElementById('zoomControls')
};

let photoStage = 0; // 0=top,1=bottom,2=done
let currentImage = null;
let imagePosition = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let imageScale = 1;

// draw photo with current position and scale
const drawPhoto = (img, init = false) => {
  const { ctx } = elements;
  const yOffset = photoStage === 0 ? 0 : HALF;
  
  if (init || !currentImage) {
    // First time loading image - use original size
    currentImage = img;
    imageScale = 1; // Original size
    
    // Center the image
    imagePosition.x = (WIDTH - img.width) / 2;
    imagePosition.y = (HALF - img.height) / 2;
  }
  
  // Clear the half we're working on
  ctx.clearRect(0, yOffset, WIDTH, HALF);
  
  // Save context
  ctx.save();
  
  // Clip to the target area
  ctx.beginPath();
  ctx.rect(0, yOffset, WIDTH, HALF);
  ctx.clip();
  
  // Draw image at current position and scale
  ctx.drawImage(
    currentImage,
    imagePosition.x,
    yOffset + imagePosition.y,
    currentImage.width * imageScale,
    currentImage.height * imageScale
  );
  
  ctx.restore();
};

// redraw with current settings
const redrawPreview = () => {
  if (!currentImage) return;
  drawPhoto(currentImage, false);
};

// Zoom functions
const zoomIn = () => {
  if (!currentImage) return;
  const oldScale = imageScale;
  imageScale = Math.min(imageScale * 1.2, 5); // Max 5x zoom
  
  // Adjust position to zoom toward center
  const centerX = WIDTH / 2;
  const centerY = HALF / 2;
  imagePosition.x = centerX - (centerX - imagePosition.x) * (imageScale / oldScale);
  imagePosition.y = centerY - (centerY - imagePosition.y) * (imageScale / oldScale);
  
  redrawPreview();
};

const zoomOut = () => {
  if (!currentImage) return;
  const oldScale = imageScale;
  imageScale = Math.max(imageScale / 1.2, 0.1); // Min 0.1x zoom
  
  // Adjust position to zoom toward center
  const centerX = WIDTH / 2;
  const centerY = HALF / 2;
  imagePosition.x = centerX - (centerX - imagePosition.x) * (imageScale / oldScale);
  imagePosition.y = centerY - (centerY - imagePosition.y) * (imageScale / oldScale);
  
  redrawPreview();
};

// Mouse wheel zoom
elements.canvas.addEventListener('wheel', (e) => {
  if (!currentImage || photoStage >= 2) return;
  e.preventDefault();
  
  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) * (WIDTH / rect.width);
  const mouseY = (e.clientY - rect.top) * (HEIGHT / rect.height);
  const yOffset = photoStage === 0 ? 0 : HALF;
  
  // Only zoom if mouse is in current half
  if (mouseY >= yOffset && mouseY < yOffset + HALF) {
    const oldScale = imageScale;
    
    if (e.deltaY < 0) {
      imageScale = Math.min(imageScale * 1.1, 5);
    } else {
      imageScale = Math.max(imageScale / 1.1, 0.1);
    }
    
    // Zoom toward mouse position
    const localMouseX = mouseX;
    const localMouseY = mouseY - yOffset;
    imagePosition.x = localMouseX - (localMouseX - imagePosition.x) * (imageScale / oldScale);
    imagePosition.y = localMouseY - (localMouseY - imagePosition.y) * (imageScale / oldScale);
    
    redrawPreview();
  }
}, { passive: false });

// Pinch zoom for mobile
let lastTouchDistance = 0;

const getTouchDistance = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

elements.canvas.addEventListener('touchstart', (e) => {
  if (!currentImage || photoStage >= 2) return;
  
  if (e.touches.length === 2) {
    e.preventDefault();
    lastTouchDistance = getTouchDistance(e.touches);
    isDragging = false;
  } else if (e.touches.length === 1) {
    const rect = elements.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * (WIDTH / rect.width);
    const y = (touch.clientY - rect.top) * (HEIGHT / rect.height);
    
    const yOffset = photoStage === 0 ? 0 : HALF;
    if (y >= yOffset && y < yOffset + HALF) {
      startDrag(x, y - yOffset);
    }
  }
});

elements.canvas.addEventListener('touchmove', (e) => {
  if (!currentImage || photoStage >= 2) return;
  
  if (e.touches.length === 2) {
    e.preventDefault();
    const newDistance = getTouchDistance(e.touches);
    const scale = newDistance / lastTouchDistance;
    
    const oldScale = imageScale;
    imageScale = Math.max(0.1, Math.min(5, imageScale * scale));
    
    const rect = elements.canvas.getBoundingClientRect();
    const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * (WIDTH / rect.width);
    const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) * (HEIGHT / rect.height);
    const yOffset = photoStage === 0 ? 0 : HALF;
    const localCenterY = centerY - yOffset;
    
    imagePosition.x = centerX - (centerX - imagePosition.x) * (imageScale / oldScale);
    imagePosition.y = localCenterY - (localCenterY - imagePosition.y) * (imageScale / oldScale);
    
    lastTouchDistance = newDistance;
    redrawPreview();
  } else if (e.touches.length === 1 && isDragging) {
    e.preventDefault();
    const rect = elements.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * (WIDTH / rect.width);
    const y = (touch.clientY - rect.top) * (HEIGHT / rect.height);
    const yOffset = photoStage === 0 ? 0 : HALF;
    doDrag(x, y - yOffset);
  }
});

elements.canvas.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    lastTouchDistance = 0;
  }
  if (e.touches.length === 0) {
    endDrag();
  }
});

// Mouse/Touch drag handlers
const startDrag = (x, y) => {
  isDragging = true;
  dragStart = { x: x - imagePosition.x, y: y - imagePosition.y };
  elements.canvas.style.cursor = 'grabbing';
};

const doDrag = (x, y) => {
  if (!isDragging || !currentImage) return;
  
  imagePosition.x = x - dragStart.x;
  imagePosition.y = y - dragStart.y;
  
  redrawPreview();
};

const endDrag = () => {
  isDragging = false;
  elements.canvas.style.cursor = 'grab';
};

// Mouse events
elements.canvas.addEventListener('mousedown', (e) => {
  if (!currentImage || photoStage >= 2) return;
  const rect = elements.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (WIDTH / rect.width);
  const y = (e.clientY - rect.top) * (HEIGHT / rect.height);
  
  const yOffset = photoStage === 0 ? 0 : HALF;
  if (y >= yOffset && y < yOffset + HALF) {
    startDrag(x, y - yOffset);
  }
});

elements.canvas.addEventListener('mousemove', (e) => {
  if (!currentImage || photoStage >= 2) {
    elements.canvas.style.cursor = 'default';
    return;
  }
  
  const rect = elements.canvas.getBoundingClientRect();
  const y = (e.clientY - rect.top) * (HEIGHT / rect.height);
  const yOffset = photoStage === 0 ? 0 : HALF;
  
  if (y >= yOffset && y < yOffset + HALF) {
    elements.canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
  } else {
    elements.canvas.style.cursor = 'default';
  }
  
  if (!isDragging) return;
  const x = (e.clientX - rect.left) * (WIDTH / rect.width);
  doDrag(x, y - yOffset);
});

elements.canvas.addEventListener('mouseup', endDrag);
elements.canvas.addEventListener('mouseleave', endDrag);

// Zoom button events
elements.zoomInBtn.addEventListener('click', zoomIn);
elements.zoomOutBtn.addEventListener('click', zoomOut);

// Confirm photo position
const confirmCurrentPhoto = () => {
  if (!currentImage) return;
  
  photoStage++;
  currentImage = null;
  imagePosition = { x: 0, y: 0 };
  imageScale = 1;
  
  if (photoStage === 2) {
    finalizePhotoStrip();
  } else {
    // Reset for next photo
    elements.readyBtn.style.display = 'none';
    elements.uploadBtn.style.display = 'inline-block';
    elements.zoomControls.style.display = 'none';
    elements.canvas.style.cursor = 'default';
  }
};

elements.readyBtn.addEventListener('click', () => {
  // If still adjusting photo, confirm it first
  if (currentImage && photoStage < 2) {
    confirmCurrentPhoto();
    return;
  }
  
  // Otherwise proceed to final page
  localStorage.setItem('photoStrip', elements.canvas.toDataURL('image/png'));
  window.location.href = 'final.html';
});

// finalize photo strip
const finalizePhotoStrip = () => {
  const { ctx, readyBtn, downloadBtn, uploadBtn } = elements;
  const frame = new Image();
  frame.onload = () => {
    ctx.drawImage(frame, 0, 0, WIDTH, HEIGHT);
    uploadBtn.style.display = 'none';
    readyBtn.style.display = 'inline-block';
    readyBtn.disabled = false;
    downloadBtn.style.display = 'inline-block';
  };
  frame.src = selectedFramePath;
};

// download photo
const downloadPhoto = () => {
  const { canvas } = elements;
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'photo-strip.png';
    a.click();
  }, 'image/png');
};

// upload button
elements.uploadBtn.addEventListener('click', () => elements.uploadInput.click());

// handle upload
elements.uploadInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    drawPhoto(img, true);
    elements.uploadBtn.style.display = 'none';
    elements.readyBtn.style.display = 'inline-block';
    elements.readyBtn.disabled = false;
    elements.zoomControls.style.display = 'flex';
    elements.canvas.style.cursor = 'grab';
  };
  img.src = URL.createObjectURL(file);
  elements.uploadInput.value = '';
});

// download button
elements.downloadBtn.addEventListener('click', downloadPhoto);

// logo redirect
document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('.logo');
  if (logo) logo.addEventListener('click', () => window.location.href = 'index.html');
});