const textMeasurements = {
  defaultWidth: 6,
  defaultHeight: 10,
};

const SVG_TEMPLATE = `
<svg id="svg" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" width='8' height='12'>
  <defs>
    <filter id="glow" x="-0.2" width="2" y="-0.1" height="2">
      <feGaussianBlur stdDeviation="0.5" id="feGaussianBlur3794"/>
    </filter>
%s
  </defs>
%s
</svg>
`;

class SVG {
  constructor() {
    this._res = "";
    this._defs = "";
  }

  dump(h = 50, w = 50) {
      console.log("awww yess");
      return `
        <svg id="svg" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" width=${w} height='${h}'>
        <defs>
          <filter id="glow" x="-0.2" width="2" y="-0.1" height="2">
            <feGaussianBlur stdDeviation="0.5" id="feGaussianBlur3794"/>
          </filter>
        </defs> 
        ${this._res}
      </svg>
      `;
  }

  add_group(nid, options = {}, block) {
    let opts = "";
    for (let [k, v] of Object.entries(options)) {
      opts += ` ${k}='${v}'`;
    }
    this._res += `<g id='${nid}'${opts}>\n`;
    if (block) {
      block();
    }
    this._res += `</g>\n`;
  }

  add_path(d, options = {}) {
    let opts = "";
    for (let [k, v] of Object.entries(options)) {
      opts += ` ${k}='${v}'`;
    }
    let pathData = Array.isArray(d) ? d.join(" ") : d;
    this._res += `  <path d="${pathData}"${opts}/>\n`;
  }

  add_circle(cx, cy, radius, cls = null) {
    this._res += `  <circle class='${cls}' cx='${cx}' cy='${cy}' r='${radius}'/>\n`;
  }

  add_rectangle(lx, ly, opacity, lwidth, lheight, cls = null) {
    this._res += `  <rect class='${cls}' fill-opacity='${opacity}' x='${lx}' y='${ly}' width='${lwidth}' height='${lheight}'/>\n`;
  }

  add_radialGradient(id, cls1 = null, cls2 = null) {
    this._defs +=
      `  <radialGradient id='${id}' cx='50%' cy='50%' r='70%' fx='70%' fy='30%'>\n` +
      `    <stop offset='0%' stop-color='${cls1}' stop-opacity='1'/>\n` +
      `    <stop offset='100%' stop-color='${cls2}' stop-opacity='1'/>\n` +
      `  </radialGradient>\n`;
  }

  add_text(x, y, options = {}, block) {
    let arr = [];
    if (options.transform) {
      arr.push(`transform='${options.transform}'`);
    }
    if (options.cls) {
      arr.push(`class='${options.cls}'`);
    }
    if (options.id) {
      arr.push(`id='${options.id}'`);
    }
    this._res += `  <text x='${x}' y='${y}' ${arr.join(" ")}>`;
    if (block) {
      let txt = block();
      this._res += txt;
    }
    this._res += `</text>\n`;
  }

  add_tspan(options = {}, block) {
    let arr = [];
    if (options.transform) {
      arr.push(`transform='${options.transform}'`);
    }
    if (options.cls) {
      arr.push(`class='${options.cls}'`);
    }
    if (options.dx) {
      arr.push(`dx='${options.dx}'`);
    }
    if (options.dy) {
      arr.push(`dy='${options.dy}'`);
    }
    if (options.x != null) {
      arr.push(`x='${options.x}'`);
    }
    if (options.y != null) {
      arr.push(`y='${options.y}'`);
    }
    this._res += `<tspan ${arr.join(" ")}>`;
    if (block) {
      this._res += block();
    }
    this._res += `</tspan>`;
    return "";
  }

  add_orbit(cx, cy, angle1, angle2, radius, oradius, options = {}) {
    const [x1, y1] = SVG.circle_point(cx, cy, radius, angle1);
    const [x2, y2] = SVG.circle_point(cx, cy, radius, angle2);

    let bogerl = 10;
    let sect = (bogerl / (2.0 * (radius + oradius) * Math.PI)) * 360;

    const [ovx1, ovy1] = SVG.circle_point(
      cx,
      cy,
      radius + oradius - bogerl,
      angle1
    );
    const obx1 =
      cx + Math.cos(SVG.degrees_to_rad(angle1 - sect)) * (radius + oradius);
    const oby1 =
      cy - Math.sin(SVG.degrees_to_rad(angle1 - sect)) * (radius + oradius);

    const [ovx2, ovy2] = SVG.circle_point(
      cx,
      cy,
      radius + oradius - bogerl,
      angle2
    );
    const obx2 =
      cx + Math.cos(SVG.degrees_to_rad(angle2 + sect)) * (radius + oradius);
    const oby2 =
      cy - Math.sin(SVG.degrees_to_rad(angle2 + sect)) * (radius + oradius);

    let pathData = "";
    if (angle1 - angle2 > 180) {
      pathData = `M ${x1} ${y1} L ${ovx1} ${ovy1} A ${bogerl} ${bogerl} 0 0 1 ${obx1} ${oby1} A ${
        radius + oradius
      } ${
        radius + oradius
      } 0 1 1 ${obx2} ${oby2} A ${bogerl} ${bogerl} 0 0 1 ${ovx2} ${ovy2} L ${x2} ${y2}`;
    } else {
      pathData = `M ${x1} ${y1} L ${ovx1} ${ovy1} A ${bogerl} ${bogerl} 0 0 1 ${obx1} ${oby1} A ${
        radius + oradius
      } ${
        radius + oradius
      } 0 0 1 ${obx2} ${oby2} A ${bogerl} ${bogerl} 0 0 1 ${ovx2} ${ovy2} L ${x2} ${y2}`;
    }
    this.add_path(pathData, options);
  }

  add_rectorbit(x1, y1, x2, y2, b, height, position, bogerl, options = {}) {
    if (position === "left") {
      let pathData = `M ${x1} ${
        y1 + height / 2
      } h ${-b} a ${bogerl} ${bogerl} 0 0 1 ${-bogerl} ${-bogerl} V ${
        y2 + height / 2 + bogerl
      } a ${bogerl} ${bogerl} 0 0 1 ${bogerl}  ${-bogerl} h ${b}`;
      this.add_path(pathData, options);
    } else if (position === "right") {
      let pathData = `M ${x1} ${
        y1 + height / 2
      } h ${b}  a ${bogerl} ${bogerl} 0 0 0 ${bogerl}  ${-bogerl} V ${
        y2 + height / 2 + bogerl
      } a ${bogerl} ${bogerl} 0 0 0 ${-bogerl} ${-bogerl} h ${-b}`;
      this.add_path(pathData, options);
    }
  }

  add_subject(
    x,
    y,
    number,
    clsbody,
    clsnumber,
    clsnumbernormal,
    clsnumberspecial
  ) {
    let subjectheadradius = 3;
    this.add_subject_icon(x, y - subjectheadradius, clsbody, subjectheadradius);
    this.add_text(x, y + 10, { cls: clsbody + " " + clsnumber }, () => {
      this.add_tspan({ x: x, y: y + 10, cls: clsnumbernormal }, () => number);
      this.add_tspan({ x: x, y: y + 10, cls: clsnumberspecial }, () => "");
    });
  }

  add_subject_icon(x, y, cls, headradius) {
    let scale = headradius / 3;
    let bogerl = (11 + headradius) * scale;
    y += headradius;
    let pathData = `M ${x} ${y} L ${x + 5 * scale} ${
      y + 11 * scale
    } A ${bogerl} ${bogerl} 0 0 1 ${x - 5 * scale} ${y + 11 * scale} z`;
    this.add_path(pathData, { class: cls });
    this.add_circle(x, y, headradius, cls);
    return [x + 5 * scale, y + bogerl];
  }

  static width_of(str) {
    return str.length * textMeasurements.defaultWidth;
  }

  static height_of(str) {
    return textMeasurements.defaultHeight;
  }

  static circle_line_from(cx, cy, r, angle) {
    return ["M", cx, cy, "L"].concat(SVG.circle_point(cx, cy, r, angle));
  }

  static circle_point(cx, cy, r, angle) {
    let rad = SVG.degrees_to_rad(angle);
    let x1 = cx + r * Math.cos(rad);
    let y1 = cy - r * Math.sin(rad);
    return [x1, y1];
  }

  static degrees_to_rad(d) {
    return (d * Math.PI) / 180.0;
  }
}
