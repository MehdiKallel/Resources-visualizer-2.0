class Skill {
  constructor(id) {
    this.id = id;
    this.count = 0;
    this.parents = [];
    this.children = [];
    this.relations = {};
  }

  addRelation(type, targetId) {
    if (!this.relations[type]) this.relations[type] = [];
    this.relations[type].push(targetId);
  }
}
