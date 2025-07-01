class SkillsFeature {
  constructor(svgElement, doc = null) {
    this.svgElement = svgElement;
    this.serverData = doc;
    this.originalSvg = null;
    this.originalViewBox = null;
    this.originalSubjectsHTML = null;
    this.isZoomed = false;
    this.originalSvgContent = null;
    this.zoomedNodeId = null;
    this.collapseTimeouts = new Map();
    this.svgStateHistory = [];
    window.isZoom = false;
    if (!window.getSkillIdColor) {
      window.getSkillIdColor = this.getSkillIdColor;
    }
  }

  show(doc) {
    console.log("SkillsFeature.show() called with document:", doc);

    if (doc) {
      this.serverData = doc;
      this.initialize();
      return;
    }

    if (this.serverData) {
      this.initialize();
      return;
    }

    console.warn("No document provided to SkillsFeature.show()");
  }

  initialize() {
    this.addStyleSheet();
    this.saveOriginalSvg();

    try {
      console.log("Initializing skill distribution rings...");
      if (!this.serverData) {
        console.error("Server data not available.");
        return;
      }
      this.addSkillDistributionRings();

      if (typeof window.storeOriginalPositions === "function") {
        window.storeOriginalPositions();
      }
    } catch (error) {
      console.error("Initialization failed:", error);
    }
  }

  getSkillIdColor(skillId) {
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
  }

  saveOriginalSvg() {
    const svg = document.querySelector("#graph svg");
    if (svg) {
      this.originalSvg = svg.cloneNode(true);
      this.originalViewBox = svg.getAttribute("viewBox");
    }
  }

  // Draw an arc (ring segment) with gradient support
  describeArc(cx, cy, outerR, innerR, startAngle, endAngle) {
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
  polarToCartesian(cx, cy, r, angle) {
    const rad = Math.PI / 180;
    return {
      x: cx + r * Math.cos(angle * rad),
      y: cy + r * Math.sin(angle * rad),
    };
  }

  // Create a function to shade or lighten a color
  shadeColor(color, percent) {
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
  generateColorPalette(baseColors = null, count = 12) {
    // Updated default colors - more professional, lighter palette
    if (!baseColors) {
      baseColors = [
        "#60A5FA",
        "#34D399",
        "#A78BFA",
        "#F87171",
        "#FBBF24",
        "#6EE7B7",
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
          r1 = this.hueToRgb(p, q, newH / 360 + 1 / 3);
          g1 = this.hueToRgb(p, q, newH / 360);
          b1 = this.hueToRgb(p, q, newH / 360 - 1 / 3);
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
  hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  addStyleSheet() {
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
        stroke: #a40000 !important;
        stroke-width: 2px !important;
        filter: drop-shadow(0px 1px 3px rgba(164, 0, 0, 0.3));
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
        font-weight: 500;
        fill: #444;
      }

      .tooltip-value {
        font-family: 'Segoe UI', Arial, sans-serif;
        fill: #666;
      }

      /* Responsive media queries for smaller screens */
      @media (max-width: 800px) {
        .tooltip-title {
          font-size: 8px;
        }
        
        .tooltip-value {
          font-size: 7px;
        }
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
        .skill-segment.dragging {
    opacity: 0.7;
    filter: brightness(0.9);
  }
    `;
    document.head.appendChild(style);
  }

  // Simplified reset function to reload the entire page
  resetZoom() {
    // Simply reload the page to restore the initial HTML state
    this.isZoomed = false;
    window.isZoom = false;
    window.detailedView = false;
    window.location.reload();
  }

  // Position and update tooltip content
  updateTooltip(tooltip, skill, value, percent, x, y) {
    tooltip.style.visibility = "hidden";
    tooltip.style.display = "block";

    const title = tooltip.querySelector(".tooltip-title");
    title.textContent = skill;

    const valueText = tooltip.querySelector(".tooltip-value");
    valueText.textContent = `Value: ${value}`;

    const percentText = tooltip.querySelectorAll(".tooltip-value")[1];
    percentText.textContent = `${percent}% of total`;

    // Detect if we're in split view by checking container width
    const container = document.getElementById("graph");
    const isSplitView = window.innerWidth < 1200; // Adjust breakpoint as needed

    // Use dynamic font sizes based on view state
    const baseFontSize = isSplitView ? 8 : 10;
    const detailFontSize = isSplitView ? 6 : 8;

    title.style.fontSize = `${baseFontSize}px`;
    valueText.style.fontSize = `${detailFontSize}px`;
    percentText.style.fontSize = `${detailFontSize}px`;

    // Calculate dimensions based on text content
    const titleWidth = title.getComputedTextLength();
    const valueWidth = valueText.getComputedTextLength();
    const percentWidth = percentText.getComputedTextLength();
    const maxTextWidth = Math.max(titleWidth, valueWidth, percentWidth);

    // Fixed left padding for all text
    const paddingX = isSplitView ? 10 : 14;
    const paddingY = isSplitView ? 6 : 10;
    const lineHeight = isSplitView ? 11 : 14;

    // Tooltip width is just enough for the widest text plus padding
    const newWidth = Math.max(maxTextWidth + paddingX * 2, isSplitView ? 90 : 120);
    const newHeight = paddingY * 2 + baseFontSize + lineHeight * 2;

    const bg = tooltip.querySelector(".tooltip-bg");
    bg.setAttribute("width", newWidth);
    bg.setAttribute("height", newHeight);
    bg.setAttribute("rx", isSplitView ? 4 : 6);
    bg.setAttribute("ry", isSplitView ? 4 : 6);

    // Always left-align text with fixed x
    const textX = paddingX;
    title.setAttribute("x", textX);
    title.setAttribute("y", paddingY + baseFontSize);
    title.setAttribute("text-anchor", "start");
    valueText.setAttribute("x", textX);
    valueText.setAttribute("y", paddingY + baseFontSize + lineHeight);
    valueText.setAttribute("text-anchor", "start");
    percentText.setAttribute("x", textX);
    percentText.setAttribute("y", paddingY + baseFontSize + lineHeight * 2);
    percentText.setAttribute("text-anchor", "start");

    tooltip.setAttribute("transform", `translate(${x},${y})`);
    tooltip.style.visibility = "visible";
  }
  // Add this function to toggle tooltip zoom state
  setTooltipZoomState(svg, isZoomed) {
    // Only remove .tooltip-zoomed classes, do not touch x/y/text-anchor
    const tooltip = svg.querySelector(".skill-tooltip-container");
    if (!tooltip) return;
    const title = tooltip.querySelector(".tooltip-title");
    const valueTexts = tooltip.querySelectorAll(".tooltip-value");
    title.classList.remove("tooltip-zoomed");
    valueTexts[0].classList.remove("tooltip-zoomed");
    valueTexts[1].classList.remove("tooltip-zoomed");
    // Do not set x/y/text-anchor here!
  }

  // Create a back button as HTML element outside the SVG
  createBackButton(svg) {
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
    backButton.textContent = "Single View";
    backButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 4px 8px;
      background-color: #ffffff;
      border: 1px solid #cccccc;
      border-radius: 3px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 15px;
      color: #333333;
      cursor: pointer;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    // Add click handler with proper binding
    backButton.addEventListener("click", () => this.resetZoom());

    // Append to graph column parent container for proper positioning
    graphColumn.style.position = "relative"; // Ensure relative positioning for absolute child
    graphColumn.appendChild(backButton);
    return backButton;
  }

  // Create tooltip container with all necessary elements
  createTooltip(svg) {
    let tooltip = svg.querySelector(".skill-tooltip-container");

    if (!tooltip) {
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

  // Hide tooltip
  hideTooltip(tooltip) {
    tooltip.style.visibility = "hidden";
  }

  // Clear any existing timeout for a specific skill group
  clearCollapseTimeout(groupId, skillName) {
    const key = `${groupId}-${skillName}`;
    if (this.collapseTimeouts.has(key)) {
      clearTimeout(this.collapseTimeouts.get(key));
      this.collapseTimeouts.delete(key);
    }
  }

  // Set a timeout to auto-collapse expanded skills
  setCollapseTimeout(group, skillName, levelGroup, parentNode, delay = 10000) {
    const key = `${group.id}-${skillName}`;
    this.clearCollapseTimeout(group.id, skillName);

    const timeoutId = setTimeout(() => {
      if (levelGroup && document.contains(levelGroup)) {
        levelGroup.remove();
        if (parentNode) {
          parentNode.removeAttribute("data-expanded");
        }
      }
      this.collapseTimeouts.delete(key);
    }, delay);

    this.collapseTimeouts.set(key, timeoutId);
  }

  collectHierarchyGroups(clickedGroup) {
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

  renderSkillSegments(group, skillsData, options = {}) {
    if (!skillsData || skillsData.length === 0) return null;

    const self = this; // Store reference to this for use in event handlers
    const svg = group.ownerSVGElement;
    const tooltip = this.createTooltip(svg);
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
      innerRadius: r + 4 + (options.level || 0) * 14,
      ringWidth: 10,
      startAngle: 0,
      endAngle: 360,
      parent: null,
      autoCollapseDelay: 10000, // Auto-collapse after 5 seconds by default
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

      const gradId = `grad-${group.id}-level${
        config.level
      }-${skill.skill.replace(/\s+/g, "")}`;
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
      stop2.setAttribute("stop-color", self.shadeColor(skill.color, -10)); // Less darkening

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
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      const pathData = self.describeArc(cx, cy, outerR, innerR, startA, endA);

      // Only set path data if it's valid
      if (pathData) {
        path.setAttribute("d", pathData);
        path.setAttribute("fill", `url(#${gradId})`);
        path.setAttribute("class", "skill-segment");
        path.setAttribute("data-skill", skill.skill);
        path.setAttribute("data-skill-id", skill.skill);
        path.setAttribute("data-value", skill.value);
        path.setAttribute(
          "id",
          `${group.id}-${skill.skill.replace(/\s+/g, "")}`
        );

        // find entity name and type
        const entityType = group.id.startsWith("u") ? "unit" : "role";
        const entityName = svg.querySelector(
          `text#${group.id}_text`
        ).textContent;
        const pathId = `${group.id}-${skill.skill.replace(/\s+/g, "")}`;
        // Add drag/click/double-click functionality (no delays)
        let isDragging = false;
        let dragTooltip = null;
        let startX = 0;
        let startY = 0;
        const DRAG_THRESH = 8; // px
        let moved = false;
        let pointerMoveHandler = null;
        let pointerUpHandler = null;

        path.addEventListener("pointerdown", startPointer);
        path.addEventListener("dblclick", onDoubleClick);

        function startPointer(e) {
          isDragging = false;
          moved = false;
          startX = e.clientX;
          startY = e.clientY;
          const svg = path.ownerSVGElement;
          svg.setPointerCapture(e.pointerId);
          pointerMoveHandler = onPointerMove;
          pointerUpHandler = onPointerUp;
          svg.addEventListener("pointermove", pointerMoveHandler);
          svg.addEventListener("pointerup", pointerUpHandler);
          svg.addEventListener("pointercancel", pointerUpHandler);
        }

        function onPointerMove(e) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (!isDragging && distance > DRAG_THRESH) {
            isDragging = true;
            moved = true;
            // Create drag tooltip
            dragTooltip = document.createElement("div");
            Object.assign(dragTooltip.style, {
              position: "absolute",
              padding: "8px 12px",
              backgroundColor: skill.color,
              color: "#fff",
              borderRadius: "4px",
              fontFamily: "Arial, sans-serif",
              fontSize: "14px",
              fontWeight: "normal",
              pointerEvents: "none",
              zIndex: "9999",
              transform: "translate(-50%, -50%)",
              whiteSpace: "nowrap",
              boxShadow: `0 4px 8px ${self.shadeColor(skill.color, -20)}`,
              animation: "pulse 1s infinite",
            });
            dragTooltip.textContent = `Skill:${skill.skill} (of ${entityType} ${entityName})`;
            document.body.appendChild(dragTooltip);
            path.classList.add("dragging");
          }
          if (isDragging) {
            if (dragTooltip) {
              dragTooltip.style.left = `${e.clientX}px`;
              dragTooltip.style.top = `${e.clientY}px`;
            }
            // --- Add block-drop-target effect on expr-blocks ---
            const expressionBlocks = document.querySelectorAll('.expr-block');
            let isOverBlock = false;
            expressionBlocks.forEach(block => {
              const rect = block.getBoundingClientRect();
              const isOver = e.clientX >= rect.left &&
                            e.clientX <= rect.right &&
                            e.clientY >= rect.top &&
                            e.clientY <= rect.bottom;
              if (isOver) {
                isOverBlock = true;
                block.classList.add('block-drop-target');
                if (dragTooltip) dragTooltip.classList.add('over-expression');
              } else {
                block.classList.remove('block-drop-target');
              }
            });
            if (!isOverBlock && dragTooltip) {
              dragTooltip.classList.remove('over-expression');
            }
          }
        }

        function onPointerUp(e) {
          const svg = path.ownerSVGElement;
          svg.releasePointerCapture(e.pointerId);
          svg.removeEventListener("pointermove", pointerMoveHandler);
          svg.removeEventListener("pointerup", pointerUpHandler);
          svg.removeEventListener("pointercancel", pointerUpHandler);
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          // --- Remove all block-drop-target classes on drag end ---
          document.querySelectorAll('.block-drop-target').forEach(el => el.classList.remove('block-drop-target'));
          if (isDragging) {
            isDragging = false;
            // Dispatch drop event
            if (dragTooltip) {
              const dropEvent = new CustomEvent("skilldragend", {
                detail: {
                  skillId: skill.skill,
                  entityName: entityName,
                  entityType: entityType,
                  pathId: pathId,
                  x: e.clientX,
                  y: e.clientY,
                },
              });
              window.dispatchEvent(dropEvent);
              document.body.removeChild(dragTooltip);
              dragTooltip = null;
            }
            path.classList.remove("dragging");
          } else if (!moved && distance <= DRAG_THRESH) {
            // Treat as click
            path.dispatchEvent(new Event("click", { bubbles: true }));
          }
        }

        function onDoubleClick(e) {
          // You can add double-click logic here if needed
          // e.g., open details, zoom, etc.
        }

        path.addEventListener("mouseenter", function (e) {
          // Use cursor position for tooltip
          const svg = path.ownerSVGElement;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          // Convert screen coordinates to SVG coordinates
          const cursorpt = pt.matrixTransform(svg.getScreenCTM().inverse());
          self.updateTooltip(
            tooltip,
            skill.skill,
            skill.value,
            Math.round((skill.value / total) * 100),
            cursorpt.x + 10, // offset for better visibility
            cursorpt.y + 10
          );

          // Reset auto-collapse timeout when hovering over parent of expanded children
          if (path.parentNode.hasAttribute("data-expanded")) {
            const childGroup = group.querySelector(
              `.skill-level[data-parent="${skill.skill}"]`
            );
            if (childGroup) {
              self.clearCollapseTimeout(group.id, skill.skill);
            }
          }
        });

        // Add mousemove to update tooltip position as cursor moves
        path.addEventListener("mousemove", function (e) {
          const svg = path.ownerSVGElement;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const cursorpt = pt.matrixTransform(svg.getScreenCTM().inverse());
          self.updateTooltip(
            tooltip,
            skill.skill,
            skill.value,
            Math.round((skill.value / total) * 100),
            cursorpt.x + 10,
            cursorpt.y + 10
          );
        });

        path.addEventListener("mouseleave", function (e) {
          self.hideTooltip(tooltip);

          if (path.parentNode.hasAttribute("data-expanded")) {
            const childGroup = group.querySelector(
              `.skill-level[data-parent="${skill.skill}"]`
            );
            if (childGroup) {
              self.setCollapseTimeout(
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
          const svg = this.ownerSVGElement;
          if (!svg) {
            console.error("SVG element not found.");
            return;
          }
          self.svgStateHistory.push(svg.innerHTML);
          const mainGroup = this.closest('g[id^="u"], g[id^="r"]');

          document
            .querySelectorAll(".skill-segment.active-skill-filter")
            .forEach((el) => {
              el.classList.remove("active-skill-filter");
            });
          this.classList.add("active-skill-filter");

          const clickedGroup = this.closest(".skill-level");
          const hierarchyGroups = self.collectHierarchyGroups(clickedGroup);
          mainGroup.querySelectorAll(".skill-level").forEach((g) => {
            if (!hierarchyGroups.includes(g)) g.remove();
          });

          self.createBackButton(svg);
          self.setTooltipZoomState(svg, true);

          if (skill.subSkills && skill.subSkills.length > 0) {
            const existingSubGroup = group.querySelector(
              `.skill-level[data-level="${config.level + 1}"][data-parent="${
                skill.skill
              }"]`
            );

            if (existingSubGroup) {
              existingSubGroup.remove();
              path.parentNode.removeAttribute("data-expanded");
              self.clearCollapseTimeout(group.id, skill.skill);
            } else {
              path.parentNode.setAttribute("data-expanded", "true");
              const childGroup = self.renderSkillSegments(
                group,
                skill.subSkills,
                {
                  level: config.level + 1,
                  startAngle: startA,
                  endAngle: endA,
                  parent: skill.skill,
                  autoCollapseDelay: config.autoCollapseDelay,
                }
              );
              self.setCollapseTimeout(
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

    if (levelGroup.childNodes.length > 0) {
      group.appendChild(levelGroup);
      return levelGroup;
    }

    return null;
  }

  addSkillDistributionRings() {
    const container = document.getElementById("graph");
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;

    const nodes = svg.querySelectorAll('g[id^="u"], g[id^="r"]');
    nodes.forEach((group) => {
      const skillsData = this.getRealSkillDistribution(group.id);
      if (skillsData && skillsData.length > 0) {
        this.renderSkillSegments(group, skillsData);
      }
    });
  }

  getSubjectsByTargetId(targetName) {
    const subjects = this.serverData.querySelectorAll("subject");
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
  aggregateSkills(subjects) {
    const skillSubjects = {};
    subjects.forEach((subject) => {
      // Use the subject's id as its unique identifier.
      const subjectId = subject.getAttribute("id");
      const skillRefs = subject.querySelectorAll("subjectSkills ref");
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

  buildSkillTree(skillSubjects, serverData) {
    const skillsMap = new Map();

    Object.entries(skillSubjects).forEach(([id, subjSet]) => {
      skillsMap.set(id, {
        id,
        subjects: new Set(subjSet),
        children: [],
        parent: null,
      });
    });

    const skillElements = serverData.querySelectorAll("skill");
    skillElements.forEach((skillEl) => {
      const skillId = skillEl.getAttribute("id");
      if (!skillsMap.has(skillId)) {
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
    const palette = this.generateColorPalette();
    return rootSkills.map((skill) =>
      this.buildSkillNode(skill, skillsMap, palette)
    );
  }

  buildSkillNode(skill, skillsMap, palette, colorIndex = { index: 0 }) {
    const node = {
      skill: skill.id,
      value: skill.subjects.size, // Use the size of the Set for unique count
      color: window.getSkillIdColor(skill.id), // Use consistent color based on skill ID
      subSkills: [],
    };

    skill.children.forEach((childId) => {
      const child = skillsMap.get(childId);
      node.subSkills.push(
        this.buildSkillNode(child, skillsMap, palette, colorIndex)
      );
    });
    return node;
  }

  getRealSkillDistribution(nodeId) {
    const textElement = document.querySelector(`#${nodeId}_text`);
    if (!textElement) return [];
    const targetName = textElement.textContent.trim();

    const subjects = this.getSubjectsByTargetId(targetName);
    if (subjects.length === 0) return [];

    const skillSubjects = this.aggregateSkills(subjects);
    return this.buildSkillTree(skillSubjects, this.serverData);
  }

  getDescendantSkillIds(skillId, serverData) {
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

  getSubjectsBySkillId(skillId) {
    if (!this.serverData) return [];
    const subjects = this.serverData.querySelectorAll("subject");
    const descendantIds = this.getDescendantSkillIds(skillId, this.serverData);
    const matches = [];

    subjects.forEach((subject) => {
      const skillRefs = subject.querySelectorAll("subjectSkills ref");
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
}
