function initializeZooming() {
  console.log("Initializing zooming functionality...");
    const svgElement = document.getElementById('main-svg');
  if (!svgElement) 
      console.error('SVG element not found!');

  let currentViewBox = svgElement.getAttribute('viewBox');
    if (!currentViewBox) {
        console.error('No viewBox attribute found on the SVG element!');
        return;
    }
    
    let [x, y, w, h] = currentViewBox.split(' ').map(Number);

  // Capture the original viewBox values as constants to ensure they're never modified
  const initialX = 0;
  const initialY = 0;
  const initialW = w;
  const initialH = h;


  console.log("initial viewBox values:", initialX, initialY, initialW, initialH);
  
  // Use these values to create the initial viewBox object
  const initialViewBox = {
    x: initialX,
    y: initialY,
    w: initialW,
    h: initialH
  };
  
  const originalViewBox = svgElement.getAttribute('viewBox');
  if (originalViewBox) {
    const [x, y, w, h] = originalViewBox.split(' ').map(Number);
    Object.assign(initialViewBox, { x, y, w, h });
  }
  
  // Create a true copy of initialViewBox by explicitly copying each property
  let viewBox = {
    x: initialViewBox.x,
    y: initialViewBox.y,
    w: initialViewBox.w,
    h: initialViewBox.h
  };

  console.log('Initial viewBox:', viewBox);
  
  svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  
  const controlPanel = document.createElement('div');
  controlPanel.className = 'svg-navigation-controls';
  controlPanel.innerHTML = `
    <div class="joystick-base">
      <div class="joystick-handle" id="joystick-handle"></div>
    </div>
    <div class="zoom-controls">
      <div class="zoom-button" id="zoom-in">+</div>
      <div class="zoom-button" id="reset-view">⌂</div>
      <div class="zoom-button" id="zoom-out">−</div>
    </div>
  `;
  
  const svgContainer = svgElement.parentNode;
  svgContainer.style.position = 'relative';
  svgContainer.appendChild(controlPanel);
  
  const style = document.createElement('style');
  style.textContent = `
    .svg-navigation-controls {
      position: absolute;
      bottom: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: center;
      z-index: 1000;
    }
    
    .joystick-base {
      width: 80px;
      height: 80px;
      background-color: rgba(50, 50, 50, 0.3);
      border-radius: 50%;
      position: relative;
      box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3);
    }
    
    .joystick-handle {
      width: 30px;
      height: 30px;
      background-color: rgba(200, 200, 200, 0.9);
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      cursor: grab;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    }
    
    .joystick-handle:active {
      cursor: grabbing;
      background-color: rgba(180, 180, 180, 0.9);
    }
    
    .zoom-controls {
      display: flex;
      gap: 10px;
    }
    
    .zoom-button {
      width: 25px;
      height: 25px;
      background-color: rgba(200, 200, 200, 0.8);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      user-select: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    
    .zoom-button:hover {
      background-color: rgba(220, 220, 220, 0.9);
    }
    
    .zoom-button:active {
      transform: scale(0.95);
      background-color: rgba(180, 180, 180, 0.9);
    }
  `;
  document.head.appendChild(style);
  
  // Joystick functionality
  const joystickHandle = document.getElementById('joystick-handle');
  const joystickBase = document.querySelector('.joystick-base');
  let isDragging = false;
  let panInterval = null;
  let joystickNormalizedX = 0;
  let joystickNormalizedY = 0;
  
  joystickHandle.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', dragJoystick);
  document.addEventListener('mouseup', stopDrag);
  
  joystickHandle.addEventListener('touchstart', e => {
    e.preventDefault();
    startDrag(e.touches[0]);
  });
  document.addEventListener('touchmove', e => {
    e.preventDefault();
    dragJoystick(e.touches[0]);
  });
  document.addEventListener('touchend', stopDrag);
  
  function startDrag(e) {
    isDragging = true;
    joystickHandle.style.transition = 'none';
    clearInterval(panInterval);

    // Reset normalized positions at the start of drag
    joystickNormalizedX = 0;
    joystickNormalizedY = 0;
    
    // Start continuous panning based on joystick position
    panInterval = setInterval(updatePanFromJoystick, 16); // ~60fps
  }
  
  function updatePanFromJoystick() {
    if (!isDragging) return;
    
    // Pan the SVG based on stored joystick position - don't modify width/height (no zooming)
    const panSpeed = 2;
    const panAmountX = joystickNormalizedX * viewBox.w * panSpeed * 0.01;
    const panAmountY = joystickNormalizedY * viewBox.h * panSpeed * 0.01;
    
    viewBox.x += panAmountX;
    viewBox.y += panAmountY;
    
    // Only update x and y, don't modify w and h to prevent zooming
    svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }
  
  function dragJoystick(e) {
    if (!isDragging) return;
    
    const baseRect = joystickBase.getBoundingClientRect();
    const baseX = baseRect.left + baseRect.width/2;
    const baseY = baseRect.top + baseRect.height/2;
    
    let moveX = e.clientX - baseX;
    let moveY = e.clientY - baseY;
    
    // Calculate distance from center
    const distance = Math.sqrt(moveX * moveX + moveY * moveY);
    const maxDistance = baseRect.width/2 - joystickHandle.offsetWidth/2;
    
    // Limit movement to circle
    if (distance > maxDistance) {
      const ratio = maxDistance / distance;
      moveX *= ratio;
      moveY *= ratio;
    }
    
    // Move joystick handle
    joystickHandle.style.left = `calc(50% + ${moveX}px)`;
    joystickHandle.style.top = `calc(50% + ${moveY}px)`;
    
    // Store normalized positions for continuous panning
    joystickNormalizedX = moveX / maxDistance;
    joystickNormalizedY = moveY / maxDistance;
  }
  
  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    
    // Stop continuous panning
    clearInterval(panInterval);
    
    // Reset normalized positions
    joystickNormalizedX = 0;
    joystickNormalizedY = 0;
    
    // Return joystick to center with animation
    joystickHandle.style.transition = 'all 0.2s ease-out';
    joystickHandle.style.left = '50%';
    joystickHandle.style.top = '50%';
  }
  
  // Zoom controls
  document.getElementById('zoom-in').addEventListener('click', zoomIn);
  document.getElementById('zoom-out').addEventListener('click', zoomOut);
  document.getElementById('reset-view').addEventListener('click', resetView);
  
  // Set default cursor style
  svgElement.style.cursor = 'grab';

  let isPanning = false;
  let startX, startY;
  let originalW, originalH; // Store original width/height during pan operations

  function hasClass(element, className) {
    while (element) {
      if (element.classList && element.classList.contains(className)) {
        return true;
      }
      element = element.parentNode;
    }
    return false;
  }

  function handleWheel(e) {
    e.preventDefault();

    if (e.ctrlKey) return;
    const zoomIntensity = 0.1;
    const delta = e.deltaY;
    
    // Ignore very small wheel movements (threshold of 5)
    if (Math.abs(delta) < 5) return;
    
    let zoomFactor = 1 + (delta > 0 ? zoomIntensity : -zoomIntensity);
    zoomFactor = Math.min(2, Math.max(0.2, zoomFactor));

    const rect = svgElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldX = viewBox.x;
    const oldY = viewBox.y;
    const oldW = viewBox.w;
    const oldH = viewBox.h;

    const mouseSvgX = (mouseX / rect.width) * oldW + oldX;
    const mouseSvgY = (mouseY / rect.height) * oldH + oldY;

    const newW = oldW * zoomFactor;
    const newH = oldH * zoomFactor;

    const newX = mouseSvgX - (mouseX / rect.width) * newW;
    const newY = mouseSvgY - (mouseY / rect.height) * newH;

    viewBox.x = newX;
    viewBox.y = newY;
    viewBox.w = newW;
    viewBox.h = newH;

    svgElement.setAttribute('viewBox', `${newX} ${newY} ${newW} ${newH}`);
  }
  
  function startPan(e) {
    // Prevent default to avoid any browser zooming behavior
    e.preventDefault();
    
    // Check for left mouse button or touch event
    if ((e.button !== undefined && e.button !== 0)) return;
    
    // Don't pan if clicking on interactive elements or control elements
    if (e.target.closest('.joystick-base, .zoom-controls, .unit, .role, .subject')) {
      return;
    }
    
    isPanning = true;
    startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    svgElement.style.cursor = 'grabbing';
    
    // Store original width and height to ensure they don't change during panning
    originalW = viewBox.w;
    originalH = viewBox.h;
    
    // Add mousemove listener dynamically only when panning starts
    document.addEventListener('mousemove', pan);
  }

  function pan(e) {
    if (!isPanning) return;
    
    e.preventDefault();
    
    const clientX = e.clientX || (e.touches ? e.touches[0].clientX : startX);
    const clientY = e.clientY || (e.touches ? e.touches[0].clientY : startY);
    
    const dx = clientX - startX;
    const dy = clientY - startY;
    startX = clientX;
    startY = clientY;

    const rect = svgElement.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;

    viewBox.x -= dx * scaleX;
    viewBox.y -= dy * scaleY;
    
    // Ensure width and height remain constant during panning
    viewBox.w = originalW;
    viewBox.h = originalH;

    svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }

  function endPan() {
    if (!isPanning) return;
    isPanning = false;
    svgElement.style.cursor = 'grab';
    
    // Remove the mousemove event listener when panning ends
    document.removeEventListener('mousemove', pan);
  }
  
  // New navigation functions
  function zoomIn() {
    const zoomFactor = 0.8; // Zoom in by reducing view size
    const centerX = viewBox.x + viewBox.w / 2;
    const centerY = viewBox.y + viewBox.h / 2;
    
    const newW = viewBox.w * zoomFactor;
    const newH = viewBox.h * zoomFactor;
    
    viewBox.x = centerX - newW / 2;
    viewBox.y = centerY - newH / 2;
    viewBox.w = newW;
    viewBox.h = newH;
    
    svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }
  
  function zoomOut() {
    const zoomFactor = 1.2; // Zoom out by increasing view size
    const centerX = viewBox.x + viewBox.w / 2;
    const centerY = viewBox.y + viewBox.h / 2;
    
    const newW = viewBox.w * zoomFactor;
    const newH = viewBox.h * zoomFactor;
    
    viewBox.x = centerX - newW / 2;
    viewBox.y = centerY - newH / 2;
    viewBox.w = newW;
    viewBox.h = newH;
    
    svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }
  
  function moveView(direction) {
    const moveAmount = 0.1; // Move by 10% of the current view
    switch(direction) {
      case 'left':
        viewBox.x -= viewBox.w * moveAmount;
        break;
      case 'right':
        viewBox.x += viewBox.w * moveAmount;
        break;
      case 'up':
        viewBox.y -= viewBox.h * moveAmount;
        break;
      case 'down':
        viewBox.y += viewBox.h * moveAmount;
        break;
    }
    svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }
  
  function resetView() {
    // Create a fresh copy of initialViewBox without reference to the original
    viewBox = {
      x: initialViewBox.x,
      y: initialViewBox.y,
      w: initialViewBox.w,
      h: initialViewBox.h
    };
    svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }
  
  // Fix event listeners for control buttons - use ID selectors instead of class selectors
  // And only include buttons that actually exist in the DOM
  document.getElementById('zoom-in').addEventListener('click', zoomIn);
  document.getElementById('zoom-out').addEventListener('click', zoomOut);
  document.getElementById('reset-view').addEventListener('click', resetView);
  
  // Add keyboard navigation support
  document.addEventListener('keydown', function(e) {
    // Skip if we're in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key) {
      case '+':
      case '=':
        zoomIn();
        e.preventDefault();
        break;
      case '-':
      case '_':
        zoomOut();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        moveView('left');
        e.preventDefault();
        break;
      case 'ArrowRight':
        moveView('right');
        e.preventDefault();
        break;
      case 'ArrowUp':
        moveView('up');
        e.preventDefault();
        break;
      case 'ArrowDown':
        moveView('down');
        e.preventDefault();
        break;
      case '0':
      case 'r':
        resetView();
        e.preventDefault();
        break;
    }
  });

  svgElement.addEventListener('wheel', handleWheel);
  svgElement.addEventListener('mousedown', startPan);
  svgElement.addEventListener('mouseup', endPan);
  svgElement.addEventListener('mouseleave', endPan);

  // Add touch support for panning
  svgElement.addEventListener('touchstart', function(e) {
      e.preventDefault(); 
      if (e.touches.length === 1) {
        startPan(e);
      }
    }, { passive: false });
  
  svgElement.addEventListener('touchmove', function(e) {
    e.preventDefault();
    pan(e);
  }, { passive: false });
  
  svgElement.addEventListener('touchend', endPan);
  svgElement.addEventListener('touchcancel', endPan);
}


