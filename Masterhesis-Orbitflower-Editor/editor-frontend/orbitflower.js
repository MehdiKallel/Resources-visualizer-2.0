var doc = null;

// OrbitFlower class definition to work with index.html initialization
class OrbitFlower {
  constructor(svgElement) {
    this.svgElement = svgElement;
    this.doc = null;
    this.initialized = false;
    console.log("OrbitFlower instance created with SVG element:", svgElement);

    // Set initial size for SVG element
    if (this.svgElement && this.svgElement.length) {
      this.svgElement.attr({
        width: "100%",
        height: "100%",
        preserveAspectRatio: "xMidYMid meet",
        id: "main-svg",
      });
    }
  }

  show(orgModel) {
    console.log("OrbitFlower.show() called with model:", orgModel);
    if (
      orgModel &&
      (orgModel.documentElement ||
        (typeof orgModel === "string" && orgModel.indexOf("<?xml") !== -1))
    ) {
      this.doc =
        typeof orgModel === "string"
          ? new DOMParser().parseFromString(orgModel, "application/xml")
          : orgModel;
      this.renderOrganisationGraph(this.doc);
      return;
    }
  }

  addCenteredContainer(svgWidth, svgHeight) {
    const ns = "http://www.w3.org/2000/svg";
    const container = document.createElementNS(ns, "g");
    container.setAttribute("id", "centered-container");
    container.setAttribute(
      "transform",
      `translate(${svgWidth / 2}, ${svgHeight / 2})`
    );
    container.style.display = "none";

    // Background rectangle
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("width", "600");
    rect.setAttribute("height", "400");
    rect.setAttribute("x", "-300"); // Center horizontally
    rect.setAttribute("y", "-200"); // Center vertically
    rect.setAttribute("rx", "10");
    rect.setAttribute("fill", "white");
    rect.setAttribute("stroke", "#666");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("filter", "url(#drop-shadow)");

    // Close button
    const closeBtn = document.createElementNS(ns, "text");
    closeBtn.setAttribute("x", "280");
    closeBtn.setAttribute("y", "-180");
    closeBtn.setAttribute("class", "close-button");
    closeBtn.textContent = "×";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", () => this.hideCenteredContainer());

    // Add shadow filter definition
    const defs = document.createElementNS(ns, "defs");
    const filter = `<filter id="drop-shadow" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/> 
      <feOffset dx="2" dy="2" result="offsetblur"/>
      <feMerge> 
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/> 
      </feMerge>
    </filter>`;
    defs.innerHTML = filter;

    container.appendChild(defs);
    container.appendChild(rect);
    container.appendChild(closeBtn);

    // Add to main SVG
    const mainSVG = this.svgElement[0];
    mainSVG.appendChild(container);
  }
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
      font-size: 15px;
      color: #333333;
      cursor: pointer;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    // Add click handler with proper binding
    backButton.addEventListener("click", () => window.location.reload());

    // Append to graph column parent container for proper positioning
    graphColumn.style.position = "relative"; // Ensure relative positioning for absolute child
    graphColumn.appendChild(backButton);
    return backButton;
  }

  showCenteredContainer() {
    const container = this.svgElement.find("#centered-container");
    container.style.display = "inline";
  }

  hideCenteredContainer() {
    const container = this.svgElement.find("#centered-container");
    container.style.display = "none";
    container.style.cursor = "default"; // Reset cursor style
    container.innerHTML = ""; // Clear previous content
  }

  renderOrganisationGraph(doc) {
    const gw = new GraphWorker(
      doc,
      "/o:organisation/o:units/o:unit|/o:organisation/o:roles/o:role",
      "/o:organisation/o:subjects/o:subject",
      {
        radius: 8,
        angle: 0,
        text_x: 0,
        text_y: 0,
        text_cls: null,
        shortid: "",
      }
    );

    gw.rank_long();

    let textgap = 8;
    let circumference = 0;
    let maxnoderadius = 0;
    let maxtextwidth = 0;
    const maxradius = 80.0;
    const orbitgap = 5;
    const nodegap = 30;
    const lineheight = 10 + textgap;
    let maxwidth = 0;
    let maxheight = 0;
    let unodes = 0;
    let rnodes = 0;

    gw.nodes.forEach((n) => {
      if (n.type === "unit") {
        unodes += 1;
        n.shortid = `u${unodes}`;
      } else if (n.type === "role") {
        rnodes += 1;
        n.shortid = `r${rnodes}`;
      }

      if (n.numsubjects > 0 && gw.maxsubjects > 0) {
        n.radius = n.radius + n.numsubjects * (maxradius / gw.maxsubjects);
      }

      circumference += n.radius * 2 + nodegap;
      if (maxnoderadius < n.radius) {
        maxnoderadius = n.radius;
      }
      if (maxtextwidth < n.twidth) {
        maxtextwidth = n.twidth;
      }
    });

    const radius = circumference / 2 / Math.PI;

    let asum = 0;
    gw.nodes.forEach((n) => {
      const nodediameter = n.radius * 2 + nodegap;
      const halfShareOfCircle =
        (360 * (nodediameter / (circumference / 100.0) / 100.0)) / 2;
      n.angle = asum + halfShareOfCircle;
      asum = n.angle + halfShareOfCircle;
    });

    let orbits = [];
    let ucount = 2;
    let rcount = 2;
    let oid = 0;

    gw.nodes.forEach((n) => {
      n.parents.forEach((p) => {
        const sortedAngles = [n.angle, p.angle].sort((a, b) => b - a);
        const a1 = sortedAngles[0];
        const a2 = sortedAngles[1];

        const idxN = gw.nodes.indexOf(n);
        const idxP = gw.nodes.indexOf(p);
        const orb = idxP > idxN ? idxP - idxN : idxN - idxP;

        oid += 1;
        orbits.push([orb, a1, a2, n.type, null, oid, p.shortid, n.shortid]);
      });
    });

    orbits.sort((a, b) => a[0] - b[0]);

    orbits.forEach((o) => {
      if (o[0] === 1) {
        o[4] = maxnoderadius + orbitgap;
      } else if (o[0] > 1 && o[3] === "unit") {
        o[4] = maxnoderadius + ucount * orbitgap;
        ucount += 1;
      } else if (o[0] > 1 && o[3] === "role") {
        o[4] = maxnoderadius + rcount * orbitgap;
        rcount += 1;
      }
    });

    let center_x =
      radius + maxnoderadius + Math.max(rcount * orbitgap, ucount * orbitgap);
    let center_y =
      radius + maxnoderadius + Math.max(rcount * orbitgap, ucount * orbitgap);

    let shiftx = 0;
    let shifty = 0;

    gw.nodes.forEach((n) => {
      const [tx, ty] = SVG.circle_point(
        center_x,
        center_y,
        radius + n.radius,
        n.angle
      );
      n.text_x = tx;
      n.text_y = ty;

      if (n.angle >= 0 && n.angle < 45) {
        n.text_cls = "right";
        n.text_x += textgap;
        n.text_y += textgap;
      } else if (n.angle >= 45 && n.angle < 90) {
        n.text_cls = "right";
        n.text_x += textgap;
        n.text_y -= textgap;
      } else if (n.angle >= 90 && n.angle < 135) {
        n.text_cls = "left";
        n.text_x -= textgap;
        n.text_y -= textgap;
      } else if (n.angle >= 135 && n.angle < 180) {
        n.text_cls = "left";
        n.text_x -= textgap;
        n.text_y += textgap;
      } else if (n.angle >= 180 && n.angle < 225) {
        n.text_cls = "left";
        n.text_x -= textgap;
        n.text_y += n.theight / 2;
      } else if (n.angle >= 225 && n.angle < 270) {
        n.text_cls = "left";
        n.text_x -= textgap;
        n.text_y += n.theight;
      } else if (n.angle >= 270 && n.angle < 315) {
        n.text_cls = "right";
        n.text_x += textgap;
        n.text_y += n.theight;
      } else if (n.angle >= 315 && n.angle < 360) {
        n.text_cls = "right";
        n.text_x += textgap;
        n.text_y += n.theight / 2;
      }

      if (
        n.text_x - n.twidth < orbitgap &&
        orbitgap - (n.text_x - n.twidth) > shiftx
      ) {
        shiftx = orbitgap - (n.text_x - n.twidth);
      }
      if (
        n.text_y - n.theight < orbitgap &&
        orbitgap - (n.text_y - n.theight) > shifty
      ) {
        shiftx = orbitgap - (n.text_y - n.theight);
      }
    });

    gw.nodes.forEach((n) => {
      n.text_x += shiftx;
      n.text_y += shifty;
      if (maxwidth < n.text_x + n.twidth) {
        maxwidth = n.text_x + n.twidth;
      }
    });
    center_x += shiftx;
    center_y += shifty;

    let last_y = center_y + lineheight;
    let last_y_height = lineheight;
    gw.nodes.forEach((n) => {
      if (n.angle >= 0 && n.angle < 90) {
        if (n.text_y > last_y - last_y_height - textgap) {
          n.text_y = last_y - last_y_height - textgap;
        }
      }
      if (n.angle >= 180 && n.angle < 270) {
        if (n.text_y - n.theight - textgap < last_y) {
          n.text_y = last_y + textgap;
        }
      }
      last_y = n.text_y;
      last_y_height = n.theight;
    });

    last_y = center_y - lineheight;
    last_y_height = lineheight;
    gw.nodes
      .slice()
      .reverse()
      .forEach((n) => {
        if ((n.angle >= 270 && n.angle < 360) || n.angle === 0) {
          if (n.text_y - n.theight - textgap < last_y) {
            n.text_y = last_y + textgap;
          }
        }
        if (n.angle >= 90 && n.angle < 180) {
          if (n.text_y > last_y - last_y_height - textgap) {
            n.text_y = last_y - last_y_height - textgap;
          }
        }
        last_y = n.text_y;
        last_y_height = n.theight;
      });

    const s = new SVG();

    let orbitSkills = {};

    gw.subjects.forEach((subject) => {
      subject.relations.forEach((r) => {
        const orbitKey = `${r.unit.shortid}--${r.role.shortid}`;
        if (!orbitSkills[orbitKey]) {
          orbitSkills[orbitKey] = {};
        }
        (subject.skillRefs || []).forEach((skillId) => {
          if (!orbitSkills[orbitKey][skillId]) {
            orbitSkills[orbitKey][skillId] = 0;
          }
          orbitSkills[orbitKey][skillId]++;
        });
      });
    });

    orbits.forEach((o) => {
      const [mx, my] = SVG.circle_point(center_x, center_y, radius + o[4], 0);
      if (maxwidth < mx) {
        maxwidth = mx;
      }

      const orbitid = "o" + o[5].toString();
      const orbitrelation = "f" + o[6].toString() + " t" + o[7].toString();
      s.add_orbit(center_x, center_y, o[1], o[2], radius, o[4], {
        class: o[3].toString() + " connect " + orbitrelation,
        id: orbitid,
      });

      if (maxheight < my + radius + o[4] + 2 * orbitgap) {
        maxheight = my + radius + o[4] + 2 * orbitgap;
      }

      const orbitKey = `${o[6]}--${o[7]}`; // Using the from-to IDs
      const skills = orbitSkills[orbitKey] || {};

      const midAngle = (o[1] + o[2]) / 2;
      const orbitRadius = o[4];

      Object.entries(skills).forEach(([skillId, count], index) => {
        const angleOffset = (index - (Object.keys(skills).length - 1) / 2) * 5;
        const angle = midAngle + angleOffset;
        const [sx, sy] = SVG.circle_point(
          center_x,
          center_y,
          radius + orbitRadius,
          angle
        );

        s.add_group(
          `skill-${orbitKey}-${skillId}`,
          {
            class: "skill-indicator",
            style: "opacity: 0; transition: opacity 0.3s;",
            "data-orbit": orbitKey,
          },
          () => {
            s.add_path(
              `M ${sx - 5} ${sy} L ${sx} ${sy - 5} L ${sx + 5} ${sy} L ${sx} ${
                sy + 5
              } Z`,
              {
                class: "skill-shape",
                fill: "#4e9a06",
                stroke: "#73d216",
                "stroke-width": "1.5",
              }
            );
            s.add_text(
              sx,
              sy + 15,
              {
                class: "skill-count",
                style: "text-anchor: middle; font-size: 8px;",
              },
              () => `${skillId}: ${count}`
            );
          }
        );
      });
    });

    let subjectintensity = {};
    let maxsubjectintensity = 0;
    let subjects = [];

    gw.subjects
      .sort((a, b) => {
        if (a.shortid < b.shortid) return -1;
        if (a.shortid > b.shortid) return 1;
        return 0;
      })
      .forEach((u) => {
        const subjectheadradius = 2.0;
        const si = new SVG();
        si.add_subject_icon(4, 1, "subjecticon", subjectheadradius);

        const svgMarkup = si.dump(12, 12);

        subjects.push(`
          <table class="subject" id="${u.id}" data-uid="${u.uid}" data-subject-id="${u.shortid}" onmouseover="s_relationstoggle(this)" onmouseout="s_relationstoggle(this)" onclick="openSubjectEditor('${u.uid}')" style="margin-bottom: 5px;">
              <tbody>
              <tr>
                  <td>${svgMarkup}</td>
                  <td class="labeltext">${u.shortid}</td>
              </tr>
              </tbody>
          </table>
      `);

        u.relations.forEach((r) => {
          const [x1, y1] = SVG.circle_point(
            center_x,
            center_y,
            radius,
            r.unit.angle
          );
          const [x2, y2] = SVG.circle_point(
            center_x,
            center_y,
            radius,
            r.role.angle
          );

          const key = `${r.unit.shortid}--${r.role.shortid}`;
          if (!subjectintensity[key]) {
            subjectintensity[key] = [
              0,
              [r.unit.shortid, r.role.shortid],
              x1,
              y1,
              x2,
              y2,
            ];
          }
          subjectintensity[key][0] += 1; // increment intensity
          subjectintensity[key][1].push(u.id); // add the subject's ID
          if (subjectintensity[key][0] > maxsubjectintensity) {
            maxsubjectintensity = subjectintensity[key][0];
          }
        });
      });

    Object.entries(subjectintensity).forEach(([key, ui]) => {
      const count = ui[0];
      const arr = ui[1];
      const x1 = ui[2],
        y1 = ui[3],
        x2 = ui[4],
        y2 = ui[5];

      const opacity = (2.9 / maxsubjectintensity) * count + 0.5;
      s.add_path(`M ${x1} ${y1} Q ${center_x} ${center_y} ${x2} ${y2}`, {
        class: `relation ${arr.join(" ")}`,
        style: `stroke-width: ${opacity};`,
      });

      // Dynamically add necessary styles for current relations
      if (document.getElementById(`relation-${arr.join("-")}-style`)) {
        document.getElementById(`relation-${arr.join("-")}-style`).remove();
      }

      const styleEl = document.createElement("style");
      styleEl.id = `relation-${arr.join("-")}-style`;
      styleEl.textContent = `
        .relation.highlight.${arr.join(".")} {
          stroke-opacity: 1;
          stroke-width: 1;
          stroke: #a40000;
        }
      `;
      document.head.appendChild(styleEl);
    });

    gw.nodes.forEach((n) => {
      const [x, y] = SVG.circle_point(center_x, center_y, radius, n.angle);

      s.add_group(
        n.shortid,
        {
          class: n.type,
          onmouseover: "ur_relationstoggle(this)",
          onmouseout: "ur_relationstoggle(this)",
          // onclick: "ur_filtertoggle(this)",
        },
        () => {
          s.add_circle(x, y, n.radius, n.type);
          s.add_text(x, y, { cls: "subjecticon number" }, () => {
            if (maxheight < y + n.theight * 0.2) {
              maxheight = y + n.theight * 0.2;
            }
            const tspanNormal = s.add_tspan(
              { x, y: y + n.theight * 0.2, cls: "normal" },
              () => `${n.numsubjects}`
            );
            const tspanSpecial = s.add_tspan(
              { x, y: y + n.theight * 0.2, cls: "special inactive" },
              () => ""
            );
            return tspanNormal + tspanSpecial;
          });
        }
      );

      s.add_text(
        n.text_x,
        n.text_y,
        { cls: n.text_cls + " btext" },
        () => n.id
      );
      s.add_text(
        n.text_x,
        n.text_y,
        { cls: n.text_cls + " labeltext", id: n.shortid + "_text" },
        () => n.id
      );

      if (maxheight < n.text_y) {
        maxheight = n.text_y;
      }
      if (maxheight < y + n.radius) {
        maxheight = y + n.radius;
      }
    });

    const graphSvg =
      this.svgElement && this.svgElement.length
        ? this.svgElement
        : $("#graph svg");
    const usersSvg = document.querySelector("#users");

    if (graphSvg && graphSvg.length) {
      // Clear existing content
      graphSvg.empty();

      // Get SVG content and set dimensions
      const svgContent = s.dump(maxwidth, maxheight).trim();

      // Create a properly sized viewport
      graphSvg.attr({
        width: "100%",
        height: "100%",
        viewBox: `0 0 ${maxwidth} ${maxheight}`,
        preserveAspectRatio: "xMidYMid meet",
      });

      // Insert the content
      graphSvg.html(svgContent);
      // Add centered container directly to the SVG

      const svgRoot = graphSvg[0]; // the actual <svg> DOM node
      // Add this after creating circles:
      // === OUTER SCOPE (once per graph render) ===
      let dragging = null;
      let startPoint = { x: 0, y: 0 };

      // One pair of listeners, installed once:
      document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        console.log("Dragging circle:", dragging);
        const ghostBox = document.getElementById("circle-drag-ghost");
        if (ghostBox) {
          const offsetX = 15; 
          const offsetY = 15; 
          ghostBox.style.position = "fixed";
          ghostBox.style.left = `${e.clientX + offsetX}px`;
          ghostBox.style.top = `${e.clientY + offsetY}px`;
          ghostBox.style.pointerEvents = "none"; // prevent interference with other elements
          ghostBox.style.zIndex = "1000";
        }
      });

      // installed once, after your render
      document.addEventListener("mouseup", (e) => {
        if (!dragging) return;

        const ghostBox = document.getElementById("circle-drag-ghost");
        if (ghostBox) {
          // Add drop animation beforef removing
          ghostBox.parentNode.removeChild(ghostBox);
        }

        // clear the reference
        dragging = null;
      });

      svgRoot.querySelectorAll("circle").forEach((circle) => {
        circle.style.cursor = "pointer";
        const group = circle.parentNode;

        // Add tooltip on hover
        circle.addEventListener("mouseenter", (e) => {
          // Remove any existing tooltips first
          const existingTooltip = document.getElementById("circle-tooltip");
          if (existingTooltip) {
            existingTooltip.remove();
          }

          
          const tooltip = document.createElement("div");
          tooltip.id = "circle-tooltip";
          tooltip.textContent = "Double-click to explore skills";
          tooltip.style.left = `${e.clientX + 15}px`;
          tooltip.style.top = `${e.clientY - 25}px`;
          document.body.appendChild(tooltip);

          // Force reflow and add visible class
          tooltip.offsetHeight;
          tooltip.classList.add("visible");
        });

        circle.addEventListener("mouseleave", () => {
          const tooltip = document.getElementById("circle-tooltip");
          if (tooltip) {
            tooltip.classList.add("hiding");
            tooltip.addEventListener(
              "transitionend",
              () => {
                if (tooltip && tooltip.parentNode) {
                  tooltip.remove();
                }
              },
              { once: true }
            );
          }
        });

        // Add drag functionality
        let isDragging = false;
        let ghostBox = null;
        let startPoint = { x: 0, y: 0 };
        const DRAG_THRESH = 10;        let clickTimeout;
        let lastClickTime = 0;
        const doubleClickDelay = 300; // ms between clicks to count as double-click
        
        circle.addEventListener("pointerdown", startDrag);        function startDrag(e) {
          const currentTime = new Date().getTime();
          const timeDiff = currentTime - lastClickTime;
          
          if (timeDiff < doubleClickDelay) {
            // This is a double-click, don't start drag
            clearTimeout(clickTimeout);
            lastClickTime = 0;
            return;
          }
          
          lastClickTime = currentTime;
          startPoint.x = e.clientX;
          startPoint.y = e.clientY;
          
          const svg = circle.ownerSVGElement;
          svg.setPointerCapture(e.pointerId);
          
          // Add listeners immediately but don't create ghost box until actual drag occurs
          svg.addEventListener("pointermove", drag);
          svg.addEventListener("pointerup", stopDrag);
          svg.addEventListener("pointercancel", stopDrag);
        }

        function drag(e) {
          const dx = e.clientX - startPoint.x;
          const dy = e.clientY - startPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);          if (!isDragging && distance > DRAG_THRESH) {
            isDragging = true;

            // Remove any existing ghost boxes first
            const existingGhost = document.getElementById("circle-drag-ghost");
            if (existingGhost) {
              existingGhost.remove();
            }
            
            // Create ghost box
            ghostBox = document.createElement("div");
            ghostBox.id = "circle-drag-ghost";
            const nodeType = group.classList.contains("unit") ? "Unit" : "Role";
            
            // Fix text extraction by looking for text in the correct place
            const labelText = group.querySelector(".labeltext")?.textContent || 
                            document.querySelector(`#${group.id}_text`)?.textContent || 
                            "Unknown";
            
            Object.assign(ghostBox.style, {
              position: "fixed",
              padding: "8px 12px",
              backgroundColor: "#4a90e2",
              color: "#fff",
              borderRadius: "4px",
              fontFamily: "Arial, sans-serif",
              fontSize: "14px",
              fontWeight: "normal",
              pointerEvents: "none",
              zIndex: "9999",
              transform: "translate(-50%, -50%)",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              animation: "pulse 1s infinite"
            });
            
            ghostBox.textContent = `${nodeType}: ${labelText}`;
            document.body.appendChild(ghostBox);
            
            // Add dragging class to circle
            circle.classList.add("dragging");
          }

          if (isDragging && ghostBox) {
            // Remove animation, make positioning instant
            ghostBox.style.transition = 'none';
            ghostBox.style.left = `${e.clientX}px`;
            ghostBox.style.top = `${e.clientY}px`;

            // Check if we're over any expression block
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
                ghostBox.classList.add('over-expression');
              } else {
                block.classList.remove('block-drop-target');
              }
            });

            if (!isOverBlock) {
              ghostBox.classList.remove('over-expression');
            }
          }
        }

        function stopDrag(e) {
          const svg = circle.ownerSVGElement;
          svg.releasePointerCapture(e.pointerId);
          svg.removeEventListener("pointermove", drag);
          svg.removeEventListener("pointerup", stopDrag);
          svg.removeEventListener("pointercancel", stopDrag);          clearTimeout(clickTimeout);
          if (isDragging) {
            isDragging = false;
            
            if (ghostBox) {
              document.body.removeChild(ghostBox);
              ghostBox = null;
            }
            
            // Remove dragging class
            circle.classList.remove("dragging");

            // Fix text extraction for the drag end event
            const nodeType = group.classList.contains("unit") ? "unit" : "role";
            const nodeText = group.querySelector(".labeltext")?.textContent || 
                           document.querySelector(`#${group.id}_text`)?.textContent || 
                           "Unknown";
            
            const dragEndEvent = new CustomEvent("nodedragend", {
              detail: {
                nodeId: group.id,
                nodeType: nodeType,
                nodeText: nodeText,
                x: e.clientX,
                y: e.clientY
              }
            });
            window.dispatchEvent(dragEndEvent);
          }
        }

        circle.addEventListener("click", (e) => {
          console.error("Circle clicked, but no action defined.");
        });
        // Double-click handler for exploring skills
        circle.addEventListener("dblclick", (e) => {
          e.preventDefault();

          // Only keep the essential functionality
          const nodeId = group.id;
          const nodeType = group.classList.contains("unit") ? "unit" : "role";
          const nodeText = document.querySelector(`#${nodeId}_text`).textContent;

          splitGraphContainer(true);
          this.createBackButton(svgRoot);
          const container = document.getElementById("detailed-graph-skills");
          container.innerHTML = "";
          const workerGraph = new SkillTreeComponent({ container });
          workerGraph.reset("#detailed-graph-skills");
          workerGraph.show(currentorgmodel, nodeType, nodeText, null);
          isolateTargetGraphNode(nodeId, "svg", "main-svg");
        });

      });

      console.log("Added centered container at", maxwidth / 2, maxheight / 2);
    } else {
      console.warn("Graph SVG element not found");
    }

    // … inside renderOrganisationGraph, after usersSvg.innerHTML = subjects.join("\n");
    if (usersSvg) {
      usersSvg.innerHTML = subjects.join("\n");
      console.log("Users updated");

      // Enhanced drag handlers for subjects
      usersSvg.querySelectorAll("table.subject").forEach((subject) => {
        subject.style.cursor = "grab";
        
        // Add data attributes for identification
        const subjectId = subject.getAttribute("data-subject-id");
        const uid = subject.getAttribute("data-uid");
        
        subject.addEventListener("pointerdown", startDrag);

        function startDrag(e) {
          // Remove any existing ghost boxes
          document.querySelectorAll("#subject-drag-ghost").forEach(ghost => ghost.remove());
          
          const currentGhostBox = document.createElement("div");
          currentGhostBox.id = "subject-drag-ghost";
          const labelText = subject.querySelector(".labeltext").textContent;
          
          Object.assign(currentGhostBox.style, {
            position: "fixed",
            padding: "8px 12px",
            backgroundColor: "#e66465",
            color: "#fff",
            borderRadius: "4px",
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            fontWeight: "normal",
            pointerEvents: "none",
            zIndex: "9999",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            animation: "pulse 1s infinite",
            transform: "translate(-50%, -50%)",
            left: `${e.clientX}px`,
            top: `${e.clientY}px`
          });
          
          currentGhostBox.textContent = `Subject: ${labelText}`;
          document.body.appendChild(currentGhostBox);

          const moveGhost = (e) => {
            if (!currentGhostBox || !currentGhostBox.parentNode) return;
            currentGhostBox.style.left = `${e.clientX}px`;  
            currentGhostBox.style.top = `${e.clientY}px`;

            // Check if over expression blocks
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
                currentGhostBox.classList.add('over-expression');
              } else {
                block.classList.remove('block-drop-target');
              }
            });

            if (!isOverBlock) {
              currentGhostBox.classList.remove('over-expression');
              document.querySelectorAll('.block-drop-target').forEach(el => 
                el.classList.remove('block-drop-target')
              );
            }
          };
          
          const cleanupDrag = () => {
            if (currentGhostBox) {
              currentGhostBox.remove();
            }
            document.querySelectorAll('.block-drop-target').forEach(el => 
              el.classList.remove('block-drop-target')
            );
            document.removeEventListener("pointermove", moveGhost);
            document.removeEventListener("pointerup", stopDrag);
            document.removeEventListener("pointercancel", stopDrag);
          };
          
          const stopDrag = (e) => {
            cleanupDrag();
            // Dispatch drop event
            window.dispatchEvent(new CustomEvent("subjectdragend", {
              detail: { 
                subjectId, 
                uid, 
                nodeText: labelText, 
                x: e.clientX, 
                y: e.clientY 
              }
            }));
          };

          document.addEventListener("pointermove", moveGhost);
          document.addEventListener("pointerup", stopDrag);
          document.addEventListener("pointercancel", stopDrag);
        }
      });
    }

    const renderedEvent = new Event("graphRendered");
    document.dispatchEvent(renderedEvent);
    this.addCenteredContainer(maxwidth, maxheight);
    return { graphSvg, usersSvg };
  }
}

const renderOrganisationGraph = (doc) => {
  const tempViz = new OrbitFlower($("svg"));
  return tempViz.renderOrganisationGraph(doc);
};

const resetGraph = () => {
  const graphSvg = $("svg");
  if (graphSvg) {
    graphSvg.empty();
  }
};
async function renderGraph() {
  try {
    const tempViz = new OrbitFlower($("svg"));
    tempViz.renderOrganisationGraph(doc);
  } catch (error) {
    console.error("Failed to update graph:", error);
  }
}

function documentReady(fn) {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(fn, 1);
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}