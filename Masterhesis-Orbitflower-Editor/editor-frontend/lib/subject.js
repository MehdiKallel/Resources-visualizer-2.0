let globalCounter = 0;

class Subject {
  constructor(shortid, uid) {
    this.shortid = shortid;
    this.id = `s${++globalCounter}`;
    this.relations = [];
    this.uid = uid;
    this.skillRefs = [];
  }

  toString() {
    return `<Subject:${this.id} ${JSON.stringify(this.relations)}>`;
  }
  inspect() {
    return this.toString();
  }
}
