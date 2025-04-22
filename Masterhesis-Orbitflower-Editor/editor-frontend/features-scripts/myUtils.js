function isolateTargetGraphNode(nodeId, sourceContainer, targetContainer) {
    const targetGraphNode = document.getElementById(`${targetContainer}`);
    const svgElement = document.querySelector(`svg[id="${sourceContainer}"]`);
    const children = svgElement.children;
    
    // Preserve tooltip container if it exists
    let tooltipContainer = svgElement.querySelector(".skill-tooltip-container");
    
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child.id !== nodeId && child.tagName !== 'defs' && !child.classList.contains('skill-tooltip-container')) {
        child.remove();
      }
    }
        
    const remainingElement = document.getElementById(nodeId);
    if (remainingElement) {
      const bbox = remainingElement.getBBox();
      const centerX = bbox.x + bbox.width/2;
      const centerY = bbox.y + bbox.height/2;
      remainingElement.setAttribute('transform', `translate(${centerX}, ${centerY}) scale(3) translate(${-centerX}, ${-centerY})`);
            
      const svgViewBox = svgElement.viewBox.baseVal;
      const viewportCenterX = svgViewBox.width / 2;
      const viewportCenterY = svgViewBox.height / 2;
      const dx = viewportCenterX - centerX;
      const dy = viewportCenterY - centerY;
            
      remainingElement.setAttribute('transform', `translate(${dx}, ${dy}) translate(${centerX}, ${centerY}) scale(3) translate(${-centerX}, ${-centerY})`);
      
      // If tooltip was removed, recreate it
      if (!svgElement.querySelector(".skill-tooltip-container") && tooltipContainer) {
        svgElement.appendChild(tooltipContainer);
      }
    }
  }


  // global backup storage
  const _graphBackup = {};

  function splitGraphContainer(doSplit = true) {
    const container = document.getElementById('graph');
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
