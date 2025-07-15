var apiBaseUrl = null;

// Form submission handlers for the management forms
async function handleSubjectFormSubmit(e) {
  e.preventDefault();

  // Prevent double submission
  const submitButton = document.getElementById("subject-submit-btn");
  if (submitButton.disabled) {
    console.log("Subject form submission already in progress, ignoring");
    return;
  }

  console.log("Subject form submitted");
  console.log("editingSubjectId:", editingSubjectId);

  // Disable submit button to prevent double submission
  submitButton.disabled = true;
  submitButton.textContent = editingSubjectId ? "Updating..." : "Adding...";

  try {
    const subjectId = document.getElementById("subject-id").value.trim();
    const unitRolePairs = Array.from(
      document.querySelectorAll(".unit-role-item, .unit-role-pair")
    ).map((pair) => ({
      unitId: pair.querySelector(".unit-id-input, .unit-id").value.trim(),
      roleId: pair.querySelector(".role-id-input, .role-id").value.trim(),
    }));

    if (!subjectId) {
      displayMessage("Subject ID is required.", "error", "messages-subjects");
      return;
    }

    // Create different XML payload formats for POST vs PUT
    let xmlPayload;
    if (editingSubjectId) {
      // PUT request - send only the relations in the expected format
      xmlPayload = `
        <subject>
          ${unitRolePairs
            .map(
              (pair) =>
                `<relation unit="${pair.unitId}" role="${pair.roleId}"/>`
            )
            .join("")}
        </subject>
      `;
    } else {
      // POST request - send the subject with id attribute and relations
      xmlPayload = `
        <subject id="${subjectId}">
          ${unitRolePairs
            .map(
              (pair) =>
                `<relation unit="${pair.unitId}" role="${pair.roleId}"/>`
            )
            .join("")}
        </subject>
      `;
    }

    console.log("XML Payload:", xmlPayload);

    const method = editingSubjectId ? "PUT" : "POST";
    const url = editingSubjectId
      ? `${apiBaseUrl}/subjects/${subjectId}`
      : `${apiBaseUrl}/subjects`;

    console.log(`Making ${method} request to:`, url);

    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/xml" },
      body: xmlPayload,
    });

    if (response.ok) {
      const action = editingSubjectId ? "updated" : "added";
      displayMessage(
        `Subject ${action} successfully.`,
        "success",
        "messages-subjects"
      );
      document.getElementById("manage-subjects-form").reset();
      document.getElementById("unit-role-pairs").innerHTML = "";
      loadSubjectsList();
      if (editingSubjectId) {
        cancelSubjectEdit();
      }
    } else {
      const errorText = await response.text();
      console.error("Server error response:", errorText);
      displayMessage(`Error: ${errorText}`, "error", "messages-subjects");
    }
  } catch (error) {
    console.error("Request error:", error);
    displayMessage(
      "An error occurred while saving the subject.",
      "error",
      "messages-subjects"
    );
  } finally {
    // Re-enable submit button
    submitButton.disabled = false;
    submitButton.textContent = editingSubjectId
      ? "Update Subject"
      : "Add Subject";
  }
}

async function handleUnitFormSubmit(e) {
  console.error("Unit form submitted");
  e.preventDefault();
  console.log("Unit form submitted");
  console.log("editingUnitId:", editingUnitId);

  const unitId = document.getElementById("unit-id").value.trim();
  const unitParentId = document.getElementById("unit-parent-id").value.trim();

  if (!unitId) {
    displayMessage("Unit ID is required.", "error", "messages-units");
    return;
  }

  // Create different XML payload formats for POST vs PUT
  let xmlPayload;
  if (editingUnitId) {
    // PUT request - send only the parent value in the expected format
    xmlPayload = `
      <unit>
        ${unitParentId ? `<parent>${unitParentId}</parent>` : ""}
      </unit>
    `;
  } else {
    // POST request - send the unit with id and parent attributes
    xmlPayload = `<unit id="${unitId}" parent="${unitParentId}" />`;
  }

  console.log("XML Payload:", xmlPayload);

  try {
    const method = editingUnitId ? "PUT" : "POST";
    const url = editingUnitId
      ? `${apiBaseUrl}/units/${unitId}`
      : `${apiBaseUrl}/units`;

    console.log(`Making ${method} request to:`, url);

    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/xml" },
      body: xmlPayload,
    });

    if (response.ok) {
      const action = editingUnitId ? "updated" : "added";
      displayMessage(
        `Unit ${action} successfully.`,
        "success",
        "messages-units"
      );
      document.getElementById("manage-units-form").reset();
      loadUnitsList();
      if (editingUnitId) {
        cancelUnitEdit();
      }
    } else {
      const errorText = await response.text();
      console.error("Server error response:", errorText);
      displayMessage(`Error: ${errorText}`, "error", "messages-units");
    }
  } catch (error) {
    console.error("Request error:", error);
    displayMessage(
      "An error occurred while saving the unit.",
      "error",
      "messages-units"
    );
  }
}

async function handleRoleFormSubmit(e) {
  e.preventDefault();
  console.log("Role form submitted");
  console.log("editingRoleId:", editingRoleId);
  console.log(
    "Button text:",
    document.getElementById("role-submit-btn").textContent
  );

  const roleId = document.getElementById("role-id").value.trim();
  const parentIds = Array.from(document.querySelectorAll(".role-parent-input"))
    .map((input) => input.value.trim())
    .filter((p) => p !== "");

  if (!roleId) {
    displayMessage("Role ID is required.", "error", "messages-roles");
    return;
  }

  // Create different XML payload formats for POST vs PUT
  let xmlPayload;
  if (editingRoleId) {
    // PUT request - send only the parent values in the expected format
    xmlPayload = `
      <role>
        ${parentIds.map((p) => `<parent>${p}</parent>`).join("")}
      </role>
    `;
  } else {
    // POST request - send the role with id attribute and parent elements
    xmlPayload = `
      <role id="${roleId}">
        ${parentIds.map((p) => `<parent>${p}</parent>`).join("")}
      </role>
    `;
  }

  console.log("XML Payload:", xmlPayload);

  try {
    const method = editingRoleId ? "PUT" : "POST";
    const url = editingRoleId
      ? `${apiBaseUrl}/roles/${roleId}`
      : `${apiBaseUrl}/roles`;

    console.log(`Making ${method} request to:`, url);

    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/xml" },
      body: xmlPayload,
    });

    if (response.ok) {
      const action = editingRoleId ? "updated" : "added";
      displayMessage(
        `Role ${action} successfully.`,
        "success",
        "messages-roles"
      );
      document.getElementById("manage-roles-form").reset();
      document.getElementById("role-parents").innerHTML = "";
      loadRolesList();
      if (editingRoleId) {
        cancelRoleEdit();
      }
    } else {
      const errorText = await response.text();
      console.error("Server error response:", errorText);
      displayMessage(`Error: ${errorText}`, "error", "messages-roles");
    }
  } catch (error) {
    console.error("Network error:", error);
    displayMessage(
      "An error occurred while saving the role.",
      "error",
      "messages-roles"
    );
  }
}

// Global variables for skills management
let currentSkills = [];
let editingSkillId = null;
let availableRelationTypes = [
  "Parent",
  "Child",
  "Similar",
  "Prerequisite",
  "Builds-on",
];

async function loadSkillsList() {
  try {
    const skills = await fetchAllSkills();
    currentSkills = skills;
    displaySkillsList(skills);
    updateAvailableSkillsDropdown();
  } catch (error) {
    console.error("Error loading skills:", error);
    displayMessage("Failed to load skills list.", "error", "messages-skills");
  }
}

function displaySkillsList(skills) {
  const skillsList = document.getElementById("skills-list");
  if (!skillsList) return;

  if (skills.length === 0) {
    skillsList.innerHTML =
      '<div class="skills-empty">No skills found. Add your first skill!</div>';
    return;
  }

  skillsList.innerHTML = skills
    .map((skill) => {
      const relationCount = skill.relations
        ? skill.relations.length
        : skill.relatedSkills
        ? skill.relatedSkills.length
        : 0;
      return `
      <div class="skill-list-item" data-skill-id="${skill.id}">
        <div class="skill-info">
          <div class="skill-name">${skill.id}</div>
          <div class="skill-relations-count">
            ${relationCount} relation(s)
          </div>
        </div>
        <div class="skill-actions">
          <button class="skill-edit-btn" onclick="editSkill('${skill.id}')">Edit</button>
          <button class="skill-delete-btn" onclick="deleteSkill('${skill.id}')">Delete</button>
        </div>
      </div>
    `;
    })
    .join("");
}

function updateAvailableSkillsDropdown() {
  const dropdown = document.getElementById("available-skills-dropdown");
  if (!dropdown) return;

  const skillIdInput = document.getElementById("skill-id");
  const currentSkillId = skillIdInput ? skillIdInput.value.trim() : "";
  const existingRelationIds = Array.from(
    document.querySelectorAll(".relation-item")
  )
    .map((item) => {
      // Get confirmed relations
      if (item.dataset.relationId) {
        return item.dataset.relationId;
      }
      // Skip unconfirmed manual inputs
      return null;
    })
    .filter((id) => id);

  dropdown.innerHTML = '<option value="">Select a skill to relate...</option>';

  currentSkills
    .filter(
      (skill) =>
        skill.id !== currentSkillId && !existingRelationIds.includes(skill.id)
    )
    .forEach((skill) => {
      const option = document.createElement("option");
      option.value = skill.id;
      option.textContent = skill.id;
      dropdown.appendChild(option);
    });
}

async function editSkill(skillId) {
  try {
    const response = await fetch(`${apiBaseUrl}/skills/${skillId}`);
    if (!response.ok) throw new Error("Failed to fetch skill details");

    const skill = await response.json();
    editingSkillId = skillId;

    // Update form title and button (check if elements exist first)
    const titleElement = document.getElementById("skill-editor-title");
    if (titleElement) {
      titleElement.textContent = `Edit Skill: ${skillId}`;
    }
    
    const submitBtn = document.getElementById("skill-submit-btn");
    if (submitBtn) {
      submitBtn.textContent = "Update Skill";
    }
    
    const cancelBtn = document.getElementById("cancel-edit-btn");
    if (cancelBtn) {
      cancelBtn.style.display = "inline-block";
    }

    // Populate form
    const skillIdInput = document.getElementById("skill-id");
    if (skillIdInput) {
      skillIdInput.value = skillId;
      skillIdInput.readOnly = true;
    }

    // Clear existing relations
    const relationsContainer = document.getElementById("relations-container");
    if (relationsContainer) {
      relationsContainer.innerHTML = "";
    }

    // Add existing relations - handle both new and old format
    if (skill.relations && skill.relations.length > 0) {
      skill.relations.forEach((relation) => {
        addRelationItem(
          relation.id,
          relation.type || "Similar",
          relation.strength || 5
        );
      });
    } else if (skill.relatedSkills && skill.relatedSkills.length > 0) {
      // Fallback for old format
      skill.relatedSkills.forEach((relatedSkillId) => {
        addRelationItem(relatedSkillId, "Similar", 5);
      });
    }

    updateAvailableSkillsDropdown();

    // Highlight selected skill in list
    document.querySelectorAll(".skill-list-item").forEach((item) => {
      item.classList.remove("selected");
    });
    document
      .querySelector(`[data-skill-id="${skillId}"]`)
      ?.classList.add("selected");
  } catch (error) {
    console.error("Error editing skill:", error);
    displayMessage(
      "Failed to load skill for editing.",
      "error",
      "messages-skills"
    );
  }
}

async function deleteSkill(skillId) {
  if (
    !confirm(
      `Are you sure you want to delete the skill "${skillId}"? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/skills/${skillId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      displayMessage(
        "Skill deleted successfully.",
        "success",
        "messages-skills"
      );
      loadSkillsList(); // Refresh the list
      if (editingSkillId === skillId) {
        cancelEdit();
      }
    } else {
      const errorText = await response.text();
      displayMessage(
        `Error deleting skill: ${errorText}`,
        "error",
        "messages-skills"
      );
    }
  } catch (error) {
    console.error("Error deleting skill:", error);
    displayMessage(
      "An error occurred while deleting the skill.",
      "error",
      "messages-skills"
    );
  }
}

function cancelEdit() {
  editingSkillId = null;
  
  const titleElement = document.getElementById("skill-editor-title");
  if (titleElement) {
    titleElement.textContent = "Add New Skill";
  }
  
  const submitBtn = document.getElementById("skill-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = "Add Skill";
  }
  
  const cancelBtn = document.getElementById("cancel-edit-btn");
  if (cancelBtn) {
    cancelBtn.style.display = "none";
  }
  
  const skillIdInput = document.getElementById("skill-id");
  if (skillIdInput) {
    skillIdInput.readOnly = false;
  }
  
  const form = document.getElementById("manage-skills-form");
  if (form) {
    form.reset();
  }
  
  const relationsContainer = document.getElementById("relations-container");
  if (relationsContainer) {
    relationsContainer.innerHTML = "";
  }
  
  updateAvailableSkillsDropdown();

  // Remove selection highlight
  document.querySelectorAll(".skill-list-item").forEach((item) => {
    item.classList.remove("selected");
  });
}

function addRelationItem(
  relationId = "",
  relationType = "Similar",
  strength = 5
) {
  const container = document.getElementById("relations-container");
  if (!container) {
    console.error("Relations container not found");
    return;
  }
  
  const div = document.createElement("div");
  div.className = "relation-item";

  // If no relationId provided, allow manual input
  if (relationId) {
    div.dataset.relationId = relationId;
  }

  if (relationId) {
    // For existing skills
    div.innerHTML = `
      <input type="text" value="${relationId}" readonly>
      <input type="text" class="relation-type-input" value="${relationType}" placeholder="Type">
      <input type="number" class="strength-input" min="1" max="999" value="${strength}" placeholder="Strength">
      <button type="button" class="remove-relation-btn">×</button>
    `;
  } else {
    // For manual input
    div.innerHTML = `
      <input type="text" class="relation-id-input" placeholder="Skill ID">
      <button type="button" class="confirm-relation-btn">✓</button>
      <input type="text" class="relation-type-input" value="${relationType}" placeholder="Type">
      <input type="number" class="strength-input" min="1" max="999" value="${strength}" placeholder="Strength">
      <button type="button" class="remove-relation-btn">×</button>
    `;

    // Handle manual skill ID confirmation
    const confirmBtn = div.querySelector(".confirm-relation-btn");
    const skillInput = div.querySelector(".relation-id-input");

    confirmBtn.addEventListener("click", function () {
      const skillId = skillInput.value.trim();
      if (skillId) {
        // Check if skill exists in our list
        const skillExists = currentSkills.some((skill) => skill.id === skillId);
        if (!skillExists) {
          displayMessage(
            `Skill "${skillId}" not found. You can still add it as a relation.`,
            "warning",
            "messages-skills"
          );
        }

        // Replace manual input with skill name display
        div.dataset.relationId = skillId;
        const newHTML = `
          <input type="text" value="${skillId}" readonly>
          <input type="text" class="relation-type-input" value="${relationType}" placeholder="Type">
          <input type="number" class="strength-input" min="1" max="999" value="${strength}" placeholder="Strength">
          <button type="button" class="remove-relation-btn">×</button>
        `;
        div.innerHTML = newHTML;
        
        // Re-attach remove button event
        div.querySelector(".remove-relation-btn").addEventListener("click", () => {
          container.removeChild(div);
          updateAvailableSkillsDropdown();
        });
        
        updateAvailableSkillsDropdown();
      } else {
        displayMessage("Please enter a skill ID.", "error", "messages-skills");
      }
    });

    // Allow Enter key to confirm
    skillInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        confirmBtn.click();
      }
    });
  }

  div.querySelector(".remove-relation-btn").addEventListener("click", () => {
    container.removeChild(div);
    updateAvailableSkillsDropdown();
  });

  container.appendChild(div);

  // Only update dropdown if this is a confirmed relation
  if (relationId) {
    updateAvailableSkillsDropdown();
  }
}

async function handleSkillFormSubmit(e) {
  e.preventDefault();
  const skillIdInput = document.getElementById("skill-id");
  if (!skillIdInput) {
    displayMessage("Skill ID input not found.", "error", "messages-skills");
    return;
  }
  
  const skillId = skillIdInput.value.trim();
  if (!skillId) {
    displayMessage("Skill ID is required.", "error", "messages-skills");
    return;
  }

  const relationElements = Array.from(
    document.querySelectorAll(".relation-item")
  )
    .map((item) => {
      let relId = item.dataset.relationId;

      // If no relationId in dataset, check for unconfirmed manual input
      if (!relId) {
        const manualInput = item.querySelector(".relation-id-input");
        if (manualInput && manualInput.value.trim()) {
          relId = manualInput.value.trim();
        }
      }

      if (relId) {
        const relType =
          item.querySelector(".relation-type-input").value.trim() || "Similar";
        const strength = item.querySelector(".strength-input").value || "5";

        return `<relation id="${relId}" type="${relType}" strength="${strength}"/>`;
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
    const method = editingSkillId ? "PUT" : "POST";
    const url = editingSkillId
      ? `${apiBaseUrl}/skills/${skillId}`
      : `${apiBaseUrl}/skills`;

    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/xml" },
      body: xmlPayload,
    });

    const responseText = await response.text();
    if (response.ok) {
      const action = editingSkillId ? "updated" : "added";
      displayMessage(
        `Skill ${action} successfully.`,
        "success",
        "messages-skills"
      );
      loadSkillsList(); // Refresh the skills list
      if (editingSkillId) {
        cancelEdit();
      } else {
        const form = document.getElementById("manage-skills-form");
        if (form) {
          form.reset();
        }
        const relationsContainer = document.getElementById("relations-container");
        if (relationsContainer) {
          relationsContainer.innerHTML = "";
        }
        updateAvailableSkillsDropdown();
      }
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
    console.error("Skill creation/update error:", error);
    displayMessage(
      "An error occurred while saving the skill.",
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

// Function to add a new unit-role pair in the static subject management form
function addUnitRolePair() {
  // Try to find the container for the static form first
  let container = document.getElementById("unit-role-pairs");

  // If static form container not found, try the dynamic editor container
  if (!container) {
    container = document.getElementById("edit-unit-role-pairs");
    if (!container) {
      console.error("Container for unit-role pairs not found");
      return;
    }
  }

  console.error("current state:", container);

  const pairDiv = document.createElement("div");
  pairDiv.className = "unit-role-item";
  pairDiv.innerHTML = `
    <input type="text" class="unit-id-input" placeholder="Enter Unit ID">
    <input type="text" class="role-id-input" placeholder="Enter Role ID">
    <button type="button" class="remove-relation-btn">×</button>
  `;

  container.appendChild(pairDiv);

  const removeBtn = pairDiv.querySelector(".remove-relation-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      pairDiv.remove();
    });
  }
}

function addRoleParent() {
  console.log("addRoleParent function called");
  
  const container = document.getElementById("role-parents");
  if (!container) {
    console.error("role-parents container not found");
    return;
  }

  const parentInput = document.getElementById("parent-role-input");
  const parentId = parentInput ? parentInput.value.trim() : "";

  console.log("Parent ID:", parentId);

  if (!parentId) {
    displayMessage("Parent Role ID is required.", "error", "messages-roles");
    return;
  }

  // Check if parent already exists
  const existingParents = Array.from(container.querySelectorAll(".role-parent-input"))
    .map(input => input.value.trim());
  
  if (existingParents.includes(parentId)) {
    displayMessage("Parent role already added.", "warning", "messages-roles");
    return;
  }

  console.log("Creating parent div for:", parentId);

  const parentDiv = document.createElement("div");
  parentDiv.className = "role-parent-pair";
  parentDiv.innerHTML = `
    <input type="text" class="role-parent-input" value="${parentId}" placeholder="Parent ID" readonly>
    <button type="button" class="remove-btn danger-btn" title="Remove this parent">×</button>
  `;

  container.appendChild(parentDiv);

  // Add remove functionality
  const removeBtn = parentDiv.querySelector(".remove-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      console.log("Removing parent:", parentId);
      parentDiv.remove();
    });
  }

  // Clear the input field
  if (parentInput) {
    parentInput.value = "";
  }

  console.log("Parent added successfully");
}

async function openSubjectEditor(uid) {
  try {
    const [subjectResponse, allSkills] = await Promise.all([
      fetch(`${apiBaseUrl}/subjects/byuid/${uid}`),
      fetchAllSkills(),
    ]);

    if (!subjectResponse.ok) throw new Error("Failed to fetch subject");
    const subject = await subjectResponse.json();

    // Debug logging
    console.log("Subject data received:", subject);
    console.log("Subject relations:", subject.relations);
    console.log("Subject skillRefs:", subject.skillRefs);

    const tabbed = document.querySelector("#main");
    const tabId = `subject-${uid}`;
    if (!window.uidash_add_tab_active(tabbed, `Edit ${uid}`, tabId, true))
      return;

    const existingSkillsMap = {};
    subject.skillRefs.forEach((skill) => (existingSkillsMap[skill] = true));

    const area = document.querySelector(`[data-belongs-to-tab="${tabId}"]`);
    area.innerHTML = `
            <div class="subjects-management-container">
              <div class="subject-info-section">
                <h3>Subject Information</h3>
                <div class="subject-meta">
                  <div class="meta-item"><strong>ID:</strong> ${
                    subject.id
                  }</div>
                  <div class="meta-item"><strong>UID:</strong> ${
                    subject.uid
                  }</div>
                  <div class="meta-item"><strong>Relations:</strong> ${
                    subject.relations.length
                  } Unit-Role pairs</div>
                  <div class="meta-item"><strong>Skills:</strong> ${
                    subject.skillRefs.length
                  } assigned</div>
                </div>
              </div>
              
              <div class="subject-editor-section">
                <h3 id="subject-editor-title-${tabId}">Edit Subject: ${
      subject.id
    }</h3>
                <form id="subject-editor-form-${tabId}" class="manage-form" onsubmit="window.handleSubjectEditorSubmit(event)">
                  <input type="hidden" id="edit-subject-id-${tabId}" value="${
      subject.id
    }">
                  <input type="hidden" id="edit-subject-uid-${tabId}" value="${
      subject.uid
    }">
        
                  <div class="form-group">
                    <label for="edit-subject-id-display-${tabId}">Subject ID:</label>
                    <input type="text" id="edit-subject-id-display-${tabId}" value="${
      subject.id
    }" placeholder="Subject ID" readonly />
                  </div>
        
                  <div class="relations-section">
                    <h4>Unit-Role Relations</h4>
                    <div id="edit-unit-role-pairs-${tabId}">
                      ${
                        subject.relations && subject.relations.length > 0
                          ? subject.relations
                              .filter((rel) => rel && rel.unit && rel.role)
                              .map((rel) => {
                                console.log("Processing relation:", rel);
                                return `
                              <div class="unit-role-item">
                                <input type="text" class="unit-id-input" value="${
                                  rel.unit || ""
                                }" placeholder="Enter Unit ID">
                                <input type="text" class="role-id-input" value="${
                                  rel.role || ""
                                }" placeholder="Enter Role ID">
                                <button type="button" class="remove-relation-btn">×</button>
                              </div>
                            `;
                              })
                              .join("")
                          : '<div class="no-relations">No unit-role relations found</div>'
                      }
                    </div>
                    <div class="add-relation-controls">
                      <input type="text" id="unit-id-input-${tabId}" placeholder="Unit ID" />
                      <input type="text" id="role-id-input-${tabId}" placeholder="Role ID" />
                      <button type="button" id="add-unit-role-btn-${tabId}" onclick="window.addUnitRolePairForTab('${tabId}')">Add Unit-Role Pair</button>
                    </div>
                  </div>
        
                  <div class="relations-section">
                    <h4>Skills Assignment</h4>
                    <div id="edit-skills-${tabId}">
                      ${subject.skillRefs
                        .map(
                          (skill) => `
                        <div class="skill-item-edit">
                          <span class="skill-name">${skill}</span>
                          <button type="button" class="remove-btn danger-btn" title="Remove this skill">×</button>
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                    <div class="add-relation-controls">
                      <input type="text" id="skill-search-${tabId}" placeholder="Search for skills...">
                      <select id="skill-dropdown-${tabId}" class="skill-dropdown">
                        <option value="">Select a skill...</option>
                        ${allSkills
                          .filter((skill) => !existingSkillsMap[skill.id])
                          .map(
                            (skill) =>
                              `<option value="${skill.id}">${skill.id}</option>`
                          )
                          .join("")}
                      </select>
                      <button type="button" id="add-skill-btn-${tabId}" onclick="window.addSkillFromDropdownForTab('${tabId}')">Add Skill</button>
                    </div>
                  </div>
        
                  <div class="form-actions">
                    <button type="submit" id="subject-submit-btn-${tabId}">Save Changes</button>
                    <button type="button" id="cancel-subject-btn-${tabId}" onclick="window.uidash_close_tab(this.closest('[data-belongs-to-tab]'))">Cancel</button>
                  </div>
                  <div id="messages-edit-${tabId}"></div>
                </form>
              </div>
            </div>
          `;

    // Initialize skill search functionality
    const skillSearch = document.getElementById(`skill-search-${tabId}`);
    const skillDropdown = document.getElementById(`skill-dropdown-${tabId}`);

    if (skillSearch && skillDropdown) {
      skillSearch.addEventListener("input", function () {
        const searchTerm = this.value.toLowerCase();
        const options = skillDropdown.options;

        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          const text = option.textContent.toLowerCase();

          if (text.includes(searchTerm) || option.value === "") {
            option.style.display = "";
          } else {
            option.style.display = "none";
          }
        }

        // Auto-select if only one option is visible (excluding the empty option)
        const visibleOptions = Array.from(options).filter(
          (opt) => opt.style.display !== "none" && opt.value !== ""
        );
        if (visibleOptions.length === 1) {
          skillDropdown.value = visibleOptions[0].value;
        }
      });
    }

    document
      .querySelectorAll(
        `#edit-unit-role-pairs-${tabId} .remove-relation-btn, #edit-skills-${tabId} .remove-btn`
      )
      .forEach((btn) => {
        btn.addEventListener("click", function () {
          this.closest(".unit-role-item, .skill-item-edit").remove();

          if (this.closest(".skill-item-edit")) {
            const skillId =
              this.closest(".skill-item-edit").querySelector(
                ".skill-name"
              ).textContent;
            addSkillBackToDropdownForTab(skillId, tabId);
          }
        });
      });
  } catch (error) {
    console.error("Editor error:", error);
    showEditMessage(`Failed to open editor: ${error.message}`, "error");
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

function showEditMessageForTab(message, type = "info", tabId) {
  const msgDiv = document.getElementById(`messages-edit-${tabId}`);
  if (msgDiv) {
    msgDiv.textContent = message;
    msgDiv.className = type;
    setTimeout(() => (msgDiv.textContent = ""), 5000);
  }
}

function addUnitRolePairForTab(tabId) {
  console.log("addUnitRolePairForTab called with tabId:", tabId);

  // Get values from the tab-specific input fields
  const unitInput = document.getElementById(`unit-id-input-${tabId}`);
  const roleInput = document.getElementById(`role-id-input-${tabId}`);

  let unitId = "";
  let roleId = "";

  if (unitInput) {
    unitId = unitInput.value.trim();
    unitInput.value = ""; // Clear after getting value
  }
  if (roleInput) {
    roleId = roleInput.value.trim();
    roleInput.value = ""; // Clear after getting value
  }

  console.log("Got values from inputs:", unitId, roleId);

  const container = document.getElementById(`edit-unit-role-pairs-${tabId}`);
  if (!container) {
    console.error(`Container 'edit-unit-role-pairs-${tabId}' not found`);
    return;
  }

  const div = document.createElement("div");
  div.className = "unit-role-item";

  // Use placeholder values if inputs are empty to make them visible
  const displayUnitId = unitId || "";
  const displayRoleId = roleId || "";

  div.innerHTML = `
    <input type="text" class="unit-id-input" value="${displayUnitId}" placeholder="Enter Unit ID">
    <input type="text" class="role-id-input" value="${displayRoleId}" placeholder="Enter Role ID">
    <button type="button" class="remove-relation-btn">×</button>
  `;

  div.querySelector(".remove-relation-btn").addEventListener("click", () => {
    console.log("Removing unit-role pair");
    container.removeChild(div);
  });

  container.appendChild(div);
  console.log(
    "Unit-role pair added successfully. Container now has",
    container.children.length,
    "children"
  );

  // Focus on the first input if both are empty
  if (!displayUnitId && !displayRoleId) {
    const firstInput = div.querySelector(".unit-id-input");
    if (firstInput) {
      firstInput.focus();
    }
  }
}

function addSkillFromDropdownForTab(tabId) {
  const dropdown = document.getElementById(`skill-dropdown-${tabId}`);
  if (!dropdown || !dropdown.value) return;

  const skillId = dropdown.value;
  const container = document.getElementById(`edit-skills-${tabId}`);
  if (!container) return;

  // Check if skill is already added
  if (
    Array.from(container.children).some(
      (item) => item.querySelector(".skill-name").textContent === skillId
    )
  ) {
    return;
  }

  // Create new skill item
  const skillDiv = document.createElement("div");
  skillDiv.className = "skill-item-edit";
  skillDiv.innerHTML = `
    <span class="skill-name">${skillId}</span>
    <button type="button" class="remove-btn danger-btn" title="Remove this skill">×</button>
  `;

  container.appendChild(skillDiv);

  // Add remove functionality
  const removeBtn = skillDiv.querySelector(".remove-btn");
  removeBtn.addEventListener("click", function () {
    skillDiv.remove();
    addSkillBackToDropdownForTab(skillId, tabId);
  });

  // Remove from dropdown
  const option = Array.from(dropdown.options).find(
    (opt) => opt.value === skillId
  );
  if (option) {
    option.remove();
  }

  // Clear search and reset dropdown
  const searchInput = document.getElementById(`skill-search-${tabId}`);
  if (searchInput) {
    searchInput.value = "";
    // Show all remaining options
    Array.from(dropdown.options).forEach((opt) => (opt.style.display = ""));
  }

  dropdown.value = "";
}

function addSkillBackToDropdownForTab(skillId, tabId) {
  const dropdown = document.getElementById(`skill-dropdown-${tabId}`);
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
      (item) => item.querySelector(".skill-name").textContent === skillId
    )
  ) {
    return;
  }

  // Create new skill item
  const skillDiv = document.createElement("div");
  skillDiv.className = "skill-item-edit";
  skillDiv.innerHTML = `
    <span class="skill-name">${skillId}</span>
    <button type="button" class="remove-btn danger-btn" title="Remove this skill">×</button>
  `;

  container.appendChild(skillDiv);

  // Add remove functionality
  const removeBtn = skillDiv.querySelector(".remove-btn");
  removeBtn.addEventListener("click", function () {
    skillDiv.remove();
    addSkillBackToDropdown(skillId);
  });

  // Remove from dropdown
  const option = Array.from(dropdown.options).find(
    (opt) => opt.value === skillId
  );
  if (option) {
    option.remove();
  }

  // Clear search and reset dropdown
  const searchInput = document.getElementById("skill-search");
  if (searchInput) {
    searchInput.value = "";
    // Show all remaining options
    Array.from(dropdown.options).forEach((opt) => (opt.style.display = ""));
  }

  dropdown.value = "";
}

function addSkillAssignment() {
  addSkillFromDropdown();
}

async function handleSubjectEditorSubmit(event) {
  console.error("Subject editor form submitted");
  event.preventDefault();
  const form = event.target;

  // Extract tabId from the form ID
  const formId = form.id;
  const tabId = formId.replace("subject-editor-form-", "");

  const subjectId = form.querySelector(`#edit-subject-id-${tabId}`).value;
  const subjectUid = form.querySelector(`#edit-subject-uid-${tabId}`).value;

  const pairs = Array.from(form.querySelectorAll(".unit-role-item"))
    .map((pair) => ({
      unit: pair.querySelector(".unit-id-input").value,
      role: pair.querySelector(".role-id-input").value,
    }))
    .filter((p) => p.unit && p.role);

  const skills = Array.from(
    form.querySelectorAll(".skill-item-edit .skill-name")
  ).map((span) => span.textContent);

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
      showEditMessageForTab("✅ Changes saved successfully!", "success", tabId);
      setTimeout(() => {
        window.uidash_close_tab(form.closest("[data-belongs-to-tab]"));
      }, 1500);
    } else {
      throw new Error(await response.text());
    }
  } catch (error) {
    console.error("Save failed:", error);
    showEditMessageForTab(`🚨 Save failed: ${error.message}`, "error", tabId);
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

// Global variables for management interfaces
let currentSubjects = [];
let currentUnits = [];
let currentRoles = [];
let editingSubjectId = null;
let editingUnitId = null;
let editingRoleId = null;

// Subject Management Functions
async function loadSubjectsList() {
  try {
    const response = await fetch(`${apiBaseUrl}/subjects`);
    if (!response.ok) throw new Error("Failed to fetch subjects");
    const subjectsBasicInfo = await response.json();

    // Store basic subject info without making additional requests
    currentSubjects = subjectsBasicInfo.map(subjectInfo => ({
      ...subjectInfo,
      relations: [], // Will be populated when editing
      skills: []
    }));
    
    displaySubjectsList(currentSubjects);
  } catch (error) {
    console.error("Error loading subjects:", error);
    displayMessage(
      "Failed to load subjects list.",
      "error",
      "messages-subjects"
    );
  }
}

function displaySubjectsList(subjects) {
  const subjectsList = document.getElementById("subjects-list");
  if (!subjectsList) return;

  if (subjects.length === 0) {
    subjectsList.innerHTML =
      '<div class="subjects-empty">No subjects found. Add your first subject!</div>';
    return;
  }

  subjectsList.innerHTML = subjects
    .map((subject) => `
      <div class="subject-list-item" data-subject-id="${subject.id}">
        <div class="subject-info">
          <div class="subject-name">${subject.id}</div>
          <div class="subject-uid">${subject.uid || subject.id}</div>
        </div>
        <div class="subject-actions">
          <button class="subject-edit-btn" onclick="editSubject('${subject.id}')">Edit</button>
          <button class="subject-delete-btn" onclick="deleteSubject('${subject.id}')">Delete</button>
        </div>
      </div>
    `)
    .join("");
}

function addUnitRolePair(unitId = "", roleId = "") {
  console.log("addUnitRolePair called with:", unitId, roleId);

  // If no parameters provided, get values from input fields
  if (!unitId && !roleId) {
    const unitInput = document.getElementById("unit-id-input");
    const roleInput = document.getElementById("role-id-input");

    if (unitInput) unitId = unitInput.value.trim();
    if (roleInput) roleId = roleInput.value.trim();

    console.log("Got values from inputs:", unitId, roleId);

    // Clear the input fields after getting values
    if (unitInput) unitInput.value = "";
    if (roleInput) roleInput.value = "";
  }

  // Try to find the appropriate container - static form first, then dynamic editor
  let container = document.getElementById("unit-role-pairs");
  if (!container) {
    container = document.getElementById("edit-unit-role-pairs");
  }

  if (!container) {
    console.error("No suitable container found for unit-role pairs");
    return;
  }

  console.log("Using container:", container.id);

  const div = document.createElement("div");
  div.className = "unit-role-item";

  // Use placeholder values if inputs are empty to make them visible
  const displayUnitId = unitId || "";
  const displayRoleId = roleId || "";

  div.innerHTML = `
    <input type="text" class="unit-id-input" value="${displayUnitId}" placeholder="Enter Unit ID">
    <input type="text" class="role-id-input" value="${displayRoleId}" placeholder="Enter Role ID">
    <button type="button" class="remove-relation-btn">×</button>
  `;

  div.querySelector(".remove-relation-btn").addEventListener("click", () => {
    console.log("Removing unit-role pair");
    container.removeChild(div);
  });

  container.appendChild(div);
  console.log(
    "Unit-role pair added successfully. Container now has",
    container.children.length,
    "children"
  );

  // Focus on the first input if both are empty
  if (!displayUnitId && !displayRoleId) {
    const firstInput = div.querySelector(".unit-id-input");
    if (firstInput) {
      firstInput.focus();
    }
  }
}

async function editSubject(subjectId) {
  try {
    const response = await fetch(`${apiBaseUrl}/subjects/${subjectId}`);
    if (!response.ok) throw new Error("Failed to fetch subject");

    const subject = await response.json();
    console.log("Edit subject - received subject data:", subject);

    // Check if we're in the static management form or need to open the dynamic editor
    const staticForm = document.getElementById("subject-editor-title");
    const unitRolePairsContainer = document.getElementById("unit-role-pairs");

    if (staticForm && unitRolePairsContainer) {
      // We're in the static management form
      editingSubjectId = subjectId;

      // Update form title and button
      staticForm.textContent = `Edit Subject: ${subjectId}`;
      document.getElementById("subject-submit-btn").textContent =
        "Update Subject";
      document.getElementById("cancel-subject-btn").style.display =
        "inline-block";

      // Populate form
      document.getElementById("subject-id").value = subjectId;
      document.getElementById("subject-id").readOnly = true;

      // Clear existing unit-role pairs
      unitRolePairsContainer.innerHTML = "";

      // Add existing unit-role pairs
      if (subject.relations && subject.relations.length > 0) {
        subject.relations.forEach((relation) => {
          addUnitRolePair(relation.unit, relation.role);
        });
      }

      // Highlight selected subject in list
      document.querySelectorAll(".subject-list-item").forEach((item) => {
        item.classList.remove("selected");
      });
      document
        .querySelector(`[data-subject-id="${subjectId}"]`)
        ?.classList.add("selected");
    } else {
      // We're not in the static form, open the dynamic editor instead
      // Use the uid if available, otherwise use the id
      const subjectUid = subject.uid || subjectId;
      console.log("Opening dynamic editor for uid:", subjectUid);
      openSubjectEditor(subjectUid);
    }
  } catch (error) {
    console.error("Error editing subject:", error);
    displayMessage(
      "Failed to load subject for editing.",
      "error",
      "messages-subjects"
    );
  }
}

async function deleteSubject(subjectId) {
  if (
    !confirm(
      `Are you sure you want to delete the subject "${subjectId}"? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/subjects/${subjectId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      displayMessage(
        "Subject deleted successfully.",
        "success",
        "messages-subjects"
      );
      loadSubjectsList(); // Refresh the list
      if (editingSubjectId === subjectId) {
        cancelSubjectEdit();
      }
    } else {
      const errorText = await response.text();
      displayMessage(
        `Error deleting subject: ${errorText}`,
        "error",
        "messages-subjects"
      );
    }
  } catch (error) {
    console.error("Error deleting subject:", error);
    displayMessage(
      "An error occurred while deleting the subject.",
      "error",
      "messages-subjects"
    );
  }
}

function cancelSubjectEdit() {
  editingSubjectId = null;
  const titleElement = document.getElementById("subject-editor-title");
  if (titleElement) {
    titleElement.textContent = "Add New Subject";
  }
  
  const submitBtn = document.getElementById("subject-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = "Add Subject";
  }
  
  const cancelBtn = document.getElementById("cancel-subject-btn");
  if (cancelBtn) {
    cancelBtn.style.display = "none";
  }
  
  const subjectIdInput = document.getElementById("subject-id");
  if (subjectIdInput) {
    subjectIdInput.readOnly = false;
  }
  
  const form = document.getElementById("manage-subjects-form");
  if (form) {
    form.reset();
  }
  
  const unitRolePairs = document.getElementById("unit-role-pairs");
  if (unitRolePairs) {
    unitRolePairs.innerHTML = "";
  }

  // Remove selection highlight
  document.querySelectorAll(".subject-list-item").forEach((item) => {
    item.classList.remove("selected");
  });
}

// Unit Management Functions
async function loadUnitsList() {
  try {
    const response = await fetch(`${apiBaseUrl}/units`);
    if (!response.ok) throw new Error("Failed to fetch units");
    const units = await response.json();
    currentUnits = units;
    displayUnitsList(units);
  } catch (error) {
    console.error("Error loading units:", error);
    displayMessage("Failed to load units list.", "error", "messages-units");
  }
}

function displayUnitsList(units) {
  const unitsList = document.getElementById("units-list");
  if (!unitsList) return;

  if (units.length === 0) {
    unitsList.innerHTML =
      '<div class="units-empty">No units found. Add your first unit!</div>';
    return;
  }

  unitsList.innerHTML = units
    .map(
      (unit) => `
    <div class="unit-list-item" data-unit-id="${unit.id}">
      <div class="unit-info">
        <div class="unit-name">${unit.id}</div>
        <div class="unit-parent">${
          unit.parent ? `Parent: ${unit.parent}` : "No parent"
        }</div>
      </div>
      <div class="unit-actions">
        <button class="unit-edit-btn" onclick="editUnit('${
          unit.id
        }')">Edit</button>
        <button class="unit-delete-btn" onclick="deleteUnit('${
          unit.id
        }')">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

async function editUnit(unitId) {
  try {
    const response = await fetch(`${apiBaseUrl}/units/${unitId}`);
    if (!response.ok) throw new Error("Failed to fetch unit");

    const unit = await response.json();
    editingUnitId = unitId;

    // Update form title and button
    const titleElement = document.getElementById("unit-editor-title");
    if (titleElement) {
      titleElement.textContent = `Edit Unit: ${unitId}`;
    }
    
    const submitBtn = document.getElementById("unit-submit-btn");
    if (submitBtn) {
      submitBtn.textContent = "Update Unit";
    }
    
    const cancelBtn = document.getElementById("cancel-unit-btn");
    if (cancelBtn) {
      cancelBtn.style.display = "inline-block";
    }

    // Populate form
    const unitIdInput = document.getElementById("unit-id");
    if (unitIdInput) {
      unitIdInput.value = unitId;
      unitIdInput.readOnly = true;
    }
    
    const unitParentInput = document.getElementById("unit-parent-id");
    if (unitParentInput) {
      unitParentInput.value = unit.parent || "";
    }

    // Highlight selected unit in list
    document.querySelectorAll(".unit-list-item").forEach((item) => {
      item.classList.remove("selected");
    });
    document
      .querySelector(`[data-unit-id="${unitId}"]`)
      ?.classList.add("selected");
  } catch (error) {
    console.error("Error editing unit:", error);
    displayMessage(
      "Failed to load unit for editing.",
      "error",
      "messages-units"
    );
  }
}

async function deleteUnit(unitId) {
  if (
    !confirm(
      `Are you sure you want to delete the unit "${unitId}"? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/units/${unitId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      displayMessage("Unit deleted successfully.", "success", "messages-units");
      loadUnitsList(); // Refresh the list
      if (editingUnitId === unitId) {
        cancelUnitEdit();
      }
    } else {
      const errorText = await response.text();
      displayMessage(
        `Error deleting unit: ${errorText}`,
        "error",
        "messages-units"
      );
    }
  } catch (error) {
    console.error("Error deleting unit:", error);
    displayMessage(
      "An error occurred while deleting the unit.",
      "error",
      "messages-units"
    );
  }
}

function cancelUnitEdit() {
  editingUnitId = null;
  const titleElement = document.getElementById("unit-editor-title");
  if (titleElement) {
    titleElement.textContent = "Add New Unit";
  }
  
  const submitBtn = document.getElementById("unit-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = "Add Unit";
  }
  
  const cancelBtn = document.getElementById("cancel-unit-btn");
  if (cancelBtn) {
    cancelBtn.style.display = "none";
  }
  
  const unitIdInput = document.getElementById("unit-id");
  if (unitIdInput) {
    unitIdInput.readOnly = false;
  }
  
  const form = document.getElementById("manage-units-form");
  if (form) {
    form.reset();
  }

  // Remove selection highlight
  document.querySelectorAll(".unit-list-item").forEach((item) => {
    item.classList.remove("selected");
  });
}

// Role Management Functions
async function loadRolesList() {
  try {
    const response = await fetch(`${apiBaseUrl}/roles`);
    if (!response.ok) throw new Error("Failed to fetch roles");
    const roles = await response.json();
    currentRoles = roles;
    displayRolesList(roles);
  } catch (error) {
    console.error("Error loading roles:", error);
    displayMessage("Failed to load roles list.", "error", "messages-roles");
  }
}

function displayRolesList(roles) {
  const rolesList = document.getElementById("roles-list");
  if (!rolesList) return;

  if (roles.length === 0) {
    rolesList.innerHTML =
      '<div class="roles-empty">No roles found. Add your first role!</div>';
    return;
  }

  rolesList.innerHTML = roles
    .map((role) => {
      const parentCount = role.parents ? role.parents.length : 0;
      const parentText =
        parentCount > 0 ? `${parentCount} parent(s)` : "No parents";

      return `
      <div class="role-list-item" data-role-id="${role.id}">
        <div class="role-info">
          <div class="role-name">${role.id}</div>
          <div class="role-parents-count">${parentText}</div>
        </div>
        <div class="role-actions">
          <button class="role-edit-btn" onclick="editRole('${role.id}')">Edit</button>
          <button class="role-delete-btn" onclick="deleteRole('${role.id}')">Delete</button>
        </div>
      </div>
    `;
    })
    .join("");
}

async function editRole(roleId) {
  try {
    const response = await fetch(`${apiBaseUrl}/roles/${roleId}`);
    if (!response.ok) throw new Error("Failed to fetch role");

    const role = await response.json();
    editingRoleId = roleId;

    // Update form title and button
    const titleElement = document.getElementById("role-editor-title");
    if (titleElement) {
      titleElement.textContent = `Edit Role: ${roleId}`;
    }
    
    const submitBtn = document.getElementById("role-submit-btn");
    if (submitBtn) {
      submitBtn.textContent = "Update Role";
    }
    
    const cancelBtn = document.getElementById("cancel-role-btn");
    if (cancelBtn) {
      cancelBtn.style.display = "inline-block";
    }

    // Populate form
    const roleIdInput = document.getElementById("role-id");
    if (roleIdInput) {
      roleIdInput.value = roleId;
      roleIdInput.readOnly = true;
    }

    // Clear existing parent roles
    const roleParents = document.getElementById("role-parents");
    if (roleParents) {
      roleParents.innerHTML = "";
    }

    // Add existing parent roles
    if (role.parents && role.parents.length > 0) {
      role.parents.forEach((parentId) => {
        addRoleParentItem(parentId);
      });
    }

    // Highlight selected role in list
    document.querySelectorAll(".role-list-item").forEach((item) => {
      item.classList.remove("selected");
    });
    document
      .querySelector(`[data-role-id="${roleId}"]`)
      ?.classList.add("selected");
  } catch (error) {
    console.error("Error editing role:", error);
    displayMessage(
      "Failed to load role for editing.",
      "error",
      "messages-roles"
    );
  }
}

async function deleteRole(roleId) {
  if (
    !confirm(
      `Are you sure you want to delete the role "${roleId}"? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/roles/${roleId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      displayMessage("Role deleted successfully.", "success", "messages-roles");
      loadRolesList(); // Refresh the list
      if (editingRoleId === roleId) {
        cancelRoleEdit();
      }
    } else {
      const errorText = await response.text();
      displayMessage(
        `Error deleting role: ${errorText}`,
        "error",
        "messages-roles"
      );
    }
  } catch (error) {
    console.error("Error deleting role:", error);
    displayMessage(
      "An error occurred while deleting the role.",
      "error",
      "messages-roles"
    );
  }
}

function cancelRoleEdit() {
  editingRoleId = null;
  const titleElement = document.getElementById("role-editor-title");
  if (titleElement) {
    titleElement.textContent = "Add New Role";
  }
  
  const submitBtn = document.getElementById("role-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = "Add Role";
  }
  
  const cancelBtn = document.getElementById("cancel-role-btn");
  if (cancelBtn) {
    cancelBtn.style.display = "none";
  }
  
  const roleIdInput = document.getElementById("role-id");
  if (roleIdInput) {
    roleIdInput.readOnly = false;
  }
  
  const form = document.getElementById("manage-roles-form");
  if (form) {
    form.reset();
  }
  
  const roleParents = document.getElementById("role-parents");
  if (roleParents) {
    roleParents.innerHTML = "";
  }

  // Remove selection highlight
  document.querySelectorAll(".role-list-item").forEach((item) => {
    item.classList.remove("selected");
  });
}

function addRoleParentItem(parentId = "") {
  const container = document.getElementById("role-parents");
  if (!container) return;

  // If no parentId provided, get from input field
  if (!parentId) {
    const parentInput = document.getElementById("parent-role-input");
    parentId = parentInput ? parentInput.value.trim() : "";

    if (!parentId) {
      displayMessage("Parent Role ID is required.", "error", "messages-roles");
      return;
    }

    // Clear the input field
    if (parentInput) {
      parentInput.value = "";
    }
  }

  const parentDiv = document.createElement("div");
  parentDiv.className = "role-parent-pair";
  parentDiv.innerHTML = `
    <input type="text" class="role-parent-input" value="${parentId}" placeholder="Parent ID" readonly>
    <button type="button" class="remove-btn danger-btn" title="Remove this parent">×</button>
  `;

  container.appendChild(parentDiv);

  const removeBtn = parentDiv.querySelector(".remove-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      parentDiv.remove();
    });
  }
}

// Setup role form events specifically 
function setupSkillFormEvents() {
  console.log("Setting up skill form events...");
  
  // Skills - Add Relation button
  const addRelationBtn = document.getElementById('add-relation-btn');
  if (addRelationBtn && !addRelationBtn.hasAttribute('data-event-setup')) {
    console.log("Setting up add relation button events");
    addRelationBtn.addEventListener('click', function() {
      const skillDropdown = document.getElementById('available-skills-dropdown');
      const selectedSkillId = skillDropdown ? skillDropdown.value : '';
      if (selectedSkillId) {
        addRelationItem(selectedSkillId);
        skillDropdown.value = ''; // Clear the dropdown selection
      } else {
        displayMessage("Please select a skill from the dropdown first.", "error", "messages-skills");
      }
    });
    addRelationBtn.setAttribute('data-event-setup', 'true');
  }

  // Skills - Add Manual Relation button
  const addManualRelationBtn = document.getElementById('add-manual-relation-btn');
  if (addManualRelationBtn && !addManualRelationBtn.hasAttribute('data-event-setup')) {
    console.log("Setting up add manual relation button events");
    addManualRelationBtn.addEventListener('click', function() {
      addRelationItem(); // Call without relationId to create manual input
    });
    addManualRelationBtn.setAttribute('data-event-setup', 'true');
  }

  // Skills form submission
  const skillsForm = document.getElementById('manage-skills-form');
  if (skillsForm && !skillsForm.hasAttribute('data-event-setup')) {
    console.log("Setting up skills form submit events");
    skillsForm.addEventListener('submit', handleSkillFormSubmit);
    skillsForm.setAttribute('data-event-setup', 'true');
  }
}

function setupRoleFormEvents() {
  // Role form submission
  const roleForm = document.getElementById('manage-roles-form');
  if (roleForm && !roleForm.hasAttribute('data-event-setup')) {
    console.log("Setting up role form events");
    roleForm.addEventListener('submit', handleRoleFormSubmit);
    roleForm.setAttribute('data-event-setup', 'true');
  }

  // Add role parent button
  const addRoleParentBtn = document.getElementById('add-role-parent-btn');
  if (addRoleParentBtn && !addRoleParentBtn.hasAttribute('data-event-setup')) {
    console.log("Setting up add role parent button events");
    addRoleParentBtn.addEventListener('click', addRoleParent);
    addRoleParentBtn.setAttribute('data-event-setup', 'true');
  }

  // Allow Enter key in parent role input to add parent
  const parentRoleInput = document.getElementById('parent-role-input');
  if (parentRoleInput && !parentRoleInput.hasAttribute('data-event-setup')) {
    parentRoleInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addRoleParent();
      }
    });
    parentRoleInput.setAttribute('data-event-setup', 'true');
  }
}

// Setup form event listeners
function setupFormEventListeners() {
  console.log("Setting up form event listeners...");
  
  // Role form submission
  const roleForm = document.getElementById('manage-roles-form');
  if (roleForm) {
    console.log("Found role form, adding submit listener");
    roleForm.addEventListener('submit', handleRoleFormSubmit);
  } else {
    console.log("Role form not found");
  }

  // Add role parent button
  const addRoleParentBtn = document.getElementById('add-role-parent-btn');
  if (addRoleParentBtn) {
    console.log("Found add role parent button, adding click listener");
    addRoleParentBtn.addEventListener('click', addRoleParent);
  } else {
    console.log("Add role parent button not found");
  }

  // Subject form submission
  const subjectForm = document.getElementById('manage-subjects-form');
  if (subjectForm) {
    subjectForm.addEventListener('submit', handleSubjectFormSubmit);
  }

  // Unit form submission
  const unitForm = document.getElementById('manage-units-form');
  if (unitForm) {
    unitForm.addEventListener('submit', handleUnitFormSubmit);
  }

  // Skills form submission
  const skillsForm = document.getElementById('manage-skills-form');
  if (skillsForm) {
    skillsForm.addEventListener('submit', handleSkillFormSubmit);
  }

  // Allow Enter key in parent role input to add parent
  const parentRoleInput = document.getElementById('parent-role-input');
  if (parentRoleInput) {
    parentRoleInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addRoleParent();
      }
    });
  }
}

// Initialize the application
$(document).ready(function () {
  // Get API base URL from server configuration
  $.ajax({
    url: "index.conf",
    dataType: "json",
    success: function (res) {
      apiBaseUrl = res.server;
      console.log("API Base URL set to:", apiBaseUrl);

      // Setup lazy loading for management tabs to reduce initial page load requests
      // Use MutationObserver to detect when tabs become active
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target;
            const belongsToTab = target.getAttribute('data-belongs-to-tab');
            
            // Check if this area became active (class changed from 'inactive' to active)
            if (belongsToTab && !target.classList.contains('inactive')) {
              switch(belongsToTab) {
                case 'manage-subjects':
                  if (currentSubjects.length === 0) {
                    loadSubjectsList();
                  }
                  break;
                case 'manage-units':
                  if (currentUnits.length === 0) {
                    loadUnitsList();
                  }
                  break;
                case 'manage-roles':
                  if (currentRoles.length === 0) {
                    loadRolesList();
                  }
                  // Setup role form events when tab becomes active
                  setupRoleFormEvents();
                  break;
                case 'manage-skills':
                  if (currentSkills.length === 0) {
                    loadSkillsList();
                  }
                  // Setup skill form events when tab becomes active
                  setupSkillFormEvents();
                  break;
              }
            }
          }
        });
      });

      // Observe all ui-area elements for class changes
      document.querySelectorAll('ui-area[data-belongs-to-tab]').forEach(area => {
        observer.observe(area, { attributes: true, attributeFilter: ['class'] });
      });

      // Setup form event listeners
      setupFormEventListeners();
    },
    error: function () {
      console.error("Failed to load server configuration");
    },
  });
});

// Export functions to global scope for HTML access
window.handleSubjectFormSubmit = handleSubjectFormSubmit;
window.handleUnitFormSubmit = handleUnitFormSubmit;
window.handleRoleFormSubmit = handleRoleFormSubmit;
window.handleSkillFormSubmit = handleSkillFormSubmit;
window.addUnitRolePair = addUnitRolePair;
window.addRoleParent = addRoleParent;
window.addRoleParentItem = addRoleParentItem;
window.editSubject = editSubject;
window.deleteSubject = deleteSubject;
window.cancelSubjectEdit = cancelSubjectEdit;
window.editUnit = editUnit;
window.deleteUnit = deleteUnit;
window.cancelUnitEdit = cancelUnitEdit;
window.editRole = editRole;
window.deleteRole = deleteRole;
window.cancelRoleEdit = cancelRoleEdit;
window.addRoleParentItem = addRoleParentItem;
// Tab-specific functions for subject editor
window.addUnitRolePairForTab = addUnitRolePairForTab;
window.addSkillFromDropdownForTab = addSkillFromDropdownForTab;
window.addSkillBackToDropdownForTab = addSkillBackToDropdownForTab;
window.showEditMessageForTab = showEditMessageForTab;
