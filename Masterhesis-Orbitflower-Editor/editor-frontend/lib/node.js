class Node {
  constructor(id, type, opts = {}) {
    this.type = type;
    this.id = id;
    this.rank = 0;
    this.parents = [];
    this.group = 0;
    this.numsubjects = 0;
    this.subjects = [];

    this.twidth = SVG.width_of(id);
    this.theight = SVG.height_of(id);

    for (const [k, v] of Object.entries(opts)) {
      this[k] = v;
    }
  }

  toString() {
    return `<Node:${this.id} ${this.type} ${this.parents}>`;
  }

  inspect() {
    return this.toString();
  }
}
