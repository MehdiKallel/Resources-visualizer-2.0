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

    // If we're given XML directly, use it
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

    // If we have a JSON model, convert it to XML (or use as is if rendering supports JSON)
    if (orgModel && typeof orgModel === "object") {
      // For now, we'll just store it and render
      this.currentModel = orgModel;
      this.renderFromJSON(orgModel);
      return;
    }

    // If no model provided, fetch from server
    if (!orgModel && !this.initialized) {
      this.fetchAndRender();
    }
  }

  renderFromJSON(jsonModel) {
    console.log("Rendering from JSON model", jsonModel);
    this.fetchAndRender();
  }

  fetchAndRender() {
    console.log("Fetching organisation model from server...");
    fetch("http://localhost:3000/organisation")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Network response was not ok: " + response.statusText
          );
        }
        return response.text();
      })
      .then((data) => {
        this.doc = new DOMParser().parseFromString(data, "application/xml");

        console.log("Fetched organisation model:", this.doc);
        this.renderOrganisationGraph(this.doc);
      })
      .catch((error) => {
        console.error("Error fetching organisation model:", error);
      });
  }

  renderOrganisationGraph(doc) {
    console.error("************************************************ rendering doc:", doc);
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

      console.log(
        "Graph SVG updated with dimensions:",
        maxwidth,
        "×",
        maxheight
      );
    } else {
      console.warn("Graph SVG element not found");
    }

    if (usersSvg) {
      usersSvg.innerHTML = subjects.join("\n");
      console.log("Users updated");
    }

    const renderedEvent = new Event("graphRendered");
    document.dispatchEvent(renderedEvent);

    return { graphSvg, usersSvg };
  }
}

const renderOrganisationGraph = (doc) => {
  const tempViz = new OrbitFlower($("svg"));
  return tempViz.renderOrganisationGraph(doc);
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
