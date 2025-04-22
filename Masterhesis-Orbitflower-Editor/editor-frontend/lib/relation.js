class Relation {
    constructor(unit, role) {
      this.unit = unit;
      this.role = role;
    }
  
    toString() {
      return `<Relation ${this.unit} ${this.role}>`;
    }
    inspect() {
      return this.toString();
    }
  }
  
  