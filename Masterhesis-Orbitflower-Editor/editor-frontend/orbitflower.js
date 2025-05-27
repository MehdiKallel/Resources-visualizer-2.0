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
          <table class="subject" id="${u.id}" data-uid="${u.uid}" onmouseover="s_relationstoggle(this)" onmouseout="s_relationstoggle(this)" onclick="openSubjectEditor('${u.uid}')" style="margin-bottom: 5px;">
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

        // Update the ghost box position if it exists
        const ghostBox = document.getElementById("circle-drag-ghost");
        if (ghostBox) {
          ghostBox.style.left = `${e.clientX}px`;
          ghostBox.style.top = `${e.clientY}px`;
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
        circle.style.cursor = "grab";
        let holdTimeout;
        let isHolding = false;
        const group = circle.parentNode;

        circle.addEventListener("mousedown", (e) => {
          e.preventDefault();

          if (group) {
            group.classList.add("hold-active");
          }

          // Create a tooltip-style hold hint
          const holdHint = document.createElement("div");
          holdHint.id = "hold-hint";
          holdHint.textContent = "Hold to view skills graph...";
          Object.assign(holdHint.style, {
            position: "fixed",
            left: `${e.clientX + 20}px`,
            top: `${e.clientY - 25}px`,
            background: "rgba(0, 0, 0, 0.8)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: "20px",
            fontSize: "13px",
            pointerEvents: "none",
            opacity: "0",
            transform: "translateY(10px)",
            transition: "all 0.2s ease-out",
            zIndex: "10000",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            fontFamily: "Arial, sans-serif",
          });
          document.body.appendChild(holdHint);

          // Fade in the hint after a small delay
          requestAnimationFrame(() => {
            holdHint.style.opacity = "1";
            holdHint.style.transform = "translateY(0)";
          });

          holdTimeout = setTimeout(() => {
            // Fade out and remove the hint
            const existingHint = document.getElementById("hold-hint");
            if (existingHint) {
              existingHint.style.opacity = "0";
              existingHint.addEventListener("transitionend", () => existingHint.remove());
            }
            isHolding = true;
            const nodeId = group.id;
            const nodeType = group.classList.contains("unit") ? "unit" : "role";
            const nodeText = document.querySelector(
              `#${nodeId}_text`
            ).textContent;

            // Get all skills associated with this unit/role
            const relevantSkills = new Set();
            const subjects = this.doc.getElementsByTagName("subject");
            for (let i = 0; i < subjects.length; i++) {
              const subject = subjects[i];
              const relations = subject.getElementsByTagName("relation");
              for (let j = 0; j < relations.length; j++) {
                const rel = relations[j];
                if (
                  (nodeType === "unit" && rel.getAttribute("unit") === nodeText) ||
                  (nodeType === "role" && rel.getAttribute("role") === nodeText)
                ) {
                  const subjectSkills = subject.getElementsByTagName('subjectSkills')[0];
                  if (subjectSkills) {
                    const skillRefs = subjectSkills.getElementsByTagName('skillRef');
                    for (let l = 0; l < skillRefs.length; l++) {
                      relevantSkills.add(skillRefs[l].getAttribute('id'));
                    }
                  }
                }
              }
            }

            splitGraphContainer(true);
            this.createBackButton(svgRoot);
            const container = document.getElementById('detailed-graph-skills');
            container.innerHTML = '';
            const workerGraph = new SkillTreeComponent({ container });
            workerGraph.reset("#detailed-graph-skills");
            workerGraph.show(currentorgmodel, nodeType, nodeText, null);
            isolateTargetGraphNode(nodeId, "svg", "main-svg");
            group.classList.remove("hold-active");
          }, 2000); // 500ms hold duration

          // Remove hold-active when mouse is released
          const clearHoldState = () => {
            clearTimeout(holdTimeout);
            isHolding = false;
            group.classList.remove("hold-active");
             // remove hint if they let go early
    const existingHint = document.getElementById("hold-hint");
    if (existingHint) existingHint.remove();
            document.removeEventListener("mouseup", clearHoldState);
          };
          document.addEventListener("mouseup", clearHoldState);

          // Original drag handling code continues...
          // 5. Store where the pointer was
          startPoint.x = e.clientX;
          startPoint.y = e.clientY;

          // Create a drag ghost box similar to skills feature
          const ghostBox = document.createElement("div");
          const circleType = group.classList.contains("unit") ? "Unit" : "Role";
          const nodeText = svg.querySelector(`#${group.id}_text`).textContent;

          // Apply styling to make it a visible box
          Object.assign(ghostBox.style, {
            position: "absolute",
            padding: "8px 12px",
            backgroundColor: window.getComputedStyle(circle).fill || "#60A5FA",
            color: "#fff",
            borderRadius: "4px",
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            fontWeight: "normal",
            pointerEvents: "none",
            zIndex: "9999",
            transform: "translate(-50%, -50%)",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            animation: "dropPulse 1s infinite", // Using the same animation name
            whiteSpace: "nowrap",
            transition: "opacity 0.3s, transform 0.3s",
            left: `${e.clientX}px`,
            top: `${e.clientY}px`,
          });
          ghostBox.textContent = `${circleType}: ${nodeText}`;
          ghostBox.id = "circle-drag-ghost";
          document.body.appendChild(ghostBox);

          // Update the mouse move handler to also move the ghost box
          const existingMouseMove = document.onmousemove;
          document.onmousemove = function (e) {
            if (existingMouseMove) existingMouseMove(e);
            if (ghostBox) {
              ghostBox.style.left = `${e.clientX}px`;
              ghostBox.style.top = `${e.clientY}px`;
            }
          };

          // Update the mouse up handler to clean up the ghost box
          const existingMouseUp = document.onmouseup;
          document.onmouseup = function (e) {
            if (existingMouseUp) existingMouseUp(e);
            if (ghostBox && ghostBox.parentNode) {
              // Optional: Add drop animation before removing
              ghostBox.classList.add("drop-effect");
              ghostBox.parentNode.removeChild(ghostBox);
            }
            // Dispatch a custom event for drag end similar to skills
            const dropEvent = new CustomEvent("circledragend", {
              detail: {
                nodeId: group.id,
                nodeType: circleType.toLowerCase(),
                nodeName: nodeText,
                x: e.clientX,
                y: e.clientY,
              },
            });
            window.dispatchEvent(dropEvent);

            // Restore original handlers
            document.onmousemove = existingMouseMove;
            document.onmouseup = existingMouseUp;
          };
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

      // === Make each labeltext draggable ===
      usersSvg
        .querySelectorAll("table.subject .labeltext")
        .forEach((labelTd) => {
          labelTd.setAttribute("draggable", "true");
          labelTd.addEventListener("dragstart", (e) => {
            const subjectUid = labelTd.closest("table.subject").dataset.uid;
            const subjectText = labelTd.textContent;
            const payload = JSON.stringify({
              type: "external-entity", // Changed from external-subject to external-entity
              entityType: "subject",
              nodeText: subjectText,
              entityId: subjectUid,
            });
            e.dataTransfer.setData("application/json", payload);
          });
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
