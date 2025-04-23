var apiBaseUrl = null;


// Form submission handlers for the management forms
async function handleSubjectFormSubmit(e) {
  e.preventDefault();
  console.log("Subject form submitted");
  const subjectId = document.getElementById("subject-id").value.trim();
  const unitRolePairs = Array.from(
    document.querySelectorAll(".unit-role-pair")
  ).map((pair) => ({
    unitId: pair.querySelector(".unit-id").value.trim(),
    roleId: pair.querySelector(".role-id").value.trim(),
  }));

  if (
    !subjectId ||
    unitRolePairs.some((pair) => !pair.unitId || !pair.roleId)
  ) {
    displayMessage("All fields are required.", "error", "messages-subjects");
    return;
  }

  const xmlPayload = `
          <subject id="${subjectId}">
            ${unitRolePairs
              .map(
                (pair) => `
              <relation unit="${pair.unitId}" role="${pair.roleId}"/>
            `
              )
              .join("")}
          </subject>
        `;

  try {
    const response = await fetch(`${apiBaseUrl}/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlPayload,
    });

    if (response.ok) {
      displayMessage(
        "Subject added successfully.",
        "success",
        "messages-subjects"
      );
      document.getElementById("manage-subjects-form").reset();
    } else {
      const errorText = await response.text();
      displayMessage(`Error: ${errorText}`, "error", "messages-subjects");
    }
  } catch (error) {
    displayMessage(
      "An error occurred while adding the subject.",
      "error",
      "messages-subjects"
    );
  }
}

async function handleUnitFormSubmit(e) {
  console.error("Unit form submitted");
  e.preventDefault();
  console.log("Unit form submitted");
  const unitId = document.getElementById("unit-id").value.trim();
  const unitParentId = document.getElementById("unit-parent-id").value.trim();

  if (!unitId) {
    displayMessage("Unit ID is required.", "error", "messages-units");
    return;
  }

  const xmlPayload = `
          <unit id="${unitId}" parent="${unitParentId}" />
        `;

  try {
    const response = await fetch(`${apiBaseUrl}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlPayload,
    });

    if (response.ok) {
      displayMessage("Unit added successfully.", "success", "messages-units");
      document.getElementById("manage-units-form").reset();
    } else {
      const errorText = await response.text();
      displayMessage(`Error: ${errorText}`, "error", "messages-units");
    }
  } catch (error) {
    displayMessage(
      "An error occurred while adding the unit.",
      "error",
      "messages-units"
    );
  }
}

async function handleRoleFormSubmit(e) {
  e.preventDefault();
  console.log("Role form submitted");
  const roleId = document.getElementById("role-id").value.trim();
  const parentIds = Array.from(document.querySelectorAll(".role-parent-id"))
    .map((input) => input.value.trim())
    .filter((p) => p !== "");

  if (!roleId) {
    displayMessage("Role ID is required.", "error", "messages-roles");
    return;
  }

  const xmlPayload = `
          <role id="${roleId}">
            ${parentIds.map((p) => `<parent>${p}</parent>`).join("")}
          </role>
        `;

  try {
    const response = await fetch(`${apiBaseUrl}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlPayload,
    });

    if (response.ok) {
      displayMessage("Role added successfully.", "success", "messages-roles");
      document.getElementById("manage-roles-form").reset();
    } else {
      const errorText = await response.text();
      displayMessage(`Error: ${errorText}`, "error", "messages-roles");
    }
  } catch (error) {
    displayMessage(
      "An error occurred while adding the role.",
      "error",
      "messages-roles"
    );
  }
}

async function handleSkillFormSubmit(e) {
  e.preventDefault();
  const skillId = document.getElementById("skill-id").value.trim();
  if (!skillId) {
    displayMessage("Skill ID is required.", "error", "messages-skills");
    return;
  }

  const relationElements = Array.from(
    document.querySelectorAll(".relation-item")
  )
    .map((item) => {
      const relId = item.querySelector(".relation-id").value.trim();
      const relValue = item.querySelector(".relation-value").value.trim();
      if (relId) {
        return `<relation id="${relId}" type="${relValue}"/>`;
      }
      return "";
    })
    .filter((str) => str !== "");

  const xmlPayload = `
  <skill id="${skillId}">
    ${relationElements.join("")}
  </skill>
`;

  try {
    const response = await fetch(`${apiBaseUrl}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlPayload,
    });
    const responseText = await response.text();
    if (response.ok) {
      displayMessage("Skill added successfully.", "success", "messages-skills");
      document.getElementById("manage-skills-form").reset();
    } else {
      if (response.status === 409 && responseText.includes("already exists")) {
        displayMessage(
          "Skill already exists but may have been added successfully.",
          "warning",
          "messages-skills"
        );
      } else {
        displayMessage(`Error: ${responseText}`, "error", "messages-skills");
      }
    }
  } catch (error) {
    console.error("Skill creation error:", error);
    displayMessage(
      "An error occurred while adding the skill.",
      "error",
      "messages-skills"
    );
  }
}

function displayMessage(message, type, elementId) {
  const messagesDiv = document.getElementById(elementId);
  if (messagesDiv) {
    messagesDiv.textContent = message;
    messagesDiv.className = type;
    setTimeout(() => {
      messagesDiv.textContent = "";
      messagesDiv.className = "";
    }, 5000);
  }
}

// Function to fetch all available skills from the server
async function fetchAllSkills() {
  try {
    const response = await fetch(`${apiBaseUrl}/skills`);
    if (!response.ok) throw new Error("Failed to fetch skills");
    const skills = await response.json();
    return skills;
  } catch (error) {
    console.error("Error fetching skills:", error);
    return [];
  }
}

// Function to add a new unit-role pair in the subject editor
function addUnitRolePair() {
  const container = document.getElementById("edit-unit-role-pairs");
  if (!container) return;

  const pairDiv = document.createElement("div");
  pairDiv.className = "unit-role-pair";
  pairDiv.innerHTML = `
    <input type="text" class="unit-id" placeholder="Unit ID">
    <input type="text" class="role-id" placeholder="Role ID">
    <button type="button" class="remove-btn">×</button>
  `;

  container.appendChild(pairDiv);

  const removeBtn = pairDiv.querySelector(".remove-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      pairDiv.remove();
    });
  }
}

function addRoleParent() {
  const parentDiv = document.createElement("div");
  parentDiv.className = "role-parent-pair";
  parentDiv.innerHTML = `
    <input type="text" class="role-parent-id" placeholder="Parent ID" required>
    <button type="button" class="remove-btn">×</button>
  `;
  document.getElementById("role-parents").appendChild(parentDiv);

  const removeBtn = parentDiv.querySelector(".remove-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      parentDiv.remove();
    });
  }
}

async function openSubjectEditor(uid) {
  try {
    const [subjectResponse, allSkills] = await Promise.all([
      fetch(`${apiBaseUrl}/subjects/byuid/${uid}`),
      fetchAllSkills(),
    ]);

    if (!subjectResponse.ok) throw new Error("Failed to fetch subject");
    const subject = await subjectResponse.json();

    const tabbed = document.querySelector("#main");
    const tabId = `subject-${uid}`;
    if (!window.uidash_add_tab_active(tabbed, `Edit ${uid}`, tabId, true))
      return;

    const existingSkillsMap = {};
    subject.skillRefs.forEach((skill) => (existingSkillsMap[skill] = true));

    const area = document.querySelector(`[data-belongs-to-tab="${tabId}"]`);
    area.innerHTML = `
            <div class="edit-subject-container">
              <h2>${subject.id}</h3>
              <form id="subject-editor-form" onsubmit="window.handleSubjectEditorSubmit(event)">
                <input type="hidden" id="edit-subject-id" value="${subject.id}">
                <input type="hidden" id="edit-subject-uid" value="${
                  subject.uid
                }">
      
                <div class="section-header">
                  <h3>Unit-Role Pairs</h4>
                </div>
                <div id="edit-unit-role-pairs">
                  ${subject.relations
                    .map(
                      (rel) => `
                    <div class="unit-role-pair">
                      <input type="text" class="unit-id" value="${rel.unit}" placeholder="Unit ID">
                      <input type="text" class="role-id" value="${rel.role}" placeholder="Role ID">
                      <button type="button" class="remove-btn">×</button>
                    </div>
                  `
                    )
                    .join("")}
                </div>
                <button type="button" onclick="window.addUnitRolePair()">Add Pair</button>
      
                <div class="section-header">
                  <h3>Skills</h4>
                </div>
                <div class="skill-add-section">
                  <div class="skill-dropdown-container">
                    <select id="skill-dropdown" class="skill-dropdown">
                      <option value="">Select a skill...</option>
                      ${allSkills
                        .filter((skill) => !existingSkillsMap[skill.id]) // Filter out already added skills
                        .map(
                          (skill) =>
                            `<option value="${skill.id}">${skill.id}</option>`
                        )
                        .join("")}
                    </select>
                    <button type="button" onclick="window.addSkillFromDropdown()">Add</button>
                  </div>
                </div>
                <div id="edit-skills">
                  ${subject.skillRefs
                    .map(
                      (skill) => `
                    <div class="skill-item">
                      <span>${skill}</span>
                      <button type="button" class="remove-btn">×</button>
                    </div>
                  `
                    )
                    .join("")}
                </div>
      
                <div class="form-actions">
                  <button type="submit">Save Changes</button>
                  <button type="button" onclick="window.uidash_close_tab(this.closest('[data-belongs-to-tab]'))">Cancel</button>
                </div>
                <div id="messages-edit"></div>
              </form>
            </div>
          `;

    const skillDropdown = document.getElementById("skill-dropdown");
    if (skillDropdown) {
      initializeSearchableDropdown(skillDropdown);
    }

    document
      .querySelectorAll(
        "#edit-unit-role-pairs .remove-btn, #edit-skills .remove-btn"
      )
      .forEach((btn) => {
        btn.addEventListener("click", function () {
          this.closest(".unit-role-pair, .skill-item").remove();

          if (this.closest(".skill-item")) {
            const skillId =
              this.closest(".skill-item").querySelector("span").textContent;
            addSkillBackToDropdown(skillId);
          }
        });
      });
  } catch (error) {
    console.error("Editor error:", error);
    showEditMessage(`Failed to open editor: ${error.message}`, "error");
  }
}

function initializeSearchableDropdown(selectElement) {
  // Create search input
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search for skills...";
  searchInput.className = "dropdown-search";

  selectElement.parentNode.insertBefore(searchInput, selectElement);

  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();
    const options = selectElement.options;

    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const text = option.textContent.toLowerCase();

      if (text.includes(searchTerm) || option.value === "") {
        option.style.display = "";
      } else {
        option.style.display = "none";
      }
    }
  });
}

function addSkillBackToDropdown(skillId) {
  const dropdown = document.getElementById("skill-dropdown");
  if (!dropdown) return;

  for (let i = 0; i < dropdown.options.length; i++) {
    if (dropdown.options[i].value === skillId) {
      return;
    }
  }
  const option = document.createElement("option");
  option.value = skillId;
  option.textContent = skillId;
  dropdown.appendChild(option);
}

function addSkillFromDropdown() {
  const dropdown = document.getElementById("skill-dropdown");
  if (!dropdown || !dropdown.value) return;

  const skillId = dropdown.value;
  const container = document.getElementById("edit-skills");
  if (!container) return;

  // Check if skill is already added
  if (
    Array.from(container.children).some(
      (item) => item.querySelector("span").textContent === skillId
    )
  ) {
    return;
  }

  // Add skill to the list
  const div = document.createElement("div");
  div.className = "skill-item";
  div.innerHTML = `
    <span>${skillId}</span>
    <button type="button" class="remove-btn">×</button>
  `;

  // Add removal event handler
  div.querySelector(".remove-btn").addEventListener("click", function () {
    div.remove();
    addSkillBackToDropdown(skillId);
  });

  container.appendChild(div);

  // Remove selected skill from dropdown
  for (let i = 0; i < dropdown.options.length; i++) {
    if (dropdown.options[i].value === skillId) {
      dropdown.remove(i);
      break;
    }
  }

  dropdown.selectedIndex = 0;
}

function addSkillAssignment() {
  addSkillFromDropdown();
}

async function handleSubjectEditorSubmit(event) {
  console.error("Subject editor form submitted");
  event.preventDefault();
  const form = event.target;

  const subjectId = form.querySelector("#edit-subject-id").value;
  const subjectUid = form.querySelector("#edit-subject-uid").value;

  const pairs = Array.from(form.querySelectorAll(".unit-role-pair"))
    .map((pair) => ({
      unit: pair.querySelector(".unit-id").value,
      role: pair.querySelector(".role-id").value,
    }))
    .filter((p) => p.unit && p.role);

  const skills = Array.from(form.querySelectorAll(".skill-item span")).map(
    (span) => span.textContent
  );

  try {
    const response = await fetch(`${apiBaseUrl}/subjects/${subjectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0"?>
        <subject id="${subjectId}" uid="${subjectUid}">
          <relations>
            ${pairs
              .map((p) => `<relation unit="${p.unit}" role="${p.role}"/>`)
              .join("")}
          </relations>
          <skills>
            ${skills.map((s) => `<skill id="${s}" />`).join("")}
          </skills>
        </subject>
      `,
    });

    if (response.ok) {
      showEditMessage("✅ Changes saved successfully!", "success");
      setTimeout(() => {
        window.uidash_close_tab(form.closest("[data-belongs-to-tab]"));
      }, 1500);
    } else {
      throw new Error(await response.text());
    }
  } catch (error) {
    console.error("Save failed:", error);
    showEditMessage(`🚨 Save failed: ${error.message}`, "error");
  }
}

function showEditMessage(message, type = "info") {
  const msgDiv = document.getElementById("messages-edit");
  if (msgDiv) {
    msgDiv.textContent = message;
    msgDiv.className = type;
    setTimeout(() => (msgDiv.textContent = ""), 5000);
  }
}

function closeTabAndReturnToGraph(element) {
  // First find the tab element to close
  const tabArea = element.closest("[data-belongs-to-tab]");
  const tabId = tabArea?.getAttribute("data-belongs-to-tab");

  if (tabId) {
    window.uidash_close_tab(tabArea);

    const tabbed = document.querySelector(".tabbed.rest");
    const tabs = tabbed.querySelectorAll("ui-tab");
    tabs.forEach((tab) => {
      if (tab.getAttribute("data-tab") === "graph") {
        tab.click();
      }
    });
  }
}

(async function init() {
  try {
    const resp = await fetch("index.conf");
    if (!resp.ok) throw new Error(resp.statusText);
    const cfg = await resp.json();
  } catch (e) {
    console.error("Could not load index.conf:", e);
    return;
  }
  console.error("API base URL:", apiBaseUrl);

  // Ensure handlers are attached even if DOM is already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeFormHandlers);
  } else {
    // DOM already loaded, initialize right away
    initializeFormHandlers();
  }
  
  function initializeFormHandlers() {
    console.error("DOM fully loaded, initializing form handlers" + apiBaseUrl);
    
    const subjectForm = document.getElementById("manage-subjects-form");
    if (subjectForm) {
      // Remove any existing handlers to prevent duplicates
      subjectForm.removeEventListener("submit", handleSubjectFormSubmit);
      subjectForm.addEventListener("submit", handleSubjectFormSubmit);

      const addUnitRolePairBtn = document.getElementById("add-unit-role-pair");
      if (addUnitRolePairBtn) {
        addUnitRolePairBtn.removeEventListener("click", addUnitRolePair);
        addUnitRolePairBtn.addEventListener("click", addUnitRolePair);
      }
    }

    const unitForm = document.getElementById("manage-units-form");
    if (unitForm) {
      unitForm.addEventListener("submit", handleUnitFormSubmit);
    }

    const roleForm = document.getElementById("manage-roles-form");
    if (roleForm) {
      roleForm.addEventListener("submit", handleRoleFormSubmit);

      const addRoleParentBtn = document.getElementById("add-role-parent");
      if (addRoleParentBtn) {
        addRoleParentBtn.addEventListener("click", function () {
          const parentDiv = document.createElement("div");
          parentDiv.className = "role-parent-pair";
          parentDiv.innerHTML = `
                <input type="text" class="role-parent-id" placeholder="Parent ID" required>
                <button type="button" class="remove-btn">×</button>
              `;
          document.getElementById("role-parents").appendChild(parentDiv);

          const removeBtn = parentDiv.querySelector(".remove-btn");
          if (removeBtn) {
            removeBtn.addEventListener("click", function () {
              parentDiv.remove();
            });
          }
        });
      }
    }

    const skillForm = document.getElementById("manage-skills-form");
    if (skillForm) {
      skillForm.addEventListener("submit", handleSkillFormSubmit);
      enhanceSkillForm();
    }
    document
      .getElementById("add-relation-btn")
      ?.addEventListener("click", addRelationItem);

    document.addEventListener("click", function (e) {
      if (e.target && e.target.matches("[data-tab]")) {

        setTimeout(function () {
          const tabId = e.target.getAttribute("data-tab");
          setupTabFormHandlers(tabId);
        }, 100);
      }
    });
  }

  function addRelationItem() {
    const container = document.getElementById("relations-container");
    const div = document.createElement("div");
    div.className = "relation-item";
    div.innerHTML = `
    <input type="text" class="relation-id" placeholder="Related Skill ID">
    <input type="text" class="relation-value" placeholder="Relation Value">
    <button type="button" class="remove-relation-btn">Remove</button>
  `;
    div.querySelector(".remove-relation-btn").addEventListener("click", () => {
      container.removeChild(div);
    });
    container.appendChild(div);
  }

  // Expose the function to the window object while it's in scope
  window.setupTabFormHandlers = setupTabFormHandlers;

  function setupTabFormHandlers(tabId) {

    switch (tabId) {
      case "manage-subjects":
        const subjectForm = document.getElementById("manage-subjects-form");
        if (subjectForm) {
          console.log("Attaching subject form handler");
          subjectForm.removeEventListener("submit", handleSubjectFormSubmit);
          subjectForm.addEventListener("submit", handleSubjectFormSubmit);
        }
        break;

      case "manage-units":
        const unitForm = document.getElementById("manage-units-form");
        if (unitForm) {
          console.log("Attaching unit form handler");
          unitForm.addEventListener("submit", handleUnitFormSubmit);
        }
        break;

      case "manage-roles":
        const roleForm = document.getElementById("manage-roles-form");
        if (roleForm) {
          console.log("Attaching role form handler");
          roleForm.addEventListener("submit", handleRoleFormSubmit);
        }
        break;

      case "manage-skills":
        const skillForm = document.getElementById("manage-skills-form");
        if (skillForm) {
          console.log("Attaching skill form handler");
          skillForm.addEventListener("submit", handleSkillFormSubmit);
        }
        break;
    }
  }

  async function enhanceSkillForm() {
    try {
      const skills = await fetchAllSkills();

      const relatedSkillInput = document.getElementById("related-skill-id");
      if (!relatedSkillInput) return;

      const container = document.createElement("div");
      container.className = "skill-dropdown-container";

      const select = document.createElement("select");
      select.id = "related-skill-dropdown";
      select.className = "skill-dropdown";

      select.innerHTML =
        '<option value="">Select a related skill (optional)...</option>';

      skills.forEach((skill) => {
        const option = document.createElement("option");
        option.value = skill.id;
        option.textContent = skill.id;
        select.appendChild(option);
      });

      container.appendChild(select);
      relatedSkillInput.parentNode.replaceChild(container, relatedSkillInput);

      initializeSearchableDropdown(select);

      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.id = "related-skill-id";
      container.appendChild(hiddenInput);

      select.addEventListener("change", function () {
        hiddenInput.value = this.value;
      });
    } catch (error) {
      console.error("Error enhancing skill form:", error);
    }
  }
})();



window.handleSubjectFormSubmit = handleSubjectFormSubmit;
window.handleUnitFormSubmit = handleUnitFormSubmit;
window.handleRoleFormSubmit = handleRoleFormSubmit;
window.handleSkillFormSubmit = handleSkillFormSubmit;
window.openSubjectEditor = openSubjectEditor;
window.addUnitRolePair = addUnitRolePair;
window.addSkillAssignment = addSkillAssignment;
window.addSkillFromDropdown = addSkillFromDropdown;
window.handleSubjectEditorSubmit = handleSubjectEditorSubmit;
window.fetchAllSkills = fetchAllSkills;
window.initializeSearchableDropdown = initializeSearchableDropdown;
window.addSkillBackToDropdown = addSkillBackToDropdown;
