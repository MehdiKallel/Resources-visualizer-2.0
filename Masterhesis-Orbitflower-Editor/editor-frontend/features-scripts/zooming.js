function resetZoomingViewBox(newWidth, newHeight) {
  if (window.zoomingViewBox) {
    Object.assign(window.zoomingViewBox, {
      x: 0,
      y: 0,
      w: newWidth,
      h: newHeight
    });
    console.log('Zooming viewBox reset to:', window.zoomingViewBox);
  }
}

// Make function globally available
window.resetZoomingViewBox = resetZoomingViewBox;

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
  window.zoomingViewBox = viewBox;

  svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  
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

    // Sync viewBox with SVG if they're out of sync (fixes jump issue)
    const currentSvgViewBox = svgElement.getAttribute('viewBox');
    if (currentSvgViewBox) {
      const [svgX, svgY, svgW, svgH] = currentSvgViewBox.split(' ').map(Number);
      if (Math.abs(viewBox.x - svgX) > 0.1 || Math.abs(viewBox.y - svgY) > 0.1 || 
          Math.abs(viewBox.w - svgW) > 0.1 || Math.abs(viewBox.h - svgH) > 0.1) {
        console.log('Syncing viewBox with SVG before zooming');
        Object.assign(viewBox, { x: svgX, y: svgY, w: svgW, h: svgH });
      }
    }

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

    e.preventDefault();
    
    // Check for left mouse button or touch event
    if ((e.button !== undefined && e.button !== 0)) return;
    
    // Don't pan if clicking on interactive elements or control elements
    if (e.target.closest('.joystick-base, .zoom-controls, .unit, .role, .subject')) {
      return;
    }
    
    // Sync viewBox with SVG if they're out of sync (fixes jump issue)
    const currentSvgViewBox = svgElement.getAttribute('viewBox');
    if (currentSvgViewBox) {
      const [svgX, svgY, svgW, svgH] = currentSvgViewBox.split(' ').map(Number);
      if (Math.abs(viewBox.x - svgX) > 0.1 || Math.abs(viewBox.y - svgY) > 0.1 || 
          Math.abs(viewBox.w - svgW) > 0.1 || Math.abs(viewBox.h - svgH) > 0.1) {
        console.log('Syncing viewBox with SVG before panning');
        Object.assign(viewBox, { x: svgX, y: svgY, w: svgW, h: svgH });
      }
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
  
  // Add keyboard navigation support
  document.addEventListener('keydown', function(e) {
    // Skip if we're in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key) {
      case '0':
      case 'r':
        e.preventDefault();
        break;
    }
  });

  // Add event listeners
  svgElement.addEventListener('wheel', handleWheel);
  svgElement.addEventListener('mousedown', startPan);
  svgElement.addEventListener('mouseup', endPan);
  svgElement.addEventListener('mouseleave', endPan);

  // Touch events
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

