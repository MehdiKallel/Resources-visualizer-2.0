window.detailedView = false;

function getSkillIdColor(skillId) {
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

  let hash = 0;
  for (let i = 0; i < skillId.length; i++) {
    hash = (hash << 5) - hash + skillId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
}

class SkillTreeComponent {
  constructor(options) {
    this.tooltip = document.createElement("div");
    this.tooltip.id = "tooltip";
    
    if (!document.getElementById("skill-tree-component-styles")) {
      const style = document.createElement("style");
      style.id = "skill-tree-component-styles";
      style.innerHTML = `
        .skill-tree-component {
          width: 100%;
          height: 100% !important; /* Changed from 50% to 100% */
          overflow: hidden;
          position: relative;
        }
        
        .particle-canvas {
        }

        .node circle {
          stroke: #fff;
          stroke-width: 1.5;
          transition: r 0.3s ease, fill 0.3s ease;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
        }

        .node text {
          font: 13px 'Segoe UI', sans-serif;
          fill: #64748b;
          transition: fill 0.2s ease;
        }

        .node:hover circle {
          stroke: #1e293b;
        }

        .node:hover text {
          fill: #1e293b;
          font-weight: 500;
        }

        .relationship-line {
          stroke-opacity: 0; /* Make paths completely transparent */
        }

        #tooltip {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          font-size: 14px;
          color: #334155;
          pointer-events: none;
          max-width: 280px;
        }

        .tooltip-title {
          font-weight: 600;
          margin-bottom: 8px;
          color: #1e293b;
        }

        .tooltip-content {
          line-height: 1.5;
        }
      `;
      document.head.appendChild(style);
    }

    this.container = document.getElementById(`${options.container}`);
    this.filterType = options.filterType;
    this.filterId = options.filterId;
    this.skillId = options.skillId;
    this.xmlData = options.xmlData;


    this.skillTree = null;
    this.relationships = [];
    this.skillEmployeeMap = new Map();
    this.maxEmployeeCount = 1;

    this.particles = [];
    this.lastParticleTime = null;
    this.particleLimit = 1000;
    this.particleSpawnRate = 6;
    this.particleBaseSize = 1;

    this.transform = { x: 0, y: 0, scale: 1 };
    this.isDragging = false;
    this.lastMousePosition = { x: 0, y: 0 };

    this.el = document.createElement("div");
    this.el.className = "skill-tree-component";
    this.el.style.position = "relative";
    this.el.style.width = "100%";
    this.el.style.height = "100%"; // Changed from 50% to 100%
    this.el.style.boxSizing = "border-box"; // Ensure padding doesn't affect dimensions

    // Create the particle canvas to fill the component
    this.particleCanvas = document.createElement("canvas");
    this.particleCanvas.className = "particle-canvas";
    this.particleCanvas.style.width = "100%";
    this.particleCanvas.style.height = "100%";
    this.particleCanvas.width = this.container.clientWidth;
    this.particleCanvas.height = this.container.clientHeight; // Full height instead of half
    this.el.appendChild(this.particleCanvas);
    this.particleCtx = this.particleCanvas.getContext("2d");


    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");
    this.svg.style.position = "absolute";
    this.svg.style.top = "0";
    this.svg.style.left = "0";
    this.svg.style.width = "100%";
    this.svg.style.height = "100%";
    this.svg.setAttribute("id", "testing-svg");
    this.el.appendChild(this.svg);
  }

  handleResize() {
    if (this.container) {
      const containerWidth = this.container.clientWidth;
      const containerHeight = this.container.clientHeight;
      
      this.el.style.width = `${containerWidth}px`;
      this.el.style.height = `${containerHeight}px`;
      
      this.particleCanvas.width = containerWidth;
      this.particleCanvas.height = containerHeight;
      
      this.svg.setAttribute("viewBox", `0 0 ${containerWidth} ${containerHeight}`);

      this.renderTree();

      setTimeout(() => this.centerSVG(), 0);
      
    }
  }

  show(currentorgmodel, parentNodeType, relatedText, skillId) {
    this.xmlData = currentorgmodel;
    this.filterType = parentNodeType;
    this.filterId = relatedText;
    this.skillId = skillId;

    console.log("working showing with the following params",this.xmlData, this.filterType, this.filterId, this.skillId);
    this.svgContent = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    this.svg.appendChild(this.svgContent);

    this.el.appendChild(this.tooltip);
    
    this.tooltip.style.position = "absolute";
    this.tooltip.style.zIndex = "1000";
    this.tooltip.style.pointerEvents = "none"; 

    this.setupNavigation();
    this.parseXML();
    this.filterTreeBySkill();
    this.computeLayout();

    this.render();
    this.centerSVG();

    requestAnimationFrame(this.animateParticles.bind(this));

    this.isFirstRender = true;

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          this.handleResize();
        }
      });
      this.resizeObserver.observe(this.container);
    }

    
    document.addEventListener("click", (event) => {
      if (this.wasDragging) {
        this.wasDragging = false;
        return;
      }
    });

    window.addEventListener("resize", this.handleResize.bind(this));

    this.activeParticles = [];

    this.setupCanvasClickHandler();

    this.layoutType = options.layoutType || "radial";
  }

  reset(container) {
    document.querySelector(`${container}`).innerHTML = ""; 
    ;
    console.error("reset called successfully");
  }


  getSkillColor(value) {
    if (this.currentSkillId) {
      return getSkillIdColor(this.currentSkillId);
    }

    const colors = [
      "#e2e8f0", // Base (no employees)
      "#bfdbfe", // Blue 100
      "#93c5fd", // Blue 300
      "#60a5fa", // Blue 400
      "#3b82f6", // Blue 500
      "#2563eb", // Blue 600,
    ];

    const index = value
      ? Math.min(
          Math.floor((value / this.maxEmployeeCount) * (colors.length - 1)) + 1,
          colors.length - 1
        )
      : 0;

    return colors[index];
  }

  getRelationshipColor(type) {
    const colors = {
      isRelatedTo: "rgba(123, 58, 223, 0.8)", // Brighter Purple
      dependOn: "rgba(255, 30, 99, 0.8)", // Brighter Pink
      RelatedTo: "rgba(255, 152, 0, 0.8)", // Bright Orange
      complementary: "rgba(46, 205, 50, 0.8)", // Brighter Green
      parent: "rgba(0, 0, 0, 0.8)", // Bright Blue
      default: "rgba(93, 170, 243, 0.8)", // Bright default blue
    };
    return colors[type] || "rgba(33, 150, 243, 0.4)"; // Default blue
  }



  parseXML() {
    const skills = {};
    const skillElements = this.xmlData.getElementsByTagName("skill");
    for (let i = 0; i < skillElements.length; i++) {
      const elem = skillElements[i];
      const id = elem.getAttribute("id");
      if (!id) continue;
      skills[id] = { id: id, name: id, children: [] };
    }

    this.relationships = [];
    const childSet = new Set();
    for (let i = 0; i < skillElements.length; i++) {
      const elem = skillElements[i];
      const id = elem.getAttribute("id");
      const relElements = elem.getElementsByTagName("relation");
      for (let j = 0; j < relElements.length; j++) {
        const relElem = relElements[j];
        const targetId = relElem.getAttribute("id");
        const type = relElem.getAttribute("type");
        if (type === "Child") {
          if (skills[targetId]) {
            skills[targetId].children.push(skills[id]);
          } else {
            skills[targetId] = {
              id: targetId,
              name: targetId,
              children: [skills[id]],
            };
          }
          childSet.add(id);
        } else {
          let score = parseFloat(relElem.getAttribute("score"));

          if (isNaN(score)) score = Math.floor(Math.random() * 10) + 1;
          const speed = 0.0004 * score;
          this.relationships.push({
            from: id,
            to: targetId,
            score: score,
            speed: speed,
            type: type,
          });
        }
      }
    }

    const roots = [];
    for (let id in skills) {
      if (!childSet.has(id)) roots.push(skills[id]);
    }
    if (roots.length === 1) {
      this.skillTree = roots[0];
    } else {
      this.skillTree = {
        id: "root",
        name: "",
        children: roots,
        isSynthetic: true,
      };
    }

    this.skillEmployeeMap.clear();
    const subjectElements = this.xmlData.getElementsByTagName("subject");
    for (let i = 0; i < subjectElements.length; i++) {
      const subj = subjectElements[i];
      let match = false;
      const relationElements = subj.getElementsByTagName("relation");
      for (let j = 0; j < relationElements.length; j++) {
        const rel = relationElements[j];
        if (
          (this.filterType === "unit" &&
            rel.getAttribute("unit") === this.filterId) ||
          (this.filterType === "role" &&
            rel.getAttribute("role") === this.filterId)
        ) {
          match = true;
          break;
        }
      }
      if (match) {
        const subjectSkills = subj.getElementsByTagName("subjectSkills");
        for (let k = 0; k < subjectSkills.length; k++) {
          const ss = subjectSkills[k];
          const skillRefs = ss.getElementsByTagName("skillRef");
          for (let l = 0; l < skillRefs.length; l++) {
            const ref = skillRefs[l];
            const skillRefId = ref.getAttribute("id");
            const count = this.skillEmployeeMap.get(skillRefId) || 0;
            this.skillEmployeeMap.set(skillRefId, count + 1);
            if (count + 1 > this.maxEmployeeCount) {
              this.maxEmployeeCount = count + 1;
            }
          }
        }
      }
    }
  }
  filterTreeBySkill() {
    const skillElements = this.xmlData.getElementsByTagName("skill");
    const graph = {};
    for (let i = 0; i < skillElements.length; i++) {
      const elem = skillElements[i];
      const id = elem.getAttribute("id");
      if (!id) continue;
      if (!graph[id] && id == this.skillId) {
        graph[id] = new Set();
      }

    
      if (id != this.skillId) continue;
      const relElements = elem.getElementsByTagName("relation");
      for (let j = 0; j < relElements.length; j++) {
        const relElem = relElements[j];
        const targetId = relElem.getAttribute("id");
        if (targetId) {
          if (!graph[id]) graph[id] = new Set();
          if (!graph[targetId]) graph[targetId] = new Set();
          graph[id].add(targetId);
          graph[targetId].add(id);
        }
      }
      
    }

    const visited = new Set();
    const queue = [];
    const spanningTree = { id: this.skillId, name: this.skillId, children: [] };
    const treeNodes = {};
    treeNodes[this.skillId] = spanningTree;
    visited.add(this.skillId);
    queue.push(this.skillId);

    while (queue.length > 0) {
      const currentId = queue.shift();
      const neighbors = graph[currentId] || [];
      neighbors.forEach((neighborId) => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          const treeNode = { id: neighborId, name: neighborId, children: [] };
          treeNodes[neighborId] = treeNode;
          treeNodes[currentId].children.push(treeNode);
          queue.push(neighborId);
        }
      });
    }

    this.skillTree = spanningTree;
    setTimeout(() => this.centerSVG(), 50);
  }

  computeLayout() {
    if (this.layoutType === "radial") {
      this.computeRadialLayout();
    } else {
      this.computeHierarchicalLayout();
    }
  }

  computeHierarchicalLayout() {
    let nextX = 50;
    const horizontalSpacing = 160;
    const verticalSpacing = 160;
    function layout(node, depth) {
      node.y = depth * verticalSpacing;
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => layout(child, depth + 1));
        let first = node.children[0].x;
        let last = node.children[node.children.length - 1].x;
        node.x = (first + last) / 2;
      } else {
        node.x = nextX;
        nextX += horizontalSpacing;
      }
    }
    layout(this.skillTree, 0);
  }

  // New radial layout implementation
  computeRadialLayout() {
    // First, count nodes at each level to calculate proper spacing
    const levelCounts = {};

    // Helper function to traverse tree and count nodes at each level
    const countNodesAtLevels = (node, level = 0) => {
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      if (node.children) {
        node.children.forEach((child) => countNodesAtLevels(child, level + 1));
      }
    };

    countNodesAtLevels(this.skillTree);

    // Calculate center position - we'll use this for the root node
    // Base on SVG dimensions
    const svgRect = this.svg.getBoundingClientRect();
    const centerX = svgRect.width / 2;
    const centerY = svgRect.height / 2;

    // Radius for each level of the tree
    const baseRadius = Math.min(svgRect.width, svgRect.height) * 0.15;

    // Position nodes in a radial layout
    const positionNodesRadially = (node, level = 0, angle = 0, arc = 2 * Math.PI) => {

      if (level === 0) {
        // Root node at center
        node.x = centerX;
        node.y = centerY;
      } else {
        // Calculate position based on level, angle, and parent position
        const radius = baseRadius * (level * 1.8 + 1);
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      }

      if (node.children && node.children.length > 0) {
        const childCount = node.children.length;
        const childArc = arc / childCount;

        let startAngle = angle - arc / 2 + childArc / 2;

        node.children.forEach((child, index) => {
          const childAngle = startAngle + index * childArc;
          positionNodesRadially(child, level + 1, childAngle, childArc);
        });
      }
    };

    positionNodesRadially(this.skillTree);
  }

  // --- Rendering ---

  renderTree() {
    while (this.svgContent.firstChild) {
      this.svgContent.removeChild(this.svgContent.firstChild);
    }
    this.particleCtx.clearRect(
      0,
      0,
      this.particleCanvas.width,
      this.particleCanvas.height
    );

    // Collect nodes via a simple tree traversal.
    const nodes = [];
    function traverse(node) {
      nodes.push(node);
      if (node.children) node.children.forEach((child) => traverse(child));
    }
    traverse(this.skillTree);

    // Set parent pointers.
    function setParents(node, parent) {
      node.parent = parent;
      if (node.children)
        node.children.forEach((child) => setParents(child, node));
    }
    setParents(this.skillTree, null);

    // Draw nodes with enhanced styling and add click handlers
    nodes.forEach((node) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "node");
      group.setAttribute("transform", `translate(${node.x}, ${node.y})`);

      // Add data attributes for entity type and skill ID
      group.setAttribute("data-skill-id", node.id || "");
      group.setAttribute("data-entity-type", this.filterType || "");

      // Add click handler for nodes
      group.addEventListener("click", (event) => {
        // Prevent event bubbling

        console.log("Node clicked:", {
          id: node.id,
          name: node.name,
          entityType: this.filterType,
          employeeCount: this.skillEmployeeMap.get(node.id) || 0,
          hasChildren: node.children && node.children.length > 0,
          childrenCount: node.children ? node.children.length : 0,
        });
      });

      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      const baseRadius = 15;
      const count = this.skillEmployeeMap.get(node.id) || 0;
      const maxRadius = 45;
      const radius = count === 0 ? baseRadius : 
        baseRadius + (count / this.maxEmployeeCount) * (maxRadius - baseRadius);

      // Store current node ID for color lookup
      this.currentSkillId = node.id;
      const color = node.id
        ? getSkillIdColor(node.id)
        : this.getSkillColor(count);

      circle.setAttribute("r", radius);
      circle.setAttribute("fill", color);
      circle.setAttribute("stroke", "#ffffff");
      circle.setAttribute("stroke-width", "1.5");
      group.appendChild(circle);

      // Add count text inside the node instead of outside
      if (count > 0) {
        const countText = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );
        countText.setAttribute("x", 0);
        countText.setAttribute("y", 5);
        countText.setAttribute("text-anchor", "middle");
        countText.setAttribute("font-size", Math.min(radius * 0.8, 16));
        countText.setAttribute("fill", "#ffffff");
        countText.setAttribute("font-weight", "bold");
        countText.textContent = count;
        group.appendChild(countText);
      }

      // Node name only - no employee count outside
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      text.setAttribute("x", radius + 8);
      text.setAttribute("y", 4);
      text.setAttribute("class", "node-label");
      text.textContent = node.name;
      group.appendChild(text);

      group.addEventListener("mouseover", (e) => {
        const count = this.skillEmployeeMap.get(node.id) || 0;
        const relationships = this.relationships.filter(
          (r) => r.from === node.id || r.to === node.id
        );

        this.tooltip.innerHTML = `
          <div class="tooltip-title">${node.name}</div>
          <div class="tooltip-content">
            <div>Employees: ${count}</div>
            ${
              relationships.length
                ? `<div>Connections: ${relationships.length}</div>`
                : ""
            }
          </div>
        `;

        this.tooltip.style.display = "block";
        const rect = group.getBoundingClientRect();
        this.tooltip.style.left = `${rect.left + 20}px`;
        this.tooltip.style.top = `${rect.top + 20}px`;
      });

      group.addEventListener("mouseleave", () => {
        this.tooltip.style.display = "none";
      });
      this.svgContent.appendChild(group);
    });

    this.relationships.forEach((rel) => {
      const fromNode = nodes.find((n) => n.id === rel.from);
      const toNode = nodes.find((n) => n.id === rel.to);
      if (!fromNode || !toNode) return;

      const start = { x: fromNode.x, y: fromNode.y };
      const end = { x: toNode.x, y: toNode.y };

      const distance = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );
      const offsetRatio = Math.min(0.5, 50 / distance);
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const nx = -dy; // Perpendicular vector
      const ny = dx;
      const normFactor = Math.sqrt(nx * nx + ny * ny) || 1;

      const controlX = midX + (nx / normFactor) * distance * offsetRatio;
      const controlY = midY + (ny / normFactor) * distance * offsetRatio;

      // Create invisible but wider clickable path
      const clickablePath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      const d = `M ${start.x} ${start.y} Q ${controlX} ${controlY}, ${end.x} ${end.y}`;
      clickablePath.setAttribute("d", d);
      clickablePath.setAttribute("stroke-width", "10"); // Much wider for easier clicking
      clickablePath.setAttribute("stroke", "transparent");
      clickablePath.setAttribute("fill", "none");
      clickablePath.setAttribute("data-relation-from", rel.from);
      clickablePath.setAttribute("data-relation-to", rel.to);
      clickablePath.setAttribute("data-relation-type", rel.type);
      clickablePath.setAttribute("data-relation-score", rel.score);
      clickablePath.classList.add("clickable-relation");

      // Add hover effect styles
      clickablePath.style.cursor = "pointer";
      clickablePath.style.transition = "stroke-opacity 0.3s ease";

      // Add hover events to show relationship
      clickablePath.addEventListener("mouseover", (event) => {
        clickablePath.setAttribute(
          "stroke",
          this.getRelationshipColor(rel.type)
        );
        clickablePath.setAttribute("stroke-opacity", "0.4");

        // Show tooltip with relationship details
        this.tooltip.innerHTML = `
          <div class="tooltip-title">Relationship</div>
          <div class="tooltip-content">
            <div>From: ${rel.from}</div>
            <div>To: ${rel.to}</div>
            <div>Type: ${rel.type}</div>
            <div>Strength: ${rel.score}</div>
          </div>
        `;

        this.tooltip.style.display = "block";
        
        // Fix positioning calculation - use mouse coordinates instead of path bounds
        const containerRect = this.el.getBoundingClientRect();
        this.tooltip.style.left = `${event.clientX - containerRect.left + 10}px`;
        this.tooltip.style.top = `${event.clientY - containerRect.top - 40}px`;
      });

      clickablePath.addEventListener("mouseleave", () => {
        clickablePath.setAttribute("stroke-opacity", "0");
        this.tooltip.style.display = "none";
      });

      // Add click handler for the path
      clickablePath.addEventListener("click", (event) => {

        console.log("Relationship clicked:", {
          from: rel.from,
          to: rel.to,
          type: rel.type,
          score: rel.score,
        });

        // Temporary visual indication that the relationship was clicked
        clickablePath.setAttribute(
          "stroke",
          this.getRelationshipColor(rel.type)
        );
        clickablePath.setAttribute("stroke-opacity", "0.8");
        clickablePath.setAttribute("stroke-width", "10");

        // Reset after animation
        setTimeout(() => {
          clickablePath.setAttribute("stroke-opacity", "0");
          clickablePath.setAttribute("stroke-width", "1");
        }, 500);
      });

      // Add the clickable path to the SVG
      this.svgContent.appendChild(clickablePath);

      // Now add the regular path for appearance
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", d);
      path.setAttribute("stroke", "transparent"); // Make completely invisible
      path.setAttribute("stroke-width", "0");
      path.setAttribute("fill", "none");
      path.classList.add("relationship-line");
      this.svgContent.appendChild(path);
    });

    // Apply pan/zoom transform
    this.applyTransform();
  }

  // Apply current transform.
  applyTransform() {
    this.svgContent.setAttribute(
      "transform",
      `translate(${this.transform.x}, ${this.transform.y}) scale(${this.transform.scale})`
    );
  }

  centerSVG() {
    const svgRect = this.svg.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;

    if (!this.skillTree || !this.svgContent) return;

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    // Collect all nodes for bounding box calculation
    const nodes = [];
    const traverseForBounds = (node) => {
      if (node) {
        nodes.push(node);
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);

        if (node.children) {
          node.children.forEach(traverseForBounds);
        }
      }
    };

    traverseForBounds(this.skillTree);

    // Add padding
    const padding = 100;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    // Calculate required scale to fit entire graph
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const scaleX = svgWidth / graphWidth;
    const scaleY = svgHeight / graphHeight;

    // Use the smaller scale to ensure the entire graph fits
    const fitScale = Math.min(scaleX, scaleY, 1); // Cap at 1 to prevent excessive zooming out

    // Calculate center point of the graph
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Set transform to center the graph and apply the scale
    this.transform.scale = fitScale;
    this.transform.x = svgWidth / 2 - centerX * fitScale;
    this.transform.y = svgHeight / 2 - centerY * fitScale;

    this.applyTransform();

  }

  // Re-render with improved centering
  render() {
    // Check if container exists and is a DOM element
    if (!this.container) {
      console.error("Container is undefined");
      return;
    }

    if (typeof this.container.appendChild !== "function") {
      console.error("Container is not a valid DOM element:", this.container);
      // Try to fix by getting element by ID or selector if it's a string
      if (typeof this.container === "string") {
        this.container =
          document.querySelector(this.container) ||
          document.getElementById(this.container);
        if (!this.container) {
          console.error(
            "Could not find element with selector:",
            this.container
          );
          return;
        }
      } else {
        return; // Cannot proceed without valid container
      }
    }

    this.particleCanvas.width = this.container.clientWidth;
    this.particleCanvas.height = this.container.clientHeight; // Full height instead of half

    if (!this.el.parentNode) {
      this.container.appendChild(this.el);
    }

    this.computeLayout();
    this.renderTree();
    setTimeout(() => this.centerSVG(), 100);
  }
  // --- Navigation (Pan & Zoom) ---

  setupNavigation() {
    // Flag to track if drag just happened (to prevent click events)
    this.wasDragging = false;

    // Mouse events for panning.
    this.svg.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.isDragging = true;
        this.lastMousePosition = { x: event.clientX, y: event.clientY };
        this.svg.style.cursor = "grabbing";
        event.preventDefault();
      }
    });

    document.addEventListener("mousemove", (event) => {
      if (this.isDragging) {
        const dx = event.clientX - this.lastMousePosition.x;
        const dy = event.clientY - this.lastMousePosition.y;
        this.transform.x += dx;
        this.transform.y += dy;
        this.lastMousePosition = { x: event.clientX, y: event.clientY };
        this.applyTransform();
        // Set flag to indicate dragging occurred
        this.wasDragging = true;
        event.preventDefault();
      }
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.svg.style.cursor = "grab";

        // Keep the wasDragging flag true for a short time to cancel the next click
        setTimeout(() => {
          this.wasDragging = false;
        }, 100);
      }
    });

    // Mouse wheel for zooming.
    this.svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const svgRect = this.svg.getBoundingClientRect();
      const mouseX = event.clientX - svgRect.left;
      const mouseY = event.clientY - svgRect.top;
      const zoomDirection = event.deltaY < 0 ? 1 : -1;
      const zoomFactor = 0.1;
      const newScale = this.transform.scale * (1 + zoomDirection * zoomFactor);
      if (newScale > 0.1 && newScale < 10) {
        const scaleChange = newScale / this.transform.scale;
        this.transform.x = mouseX - (mouseX - this.transform.x) * scaleChange;
        this.transform.y = mouseY - (mouseY - this.transform.y) * scaleChange;
        this.transform.scale = newScale;
        this.applyTransform();
      }
    });

    // Touch events for mobile devices.
    this.svg.addEventListener("touchstart", (event) => {
      if (event.touches.length === 1) {
        this.isDragging = true;
        this.lastMousePosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
        event.preventDefault();
      }
    });

    document.addEventListener("touchmove", (event) => {
      if (this.isDragging && event.touches.length === 1) {
        const dx = event.touches[0].clientX - this.lastMousePosition.x;
        const dy = event.touches[0].clientY - this.lastMousePosition.y;
        this.transform.x += dx;
        this.transform.y += dy;
        this.lastMousePosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
        this.applyTransform();
        event.preventDefault();
      }
    });

    document.addEventListener("touchend", () => {
      this.isDragging = false;
    });

    this.svg.style.cursor = "grab";
  }

  // --- Particle Animation ---

  // Enhanced curved particle along a quadratic bezier curve
  CurvedParticle(
    start,
    end,
    control,
    progress,
    thickness,
    speed,
    score,
    relType,
    getTransform
  ) {
    return {
      progress: progress,
      fadeRate: 0.97,
      thickness: thickness * 0.001,
      speed: speed * 0.05,
      alpha: 0.75,
      curve: { start, end, control },
      size: this.particleBaseSize + Math.min(score, 6) * 0.1,
      relType: relType,
      score: score, // Store the score directly
      getTransform: getTransform,
      relationDetails: {
        type: relType,
        intensity: score,
        speed: speed,
      },
      update(dt, isDragging) {
        this.progress = (this.progress + this.speed * dt) % 1;
        this.alpha *= this.fadeRate;
        if (isDragging) this.alpha *= 0.85;
        // Remove size pulsing for more consistent small particles
        this.size = 1 + Math.min(score, 6) * 0.15;
      },
      getPosition() {
        const t = this.progress;
        const xOriginal =
          (1 - t) ** 2 * this.curve.start.x +
          2 * (1 - t) * t * this.curve.control.x +
          t ** 2 * this.curve.end.x;
        const yOriginal =
          (1 - t) ** 2 * this.curve.start.y +
          2 * (1 - t) * t * this.curve.control.y +
          t ** 2 * this.curve.end.y;
        const transform = this.getTransform();
        return {
          x: xOriginal * transform.scale + transform.x,
          y: yOriginal * transform.scale + transform.y,
        };
      },
    };
  }

  animateParticles(timestamp) {
    if (!this.lastParticleTime) this.lastParticleTime = timestamp;
    const dt = Math.min(timestamp - this.lastParticleTime, 100); // Cap dt to prevent huge jumps
    this.lastParticleTime = timestamp;

    this.particleCtx.clearRect(
      0,
      0,
      this.particleCanvas.width,
      this.particleCanvas.height
    );

    this.activeParticles = [];

    if (!this.isDragging && this.particles.length < this.particleLimit) {
      this.relationships.forEach((rel) => {
        const fromNode = this.findNodeById(this.skillTree, rel.from);
        const toNode = this.findNodeById(this.skillTree, rel.to);
        if (!fromNode || !toNode) return;

        const start = { x: fromNode.x, y: fromNode.y };
        const end = { x: toNode.x, y: toNode.y };

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const offsetRatio = Math.min(0.5, 50 / distance);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        const nx = -dy,
          ny = dx;
        const normFactor = Math.sqrt(nx * nx + ny * ny) || 1;
        const controlX =
          midX +
          (nx / normFactor) * distance * offsetRatio +
          (Math.random() - 0.5) * 10;
        const controlY =
          midY +
          (ny / normFactor) * distance * offsetRatio +
          (Math.random() - 0.5) * 10;

        const control = { x: controlX, y: controlY };

        if (Math.random() < this.particleSpawnRate * (rel.score / 10)) {
          const particle = this.CurvedParticle(
            start,
            end,
            control,
            Math.random(),
            rel.score,
            rel.speed * (0.5 + Math.random()),
            rel.score,
            rel.type,
            () => ({
              scale: this.transform.scale,
              x: this.transform.x,
              y: this.transform.y,
            })
          );

          // Add more detailed relation attributes
          particle.fromId = rel.from;
          particle.toId = rel.to;
          particle.relationData = {
            fromSkill: rel.from,
            toSkill: rel.to,
            type: rel.type,
            score: rel.score,
            speed: rel.speed,
          };

          this.particles.push(particle);
        }
      });
    }

    // Update and draw particles with simpler rendering
    this.particles = this.particles.filter((p) => {
      p.update(dt, this.isDragging);
      const pos = p.getPosition();

      // Skip drawing particles that are offscreen
      if (
        pos.x < 0 ||
        pos.y < 0 ||
        pos.x > this.particleCanvas.width ||
        pos.y > this.particleCanvas.height
      ) {
        return p.alpha > 0.1;
      }

      // Add to active particles for click detection if visible enough
      if (p.alpha > 0.2) {
        // Store the current position with the particle for click detection
        p.currentPos = pos;
        this.activeParticles.push(p);
      }

      // Extract color components for proper alpha blending
      const baseColor = this.getRelationshipColor(p.relType);
      const colorMatch = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const [r, g, b] = colorMatch
        ? colorMatch.slice(1, 4).map(Number)
        : [100, 149, 237];

      // Use direct fill style without gradient for smaller particles
      this.particleCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
      this.particleCtx.beginPath();
      this.particleCtx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
      this.particleCtx.fill();
      if (window.detailedView) {
        this.particleCtx.save();
        this.particleCtx.fillStyle = "white";
        this.particleCtx.font = "8px Arial";
        this.particleCtx.fillText(
          `${p.relType}:${p.score.toFixed(1)}`,
          pos.x + 5,
          pos.y - 5
        );
        this.particleCtx.restore();
      }

      return p.alpha > 0.05;
    });

    requestAnimationFrame(this.animateParticles.bind(this));
  }

  // Helper: find a node by id.
  findNodeById(node, id) {
    if (node.id === id) return node;
    if (node.children) {
      for (let child of node.children) {
        const found = this.findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  }

  // Add a public method to manually center the view if needed
  resetView() {
    this.centerSVG();
  }

  // Add method to handle canvas clicks - improved version
  setupCanvasClickHandler() {
    this.particleCanvas.addEventListener("click", (event) => {
      // Skip if this was part of a drag operation
      if (this.wasDragging) {
        return;
      }

      // Calculate click position relative to canvas
      const rect = this.particleCanvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      console.log(
        `Canvas clicked at (${clickX}, ${clickY}), checking ${this.activeParticles.length} particles`
      );

      // Check if any particle was clicked (within a small radius)
      let clickedParticle = null;
      const clickRadius = 15; // Increased detection radius in pixels

      // Find the closest particle to the click position
      let closestDistance = Infinity;

      for (let particle of this.activeParticles) {
        // Use the stored current position
        const pos = particle.currentPos;
        if (!pos) continue;

        const dx = clickX - pos.x;
        const dy = clickY - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Keep track of the closest particle within detection radius
        if (distance <= clickRadius && distance < closestDistance) {
          closestDistance = distance;
          clickedParticle = particle;
        }
      }

      // Log if a particle was clicked
      if (clickedParticle) {
        console.log("Particle clicked:", {
          fromSkill: clickedParticle.fromId,
          toSkill: clickedParticle.toId,
          relationType: clickedParticle.relType,
          score: clickedParticle.score,
          relationDetails: clickedParticle.relationData,
        });

        clickedParticle.size *= 2;
        clickedParticle.alpha = 1.0;
      } else {
        console.log("No particle detected at this position");
      }
    });
  }
}

// Add a global function to switch layouts
window.switchSkillTreeLayout = function (layoutType) {
  if (window.treeComponent) {
    window.treeComponent.layoutType = layoutType || "radial";
    window.treeComponent.render();
    console.log(
      `Switched skill tree to ${window.treeComponent.layoutType} layout`
    );
  }
};