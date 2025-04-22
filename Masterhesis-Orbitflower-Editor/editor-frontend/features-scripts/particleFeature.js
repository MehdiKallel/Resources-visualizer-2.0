document.addEventListener("DOMContentLoaded", () => {
  console.log("Adding particle feature styles");
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    .particle {
      transition: opacity 0.2s ease-out;
      will-change: transform, opacity;
    }

    @keyframes pulse {
      0% { stroke-dashoffset: 0; }
      50% { stroke-dashoffset: 100; }
      100% { stroke-dashoffset: 0; }
    }

    .flow-particle {
      opacity: 0.8;
      transition: opacity 0.9s ease-out;
    }

    .flow-particle.unit {
      fill: #729fcf;
      stroke: #204a87;
    }

    .flow-particle.role {
      fill: #ad7fa8;
      stroke: #5c3566;
    }
    
    /* Heat map effects */
    .heat-map {
      pointer-events: none;
      transition: opacity 2s ease;
    }
    
    .heat-pulse {
      animation: heatPulse 3s infinite alternate ease-in-out;
    }
    
    @keyframes heatPulse {
      0% { opacity: 0.3; }
      100% { opacity: 0.7; }
    }
  `;
  document.head.appendChild(styleElement);

  function setupSVGPatterns() {
    const svg = document.querySelector("svg");
    if (!svg) return false;

    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.insertBefore(defs, svg.firstChild);
    }

    const unitHeatGradient = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "radialGradient"
    );
    unitHeatGradient.setAttribute("id", "unitHeatGradient");
    unitHeatGradient.innerHTML = `
      <stop offset="0%" stop-color="#729fcf" stop-opacity="0.6"/>
      <stop offset="40%" stop-color="#729fcf" stop-opacity="0.3"/>
      <stop offset="70%" stop-color="#729fcf" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#729fcf" stop-opacity="0"/>
    `;

    const roleHeatGradient = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "radialGradient"
    );
    roleHeatGradient.setAttribute("id", "roleHeatGradient");
    roleHeatGradient.innerHTML = `
      <stop offset="0%" stop-color="#ad7fa8" stop-opacity="0.6"/>
      <stop offset="40%" stop-color="#ad7fa8" stop-opacity="0.3"/>
      <stop offset="70%" stop-color="#ad7fa8" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#ad7fa8" stop-opacity="0"/>
    `;

    defs.appendChild(unitHeatGradient);
    defs.appendChild(roleHeatGradient);

    return true;
  }

  class HeatMapManager {
    constructor() {
      this.heatMaps = new Map();
      this.updateInterval = null;
    }

    updateHeat(nodeId, circle, type, intensity) {
      const cx = parseFloat(circle.getAttribute("cx"));
      const cy = parseFloat(circle.getAttribute("cy"));
      const r = parseFloat(circle.getAttribute("r"));

      let heatMap = this.heatMaps.get(nodeId);

      if (!heatMap) {
        heatMap = {
          element: this.createHeatElement(nodeId, cx, cy, r, type),
          intensity: 0,
          type: type,
          lastUpdate: performance.now(),
          cx: cx,
          cy: cy,
          r: r,
        };

        const parentGroup = circle.closest("g");
        if (parentGroup && parentGroup.parentNode) {
          parentGroup.parentNode.insertBefore(heatMap.element, parentGroup);
          this.heatMaps.set(nodeId, heatMap);
        }
      }

      heatMap.intensity = Math.min(1.0, heatMap.intensity + intensity * 0.2);
      heatMap.lastUpdate = performance.now();

      this.updateHeatMapIntensity(heatMap);

      if (!this.updateInterval) {
        this.startUpdateCycle();
      }
    }

    createHeatElement(nodeId, cx, cy, radius, type) {
      const heatSize = radius * 3;

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.classList.add("heat-map");
      group.setAttribute("data-node-id", nodeId);

      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", heatSize);
      circle.setAttribute("fill", `url(#${type}HeatGradient)`);
      circle.setAttribute("opacity", "0");
      circle.classList.add("heat-pulse");

      group.appendChild(circle);
      return group;
    }

    // Update heat map visuals based on intensity
    updateHeatMapIntensity(heatMap) {
      // Apply a base scale based on intensity (1.0-1.5x)
      const scale = 1.0 + heatMap.intensity * 0.5;

      // Update the circle
      const circle = heatMap.element.querySelector("circle");
      if (circle) {
        circle.setAttribute("opacity", heatMap.intensity);
        circle.setAttribute("r", heatMap.r * 3 * scale);

        // If intensity is high, add pulsing effect
        if (heatMap.intensity > 0.6) {
          circle.classList.add("heat-pulse");
        } else {
          circle.classList.remove("heat-pulse");
        }
      }
    }

    // Start periodic updates for heat maps
    startUpdateCycle() {
      this.updateInterval = setInterval(() => this.updateAllHeatMaps(), 100);
    }

    // Update all heat maps, fading them over time
    updateAllHeatMaps() {
      const now = performance.now();
      let hasActiveHeatMaps = false;

      this.heatMaps.forEach((heatMap, nodeId) => {
        // Calculate time factor for fading
        const timeSinceLastUpdate = now - heatMap.lastUpdate;

        if (timeSinceLastUpdate > 5000) {
          // Remove heat map if too old
          if (heatMap.element && heatMap.element.parentNode) {
            heatMap.element.parentNode.removeChild(heatMap.element);
          }
          this.heatMaps.delete(nodeId);
        } else {
          // Fade out gradually
          const fadeFactor = Math.max(0, 1 - timeSinceLastUpdate / 5000);
          heatMap.intensity *= fadeFactor;

          if (heatMap.intensity < 0.05) {
            // Hide if almost invisible
            heatMap.element.style.opacity = "0";
          } else {
            hasActiveHeatMaps = true;
            this.updateHeatMapIntensity(heatMap);
          }
        }
      });

      // Stop update cycle if no active heat maps
      if (!hasActiveHeatMaps && this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }
  }

  // Create heat map manager
  const heatMapManager = new HeatMapManager();

  // Setup SVG filters for glow effects
  function setupSVGFilters() {
    const svg = document.querySelector("svg");
    if (!svg) return;

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    const filterUnit = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "filter"
    );
    filterUnit.setAttribute("id", "glowUnit");
    filterUnit.innerHTML = `
      <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    `;

    const filterRole = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "filter"
    );
    filterRole.setAttribute("id", "glowRole");
    filterRole.innerHTML = `
      <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    `;

    defs.appendChild(filterUnit);
    defs.appendChild(filterRole);
    svg.appendChild(defs);
  }

  const receivingNodes = new Map();

  function updateNodeGlowEffect() {
    const now = performance.now();
    let hasActiveNodes = false;

    receivingNodes.forEach((data, nodeId) => {
      const { element, count, type, lastUpdate } = data;

      const timeFactor = Math.max(0, 1 - (now - lastUpdate) / 5000);

      if (timeFactor > 0.1) {
        hasActiveNodes = true;

        element.setAttribute(
          "filter",
          `url(#glow${type.charAt(0).toUpperCase() + type.slice(1)})`
        );

        const baseStrokeWidth = parseFloat(
          element.getAttribute("stroke-width") || "1.5"
        );
        const enhancedStrokeWidth =
          baseStrokeWidth * (1 + Math.min(count * 0.05, 0.5));
        element.setAttribute("stroke-width", enhancedStrokeWidth);
      } else {
        element.removeAttribute("filter");

        element.setAttribute("stroke-width", "1.5");
        receivingNodes.delete(nodeId);
      }
    });

    if (hasActiveNodes) {
      requestAnimationFrame(updateNodeGlowEffect);
    }
  }

  function registerParticleArrival(targetNode, type) {
    const nodeId = targetNode.id;
    const circle = targetNode.querySelector("circle");

    if (!circle) return;

    console.log(`Particle arrived at ${nodeId}`);

    if (!receivingNodes.has(nodeId)) {
      receivingNodes.set(nodeId, {
        element: circle,
        count: 1,
        type,
        lastUpdate: performance.now(),
      });

      requestAnimationFrame(updateNodeGlowEffect);
    } else {
      const data = receivingNodes.get(nodeId);
      data.count = Math.min(data.count + 1, 20); 
      data.lastUpdate = performance.now();
      receivingNodes.set(nodeId, data);
    }
  }

  class ParticlePool {
    constructor(maxSize = 300) {
      this.pool = [];
      this.maxSize = maxSize;
    }

    get() {
      return (
        this.pool.pop() ||
        document.createElementNS("http://www.w3.org/2000/svg", "circle")
      );
    }

    release(element) {
      if (this.pool.length < this.maxSize) {
        element.removeAttribute("class");
        element.removeAttribute("style");
        element.removeAttribute("r");
        element.removeAttribute("cx");
        element.removeAttribute("cy");

        this.pool.push(element);
      } else if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  }

  const particlePool = new ParticlePool(300);

  class FlowParticle {
    constructor(sourceNode, targetNode, type) {
      const sourceCircle = sourceNode.querySelector("circle");
      const targetCircle = targetNode.querySelector("circle");

      if (!sourceCircle || !targetCircle) {
        return;
      }

      this.sourceNode = sourceNode;
      this.targetNode = targetNode;
      this.type = type;

      this.element = particlePool.get();
      this.element.classList.add("flow-particle", "particle", type);

      this.size = 1 + Math.random() * 2;
      this.element.setAttribute("r", this.size);

      this.speedFactor = 0.5 + Math.random() * 1.0; 

      this.randomFactor = Math.random() * 0.4 - 0.2; 

      const baseOpacity = type === "unit" ? 0.5 : 0.6;
      const opacity = baseOpacity + Math.random() * 0.3;
      this.element.style.opacity = opacity;

      const svg = sourceNode.closest("svg");
      if (svg) {
        const firstChild = svg.firstChild;
        svg.insertBefore(this.element, firstChild);
      } else {
        console.error("Could not find SVG element");
        return;
      }

      this.start = {
        x: parseFloat(sourceCircle.getAttribute("cx")),
        y: parseFloat(sourceCircle.getAttribute("cy")),
        radius: parseFloat(sourceCircle.getAttribute("r")),
      };

      this.end = {
        x: parseFloat(targetCircle.getAttribute("cx")),
        y: parseFloat(targetCircle.getAttribute("cy")),
        radius: parseFloat(targetCircle.getAttribute("r")),
      };

      const dx = this.end.x - this.start.x;
      const dy = this.end.y - this.start.y;
      this.distance = Math.sqrt(dx * dx + dy * dy);

      const curveFactor = Math.min(0.2, 20 / this.distance);
      const midX = (this.start.x + this.end.x) / 2;
      const midY = (this.start.y + this.end.y) / 2;

      const perpX = -dy * (curveFactor + this.randomFactor);
      const perpY = dx * (curveFactor + this.randomFactor);

      this.controlPoint = {
        x: midX + perpX,
        y: midY + perpY,
      };

      const startingProgress = (this.start.radius / this.distance) * 0.5;
      this.progress = startingProgress;
      this.arrived = false;
      this.valid = true;

      if (this.type === "unit") {
        this.element.style.strokeWidth = "0.5";
      } else {
        this.element.style.strokeWidth = "0.7";
      }

      this.element.classList.add("particle-from-" + this.sourceNode.id);
    }

    update(delta) {
      if (!this.valid) return false;

      const prevProgress = this.progress;

      this.progress = Math.min(
        1,
        this.progress + (delta / 2500) * this.speedFactor
      );

      const t = this.progress;
      const invT = 1 - t;

      const x =
        invT * invT * this.start.x +
        2 * invT * t * this.controlPoint.x +
        t * t * this.end.x;

      const y =
        invT * invT * this.start.y +
        2 * invT * t * this.controlPoint.y +
        t * t * this.end.y;

      this.element.setAttribute("cx", x);
      this.element.setAttribute("cy", y);

      let opacity;

      if (this.progress < 0.15) {
        opacity = (this.progress / 0.15) * 0.7;
      } else if (this.progress <= 0.85) {
        const pulseEffect = 0.05 * Math.sin(this.progress * Math.PI * 4);
        opacity = 0.7 + pulseEffect;

        const sizeAdjust = 1 - (this.progress - 0.15) * 0.3;
        this.element.setAttribute("r", this.size * sizeAdjust);
      } else {
        opacity = (1 - (this.progress - 0.85) / 0.15) * 0.7;
      }

      this.element.style.opacity = opacity;

      if (!this.arrived && prevProgress < 0.9 && this.progress >= 0.9) {
        this.arrived = true;

        this.registerHeatEffect();
      }

      return this.progress < 1;
    }

    registerHeatEffect() {
      const circle = this.targetNode.querySelector("circle");
      if (!circle) return;

      const intensity = 0.05 + (this.size / 3) * 0.05;

      heatMapManager.updateHeat(
        this.targetNode.id,
        circle,
        this.type,
        intensity
      );
    }

    remove() {
      if (this.element) {
        particlePool.release(this.element);
      }
      this.valid = false;
    }
  }

  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.lastFrameTime = 0;
      this.running = false;
      this.maxParticles = 150;
      this.frameSkipCounter = 0;
    }

    addConnection(source, target, type) {
      if (this.particles.length >= this.maxParticles) {
        if (Math.random() > 0.8 && this.particles.length > 0) {
          this.particles[0].remove();
          this.particles.shift();
        } else {
          return;
        }
      }

      const particle = new FlowParticle(source, target, type);
      if (particle.valid) {
        this.particles.push(particle);
      }

      if (!this.running) {
        this.running = true;
        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.update.bind(this));
      }
    }

    update(timestamp) {
      this.frameSkipCounter =
        (this.frameSkipCounter + 1) % (this.particles.length > 100 ? 2 : 1);
      if (this.frameSkipCounter !== 0) {
        requestAnimationFrame(this.update.bind(this));
        return;
      }

      const delta = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      if (delta > 100) {
        requestAnimationFrame(this.update.bind(this));
        return;
      }

      const activeParticles = [];

      for (let i = 0; i < this.particles.length; i++) {
        const particle = this.particles[i];
        if (particle.update(delta)) {
          activeParticles.push(particle);
        } else {
          particle.remove();
        }
      }

      this.particles = activeParticles;

      if (this.particles.length > 0) {
        requestAnimationFrame(this.update.bind(this));
      } else {
        this.running = false;
      }
    }
  }

  const ps = new ParticleSystem();

  function initConnections() {
    console.log("Initializing particle connections");

    const connections = document.querySelectorAll(
      "path.connect.unit, path.connect.role"
    );

    if (connections.length === 0) {
      console.warn("No connections found. Will try again in 1 second.");
      setTimeout(initConnections, 1000);
      return;
    }

    console.log(`Found ${connections.length} connections`);

    connections.forEach((connection) => {
      const classAttr = connection.getAttribute("class") || "";
      const type = classAttr.includes("unit") ? "unit" : "role";

      const relationMatch = classAttr.match(/\bf([^ ]+) t([^ ]+)\b/);

      if (!relationMatch) return;

      const fromId = relationMatch[1];
      const toId = relationMatch[2];

      if (!fromId || !toId) return;

      const sourceNode = document.getElementById(fromId);
      const targetNode = document.getElementById(toId);

      if (!sourceNode || !targetNode) {
        console.warn(`Missing nodes for: ${fromId} -> ${toId}`);
        return;
      }

      const sourceCircle = sourceNode.querySelector("circle");
      const targetCircle = targetNode.querySelector("circle");

      if (!sourceCircle || !targetCircle) return;

      const sx = parseFloat(sourceCircle.getAttribute("cx"));
      const sy = parseFloat(sourceCircle.getAttribute("cy"));
      const tx = parseFloat(targetCircle.getAttribute("cx"));
      const ty = parseFloat(targetCircle.getAttribute("cy"));

      const distance = Math.sqrt(Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2));

      const baseInterval = 750 + distance * 3;

      setInterval(() => {
        if (!document.hidden && Math.random() > 0.3) {
          ps.addConnection(sourceNode, targetNode, type);
        }
      }, baseInterval);

      if (Math.random() > 0.3) {
        setInterval(() => {
          if (!document.hidden && Math.random() > 0.5) {
            ps.addConnection(targetNode, sourceNode, type);
          }
        }, baseInterval * 2); 
      }
    });
  }

  function waitForSVG() {
    const container = document.getElementById("graphcolumn");
    if (!container) {
      setTimeout(waitForSVG, 500);
      return;
    }

    const svg = container.querySelector("svg");
    if (!svg) {
      setTimeout(waitForSVG, 500);
      return;
    }

    console.log("SVG found, initializing connections...");

    if (setupSVGPatterns()) {
      setTimeout(initConnections, 800);

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          ps.lastFrameTime = performance.now();
        }
      });
    } else {
      console.warn("Failed to set up SVG patterns, retrying...");
      setTimeout(waitForSVG, 500);
    }
  }

  waitForSVG();
  setupSVGFilters();
});
