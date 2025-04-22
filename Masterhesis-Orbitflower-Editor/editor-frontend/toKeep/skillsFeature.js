let originalSvg = null;
let originalViewBox = null;
let serverData = null;
window.skillId = null;
window.currentEntityId = null;
window.currentEntityType = null;
let originalSubjectsHTML = null;
var orgmodel;

if (!window.getSkillIdColor) {
  window.getSkillIdColor = function (skillId) {
    const colorPalette = [
      "#60A5FA", // Soft blue
      "#34D399", // Mint green
      "#A78BFA", // Lavender
      "#F87171", // Soft coral
      "#FBBF24", // Golden yellow
      "#6EE7B7", // Seafoam
      "#93c5fd", // Blue 300
      "#3b82f6", // Blue 500
      "#2563eb", // Blue 600
      "#c4b5fd", // Violet 300
      "#8b5cf6", // Violet 500
      "#7c3aed", // Violet 600,
    ];

    // Simple hash function to convert skillId string to a number
    let hash = 0;
    for (let i = 0; i < skillId.length; i++) {
      hash = (hash << 5) - hash + skillId.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    // Use absolute value and modulo to get an index in the palette range
    const index = Math.abs(hash) % colorPalette.length;
    return colorPalette[index];
  };
}

// Save original svg - simpler function
function saveOriginalSvg() {
  const svg = document.querySelector("#graph svg");
  if (svg) {
    originalSvg = svg.cloneNode(true);
    originalViewBox = svg.getAttribute("viewBox");
  }
}

// Draw an arc (ring segment) with gradient support
function describeArc(cx, cy, outerR, innerR, startAngle, endAngle) {
  // Validate inputs to prevent NaN values
  if (
    isNaN(cx) ||
    isNaN(cy) ||
    isNaN(outerR) ||
    isNaN(innerR) ||
    isNaN(startAngle) ||
    isNaN(endAngle)
  ) {
    console.error("Invalid parameters to describeArc:", {
      cx,
      cy,
      outerR,
      innerR,
      startAngle,
      endAngle,
    });
    return ""; // Return empty path if invalid parameters
  }

  // Ensure minimum radius values
  outerR = Math.max(outerR, 0.1);
  innerR = Math.max(innerR, 0.1);

  // Ensure angles are valid
  if (Math.abs(endAngle - startAngle) < 0.1) {
    // If angle is too small, return empty path
    return "";
  }

  const rad = Math.PI / 180;
  const calcPoint = (r, angle) => ({
    x: cx + r * Math.cos(angle * rad),
    y: cy + r * Math.sin(angle * rad),
  });

  // Check if we need to draw a full circle (or more)
  if (Math.abs(endAngle - startAngle) >= 360) {
    const midAngle = startAngle + 180;
    const startOuter = calcPoint(outerR, startAngle);
    const midOuter = calcPoint(outerR, midAngle);
    const startInner = calcPoint(innerR, startAngle);
    const midInner = calcPoint(innerR, midAngle);

    return `
      M ${startOuter.x} ${startOuter.y}
      A ${outerR} ${outerR} 0 1 1 ${midOuter.x} ${midOuter.y}
      A ${outerR} ${outerR} 0 1 1 ${startOuter.x} ${startOuter.y}
      L ${startInner.x} ${startInner.y}
      A ${innerR} ${innerR} 0 1 0 ${midInner.x} ${midInner.y}
      A ${innerR} ${innerR} 0 1 0 ${startInner.x} ${startInner.y}
      Z
    `;
  } else {
    const startOuter = calcPoint(outerR, startAngle);
    const endOuter = calcPoint(outerR, endAngle);
    const startInner = calcPoint(innerR, endAngle);
    const endInner = calcPoint(innerR, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} L ${startInner.x} ${startInner.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y} Z`;
  }
}

// Helper: Convert polar to cartesian coordinates for label positioning
function polarToCartesian(cx, cy, r, angle) {
  const rad = Math.PI / 180;
  return {
    x: cx + r * Math.cos(angle * rad),
    y: cy + r * Math.sin(angle * rad),
  };
}

// Create a function to shade or lighten a color
function shadeColor(color, percent) {
  let num = parseInt(color.slice(1), 16),
    amt = Math.round(2.55 * percent);
  let R = Math.min(255, Math.max(0, (num >> 16) + amt));
  let G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  let B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));

  if (percent < 0) {
    const minBrightness = 160;
    R = Math.max(R, minBrightness);
    G = Math.max(G, minBrightness);
    B = Math.max(B, minBrightness);
  }

  return "#" + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

// Generate a professional, attractive color palette with lighter tones
function generateColorPalette(baseColors = null, count = 12) {
  // Updated default colors - more professional, lighter palette
  if (!baseColors) {
    baseColors = [
      "#60A5FA", // Soft blue
      "#34D399", // Mint green
      "#A78BFA", // Lavender
      "#F87171", // Soft coral
      "#FBBF24", // Golden yellow
      "#6EE7B7", // Seafoam
    ];
  }

  const palette = [];
  const step = 360 / count;

  // Distribute the colors evenly
  baseColors.forEach((baseColor, colorIndex) => {
    // Convert hex to HSL for easier manipulation
    const r = parseInt(baseColor.slice(1, 3), 16) / 255;
    const g = parseInt(baseColor.slice(3, 5), 16) / 255;
    const b = parseInt(baseColor.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }

    // Create variations with better constraints
    const colorsPerBase = Math.ceil(count / baseColors.length);

    for (let i = 0; i < colorsPerBase; i++) {
      // Modify hue slightly for each variation
      const newH = (h + i * 15) % 360;

      // Keep saturation moderate for professional look
      const newS = Math.min(0.65, s);

      // Keep lightness high for light attractive colors
      const newL = Math.min(Math.max(0.65, l), 0.85);

      // Convert back to RGB
      let r1, g1, b1;

      if (s === 0) {
        r1 = g1 = b1 = newL; // achromatic
      } else {
        const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
        const p = 2 * newL - q;
        r1 = hueToRgb(p, q, newH / 360 + 1 / 3);
        g1 = hueToRgb(p, q, newH / 360);
        b1 = hueToRgb(p, q, newH / 360 - 1 / 3);
      }

      const toHex = (c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, "0");
      palette.push(`#${toHex(r1)}${toHex(g1)}${toHex(b1)}`);
    }
  });

  // Trim to the exact count requested
  return palette.slice(0, count);
}

// Helper function for HSL to RGB conversion
function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function addStyleSheet() {
  const style = document.createElement("style");
  style.textContent = `
    .skill-segment, .sub-skill-segment {
      transition: all 0.3s ease;
      cursor: pointer;
      filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.05));
    }
    .skill-segment:hover, .sub-skill-segment:hover {
      filter: brightness(1.05) drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.1));
    }
    .skill-tooltip-container {
      pointer-events: none;
      filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1));
    }
      .skill-segment.active-skill-filter {
  stroke: #a40000;
  stroke-width: 1px;
}

#usercolumn .subject.highlight {
  background-color: #ffeb3b;
}
    
    .tooltip-bg {
      fill: rgba(255, 255, 255, 0.95);
      stroke: rgba(0, 0, 0, 0.05);
      stroke-width: 1;
    }
    
    .tooltip-title {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10px;
      font-weight: 500;
      fill: #444;
    }
    
    .tooltip-value {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 8px;
      fill: #666;
    }
    
    /* Add new classes for zoomed state */
    .tooltip-zoomed.tooltip-title {
      font-size: 8px;
    }
    
    .tooltip-zoomed.tooltip-value {
      font-size: 6px;
    }
    .skill-indicator {
      fill: #fff;
      opacity: 0.5;
    }
    .skill-level[data-expanded="true"] .skill-indicator {
      fill: #fff;
      opacity: 0.9;
    }
    .back-button-group {
      transition: all 0.3s;
    }
    .back-button-group:hover rect {
      fill: #f0f0f0;
    }
    #usercolumn .subject.highlight {
      background-color: #ffeb3b;
    }
  `;
  document.head.appendChild(style);
}

// Track zoom state and save original SVG content
let isZoomed = false;
window.isZoom = false;
let originalSvgContent = null;
let zoomedNodeId = null;

// Simplified reset function to reload the entire page
function resetZoom() {
  // Simply reload the page to restore the initial HTML state
  isZoomed = false;
  window.isZoom = false;
  window.detailedView = false;

  window.location.reload();
}

// Create a simpler, smaller back button
// Create a back button as HTML element outside the SVG
function createBackButton(svg) {
  // Remove any existing back button
  const existingButton = document.getElementById("skills-back-button");
  if (existingButton) {
    existingButton.remove();
  }

  // Get the graph column position for proper placement
  const graphColumn = document.getElementById("graph");

  // Create HTML button
  const backButton = document.createElement("button");
  backButton.id = "skills-back-button";
  backButton.textContent = "Back";
  backButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 8px;
    background-color: #ffffff;
    border: 1px solid #cccccc;
    border-radius: 3px;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    color: #333333;
    cursor: pointer;
    z-index: 100;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  `;

  // Add click handler
  backButton.addEventListener("click", resetZoom);

  // Append to graph column parent container for proper positioning
  graphColumn.style.position = "relative"; // Ensure relative positioning for absolute child
  graphColumn.appendChild(backButton);
  return backButton;
}
// Create tooltip container with all necessary elements
function createTooltip(svg) {
  let tooltip = svg.querySelector(".skill-tooltip-container");

  if (!tooltip) {
    // change dimensions depending if zoomedIn or not

    tooltip = document.createElementNS("http://www.w3.org/2000/svg", "g");
    tooltip.classList.add("skill-tooltip-container");
    tooltip.style.pointerEvents = "none";
    tooltip.style.visibility = "hidden";

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.classList.add("tooltip-bg");
    bg.setAttribute("width", 120);
    bg.setAttribute("height", 45);

    const title = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    title.classList.add("tooltip-title");
    title.setAttribute("x", 8);
    title.setAttribute("y", 15);

    const value = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    value.classList.add("tooltip-value");
    value.setAttribute("x", 8);
    value.setAttribute("y", 28);

    const percent = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    percent.classList.add("tooltip-value");
    percent.setAttribute("x", 10);
    percent.setAttribute("y", 39);

    tooltip.appendChild(bg);
    tooltip.appendChild(title);
    tooltip.appendChild(value);
    tooltip.appendChild(percent);

    svg.appendChild(tooltip);
  }

  return tooltip;
}

// Position and update tooltip content
function updateTooltip(tooltip, skill, value, percent, x, y) {
  tooltip.style.visibility = "visible";

  // Update content
  const title = tooltip.querySelector(".tooltip-title");
  title.textContent = skill;

  const valueText = tooltip.querySelector(".tooltip-value");
  valueText.textContent = `Value: ${value}`;

  const percentText = tooltip.querySelectorAll(".tooltip-value")[1];
  percentText.textContent = `${percent}% of total`;

  // Make the tooltip temporarily visible but not displayed to measure text
  tooltip.style.visibility = "hidden";
  tooltip.style.display = "block";

  // Calculate the text width based on the content
  const bg = tooltip.querySelector(".tooltip-bg");
  const titleLength =
    title.getComputedTextLength() || title.textContent.length * 7;
  const valueLength =
    valueText.getComputedTextLength() || valueText.textContent.length * 6;
  const percentLength =
    percentText.getComputedTextLength() || percentText.textContent.length * 6;

  // Determine the maximum width needed
  const maxTextWidth = Math.max(titleLength, valueLength, percentLength);

  // Add some padding
  const paddingX = 16;
  const paddingY = 8;

  // Set the background rectangle dimensions to fit the text
  const newWidth = Math.max(maxTextWidth + paddingX, 120); // Minimum width of 120
  const newHeight = 45 + (newWidth > 120 ? 5 : 0); // Increase height slightly for wider tooltips

  bg.setAttribute("width", newWidth);
  bg.setAttribute("height", newHeight);

  // Position tooltip
  tooltip.setAttribute("transform", `translate(${x},${y})`);
  tooltip.style.visibility = "visible";
}

// Also update the setTooltipZoomState function to handle dynamic sizing
function setTooltipZoomState(svg, isZoomed) {
  const tooltip = svg.querySelector(".skill-tooltip-container");
  if (!tooltip) return;

  // Get tooltip elements
  const title = tooltip.querySelector(".tooltip-title");
  const valueTexts = tooltip.querySelectorAll(".tooltip-value");

  if (isZoomed) {
    // Apply much smaller dimensions for zoomed state
    // Don't set fixed dimensions on bg here - will be calculated in updateTooltip

    // Add zoomed class to text elements
    title.classList.add("tooltip-zoomed");
    title.setAttribute("x", 4); // Reduced padding
    title.setAttribute("y", 9); // Adjusted position

    valueTexts[0].classList.add("tooltip-zoomed");
    valueTexts[0].setAttribute("x", 4);
    valueTexts[0].setAttribute("y", 17); // Adjusted position

    valueTexts[1].classList.add("tooltip-zoomed");
    valueTexts[1].setAttribute("x", 4);
    valueTexts[1].setAttribute("y", 24); // Adjusted position
  } else {
    // Don't set fixed dimensions on bg here - will be calculated in updateTooltip

    // Remove zoomed class from text elements
    title.classList.remove("tooltip-zoomed");
    title.setAttribute("x", 8);
    title.setAttribute("y", 15);

    valueTexts[0].classList.remove("tooltip-zoomed");
    valueTexts[0].setAttribute("x", 8);
    valueTexts[0].setAttribute("y", 28);

    valueTexts[1].classList.remove("tooltip-zoomed");
    valueTexts[1].setAttribute("x", 10);
    valueTexts[1].setAttribute("y", 39);
  }
}

// Hide tooltip
function hideTooltip(tooltip) {
  tooltip.style.visibility = "hidden";
}

// Auto-collapse timeout management
const collapseTimeouts = new Map();

// Clear any existing timeout for a specific skill group
function clearCollapseTimeout(groupId, skillName) {
  const key = `${groupId}-${skillName}`;
  if (collapseTimeouts.has(key)) {
    clearTimeout(collapseTimeouts.get(key));
    collapseTimeouts.delete(key);
  }
}
// Add this function to toggle tooltip zoom state
function setTooltipZoomState(svg, isZoomed) {
  const tooltip = svg.querySelector(".skill-tooltip-container");
  if (!tooltip) return;

  // Get tooltip elements
  const bg = tooltip.querySelector(".tooltip-bg");
  const title = tooltip.querySelector(".tooltip-title");
  const valueTexts = tooltip.querySelectorAll(".tooltip-value");

  if (isZoomed) {
    // Apply much smaller dimensions for zoomed state
    bg.setAttribute("width", 65); // Even smaller width
    bg.setAttribute("height", 28); // Even smaller height
    bg.setAttribute("rx", 2);
    bg.setAttribute("ry", 2);

    // Add zoomed class to text elements
    title.classList.add("tooltip-zoomed");
    title.setAttribute("x", 4); // Reduced padding
    title.setAttribute("y", 9); // Adjusted position

    valueTexts[0].classList.add("tooltip-zoomed");
    valueTexts[0].setAttribute("x", 4);
    valueTexts[0].setAttribute("y", 17); // Adjusted position

    valueTexts[1].classList.add("tooltip-zoomed");
    valueTexts[1].setAttribute("x", 4);
    valueTexts[1].setAttribute("y", 24); // Adjusted position
  } else {
    // Reset to normal dimensions
    bg.setAttribute("width", 120);
    bg.setAttribute("height", 45);
    bg.setAttribute("rx", 3);
    bg.setAttribute("ry", 3);

    // Remove zoomed class from text elements
    title.classList.remove("tooltip-zoomed");
    title.setAttribute("x", 8);
    title.setAttribute("y", 15);

    valueTexts[0].classList.remove("tooltip-zoomed");
    valueTexts[0].setAttribute("x", 8);
    valueTexts[0].setAttribute("y", 28);

    valueTexts[1].classList.remove("tooltip-zoomed");
    valueTexts[1].setAttribute("x", 10);
    valueTexts[1].setAttribute("y", 39);
  }
}
// Set a timeout to auto-collapse expanded skills
function setCollapseTimeout(
  group,
  skillName,
  levelGroup,
  parentNode,
  delay = 5000
) {
  const key = `${group.id}-${skillName}`;
  clearCollapseTimeout(group.id, skillName);

  const timeoutId = setTimeout(() => {
    if (levelGroup && document.contains(levelGroup)) {
      levelGroup.remove();
      if (parentNode) {
        parentNode.removeAttribute("data-expanded");
      }
    }
    collapseTimeouts.delete(key);
  }, delay);

  collapseTimeouts.set(key, timeoutId);
}

let svgStateHistory = [];

function collectHierarchyGroups(clickedGroup) {
  const hierarchy = [clickedGroup];
  let currentGroup = clickedGroup;
  let currentLevel = parseInt(currentGroup.dataset.level);
  let currentParentSkill = currentGroup.dataset.parent;

  while (currentLevel > 0) {
    const prevLevel = currentLevel - 1;
    const prevGroups = currentGroup.parentNode.querySelectorAll(
      `.skill-level[data-level="${prevLevel}"]`
    );

    let foundGroup = null;
    prevGroups.forEach((group) => {
      const skills = Array.from(group.querySelectorAll(".skill-segment")).map(
        (p) => p.dataset.skill
      );
      if (skills.includes(currentParentSkill)) {
        foundGroup = group;
      }
    });

    if (foundGroup) {
      hierarchy.unshift(foundGroup);
      currentGroup = foundGroup;
      currentLevel = prevLevel;
      currentParentSkill = currentGroup.dataset.parent;
    } else break;
  }

  return hierarchy;
}

function animateZoom(svg, targetGroup, clickedElement) {
  const bbox = targetGroup.getBBox();
  const clickedBBox = clickedElement.getBBox();
  const centerX = clickedBBox.x + clickedBBox.width / 2;
  const centerY = clickedBBox.y + clickedBBox.height / 2;

  const initialViewBox = svg.viewBox.baseVal;
  const scaleFactor = 3;
  const targetWidth = Math.max(svg.clientWidth / scaleFactor, 10); // Ensure minimum width
  const targetHeight = Math.max(svg.clientHeight / scaleFactor, 10); // Ensure minimum height
  const targetX = centerX - targetWidth / 2;
  const targetY = centerY - targetHeight / 2;

  const duration = 500;
  const startTime = performance.now();

  function update(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const x = initialViewBox.x + (targetX - initialViewBox.x) * progress;
    const y = initialViewBox.y + (targetY - initialViewBox.y) * progress;
    const width = Math.max(
      initialViewBox.width + (targetWidth - initialViewBox.width) * progress,
      10 // Ensure width is never less than 10
    );
    const height = Math.max(
      initialViewBox.height + (targetHeight - initialViewBox.height) * progress,
      10 // Ensure height is never less than 10
    );

    // Only set valid viewBox values
    if (width > 0 && height > 0) {
      svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    }

    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function renderSkillSegments(group, skillsData, options = {}) {
  if (!skillsData || skillsData.length === 0) return null;

  const svg = group.ownerSVGElement;
  const tooltip = createTooltip(svg);
  const circle = group.querySelector("circle");

  if (!circle) return null;

  const cx = parseFloat(circle.getAttribute("cx"));
  const cy = parseFloat(circle.getAttribute("cy"));
  const r = parseFloat(circle.getAttribute("r"));

  if (isNaN(cx) || isNaN(cy) || isNaN(r)) {
    console.error("Invalid node dimensions:", { cx, cy, r });
    return null;
  }

  const defaults = {
    level: 0,
    innerRadius: r + 2 + (options.level || 0) * 7,
    ringWidth: 5,
    startAngle: 0,
    endAngle: 360,
    parent: null,
    autoCollapseDelay: 5000, // Auto-collapse after 5 seconds by default
  };

  const config = { ...defaults, ...options };
  const innerR = config.innerRadius;
  const outerR = innerR + config.ringWidth;

  // Create group for this level
  const levelGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  levelGroup.classList.add("skill-level");
  levelGroup.setAttribute("data-level", config.level);

  if (config.parent) {
    levelGroup.setAttribute("data-parent", config.parent);
  }

  const validSkills = skillsData.filter((skill) => skill.value > 0);
  if (validSkills.length === 0) return null;

  const total = validSkills.reduce((sum, skill) => sum + skill.value, 0);
  if (total <= 0) return null;

  let currAngle = config.startAngle;
  validSkills.forEach((skill) => {
    const angleSpan =
      (skill.value / total) * (config.endAngle - config.startAngle);

    if (angleSpan < 0.1) return;

    const startA = currAngle;
    const endA = currAngle + angleSpan;
    currAngle = endA;

    const gradId = `grad-${group.id}-level${config.level}-${skill.skill.replace(
      /\s+/g,
      ""
    )}`;
    const grad = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "linearGradient"
    );
    grad.id = gradId;
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "100%");
    grad.setAttribute("y2", "100%");

    const stop1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "stop"
    );
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", skill.color);

    const stop2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "stop"
    );
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", shadeColor(skill.color, -10)); // Less darkening

    grad.appendChild(stop1);
    grad.appendChild(stop2);

    // Add gradient to defs
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    defs.appendChild(grad);

    // Create skill segment
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const pathData = describeArc(cx, cy, outerR, innerR, startA, endA);

    // Only set path data if it's valid
    if (pathData) {
      path.setAttribute("d", pathData);
      path.setAttribute("fill", `url(#${gradId})`);
      path.setAttribute("class", "skill-segment");
      path.setAttribute("data-skill", skill.skill);
      path.setAttribute("data-skill-id", skill.skill);
      path.setAttribute("data-value", skill.value);

      if (skill.subSkills && skill.subSkills.length > 0) {
        const midAngle = (startA + endA) / 2;
        const indicatorR = outerR - 2;
        const indicatorPos = polarToCartesian(cx, cy, indicatorR, midAngle);

        const indicator = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        indicator.setAttribute("cx", indicatorPos.x);
        indicator.setAttribute("cy", indicatorPos.y);
        indicator.setAttribute("r", 1.5);
        indicator.classList.add("skill-indicator");
        levelGroup.appendChild(indicator);
      }

      path.addEventListener("mouseenter", function (e) {
        const midAngle = (startA + endA) / 2;
        const tooltipPos = polarToCartesian(cx, cy, outerR + 15, midAngle);
        updateTooltip(
          tooltip,
          skill.skill,
          skill.value,
          Math.round((skill.value / total) * 100),
          tooltipPos.x,
          tooltipPos.y
        );

        // Reset auto-collapse timeout when hovering over parent of expanded children
        if (path.parentNode.hasAttribute("data-expanded")) {
          const childGroup = group.querySelector(
            `.skill-level[data-parent="${skill.skill}"]`
          );
          if (childGroup) {
            clearCollapseTimeout(group.id, skill.skill);
          }
        }
      });

      path.addEventListener("mouseleave", function (e) {
        hideTooltip(tooltip);

        if (path.parentNode.hasAttribute("data-expanded")) {
          const childGroup = group.querySelector(
            `.skill-level[data-parent="${skill.skill}"]`
          );
          if (childGroup) {
            setCollapseTimeout(
              group,
              skill.skill,
              childGroup,
              path.parentNode,
              config.autoCollapseDelay
            );
          }
        }
      });

      path.addEventListener("click", function (e) {
        if (!window.expressionBuilderPaused) {
          return;
        }
        const svg = this.ownerSVGElement;
        svg.setAttribute("height", "250");
        svgStateHistory.push(svg.innerHTML);
        const mainGroup = this.closest('g[id^="u"], g[id^="r"]');
        const currentUserColumn = document.getElementById("users");
        const clonedUserColumn = originalSubjectsHTML.cloneNode(true);
        currentUserColumn.parentNode.replaceChild(
          clonedUserColumn,
          currentUserColumn
        );

        // In the click event handler for the skill segment
        const skillId = this.getAttribute("data-skill-id");
        window.skillId = skillId;

        // Filter subjects after resetting
        const matchingSubjects = getSubjectsBySkillId(skillId);
        clonedUserColumn.querySelectorAll(".subject").forEach((subject) => {
          const subjectUid = subject.getAttribute("data-uid");
          if (!matchingSubjects.some((s) => s.uid === subjectUid)) {
            subject.remove();
          }
        });

        // Highlight remaining subjects
        matchingSubjects.forEach((subject) => {
          const subjectElement = clonedUserColumn.querySelector(
            `.subject[id="${subject.id}"]`
          );
          if (subjectElement) {
            subjectElement.classList.add("highlight");
          }
        });

        // Highlight matching subjects
        matchingSubjects.forEach((subject) => {
          const subjectElement = document.querySelector(
            `#usercolumn .subject[id="${subject.id}"]`
          );
          if (subjectElement) {
            subjectElement.classList.add("highlight");
          }
        });

        if (isZoomed == false) {
          console.log("Deleting unecessary elements for the first time");

          // uppdate .unit css to have a stroke width of 0.5
          document.querySelectorAll(".unit").forEach((unit) => {
            unit.style.strokeWidth = 0.5;
          });
          document.querySelectorAll(".role").forEach((role) => {
            role.style.strokeWidth = 0.5;
          });

          const allNodes = svg.querySelectorAll('g[id^="u"], g[id^="r"]');
          const nodeId = mainGroup.id;

          const node = document.getElementById(nodeId);
          node.removeAttribute("onmouseover");
          node.removeAttribute("onmouseout");
          node.removeAttribute("onclick");

          const relatedText = svg.querySelector(`text[id="${nodeId}_text"]`);
          window.currentEntityId = relatedText.textContent;
          window.currentEntityType = mainGroup.getAttribute("class");

          if (relatedText) {
            textToKeep = relatedText.cloneNode(true);
          }

          allNodes.forEach((node) => {
            if (node !== mainGroup && !node.closest("#usercolumn")) {
              node.remove();
            }
          });

          // change textTokeep position in html and place it under <td id="graphcolumn">
          const graphColumn = document.getElementById("graph");
          const existingTitles = graphColumn.querySelectorAll("h3.node-title");
          existingTitles.forEach((title) => title.remove());

          if (textToKeep && textToKeep.textContent) {
            // get texttokeep text
            const textToKeepText = textToKeep.textContent;
            // create an h3 and append it to graphcolumn
            const h3 = document.createElement("h3");
            h3.textContent = textToKeepText;
            h3.classList.add("node-title"); // Add a class for easier selection
            graphColumn.insertBefore(h3, graphColumn.firstChild);
          }

          isZoomed = true;
          window.isZoom = true;

          // Immediately render the skill tree instead of waiting for another click
          if (window.renderSkillTree) {
            window.renderSkillTree();
          }
        }
        document
          .querySelectorAll(".skill-segment.active-skill-filter")
          .forEach((el) => {
            el.classList.remove("active-skill-filter");
          });
        this.classList.add("active-skill-filter");

        // Filter skill levels
        const clickedGroup = this.closest(".skill-level");
        const hierarchyGroups = collectHierarchyGroups(clickedGroup);
        mainGroup.querySelectorAll(".skill-level").forEach((g) => {
          if (!hierarchyGroups.includes(g)) g.remove();
        });

        // Animate zoom
        animateZoom(svg, mainGroup, this);
        createBackButton(svg);
        setTooltipZoomState(svg, true);

        // Original subskill expansion behavior
        // Proceed with sub-skill expansion if available
        if (skill.subSkills && skill.subSkills.length > 0) {
          const existingSubGroup = group.querySelector(
            `.skill-level[data-level="${config.level + 1}"][data-parent="${
              skill.skill
            }"]`
          );

          if (existingSubGroup) {
            existingSubGroup.remove();
            path.parentNode.removeAttribute("data-expanded");
            clearCollapseTimeout(group.id, skill.skill);
          } else {
            path.parentNode.setAttribute("data-expanded", "true");
            const childGroup = renderSkillSegments(group, skill.subSkills, {
              level: config.level + 1,
              startAngle: startA,
              endAngle: endA,
              parent: skill.skill,
              autoCollapseDelay: config.autoCollapseDelay,
            });
            setCollapseTimeout(
              group,
              skill.skill,
              childGroup,
              path.parentNode,
              config.autoCollapseDelay
            );
          }
        }
        if (window.updateAfterClick) {
          window.updateAfterClick();
        }
      });

      levelGroup.appendChild(path);
    }
  });

  // Only append the level group if it has children
  if (levelGroup.childNodes.length > 0) {
    group.appendChild(levelGroup);
    return levelGroup;
  }

  return null;
}

function renderSubjectsInColumn(subjects) {
  const column = originalSubjectsHTML
  if (!column) return;

  // keep only subjects in the column
  const existingSubjects = column.querySelectorAll(".subject");
  existingSubjects.forEach((subject) => {
    // keep only exisiting subjects with uid from subjects uid
    const subjectId = subject.getAttribute("id");
    const matchingSubject = subjects.find((s) => s.id === subjectId);
    if (!matchingSubject) {
      subject.remove();
    }
  });

  return column;
}
// construct skill data for specific node
function getSkillData(nodeId) {
  const node = serverData.querySelector(`#${nodeId}`);
  if (!node) return null;
}

function addSkillDistributionRings() {
  const container = document.getElementById("graph");
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) return;

  const nodes = svg.querySelectorAll('g[id^="u"], g[id^="r"]');
  nodes.forEach((group) => {
    const skillsData = getRealSkillDistribution(group.id);
    if (skillsData && skillsData.length > 0) {
      renderSkillSegments(group, skillsData);
    }
  });
}

function getSubjectsByTargetId(targetName) {
  const subjects = serverData.querySelectorAll("subject");
  const relatedSubjects = [];
  subjects.forEach((subject) => {
    const relations = subject.querySelectorAll("relation");
    for (const rel of relations) {
      if (
        rel.getAttribute("unit") === targetName ||
        rel.getAttribute("role") === targetName
      ) {
        relatedSubjects.push(subject);
        break;
      }
    }
  });
  return relatedSubjects;
}

// Instead of returning counts, aggregateSkills now returns a mapping from skill id to a Set of subject IDs.
function aggregateSkills(subjects) {
  const skillSubjects = {};
  subjects.forEach((subject) => {
    // Use the subject's id as its unique identifier.
    const subjectId = subject.getAttribute("id");
    const skillRefs = subject.querySelectorAll("subjectSkills skillRef");
    skillRefs.forEach((ref) => {
      const skillId = ref.getAttribute("id");
      if (!skillSubjects[skillId]) {
        skillSubjects[skillId] = new Set();
      }
      skillSubjects[skillId].add(subjectId);
    });
  });
  return skillSubjects;
}

function buildSkillTree(skillSubjects, serverData) {
  const skillsMap = new Map();

  // Initialize the map with each skill that appears in a subject.
  Object.entries(skillSubjects).forEach(([id, subjSet]) => {
    skillsMap.set(id, {
      id,
      subjects: new Set(subjSet),
      children: [],
      parent: null,
    });
  });

  // Process parent–child relationships from the XML.
  const skillElements = serverData.querySelectorAll("skill");
  skillElements.forEach((skillEl) => {
    const skillId = skillEl.getAttribute("id");
    if (!skillsMap.has(skillId)) {
      // Create an entry if the skill wasn't referenced directly by any subject.
      skillsMap.set(skillId, {
        id: skillId,
        subjects: new Set(),
        children: [],
        parent: null,
      });
    }
    // Look for relations of type "Child" that indicate a parent skill.
    const relations = skillEl.querySelectorAll('relation[type="Child"]');
    relations.forEach((rel) => {
      const parentId = rel.getAttribute("id");
      if (!skillsMap.has(parentId)) {
        skillsMap.set(parentId, {
          id: parentId,
          subjects: new Set(),
          children: [],
          parent: null,
        });
      }
      const child = skillsMap.get(skillId);
      const parent = skillsMap.get(parentId);
      child.parent = parentId;
      parent.children.push(skillId);
    });
  });
  skillsMap.forEach((skill) => {
    if (skill.parent) {
      const parent = skillsMap.get(skill.parent);
      skill.subjects.forEach((s) => parent.subjects.add(s));
    }
  });

  const rootSkills = Array.from(skillsMap.values()).filter(
    (skill) => !skill.parent
  );
  const palette = generateColorPalette();
  return rootSkills.map((skill) => buildSkillNode(skill, skillsMap, palette));
}

function buildSkillNode(skill, skillsMap, palette, colorIndex = { index: 0 }) {
  const node = {
    skill: skill.id,
    value: skill.subjects.size, // Use the size of the Set for unique count
    color: window.getSkillIdColor(skill.id), // Use consistent color based on skill ID
    subSkills: [],
  };

  skill.children.forEach((childId) => {
    const child = skillsMap.get(childId);
    node.subSkills.push(buildSkillNode(child, skillsMap, palette, colorIndex));
  });
  return node;
}

function getRealSkillDistribution(nodeId) {
  const textElement = document.querySelector(`#${nodeId}_text`);
  if (!textElement) return [];
  const targetName = textElement.textContent.trim();

  const subjects = getSubjectsByTargetId(targetName);
  if (subjects.length === 0) return [];

  const skillSubjects = aggregateSkills(subjects);
  return buildSkillTree(skillSubjects, serverData);
}

function getDescendantSkillIds(skillId, serverData) {
  const descendants = new Set([skillId]);
  const queue = [skillId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const skills = serverData.querySelectorAll(
      `skill relation[type="Child"][id="${currentId}"]`
    );
    skills.forEach((relation) => {
      const skill = relation.parentElement;
      const childId = skill.getAttribute("id");
      if (!descendants.has(childId)) {
        descendants.add(childId);
        queue.push(childId);
      }
    });
  }

  return Array.from(descendants);
}
function getSubjectsBySkillId(skillId) {
  if (!serverData) return [];
  const subjects = serverData.querySelectorAll("subject");
  const descendantIds = getDescendantSkillIds(skillId, serverData);
  const matches = [];

  subjects.forEach((subject) => {
    const skillRefs = subject.querySelectorAll("subjectSkills skillRef");
    let hasMatch = false;
    skillRefs.forEach((ref) => {
      if (descendantIds.includes(ref.getAttribute("id"))) {
        hasMatch = true;
      }
    });
    if (hasMatch) {
      matches.push({
        id: subject.getAttribute("id"),
        uid: subject.getAttribute("uid"),
        name: subject.getAttribute("id"),
      });
    }
  });

  return matches;
}

document.addEventListener("graphRendered", async () => {
  addStyleSheet();
  saveOriginalSvg();
  saveUserColumn();

  try {
    console.log("Initializing skill distribution rings...");
    serverData = doc;
    if (!serverData) {
      console.error("Server data not available.");
      return;
    }
    addSkillDistributionRings();

    if (typeof window.storeOriginalPositions === "function") {
      window.storeOriginalPositions();
    }
  } catch (error) {
    console.error("Initialization failed:", error);
  }
});

function saveUserColumn() {
  if (isZoomed == false) {
    console.log("saving current user column");
    const column = document.querySelector("#users");
    originalSubjectsHTML = column.cloneNode(true);
    console.log("saving current", column);
  } else {
    console.log("not saving current");
  }
}

document.addEventListener("click", function (e) {
  console.log(isZoomed);
});

function localUpdateAfterClick() {
  if (window.updateAfterClick) {
    window.updateAfterClick();
  } else {
    console.log("updateAfte rClick not available");
    saveOriginalSvg();
    saveUserColumn();
    addSkillDistributionRings();
  }
}

window.addSkillDistributionRings = addSkillDistributionRings;
