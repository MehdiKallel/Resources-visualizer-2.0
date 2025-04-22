const SHIFT_FACTOR = 20;
const EXPANSION_FACTOR = 1.5;
const ANIMATION_DURATION = 200;
let isExpanded = false;
let originalPositions = {};
let center = null;
let animationFrameId = null;
let deletedElements = [];
let documentCenter = null;
let mylocalData = null;

let skills = {};

document.addEventListener("graphRendered", async function () {
  document.addEventListener("click", (e) => {
    console.log(window.expressionBuilderPaused);
    console.log("##############################click event", e.target);
    if (
      e.target.classList.contains("skill-segment") &&
      isExpanded === true &&
      window.expressionBuilderPaused
    ) {
      deleteCenteredSVG();
      toggleExpansion();
    }
  });

  console.log("call from expanderWorker.js", window.passData);
  center = estimateCenterOfCircles();
  createToggleButton();
  storeOriginalPositions();

  console.log("Detailed Skill View Loaded correctly");
});

function deleteUnecessaryElements() {
  // Only delete paths with connect or relation in class, preserve other paths
  const pathElements = document.querySelectorAll("path");
  pathElements.forEach((path) => {
    if (
      path.classList.contains("connect") ||
      path.classList.contains("relation")
    ) {
      // Store the path's parent node and its position in the DOM
      const pathParent = path.parentNode;
      const nextSibling = path.nextSibling;

      // Remove from DOM but store for later restoration
      pathParent.removeChild(path);

      // Store reference to the element and information needed to restore it
      deletedElements.push({
        element: path,
        parent: pathParent,
        nextSibling: nextSibling,
      });
    }
  });
}

function restoreDeletedElements() {
  deletedElements.forEach((item) => {
    if (item.nextSibling) {
      item.parent.insertBefore(item.element, item.nextSibling);
    } else {
      item.parent.appendChild(item.element);
    }
  });

  deletedElements = [];
}

function estimateCenterOfCircles() {
  const circles = document.querySelectorAll("circle");
  const circlesArray = Array.from(circles).filter((circle) => {
    const r = parseFloat(circle.getAttribute("r"));
    return (
      r > 5 &&
      !circle.classList.contains("marker") &&
      !circle.classList.contains("ui-element")
    );
  });

  if (circlesArray.length === 0) {
    console.warn("No valid circles found for center calculation");
    return;
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  circlesArray.forEach((circle) => {
    const cx = parseFloat(circle.getAttribute("cx"));
    const cy = parseFloat(circle.getAttribute("cy"));
    const r = parseFloat(circle.getAttribute("r"));

    minX = Math.min(minX, cx - r);
    minY = Math.min(minY, cy - r);
    maxX = Math.max(maxX, cx + r);
    maxY = Math.max(maxY, cy + r);
  });

  center = {
    x: minX + (maxX - minX) / 2,
    y: minY + (maxY - minY) / 2,
  };

  console.log("Center of circles is at", center);

  const svg = document.querySelector("svg");
  const point = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  point.setAttribute("cx", center.x);
  point.setAttribute("cy", center.y);
  point.setAttribute("r", 1);
  point.setAttribute("fill", "white");
  svg.appendChild(point);

  const svgElement = document.querySelector("svg");
  const svgRect = svgElement.getBoundingClientRect();
  const svgPoint = svgElement.createSVGPoint();
  svgPoint.x = center.x;
  svgPoint.y = center.y;

  // Transform the point from SVG coordinate system to screen coordinates
  const screenPoint = svgPoint.matrixTransform(svgElement.getScreenCTM());

  // Store the document coordinates (including scroll position)
  documentCenter = {
    x: screenPoint.x + window.scrollX,
    y: screenPoint.y + window.scrollY,
  };

  console.log("Document center coordinates:", documentCenter);

  return center;
}

function addSkillSvg(offsetX = 0, offsetY = 0) {
  if (!center || !documentCenter) {
    console.warn("Center coordinates not available, using default position");
    return;
  }
  const div = document.createElement("div");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100");
  svg.setAttribute("height", "100");
  svg.style.position = "absolute";

  svg.style.left = `${documentCenter.x}px`;
  svg.style.top = `${documentCenter.y}px`;

  svg.style.transform = "translate(-50%, -50%)";

  if (offsetX !== 0 || offsetY !== 0) {
    svg.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  }

  svg.style.border = "1px solid black";
  svg.style.backgroundColor = "white";
  svg.style.zIndex = "1000";

  const title = document.createElement("title");
  title.textContent = "Skill Details";
  svg.appendChild(title);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", "50");
  text.setAttribute("y", "50");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("fill", "black");
  text.textContent = "Skills";
  svg.appendChild(text);

  // Append to document.body
  const target = document.querySelector("#graph");
  target.appendChild(svg);

  return svg;
}
function storeOriginalPositions() {
  originalPositions = {
    circles: [],
    texts: [],
    tspans: [],
    paths: [],
  };

  // Store circle positions and radii
  document.querySelectorAll("circle").forEach((circle) => {
    originalPositions.circles.push({
      element: circle,
      cx: parseFloat(circle.getAttribute("cx")),
      cy: parseFloat(circle.getAttribute("cy")),
      r: parseFloat(circle.getAttribute("r")),
      isSubjectIcon: circle.classList.contains("subjecticon"), // Store if it's a subject icon
    });
  });

  // Store text positions
  document.querySelectorAll("text").forEach((text) => {
    if (text.hasAttribute("x") && text.hasAttribute("y")) {
      originalPositions.texts.push({
        element: text,
        x: parseFloat(text.getAttribute("x")),
        y: parseFloat(text.getAttribute("y")),
      });
    }
  });

  // Store tspan positions
  document.querySelectorAll("tspan").forEach((tspan) => {
    if (tspan.hasAttribute("x") && tspan.hasAttribute("y")) {
      originalPositions.tspans.push({
        element: tspan,
        x: parseFloat(tspan.getAttribute("x")),
        y: parseFloat(tspan.getAttribute("y")),
      });
    }
  });

  // Store all paths that weren't deleted earlier
  document.querySelectorAll("path").forEach((path) => {
    originalPositions.paths.push({
      element: path,
      d: path.getAttribute("d"),
      isSubjectIcon: path.classList.contains("subjecticon"), // Store if it's a subject icon
    });
  });
}

function deleteCenteredSVG() {
  // find svg by id
  const svg = document.querySelector("#centered-graph");
  if (svg) {
    svg.remove();
  }
}
function createToggleButton() {
  const button = document.createElement("button");
  button.textContent = "Expand";
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.padding = "10spx 15px";
  button.style.backgroundColor = "#4CAF50";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "5px";
  button.style.cursor = "pointer";
  button.style.zIndex = "1000";
  button.setAttribute("id", "expander-button");

  // Add a hint to the button that it will animate
  button.style.transition = "background-color 0.3s ease";
  button.addEventListener(
    "mouseenter",
    () => (button.style.backgroundColor = "#45a049")
  );
  button.addEventListener(
    "mouseleave",
    () => (button.style.backgroundColor = "#4CAF50")
  );

  // two actions on click
  button.addEventListener("click", () => {
    console.log("Current zoom is before ", isExpanded);
    if (window.isZoom == false) {
      toggleExpansion();
    }
    console.log("Current zoom is after", isExpanded);

    // Only delete elements when expanding, restore when collapsing
    if (!isExpanded && window.isZoom == false) {
      console.log("window is zoom issss", window.isZoom);
      deleteUnecessaryElements();
      createResizableSkillSvgParticles();
    } else {
      restoreDeletedElements();
      // Remove the SVG with particles when collapsing
      const svg = document.querySelector("#centered-graph");
      if (svg) {
        svg.remove();
      }
    }
  });
  document.body.appendChild(button);
}

function toggleExpansion() {
  if (!center) return;

  const button = document.querySelector("#expander-button");
  // Cancel any existing animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  if (isExpanded) {
    // Restore to original positions
    animateTransformation(EXPANSION_FACTOR, 1.0, button);
  } else {
    // Expand outward
    animateTransformation(1.0, EXPANSION_FACTOR, button);
  }
}

function animateTransformation(startScale, endScale, button) {
  const startTime = performance.now();

  // Prepare elements for animation by adding GPU hints
  prepareElementsForAnimation();

  function animate(currentTime) {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / ANIMATION_DURATION, 1);
    const easeProgress = easeInOutQuad(progress); // Using a simpler easing function
    const currentScale = startScale + (endScale - startScale) * easeProgress;

    // Group similar operations to reduce reflows
    updateElements(currentScale);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      // Animation complete
      animationFrameId = null;
      console.log("changing from", isExpanded, "to", !isExpanded);
      isExpanded = !isExpanded;
      button.textContent = isExpanded ? "Restore" : "Expand";
    }
  }

  animationFrameId = requestAnimationFrame(animate);
}

function prepareElementsForAnimation() {
  // Add will-change hints to elements for better performance
  originalPositions.circles.forEach((item) => {
    item.element.style.willChange = "transform";
  });
  originalPositions.texts.forEach((item) => {
    item.element.style.willChange = "transform";
  });
}

function updateElements(currentScale) {
  // Use requestAnimationFrame's timing to batch updates
  // Update all circle elements first
  originalPositions.circles.forEach((item) => {
    const newRadius = item.r * currentScale;

    // Skip position transformation for subject icon circles
    if (item.isSubjectIcon) {
      // Only update the radius if needed
      return;
    }

    const newCx = center.x + (item.cx - center.x) * currentScale;
    const newCy = center.y + (item.cy - center.y) * currentScale;

    // Use transforms when possible instead of attribute changes
    const dx = newCx - item.cx;
    const dy = newCy - item.cy;
    item.element.setAttribute("transform", `translate(${dx}, ${dy})`);
    item.element.setAttribute("r", newRadius);
  });

  // Batch update text elements
  originalPositions.texts.forEach((item) => {
    const newX = center.x + (item.x - center.x) * currentScale;
    const newY = center.y + (item.y - center.y) * currentScale;
    item.element.setAttribute(
      "transform",
      `translate(${newX - item.x}, ${newY - item.y})`
    );
  });

  // Batch update tspan elements
  originalPositions.tspans.forEach((item) => {
    const newX = center.x + (item.x - center.x) * currentScale;
    const newY = center.y + (item.y - center.y) * currentScale;
    item.element.setAttribute(
      "transform",
      `translate(${newX - item.x}, ${newY - item.y})`
    );
  });

  // Update path elements using transform attribute
  originalPositions.paths.forEach((item) => {
    // Skip position transformation for subject icon paths
    if (item.isSubjectIcon) {
      return;
    }

    const translateX = center.x * (1 - currentScale);
    const translateY = center.y * (1 - currentScale);
    item.element.setAttribute(
      "transform",
      `translate(${translateX},${translateY}) scale(${currentScale})`
    );
  });
}

// Simpler easing function for smoother animation
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Original easing function - keeping for reference
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function printXmlStructure(node, indent = "") {
  console.log(indent + node.nodeName + (node.id ? ` id="${node.id}"` : ""));
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === 1) {
      // Element nodes only
      printXmlStructure(child, indent + "  ");
    }
  });
}

/**
 * Creates a resizable SVG that renders skill nodes (from window.serverData)
 * and animated relationship particles (with speed and color based on score).
 */
function createResizableSkillSvgParticles() {
  if (isExpanded) {
    //delete svg with specific id
    const svg = document.querySelector("#centered-graph");
    if (svg) {
      svg.remove();
    }
    return;
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const svgSize = "100%"; // Slightly larger for better spacing
  svg.setAttribute("width", svgSize);
  svg.setAttribute("height", svgSize);
  svg.setAttribute("viewBox", `-250 -250 500 500`); // Expanded viewBox from -200,-200,400,400
  svg.setAttribute("id", "centered-graph");
  svg.style.position = "absolute";

  // Position SVG at document center
  if (documentCenter) {
    svg.style.left = `${documentCenter.x}px`;
    svg.style.top = `${documentCenter.y}px`;
    svg.style.transform = "translate(-50%, -50%)";
  } else {
    // Fallback to center of window if documentCenter isn't available
    svg.style.left = "50%";
    svg.style.top = "50%";
    svg.style.transform = "translate(-50%, -50%)";
  }

  svg.style.zIndex = "1000";

  // Add debugging center point
  const centerPoint = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  centerPoint.setAttribute("cx", 0);
  centerPoint.setAttribute("cy", 0);
  centerPoint.setAttribute("r", 5);
  centerPoint.setAttribute("fill", "red");
  svg.appendChild(centerPoint);

  // Create tooltip element for displaying information
  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.padding = "8px 12px";
  tooltip.style.backgroundColor = "rgba(50,50,50,0.9)";
  tooltip.style.color = "white";
  tooltip.style.borderRadius = "4px";
  tooltip.style.fontSize = "12px";
  tooltip.style.zIndex = "1001";
  tooltip.style.pointerEvents = "none";
  tooltip.style.opacity = "0";
  tooltip.style.transition = "opacity 0.2s";
  tooltip.style.maxWidth = "250px";
  document.body.appendChild(tooltip);

  // Skill node styling parameters
  const NODE_RADIUS = 26;
  const NODE_COLOR = "rgba(62, 142, 78, 0.9)"; // Softer blue

  // Parse XML data and create skill nodes
  const parser = new DOMParser();

  // Handle XML parsing errors gracefully
  let xmlDoc;
  try {
    xmlDoc = parser.parseFromString(mylocalData, "application/xml");
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("XML parsing error");
    }
  } catch (e) {
    console.error("Error parsing XML, using fallback data", e);
    // Use fallback data if XML parsing fails
    const fallbackXml =
      "<skills>" +
      '<skill id="programming" name="Programming">' +
      '<relation id="databases" score="75"/>' +
      '<relation id="algorithms" score="90"/>' +
      "</skill>" +
      '<skill id="databases" name="Databases">' +
      '<relation id="programming" score="60"/>' +
      "</skill>" +
      '<skill id="algorithms" name="Algorithms">' +
      '<relation id="programming" score="85"/>' +
      "</skill>" +
      "</skills>";
    xmlDoc = parser.parseFromString(fallbackXml, "application/xml");
  }

  const skillElements = xmlDoc.getElementsByTagName("skill");
  console.log("Found skill elements:", skillElements.length);

  // Reset skills object before populating
  skills = {};
  const relations = new Set();
  const nodeAnimations = {}; // Track node animations for floating effect

  // Calculate optimal layout radius based on number of nodes
  const numSkills = skillElements.length;
  const LAYOUT_RADIUS = Math.min(200, 180 + numSkills * 5);

  // Create curved relationship paths
  function createCurvedPath(source, target, sourceId, targetId, score) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const relationId = `relation-${sourceId}-${targetId}`;
    path.setAttribute("id", relationId);
    path.setAttribute("stroke", getColorForScore(score));
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    path.setAttribute("opacity", "0.1");
    path.style.cursor = "pointer";
    path.dataset.sourceId = sourceId;
    path.dataset.targetId = targetId;
    path.dataset.score = score;

    // Calculate bezier control points
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const cpOffset = Math.min(dist * 0.3, 50);

    const cp1 = {
      x: source.x + Math.cos(angle + Math.PI / 2) * cpOffset,
      y: source.y + Math.sin(angle + Math.PI / 2) * cpOffset,
    };

    const cp2 = {
      x: target.x + Math.cos(angle - Math.PI / 2) * cpOffset,
      y: target.y + Math.sin(angle - Math.PI / 2) * cpOffset,
    };

    // Set the path's d attribute
    path.setAttribute(
      "d",
      `M ${source.x} ${source.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${target.x} ${target.y}`
    );

    // Add hover and click effects for path
    path.addEventListener("mouseenter", () => {
      path.setAttribute("opacity", "0.8");

      // Show tooltip with relationship information
      tooltip.innerHTML = `<strong>Relationship</strong><br>
        From: ${sourceId}<br>
        To: ${targetId}<br>
        Score: ${score}`;

      tooltip.style.opacity = "1";
    });

    path.addEventListener("mousemove", (e) => {
      tooltip.style.left = e.clientX + 10 + "px";
      tooltip.style.top = e.clientY + 10 + "px";
    });

    path.addEventListener("mouseleave", () => {
      path.setAttribute("stroke-width", "2");
      path.setAttribute("opacity", "0.5");
      tooltip.style.opacity = "0";
    });

    path.addEventListener("click", () => {
      console.log("Relationship clicked:", {
        path: path,
        sourceId: sourceId,
        targetId: targetId,
        score: score,
      });

      // Flash the path to indicate selection
      path.setAttribute("stroke-width", "8");
      setTimeout(() => path.setAttribute("stroke-width", "2"), 300);
    });

    return { path, cp1, cp2 };
  }

  // Create floating animation for a node
  function createNodeFloatingAnimation(nodeId, baseX, baseY) {
    const xPhase = Math.random() * Math.PI * 2; // Random starting phase
    const yPhase = Math.random() * Math.PI * 2; // Random starting phase

    const xAmplitude = 3 + Math.random() * 2; // Reduced from original
    const yAmplitude = 3 + Math.random() * 2;
    const xPeriod = 12000 + Math.random() * 4000; // Slower movement
    const yPeriod = 11000 + Math.random() * 4000;

    nodeAnimations[nodeId] = {
      baseX,
      baseY,
      xAmplitude,
      yAmplitude,
      xPeriod,
      yPeriod,
      xPhase,
      yPhase,
      currentX: baseX,
      currentY: baseY,
    };

    return nodeAnimations[nodeId];
  }

  // Update node positions for floating effect
  function updateNodePositions(timestamp) {
    // Skip every other frame for better performance
    if (timestamp % 2 === 0) {
      requestAnimationFrame(updateNodePositions);
      return;
    }

    // Use a single transform operation batch for all updates
    Object.keys(nodeAnimations).forEach((nodeId) => {
      const anim = nodeAnimations[nodeId];
      const nodeGroup = skills[nodeId].nodeGroup;

      // Calculate new x,y based on sine waves with different periods
      const xOffset =
        anim.xAmplitude *
        Math.sin((timestamp / anim.xPeriod) * 2 * Math.PI + anim.xPhase);
      const yOffset =
        anim.yAmplitude *
        Math.sin((timestamp / anim.yPeriod) * 2 * Math.PI + anim.yPhase);

      anim.currentX = anim.baseX + xOffset;
      anim.currentY = anim.baseY + yOffset;

      // Apply new position to node
      nodeGroup.setAttribute(
        "transform",
        `translate(${anim.currentX},${anim.currentY})`
      );

      // Update the skill position data for particles to follow
      skills[nodeId].x = anim.currentX;
      skills[nodeId].y = anim.currentY;
    });

    requestAnimationFrame(updateNodePositions);
  }

  // Create skill nodes with icons
  Array.from(skillElements).forEach((skillEl, i) => {
    const skillId = skillEl.getAttribute("id") || `skill-${i}`;
    const skillName = skillEl.getAttribute("name") || skillId;
    const angle = (2 * Math.PI * i) / numSkills;
    const baseX = Math.cos(angle) * LAYOUT_RADIUS;
    const baseY = Math.sin(angle) * LAYOUT_RADIUS;

    // Create skill node group
    const nodeGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    nodeGroup.setAttribute("transform", `translate(${baseX},${baseY})`);
    nodeGroup.setAttribute("id", `node-${skillId}`);
    nodeGroup.setAttribute("class", "skill-node");
    nodeGroup.dataset.skillId = skillId;
    nodeGroup.dataset.skillName = skillName;
    nodeGroup.style.cursor = "pointer";

    // Create circular background
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("r", NODE_RADIUS);
    circle.setAttribute("fill", NODE_COLOR);
    circle.setAttribute("stroke", "rgba(100,130,200,0.3)");
    circle.setAttribute("stroke-width", "1.5");

    // Add text label for skill name with better positioning and background
    const textGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );

    // Text background for better readability
    const textBg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    textBg.setAttribute("rx", "5");
    textBg.setAttribute("ry", "5");
    textBg.setAttribute("fill", "rgba(255,255,255,0.9)");
    textBg.setAttribute("stroke", "rgba(100,130,200,0.2)");
    textBg.setAttribute("stroke-width", "0.5");

    // Text element itself
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("font-size", "10px");
    text.setAttribute("font-weight", "500");
    text.setAttribute("fill", "#2c3e50");
    text.setAttribute("font-family", "system-ui, sans-serif");
    text.textContent = skillName;

    textGroup.appendChild(textBg);
    textGroup.appendChild(text);

    // Position text below the node
    textGroup.setAttribute("transform", `translate(0, ${NODE_RADIUS + 15})`);

    // Enhance hover effects
    nodeGroup.addEventListener("mouseenter", () => {
      circle.setAttribute("fill", "rgba(170,200,255,0.9)");
      circle.setAttribute("r", NODE_RADIUS * 1.05);
      circle.setAttribute("stroke-width", "2");

      // Show tooltip with node information
      tooltip.innerHTML = `<strong>Skill: ${skillName}</strong><br>ID: ${skillId}`;
      tooltip.style.opacity = "1";
    });

    nodeGroup.addEventListener("mousemove", (e) => {
      tooltip.style.left = e.clientX + 10 + "px";
      tooltip.style.top = e.clientY + 10 + "px";
    });

    nodeGroup.addEventListener("mouseleave", () => {
      circle.setAttribute("fill", NODE_COLOR);
      circle.setAttribute("r", NODE_RADIUS);
      circle.setAttribute("stroke-width", "1.5");
      tooltip.style.opacity = "0";
    });

    nodeGroup.addEventListener("click", () => {
      console.log("Node clicked:", {
        node: nodeGroup,
        skillId: skillId,
        skillName: skillName,
        position: { x: baseX, y: baseY },
      });

      // Visual feedback for click
      const pulseCircle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      pulseCircle.setAttribute("r", NODE_RADIUS);
      pulseCircle.setAttribute("fill", "none");
      pulseCircle.setAttribute("stroke", "rgba(100,180,255,0.8)");
      pulseCircle.setAttribute("stroke-width", "2");
      nodeGroup.appendChild(pulseCircle);

      // Animate the pulse
      let pulseSize = NODE_RADIUS;
      const pulseAnim = setInterval(() => {
        pulseSize += 2;
        pulseCircle.setAttribute("r", pulseSize);
        pulseCircle.setAttribute("opacity", 1 - (pulseSize - NODE_RADIUS) / 40);

        if (pulseSize > NODE_RADIUS + 30) {
          clearInterval(pulseAnim);
          nodeGroup.removeChild(pulseCircle);
        }
      }, 30);
    });

    nodeGroup.appendChild(circle);
    nodeGroup.appendChild(textGroup);
    svg.appendChild(nodeGroup);

    // Set up floating animation for this node
    const animation = createNodeFloatingAnimation(skillId, baseX, baseY);

    // Store node with initial position (will be updated during animation)
    skills[skillId] = {
      x: animation.currentX,
      y: animation.currentY,
      nodeGroup,
      relations: [],
    };
  });

  // Start the floating animation for all nodes
  requestAnimationFrame(updateNodePositions);

  // Create dynamic relationship paths that update with node movement
  const relationPaths = [];

  function updateRelationPaths() {
    let lastUpdate = 0;
    const now = performance.now();

    // Only update relation paths every 100ms (10 times per second)
    // This is fine for visual quality but much better for performance
    if (now - lastUpdate < 100) {
      requestAnimationFrame(updateRelationPaths);
      return;
    }

    lastUpdate = now;

    relationPaths.forEach((relationInfo) => {
      const { sourceId, targetId, pathElement, score } = relationInfo;
      const source = skills[sourceId];
      const target = skills[targetId];

      if (!source || !target) return;

      // Calculate updated bezier control points
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const cpOffset = Math.min(dist * 0.3, 50);

      const cp1 = {
        x: source.x + Math.cos(angle + Math.PI / 2) * cpOffset,
        y: source.y + Math.sin(angle + Math.PI / 2) * cpOffset,
      };

      const cp2 = {
        x: target.x + Math.cos(angle - Math.PI / 2) * cpOffset,
        y: target.y + Math.sin(angle - Math.PI / 2) * cpOffset,
      };

      // Update the path with new coordinates
      pathElement.setAttribute(
        "d",
        `M ${source.x} ${source.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${target.x} ${target.y}`
      );

      // Update the control points in the relation info for particles
      relationInfo.cp1 = cp1;
      relationInfo.cp2 = cp2;
    });

    requestAnimationFrame(updateRelationPaths);
  }

  // Start updating relation paths
  requestAnimationFrame(updateRelationPaths);

  // Create relationship particles with curved paths
  Array.from(skillElements).forEach((skillEl) => {
    const sourceId = skillEl.getAttribute("id");
    if (!sourceId || !skills[sourceId]) return;

    const source = skills[sourceId];
    const relationElements = skillEl.getElementsByTagName("relation");

    Array.from(relationElements).forEach((rel, idx) => {
      const targetId = rel.getAttribute("id");
      if (!targetId || !skills[targetId]) return;

      const score = parseFloat(rel.getAttribute("score")) || 50;
      const target = skills[targetId];

      // Avoid duplicate relations
      const relationKey = [sourceId, targetId].sort().join("-");
      if (relations.has(relationKey)) return;
      relations.add(relationKey);

      // Create path for relation with interactivity
      const pathData = createCurvedPath(
        source,
        target,
        sourceId,
        targetId,
        score
      );
      const path = pathData.path;

      // Adding path before other elements
      svg.insertBefore(path, svg.firstChild);

      // Store relation information for updating
      relationPaths.push({
        sourceId,
        targetId,
        pathElement: path,
        score,
        cp1: pathData.cp1,
        cp2: pathData.cp2,
      });

      // Create animated particle
      const particlesPerRelation = Math.max(5, Math.min(20, score / 10)); // Scale particles by score
      for (let i = 0; i < particlesPerRelation; i++) {
        // Create particles with different starting positions
        createParticle(
          svg,
          sourceId,
          targetId,
          score,
          i,
          relationPaths[relationPaths.length - 1]
        );
      }
    });
  });

  // Append the SVG to the DOM
  const target = document.querySelector("#graph");
  target.appendChild(svg);

  console.log(
    "SVG skill visualization created and positioned at",
    documentCenter || "window center"
  );
}

// Updated createParticle to be more performance-efficient
function createParticle(svg, sourceId, targetId, score, offset, relationInfo) {
  const particle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  const size = 1.5 + Math.random() * 1; // Smaller, varied sizes
  const baseOpacity = 0.7;

  // Monochromatic color scheme with score-based variation
  const blueShade = 200 - (score / 100) * 80;
  particle.setAttribute(
    "fill",
    `rgba(${blueShade},${blueShade + 40},255,${baseOpacity})`
  );

  particle.setAttribute("r", size);
  particle.style.opacity = "0"; // Start transparent

  // Add data attributes for identification
  particle.dataset.sourceId = sourceId;
  particle.dataset.targetId = targetId;
  particle.dataset.score = score;
  particle.dataset.particleType = "relationship";

  // Add hardware acceleration hint
  particle.style.willChange = "transform, opacity";

  svg.appendChild(particle);

  let progress = Math.random();
  let lastTime = 0;

  // Keep speed variation based on score - higher score = faster particles
  const speed = 0.002 + (score / 100) * 0.002; // Reduced base speed for better control

  // Use a throttled animation frame to reduce load (not every frame)
  // More particles for higher scores, but with frame skipping for performance
  const frameSkip = Math.max(1, Math.floor((100 - score) / 20)); // Skip more frames for lower scores
  let frameCount = offset % frameSkip;

  function animate(timestamp) {
    // Throttle updates based on frameSkip
    frameCount++;
    if (frameCount < frameSkip) {
      requestAnimationFrame(animate);
      return;
    }
    frameCount = 0;

    // Calculate delta time for smoother animation regardless of frame rate
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    const adjustedSpeed = speed * (deltaTime / 16.67); // Normalize to 60fps

    // Update progress with time-based increment
    progress += adjustedSpeed;
    const t = progress % 1;

    // Fade in/out effect
    const fadeIn = Math.min(t * 4, 1);
    const fadeOut = 1 - Math.max((t - 0.75) * 4, 0);
    const opacity = Math.min(fadeIn, fadeOut) * baseOpacity;

    // Batch property updates to reduce reflows
    if (opacity !== parseFloat(particle.style.opacity)) {
      particle.style.opacity = opacity;
    }

    // Check if skills and the specific skill IDs exist before accessing
    if (!skills[sourceId] || !skills[targetId]) {
      // Skip this animation frame if skills aren't available yet
      requestAnimationFrame(animate);
      return;
    }

    // Get the current source and target positions
    const source = skills[sourceId];
    const target = skills[targetId];
    const cp1 = relationInfo.cp1;
    const cp2 = relationInfo.cp2;

    // Calculate position using cubic bezier curve with current control points
    const x =
      (1 - t) ** 3 * source.x +
      3 * (1 - t) ** 2 * t * cp1.x +
      3 * (1 - t) * t ** 2 * cp2.x +
      t ** 3 * target.x;

    const y =
      (1 - t) ** 3 * source.y +
      3 * (1 - t) ** 2 * t * cp1.y +
      3 * (1 - t) * t ** 2 * cp2.y +
      t ** 3 * target.y;

    // Use transform instead of attributes for better performance
    particle.setAttribute("transform", `translate(${x}, ${y})`);

    // Only update radius occasionally for better performance
    if (Math.random() < 0.1) {
      const newRadius =
        size * (0.9 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.2);
      particle.setAttribute("r", newRadius);
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

/**
 * Returns a color (in HSL format) based on the score.
 * Lower scores result in bluer hues while higher scores shift toward red.
 * Uses a cached color map for better performance.
 */
const colorCache = {};
function getColorForScore(score) {
  // Round score to nearest 5 for caching purposes
  const roundedScore = Math.round(score / 5) * 5;

  if (colorCache[roundedScore]) {
    return colorCache[roundedScore];
  }

  const maxScore = 100;
  const clampedScore = Math.min(roundedScore, maxScore);
  // Map score to a hue value from 240 (blue) to 0 (red)
  const hue = 240 - (clampedScore / maxScore) * 240;
  const color = `hsla(${hue}, 100%, 50%, 0.7)`;

  // Cache the result
  colorCache[roundedScore] = color;
  return color;
}

window.storeOriginalPositions = storeOriginalPositions;
