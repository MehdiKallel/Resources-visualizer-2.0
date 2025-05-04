// Track isolated node state
const _isolationState = {
  isIsolated: false,
  currentNodeId: null,
  originalViewBox: null,
  removedChildren: []
};

function isolateTargetGraphNode(nodeId, sourceContainer, targetContainer) {
  const targetGraphNode = document.getElementById(targetContainer);
  if (!targetGraphNode) {
      console.error(`Target container with ID ${targetContainer} not found.`);
      return;
  }
  
  const svgElement = document.querySelector(`svg[id="${sourceContainer}"]`);
  if (!svgElement) {
      console.error(`SVG element with ID ${sourceContainer} not found.`);
      return;
  }
  
  // If we're already isolated on this node, don't do anything
  if (_isolationState.isIsolated && _isolationState.currentNodeId === nodeId) {
      console.log(`Node ${nodeId} is already isolated, skipping viewBox change.`);
      return;
  }
  
  // Save original viewBox if first time isolating
  if (!_isolationState.isIsolated) {
      _isolationState.originalViewBox = svgElement.getAttribute('viewBox');
      _isolationState.isIsolated = true;
  }
  
  // Update current node ID
  _isolationState.currentNodeId = nodeId;
  
  const children = svgElement.children;
  let tooltipContainer = svgElement.querySelector(".skill-tooltip-container");
  
  // Clear previous saved removed children
  _isolationState.removedChildren = [];
  
  // Remove all children except the target node and tooltip/defs
  for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child.id !== nodeId && child.tagName !== 'defs' && !child.classList.contains('skill-tooltip-container')) {
          _isolationState.removedChildren.push(child.cloneNode(true));
          child.remove();
      }
  }
  
  const remainingElement = document.getElementById(nodeId);
  if (!remainingElement) {
      console.error(`Element with ID ${nodeId} not found in SVG.`);
      return;
  }
  
  // Calculate and set viewBox to center the element without scaling it
  const bbox = remainingElement.getBBox();
  const padding = 20; // Add some padding around the element
  
  // Set the SVG's viewBox to center the element with padding
  svgElement.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding*2} ${bbox.height + padding*2}`);
  
  // Re-append tooltip if necessary
  if (!svgElement.querySelector(".skill-tooltip-container") && tooltipContainer) {
      svgElement.appendChild(tooltipContainer);
  }
}

// Add a function to restore the original SVG state
function restoreGraphView(sourceContainer) {
  if (!_isolationState.isIsolated) return;
  
  const svgElement = document.querySelector(`svg[id="${sourceContainer}"]`);
  if (!svgElement) {
    console.error(`SVG element with ID ${sourceContainer} not found.`);
    return;
  }
  
  // Restore original viewBox
  if (_isolationState.originalViewBox) {
    svgElement.setAttribute('viewBox', _isolationState.originalViewBox);
  }
  
  // Restore removed children
  for (const child of _isolationState.removedChildren) {
    svgElement.appendChild(child);
  }
  
  // Reset state
  _isolationState.isIsolated = false;
  _isolationState.currentNodeId = null;
  _isolationState.removedChildren = [];
}

// global backup storage
const _graphBackup = {};

function splitGraphContainer(doSplit = true) {
  const container = document.getElementById('graph');
  if (!container) {
    console.error('Graph container not found. Cannot split or restore.');
    return;
  }
  
  if (doSplit) {
    if (_graphBackup.isSplit) return;
    _graphBackup.isSplit = true;

    _graphBackup.origStyle = container.getAttribute('style') || '';
    _graphBackup.origHTML  = container.innerHTML;

    container.style.display       = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow      = 'hidden';

    // top pane: move existing content into here
    const topPane = document.createElement('div');
    topPane.style.flexBasis   = '60%';
    topPane.style.flexShrink  = '0';
    topPane.style.overflow    = 'auto';
    topPane.setAttribute('id', 'graph');
    while (container.firstChild) {
      topPane.appendChild(container.firstChild);
    }

    // drag handle
    const handle = document.createElement('div');
    handle.style.height  = '5px';
    handle.style.cursor  = 'row-resize';
    handle.style.background = 'var(--x-ui-border-color)';

    // bottom pane: for expressionBuilder
    const bottomPane = document.createElement('div');
    bottomPane.style.flex    = '1';
    bottomPane.style.overflow = 'auto';
    bottomPane.setAttribute('id', 'detailed-graph-skills');

    // reassemble
    container.append(topPane, handle, bottomPane);

    // --- DRAG LOGIC ---
    let isDragging = false;
    const onMouseDown = () => {
      isDragging = true;
      document.body.style.userSelect = 'none';
    };
    const onMouseMove = e => {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      let newHeight = e.clientY - rect.top;
      // clamp so neither pane collapses
      newHeight = Math.max(50, Math.min(rect.height - 50, newHeight));
      topPane.style.flexBasis = newHeight + 'px';
    };
    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
      }
    };

    handle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // save handlers for later removal
    _graphBackup.handle       = handle;
    _graphBackup.onMouseDown  = onMouseDown;
    _graphBackup.onMouseMove  = onMouseMove;
    _graphBackup.onMouseUp    = onMouseUp;

    console.log('Graph container split horizontally.');
  } 
  else {
    if (!_graphBackup.isSplit) return;

    _graphBackup.handle.removeEventListener('mousedown', _graphBackup.onMouseDown);
    document.removeEventListener('mousemove', _graphBackup.onMouseMove);
    document.removeEventListener('mouseup', _graphBackup.onMouseUp);

    container.setAttribute('style', _graphBackup.origStyle);
    container.innerHTML = _graphBackup.origHTML;

    Object.keys(_graphBackup).forEach(k => delete _graphBackup[k]);
    console.log('Graph container restored to original layout.');
  }
}
