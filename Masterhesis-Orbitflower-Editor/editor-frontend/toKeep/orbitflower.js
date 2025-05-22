var doc = null;

const fetchOrganisationXML = async () => {
  try {
    const response = await fetch("http://localhost:3000/organisation");
    console.log(response);
    if (!response.ok) throw new Error("Failed to fetch organisation data.");
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    return xmlDoc;
  } catch (error) {
    console.error("Error fetching organisation XML:", error);
    throw error;
  }
};

const renderOrganisationGraph = (doc) => {
  console.log("Rendering organisation graph from graph worker...");
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

  let textgap = 3;
  let circumference = 0;
  let maxnoderadius = 0;
  let maxtextwidth = 0;
  const maxradius = 25.0;
  const orbitgap = 5;
  const nodegap = 10;
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

  const h = new HTML("OrbitFlower");

  // ----------------------------------------------------------------------
  // CSS STYLING - ORGANIZED BY COMPONENT TYPE
  // ----------------------------------------------------------------------

  // Base typography and text styling
  h.add_css(
    "text",
    `
      font-size: 10px;
      font-style: normal;
      font-variant: normal;
      font-weight: normal;
      font-stretch: normal;
      line-height: 100%;
      letter-spacing: 0px;
      word-spacing: 0px;
      writing-mode: lr-tb;
      text-anchor: start;
      fill: #000000;
      fill-opacity: 1;
      stroke: none;
      font-family: Arial;
    `
  );

  h.add_css(".labeltext", `font-weight: normal;`);

  h.add_css(
    ".btext",
    `
      fill: #ffffff;
      stroke: #ffffff;
      stroke-width: 2.5;
    `
  );

  h.add_css(
    ".plainwhite",
    `
      fill: none;
      stroke: #ffffff;
      stroke-width: 2.9;
    `
  );

  h.add_css(
    ".left",
    `
      text-align: end;
      text-anchor: end;
    `
  );

  h.add_css(
    ".right",
    `
      text-align: start;
      text-anchor: start;
    `
  );

  // Node styling (units, roles)
  h.add_css(
    ".unit",
    `
      fill: #729fcf;
      stroke: #204a87;
      stroke-width: 1.5;
      cursor: pointer;
    `
  );

  h.add_css(
    ".role",
    `
      fill: #ad7fa8;
      stroke: #5c3566;
      stroke-width: 1.5;
      cursor: pointer;
    `
  );

  // Connection styling
  h.add_css(
    ".unit.connect",
    `
      fill: none;
      stroke: #204a87;
      stroke-width: 1;
    `
  );

  h.add_css(
    ".role.connect",
    `
      fill: none;
      stroke: #5c3566;
      stroke-width: 1;
    `
  );

  h.add_css(".connect.inactive", `stroke-opacity: 0.1;`);

  // Highlight states
  h.add_css(
    ".role circle.highlight, .unit circle.highlight",
    `stroke: #a40000;`
  );

  h.add_css(
    ".unit.connect.highlight, .role.connect.highlight",
    `
      stroke: #a40000;
      stroke-opacity: 1;
    `
  );

  h.add_css(".activefilter", `fill: #a40000;`);

  // Subject styling
  h.add_css(".subject", `cursor: pointer;`);

  h.add_css(
    ".subject:hover .labeltext",
    `
      fill: #a40000;
      color: #a40000;
    `
  );

  h.add_css(".subject.highlightrole .labeltext", `color: #ad7fa8;`);
  h.add_css(".subject.highlightunit .labeltext", `color: #729fcf;`);
  h.add_css(".subject.highlightrole .subjecticon", `stroke: #ad7fa8;`);
  h.add_css(".subject.highlightunit .subjecticon", `stroke: #729fcf;`);

  h.add_css(
    ".subject .subjecticon",
    `
      fill: #ffffff;
      stroke: #000000;
      stroke-width: 1;
    `
  );

  // Subject icon styling
  h.add_css(
    ".subjecticon.subjecthighlight, .subjecticon.highlight",
    `stroke: #a40000;`
  );

  h.add_css(
    ".subjecticon.number",
    `
      font-size: 7px;
      font-style: normal;
      font-variant: normal;
      font-weight: normal;
      font-stretch: normal;
      line-height: 100%;
      letter-spacing: 0px;
      word-spacing: 0px;
      writing-mode: lr-tb;
      text-anchor: start;
      fill: #000000;
      fill-opacity: 1;
      stroke: none;
      font-family: Arial;
    `
  );

  h.add_css(
    ".subjecticon.number tspan",
    `
      text-anchor: middle;
      text-align: center;
    `
  );

  h.add_css(".subjecticon.number .inactive", `visibility: hidden;`);

  // Relation styling
  h.add_css(
    ".relation",
    `
      fill: none;
      stroke: #777676;
      stroke-width: 1;
    `
  );

  h.add_css(".relation.inactive", `stroke-opacity: 0.2;`);

  h.add_css(
    ".relation.role",
    `
      stroke-opacity: 1;
      stroke: #5c3566;
    `
  );

  h.add_css(
    ".relation.unit",
    `
      stroke-opacity: 1;
      stroke: #204a87;
    `
  );

  h.add_css(
    ".relation.highlight",
    `
      stroke-opacity: 1;
      stroke: #a40000;
    `
  );

  // Skill indicators
  h.add_css(
    ".skill-indicator",
    `
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: all;
    `
  );

  h.add_css(".skill-indicator:hover", `opacity: 1 !important;`);

  // Graph element interaction
  h.add_css("#graphcolumn svg", `cursor: grab;`);
  h.add_css("#graphcolumn svg:active", `cursor: grabbing;`);

  // Tab navigation
  h.add_css(
    ".tabs",
    `
      display: flex;
      border-bottom: 1px solid #ccc;
      background-color: #f1f1f1;
      padding: 10px;
    `
  );

  h.add_css(
    ".tab-button",
    `
      background-color: inherit;
      border: 1px solid #ccc;
      outline: none;
      padding: 14px 16px;
      cursor: pointer;
      transition: background-color 0.3s;
      font-size: 17px;
      margin-right: 5px;
    `
  );

  h.add_css(".tab-button:hover", `background-color: #ddd;`);
  h.add_css(".tab-button.active", `background-color: #ccc;`);
  h.add_css(".tab-content.active", `display: block;`);

  h.add_css(
    ".manage-form",
    `
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 5px;
      background-color: #f9f9f9;
    `
  );

  h.add_css(".manage-form label", `font-weight: bold;`);

  h.add_css(
    ".manage-form input, .manage-form select, .manage-form button",
    `
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 3px;
      font-size: 14px;
    `
  );

  // Form element groups
  h.add_css(
    ".unit-role-pair, .role-parent-pair, .skill-item",
    `
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 5px;
      background: #f8f8f8;
      border-radius: 4px;
      margin-bottom: 5px;
    `
  );

  h.add_css(
    ".unit-role-pair input, .role-parent-pair input",
    `
      flex: 1;
      padding: 5px;
    `
  );

  h.add_css(
    ".remove-btn",
    `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: #666;
      padding: 0 8px;
    `
  );

  h.add_css(".remove-btn:hover", `color: #c00;`);

  h.add_css(
    "#messages",
    `
      margin-top: 10px;
      color: green;
    `
  );

  h.add_css(".error", `color: red;`);

  h.add_css(
    ".edit-subject-section",
    `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      z-index: 1000;
      display: none;
      padding: 20px;
    `
  );

  h.add_css(
    ".back-button",
    `
      margin-bottom: 10px;
      padding: 5px 10px;
      background: none;
      border: 1px solid #ccc;
      cursor: pointer;
    `
  );

  h.add_css(
    ".section-header",
    `
      margin-top: 15px;
      margin-bottom: 10px;
      border-bottom: 1px solid #ddd;
    `
  );

  h.add_css(".edit-subject-container", `padding: 10px;`);

  h.add_css(".edit-subject-container .form-group", `margin-bottom: 10px;`);

  h.add_css(
    ".skill-add-section",
    `
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      align-items: center;
    `
  );

  h.add_css(
    ".skill-add-section input",
    `
      flex: 1;
      padding: 5px;
    `
  );

  h.add_css(
    ".edit-subject-container .form-actions",
    `
      margin-top: 15px;
      display: flex;
      gap: 10px;
    `
  );
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

  // Add CSS for skill indicators
  h.add_css(
    ".skill-indicator",
    `
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: all;
    `
  );

  h.add_css(
    ".skill-indicator:hover",
    `
    opacity: 1 !important;
    `
  );

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
        subjectintensity[key][1].push(u.id); // add the subject’s ID
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
    });

    h.add_css(
      `.relation.${arr.join(".")}`,
      `
      stroke-width: ${opacity};
  `
    );

    h.add_css(
      `.relation.highlight.${arr.join(".")}`,
      `
      stroke-opacity:1;
      stroke-width:1;
      stroke: #a40000;
  `
    );
  });

  gw.nodes.forEach((n) => {
    const [x, y] = SVG.circle_point(center_x, center_y, radius, n.angle);

    s.add_group(
      n.shortid,
      {
        class: n.type,
        onmouseover: "ur_relationstoggle(this)",
        onmouseout: "ur_relationstoggle(this)",
        onclick: "ur_filtertoggle(this)",
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

    s.add_text(n.text_x, n.text_y, { cls: n.text_cls + " btext" }, () => n.id);
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

  const graphDiv = document.querySelector("#graph");
  if (graphDiv) {
    graphDiv.innerHTML = s.dump(maxwidth, maxheight).trim();
  }

  const usersDiv = document.querySelector("#users");
  if (usersDiv) {
    usersDiv.innerHTML = subjects.join("\n");
  }


  return { graphDiv, usersDiv, styles: h.css };
};

async function renderGraph() {
  try {
    console.log("Fetching latest organisation data...");

    const doc = await fetchOrganisationXML();
    console.log("Fresh XML data fetched ");

    const { graphDiv, usersDiv, styles } = renderOrganisationGraph(doc);

    console.log(graphDiv.innerHTML);

    const graphColumn = document.querySelector("#graph");
    if (graphColumn) {
      graphColumn.innerHTML = graphDiv.innerHTML.trim();
    }

    const usersColumn = document.querySelector("#users");
    if (usersColumn) {
      usersColumn.innerHTML = usersDiv.innerHTML.trim();
    }
    const existingStyleElement = document.getElementById(
      "dynamic-graph-styles"
    );
    if (existingStyleElement) {
      existingStyleElement.innerHTML = styles;
    }
    const renderedEvent = new Event("graphRendered");
    document.dispatchEvent(renderedEvent);

    console.log("Graph successfully updated");
  } catch (error) {
    console.error("Failed to update graph:", error);
  }
}

function createInitialUIStructure() {
  const h = new HTML("OrbitFlower");

  h.add_css(
    "text",
    `
      font-size: 10px;
      font-style: normal;
      font-variant: normal;
      font-weight: normal;
      font-stretch: normal;
      line-height: 100%;
      letter-spacing: 0px;
      word-spacing: 0px;
      writing-mode: lr-tb;
      text-anchor: start;
      fill: #000000;
      fill-opacity: 1;
      stroke: none;
      font-family: Arial;
    `
  );

  const styleTag = document.createElement("style");
  styleTag.id = "dynamic-graph-styles";
  document.head.appendChild(styleTag);
  styleTag.innerHTML = h.css;

  
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

(async () => {
  try {
    console.log("Setting up application...");

    documentReady(async function () {
      console.log("Document is ready, creating UI structure...");
      createInitialUIStructure();

      console.log("Fetching organisation XML...");
      doc = await fetchOrganisationXML();
      console.log("XML fetched successfully:", doc);

      renderGraph();

      const eventSource = new EventSource("http://localhost:3000/events");
      console.log("Listening for real-time updates...");
      eventSource.onopen = () => {
        console.log("SSE connection established");
      };

      eventSource.addEventListener("update", (event) => {
        console.log("Update event received:", event.data);
        try {
          const updateData = JSON.parse(event.data);
          console.log("Update type:", updateData.type);
          renderGraph();
        } catch (error) {
          console.error("Error parsing update data:", error);
        }
      });

      eventSource.addEventListener("connected", (event) => {
        console.log("Connected to SSE stream:", event.data);
      });

      eventSource.onmessage = (event) => {
        console.log("Generic message received:", event.data);
        renderGraph();
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        setTimeout(() => {
          console.log("Attempting to reconnect to event stream...");
          eventSource.close();
          new EventSource("http://localhost:3000/events");
        }, 5000);
      };

      console.log("Real-time update listener established");
    });
  } catch (error) {
    console.error("Failed to initialize GraphWorker:", error);
  }
})();
