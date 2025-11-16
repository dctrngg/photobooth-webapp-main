// constants
const WIDTH = 1176, HEIGHT = 1470;

// dom elements
const canvas = document.getElementById('finalCanvas'),
      ctx = canvas.getContext('2d'),
      addFishBtn = document.getElementById('addFish'),
      addOctopusBtn = document.getElementById('addOctopus'),
      addSeaweedBtn = document.getElementById('addSeaweed'),
      addAxBtn = document.getElementById('addAx'),
      addBubbleBtn = document.getElementById('addBubble'),
      downloadBtn = document.getElementById('downloadBtn'),
      homeBtn = document.getElementById('homeBtn'),
      resetBtn = document.getElementById('reset'),
      shareBtn = document.getElementById('shareBtn'),
      scanBtn = document.getElementById('scanBtn'),
      qrModal = document.getElementById('qrModal'),
      qrCanvas = document.getElementById('qrCanvas'),
      qrCloseBtn = document.getElementById('qrClose'),
      scanModal = document.getElementById('scanModal'),
      scanCloseBtn = document.getElementById('scanClose'),
      scanInput = document.getElementById('scanInput'),
      scanSubmitBtn = document.getElementById('scanSubmitBtn');

// sticker paths
const stickerPaths = {
  fish: 'Assets/fish-photobooth/camerapage/stickers/fish.png',
  octopus: 'Assets/fish-photobooth/camerapage/stickers/octopus.png',
  seaweed1: 'Assets/fish-photobooth/camerapage/stickers/seaweed1.png',
  seaweed2: 'Assets/fish-photobooth/camerapage/stickers/seaweed2.png',
  axolotl: 'Assets/fish-photobooth/camerapage/stickers/axolotl.png',
  bubble1: 'Assets/fish-photobooth/camerapage/stickers/bubble1.png',
  bubble2: 'Assets/fish-photobooth/camerapage/stickers/bubble2.png'
};

// sticker state
let stickers = [], 
    selectedSticker = null,
    dragOffset = { x: 0, y: 0 },
    initialPinchDistance = 0,
    initialRotation = 0,
    initialSize = { width: 0, height: 0 },
    lastTapTime = 0,
    seaweedIndex = 0,
    bubbleIndex = 0;

// load photo
const finalImage = new Image(), dataURL = localStorage.getItem('photoStrip');
if (dataURL) {
  finalImage.src = dataURL;
  finalImage.onload = drawCanvas;
  localStorage.removeItem('photoStrip');
} else alert("No photo found!");

// draw canvas
function drawCanvas() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.drawImage(finalImage, 0, 0, WIDTH, HEIGHT);
  
  stickers.forEach(s => {
    ctx.save();
    ctx.translate(s.x + s.width / 2, s.y + s.height / 2);
    ctx.rotate(s.rotation * Math.PI / 180);
    ctx.drawImage(s.img, -s.width / 2, -s.height / 2, s.width, s.height);
    
    // Draw selection border with corner handles
    if (s === selectedSticker) {
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(-s.width / 2, -s.height / 2, s.width, s.height);
      ctx.setLineDash([]);
      
      // Draw corner handles
      const handleSize = 20;
      ctx.fillStyle = '#555555';
      
      // Top-left
      ctx.fillRect(-s.width / 2 - handleSize/2, -s.height / 2 - handleSize/2, handleSize, handleSize);
      // Top-right
      ctx.fillRect(s.width / 2 - handleSize/2, -s.height / 2 - handleSize/2, handleSize, handleSize);
      // Bottom-left
      ctx.fillRect(-s.width / 2 - handleSize/2, s.height / 2 - handleSize/2, handleSize, handleSize);
      // Bottom-right
      ctx.fillRect(s.width / 2 - handleSize/2, s.height / 2 - handleSize/2, handleSize, handleSize);
      
      // Draw rotation indicator at top
      ctx.beginPath();
      ctx.arc(0, -s.height / 2 - 30, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -s.height / 2);
      ctx.lineTo(0, -s.height / 2 - 22);
      ctx.stroke();
    }
    ctx.restore();
  });
}

// add sticker
function addSticker(src) {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    const newSticker = {
      img,
      x: WIDTH / 2 - img.width / 3,
      y: HEIGHT / 2 - img.height / 3,
      width: img.width / 1.5, // Larger default size
      height: img.height / 1.5,
      rotation: 0,
      dragging: false
    };
    stickers.push(newSticker);
    selectedSticker = newSticker; // Auto-select new sticker
    drawCanvas();
  };
}

// pointer position
function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect(), 
        scaleX = canvas.width / rect.width, 
        scaleY = canvas.height / rect.height;
  const clientX = e.touches?.[0]?.clientX ?? e.clientX,
        clientY = e.touches?.[0]?.clientY ?? e.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

// check if point is in rotated rectangle
function isPointInSticker(x, y, sticker) {
  const cx = sticker.x + sticker.width / 2;
  const cy = sticker.y + sticker.height / 2;
  const rad = -sticker.rotation * Math.PI / 180;
  
  const dx = x - cx;
  const dy = y - cy;
  
  const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);
  
  return Math.abs(rotatedX) <= sticker.width / 2 && Math.abs(rotatedY) <= sticker.height / 2;
}

// get distance between two touches
function getTouchDistance(e) {
  if (e.touches.length < 2) return 0;
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// get angle between two touches
function getTouchAngle(e) {
  if (e.touches.length < 2) return 0;
  const dx = e.touches[1].clientX - e.touches[0].clientX;
  const dy = e.touches[1].clientY - e.touches[0].clientY;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

// drag and drop + pinch zoom + rotate
function pointerDown(e) {
  const { x: mouseX, y: mouseY } = getPointerPos(e);
  
  // Check for double tap to delete
  if (e.touches && e.touches.length === 1) {
    const now = Date.now();
    if (now - lastTapTime < 300) {
      // Double tap detected
      for (let i = stickers.length - 1; i >= 0; i--) {
        if (isPointInSticker(mouseX, mouseY, stickers[i])) {
          if (confirm('Delete this sticker?')) {
            stickers.splice(i, 1);
            selectedSticker = null;
            drawCanvas();
          }
          break;
        }
      }
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;
  }
  
  // Multi-touch on selected sticker - start resize/rotate
  if (e.touches && e.touches.length === 2 && selectedSticker) {
    initialPinchDistance = getTouchDistance(e);
    initialRotation = getTouchAngle(e);
    initialSize = { width: selectedSticker.width, height: selectedSticker.height };
    e.preventDefault();
    return;
  }
  
  // Single touch - select or drag sticker
  if (e.touches && e.touches.length === 1) {
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      if (isPointInSticker(mouseX, mouseY, s)) {
        selectedSticker = s;
        s.dragging = true;
        dragOffset.x = mouseX - s.x;
        dragOffset.y = mouseY - s.y;
        stickers.splice(i, 1);
        stickers.push(s);
        drawCanvas();
        e.preventDefault();
        return;
      }
    }
    // Clicked empty space - deselect
    selectedSticker = null;
    drawCanvas();
  }
  
  // Mouse click - select or drag
  if (!e.touches) {
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      if (isPointInSticker(mouseX, mouseY, s)) {
        selectedSticker = s;
        s.dragging = true;
        dragOffset.x = mouseX - s.x;
        dragOffset.y = mouseY - s.y;
        stickers.splice(i, 1);
        stickers.push(s);
        drawCanvas();
        e.preventDefault();
        return;
      }
    }
    // Clicked empty space - deselect
    selectedSticker = null;
    drawCanvas();
  }
}

function pointerMove(e) {
  // Multi-touch: pinch to zoom + rotate (works on selected sticker anywhere)
  if (e.touches && e.touches.length === 2 && selectedSticker) {
    const currentDistance = getTouchDistance(e);
    const currentAngle = getTouchAngle(e);
    
    if (initialPinchDistance > 0) {
      const scale = currentDistance / initialPinchDistance;
      selectedSticker.width = initialSize.width * scale;
      selectedSticker.height = initialSize.height * scale;
      
      const angleDiff = currentAngle - initialRotation;
      selectedSticker.rotation += angleDiff;
      initialRotation = currentAngle;
    }
    
    drawCanvas();
    e.preventDefault();
    return;
  }
  
  // Single touch/mouse: drag
  if (selectedSticker?.dragging) {
    const { x: mouseX, y: mouseY } = getPointerPos(e);
    selectedSticker.x = mouseX - dragOffset.x;
    selectedSticker.y = mouseY - dragOffset.y;
    drawCanvas();
    e.preventDefault();
  }
}

function pointerUp(e) { 
  if (selectedSticker) {
    selectedSticker.dragging = false;
  }
  
  // Reset pinch state when lifting fingers
  if (!e.touches || e.touches.length < 2) {
    initialPinchDistance = 0;
  }
}

// mouse events
canvas.addEventListener('mousedown', pointerDown);
canvas.addEventListener('mousemove', pointerMove);
canvas.addEventListener('mouseup', pointerUp);
canvas.addEventListener('mouseleave', pointerUp);

// touch events
canvas.addEventListener('touchstart', pointerDown, { passive: false });
canvas.addEventListener('touchmove', pointerMove, { passive: false });
canvas.addEventListener('touchend', pointerUp);
canvas.addEventListener('touchcancel', pointerUp);

// Sticker button handlers
addFishBtn.addEventListener('click', () => addSticker(stickerPaths.fish));
addOctopusBtn.addEventListener('click', () => addSticker(stickerPaths.octopus));
addSeaweedBtn.addEventListener('click', () => {
  const seaweeds = [stickerPaths.seaweed1, stickerPaths.seaweed2];
  addSticker(seaweeds[seaweedIndex]);
  seaweedIndex = (seaweedIndex + 1) % seaweeds.length;
});
addAxBtn.addEventListener('click', () => addSticker(stickerPaths.axolotl));
addBubbleBtn.addEventListener('click', () => {
  const bubbles = [stickerPaths.bubble1, stickerPaths.bubble2];
  addSticker(bubbles[bubbleIndex]);
  bubbleIndex = (bubbleIndex + 1) % bubbles.length;
});

// reset
resetBtn.addEventListener('click', () => { 
  stickers = []; 
  selectedSticker = null;
  drawCanvas(); 
});

// QR Code Generation
async function generateQRCode() {
  const imageData = canvas.toDataURL('image/png');
  
  // Save to localStorage with unique ID
  const photoId = 'photo_' + Date.now();
  localStorage.setItem(photoId, imageData);
  
  // Generate shareable URL
  const shareUrl = window.location.origin + window.location.pathname.replace('final.html', 'view.html') + '?id=' + photoId;
  
  // Clear previous QR code
  const qrCodeContainer = document.getElementById('qrCodeContainer');
  if (qrCodeContainer) {
    qrCodeContainer.innerHTML = '';
  }
  
  // Generate QR code using library
  if (typeof QRCode !== 'undefined') {
    try {
      const qrContainer = document.createElement('div');
      qrContainer.style.display = 'inline-block';
      qrCodeContainer.appendChild(qrContainer);
      
      new QRCode(qrContainer, {
        text: shareUrl,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
      
      // Hide canvas, show container
      qrCanvas.style.display = 'none';
    } catch (error) {
      console.error('QR generation error:', error);
      fallbackQRDisplay(shareUrl);
    }
  } else {
    fallbackQRDisplay(shareUrl);
  }
  
  qrModal.style.display = 'flex';
}

// Fallback if QR library fails
function fallbackQRDisplay(url) {
  const qrCtx = qrCanvas.getContext('2d');
  qrCanvas.style.display = 'block';
  qrCtx.fillStyle = 'white';
  qrCtx.fillRect(0, 0, 256, 256);
  qrCtx.fillStyle = 'black';
  qrCtx.font = '14px Castoro, serif';
  qrCtx.textAlign = 'center';
  qrCtx.fillText('Share this link:', 128, 100);
  qrCtx.font = '10px Castoro, serif';
  const urlParts = url.match(/.{1,35}/g);
  urlParts.forEach((part, i) => {
    qrCtx.fillText(part, 128, 130 + i * 15);
  });
}

// Scan QR code
function scanQRCode() {
  scanModal.style.display = 'flex';
  scanInput.value = '';
  scanInput.focus();
}

// Submit scan
if (scanSubmitBtn) {
  scanSubmitBtn.addEventListener('click', () => {
    const photoId = scanInput.value.trim();
    if (photoId) {
      window.location.href = 'view.html?id=' + photoId;
    } else {
      alert('Please enter a photo ID');
    }
  });
}

// Allow Enter key in scan input
if (scanInput) {
  scanInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      scanSubmitBtn.click();
    }
  });
}

// download
downloadBtn.addEventListener('click', () => {
  canvas.toBlob(blob => { 
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = 'fish-photobooth.png'; 
    a.click(); 
  }, 'image/png');
});

// share button
if (shareBtn) {
  shareBtn.addEventListener('click', generateQRCode);
}

// scan button
if (scanBtn) {
  scanBtn.addEventListener('click', scanQRCode);
}

// close modals
if (qrCloseBtn) {
  qrCloseBtn.addEventListener('click', () => qrModal.style.display = 'none');
}

if (scanCloseBtn) {
  scanCloseBtn.addEventListener('click', () => scanModal.style.display = 'none');
}

// Close modals on outside click
qrModal.addEventListener('click', (e) => {
  if (e.target === qrModal) {
    qrModal.style.display = 'none';
  }
});

scanModal.addEventListener('click', (e) => {
  if (e.target === scanModal) {
    scanModal.style.display = 'none';
  }
});

// home
homeBtn.addEventListener('click', () => window.location.href = 'index.html');

// logo
document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('.logo');
  if (logo) logo.addEventListener('click', () => window.location.href = 'index.html');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (selectedSticker) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const index = stickers.indexOf(selectedSticker);
      if (index > -1) {
        stickers.splice(index, 1);
        selectedSticker = null;
        drawCanvas();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectedSticker.rotation -= 5;
      drawCanvas();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectedSticker.rotation += 5;
      drawCanvas();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      selectedSticker.width *= 1.1;
      selectedSticker.height *= 1.1;
      drawCanvas();
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      selectedSticker.width *= 0.9;
      selectedSticker.height *= 0.9;
      drawCanvas();
    }
  }
});