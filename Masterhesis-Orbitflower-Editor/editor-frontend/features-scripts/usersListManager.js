class UsersManager {
  constructor(skillId, entityId, svgContainer, orgModel) {
    this.skillId = skillId;
    this.entityId = entityId;
    this.svgContainer = svgContainer;
    this.orgModel = orgModel;
    this.users = [];
    this.tmpUsersList = [];
  }

  saveUsers() {
    // save the current users to a temporary list
    this.tmpUsersList = Array.from(this.svgContainer.querySelectorAll("table")).map((user) => user.getAttribute("id"));
  }


  // assume xmlDoc is your already‑parsed XMLDocument (e.g. via new DOMParser().parseFromString(...))
  getUsersWithSkill(skillId, entityId) {
    const skillMap = {};
    this.orgModel.querySelectorAll("skill").forEach((skill) => {
      const id = skill.getAttribute("id");
      skillMap[id] = Array.from(
        skill.querySelectorAll('relation[type="Child"]')
      ).map((r) => r.getAttribute("id"));
    });

    // 2) recursively collect skillId + all its descendants
    const collect = (id, set = new Set()) => {
      set
        .add(id)(skillMap[id] || [])
        .forEach((child) => {
          if (!set.has(child)) collect(child, set);
        });
      return set;
    };
    const relevant = collect(skillId);

    // 3) find all <subject> with a matching relation *and* at least one relevant skillRef
    return Array.from(this.orgModel.querySelectorAll("subject"))
      .filter((sub) => {
        // must belong to the given unit or role
        const hasEntity = Array.from(sub.querySelectorAll("relation")).some(
          (r) =>
            r.getAttribute("unit") === entityId ||
            r.getAttribute("role") === entityId
        );
        if (!hasEntity) return false;

        // must have a skillRef in our relevant set
        return Array.from(sub.querySelectorAll("skillRef")).some((ref) =>
          relevant.has(ref.getAttribute("id"))
        );
      })
      .map((sub) => sub.getAttribute("uid")); // return UIDs (or swap for .getAttribute('id') if you prefer names)
  }

  updateUsers(skillId, entityId) {
    // iterate over users of svgContainer and remove the ones that are not in the new list based on id
    const newUsers = this.getUsersWithSkill(skillId, entityId);
    this.svgContainer.innerHTML = ""; // clear the svgContainer
    this.tmpUsersList.forEach((user) => {
      if (newUsers.includes(user.getAttribute("data-uid"))) {
        const userElement = document.createElement("table");
        userElement.setAttribute("id", user);
        this.svgContainer.appendChild(userElement);
      }
    });
    // use id to find the user in the svgContainer
    

}
}
