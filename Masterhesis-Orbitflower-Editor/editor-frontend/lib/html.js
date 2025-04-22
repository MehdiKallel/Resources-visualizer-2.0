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
}
