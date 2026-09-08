export function initPfpMaker() {
  const uploadInput = document.getElementById('pfp-upload');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const canvasPlaceholder = document.getElementById('canvas-placeholder');
  const canvas = document.getElementById('pfp-canvas');
  const controls = document.getElementById('workspace-controls');
  const scaleInput = document.getElementById('mask-scale');
  const rotateInput = document.getElementById('mask-rotate');
  const downloadBtn = document.getElementById('download-btn');

  if (!uploadInput || !canvas) return;

  const ctx = canvas.getContext('2d');
  
  let userImg = null;
  let maskImg = null;

  // Mask state
  let maskX = 250;
  let maskY = 250;
  let maskScale = 1;
  let maskRotate = 0; // degrees

  // For dragging
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  // Load the mask image
  const loadMask = () => {
    maskImg = new Image();
    maskImg.src = "/img/mask.png";
    maskImg.onload = draw;
  };

  const draw = () => {
    if (!userImg) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw user image (cover)
    const scale = Math.max(canvas.width / userImg.width, canvas.height / userImg.height);
    const x = (canvas.width / 2) - (userImg.width / 2) * scale;
    const y = (canvas.height / 2) - (userImg.height / 2) * scale;
    ctx.drawImage(userImg, x, y, userImg.width * scale, userImg.height * scale);

    // Draw Mask
    if (maskImg) {
      ctx.save();
      ctx.translate(maskX, maskY);
      ctx.rotate((maskRotate * Math.PI) / 180);
      ctx.scale(maskScale, maskScale);
      
      // Center the mask on its coordinates
      ctx.drawImage(maskImg, -maskImg.width / 2, -maskImg.height / 2);
      ctx.restore();
    }
  };

  // Upload Handler
  uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      userImg = new Image();
      userImg.onload = () => {
        // Show canvas, hide placeholder
        canvasPlaceholder.style.display = 'none';
        canvas.style.display = 'block';
        controls.style.display = 'block';

        // Reset mask position
        maskX = canvas.width / 2;
        maskY = canvas.height / 2;
        
        if (!maskImg) loadMask();
        else draw();
      };
      userImg.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Controls
  scaleInput.addEventListener('input', (e) => {
    maskScale = parseFloat(e.target.value);
    draw();
  });

  rotateInput.addEventListener('input', (e) => {
    maskRotate = parseFloat(e.target.value);
    draw();
  });

  // Dragging Logic
  const getMousePos = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  };

  const getTouchPos = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.touches[0].clientX - rect.left) * scaleX,
      y: (evt.touches[0].clientY - rect.top) * scaleY
    };
  };

  const onDown = (pos) => {
    isDragging = true;
    dragStartX = pos.x - maskX;
    dragStartY = pos.y - maskY;
  };

  const onMove = (pos) => {
    if (!isDragging) return;
    maskX = pos.x - dragStartX;
    maskY = pos.y - dragStartY;
    draw();
  };

  const onUp = () => {
    isDragging = false;
  };

  // Mouse events
  canvas.addEventListener('mousedown', (e) => onDown(getMousePos(e)));
  canvas.addEventListener('mousemove', (e) => onMove(getMousePos(e)));
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onUp);

  // Touch events
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling while dragging
    onDown(getTouchPos(e));
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    onMove(getTouchPos(e));
  }, { passive: false });
  canvas.addEventListener('touchend', onUp);

  // Download
  downloadBtn.addEventListener('click', () => {
    if (!userImg) return;
    const link = document.createElement('a');
    link.download = 'DOOH-Bandit-PFP.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}
