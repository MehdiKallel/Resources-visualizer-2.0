class HTML {
  constructor(title) {
    this.title = title;
    document.title = title;

    this.level = 0;
    this.buf = {};
    this.res = "";

    this.styleEl = document.createElement("style");
    document.head.appendChild(this.styleEl);

    this.scriptEl = document.createElement("script");
    document.head.appendChild(this.scriptEl);

    const uiRest = document.querySelector("ui-rest#main");
    if (!uiRest) {
      console.warn(
        'No <ui-rest id="main"> element found, falling back to body'
      );
      this.container = document.body;
      this.currentElement = document.body;
    } else {
      this.container = uiRest;
      this.currentElement = uiRest;
    }
  }

  add_css(name, content) {
    const rule = `${name} {\n${content}\n}`;
    this.styleEl.sheet.insertRule(rule, this.styleEl.sheet.cssRules.length);
  }

  add_js(content) {
    const script = document.createElement("script");
    script.text = content;
    this.scriptEl.parentNode.insertBefore(script, this.scriptEl.nextSibling);
  }

  add_script(content) {
    this.add_js(content);
  }

  add(content) {
    this.container.innerHTML += content;
  }

  add_tag(name, attr = {}, callback) {
    let str = `<${name}`;

    // Build attributes
    const keys = Object.keys(attr);
    if (keys.length > 0) {
      const attrs = keys
        .map((k) => {
          const val = attr[k];
          if (val == null) return null;
          // Replace all " with &#34;
          const safeVal = String(val).replace(/"/g, "&#34;");
          return `${k}="${safeVal}"`;
        })
        .filter(Boolean)
        .join(" ");
      if (attrs) {
        str += " " + attrs;
      }
    }

    str += ">";
    this.level++;

    // If a callback (block) is provided, call it. The Ruby code does yield.to_s.strip
    if (typeof callback === "function") {
      const blockOutput = String(callback()).trim();
      str += blockOutput;
      this.buf[this.level] = blockOutput; // Ensure buffer is updated correctly
    } else {
      this.buf[this.level] = ""; // Ensure buffer is reset if no callback
    }

    // In Ruby, this line resets the current level's buffer:
    this.buf[this.level] = "";

    this.level--;
    str += `</${name}>\n`;

    if (this.level === 0) {
      // If we’re back at level 0, just return the string
      this.res += str; // Ensure the result is added to the main content
      return str;
    } else {
      // Otherwise, append it to the parent level’s buffer
      if (!this.buf[this.level]) {
        this.buf[this.level] = "";
      }
      this.buf[this.level] += str;
      return str; // Ensure the generated string is returned
    }
  }

  dump() {
    return this.res;
  }
}

// Usage example:
// const page = new HTML("My Page");
// page.add_tag('div', {id: 'main'}, () => {
//   page.add_tag('h1', {}, () => { page.add('Hello World') });
// });
// page.add_css('body', 'margin: 0; padding: 20px;');
