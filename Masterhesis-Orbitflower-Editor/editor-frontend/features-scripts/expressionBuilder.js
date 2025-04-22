let currentExpression = [];
let expressionHistory = [];
let draggedItem = null;
window.expressionBuilderPaused = false;

document.addEventListener("graphRendered", function () {
  console.log("Expression Builder Loaded correctly");
  createExpressionBuilderUI();
});

document.addEventListener("click", function (event) {
  if (window.expressionBuilderPaused) return;

  if (event.target.tagName === "circle") {
    const entityDocId = event.target.parentElement.getAttribute("id");
    const entityType = event.target.parentElement.getAttribute("class");

    const entityId = document.getElementById(`${entityDocId}_text`).textContent;

    console.log(
      "It seems that you clicked on a ",
      entityType + " with id ",
      entityId
    );

    addEntityToExpression(entityId, entityType, event.target);
    event.stopPropagation();
  } else if (event.target.tagName === "path") {
    const skillId = event.target.getAttribute("data-skill-id");

    const entityDocId =
      event.target.parentElement.parentElement.getAttribute("id");
    const entityId = document.getElementById(`${entityDocId}_text`).textContent;
    const entityType =
      event.target.parentElement.parentElement.getAttribute("class");

    console.log(
      "It seems that you clicked on a ",
      entityType + " with id ",
      entityId,
      " and skill with id ",
      skillId
    );

    // Add skill to expression with explicit parent entity reference
    addSkillToExpression(skillId, event.target, entityId, entityType);
    event.stopPropagation(); // Stop propagation to prevent zooming
  } else {
    return; 
  }
});

function createExpressionBuilderUI() {
  const container = document.querySelector("#expressionBuilder");
  container.id = "expressionBuilder";

  container.style.margin = "0";
  container.style.backgroundColor = "white";
  container.style.padding = "10px";
  container.style.zIndex = "1000";
  container.style.maxWidth = "100%"; // Maximum width constraint

  // Create a header with the title, pause/resume and collapse/expand buttons
  const headerContainer = document.createElement("div");
  headerContainer.style.display = "flex";
  headerContainer.style.justifyContent = "space-between";
  headerContainer.style.alignItems = "center";
  headerContainer.style.cursor = "move"; // indicates that it is draggable

  const title = document.createElement("h3");
  title.textContent = "Expression Builder";
  title.style.margin = "0 0 10px 0";
  title.style.fontSize = "16px";

  const buttonContainer = document.createElement("div");

  // Pause/Resume Button
  const pauseResumeBtn = document.createElement("button");
  updatePauseButtonState(pauseResumeBtn);
  pauseResumeBtn.style.fontSize = "11px";
  pauseResumeBtn.style.padding = "3px 5px";
  pauseResumeBtn.onclick = function () {
    toggleExpressionBuilderPause();
    updatePauseButtonState(pauseResumeBtn);
  };



  buttonContainer.appendChild(pauseResumeBtn);

  headerContainer.appendChild(title);
  headerContainer.appendChild(buttonContainer);

  // Create a separate container for all the non-header UI (this will be togglable)
  const contentContainer = document.createElement("div");

  const expressionDisplay = document.createElement("div");
  expressionDisplay.id = "currentExpression";
  expressionDisplay.style.marginBottom = "10px";
  expressionDisplay.style.padding = "5px";
  expressionDisplay.style.border = "1px solid #eee";
  expressionDisplay.style.minHeight = "60px";
  expressionDisplay.style.maxHeight = "150px";
  expressionDisplay.style.overflowY = "auto";
  expressionDisplay.style.background = "#f9f9f9";
  expressionDisplay.textContent = "Click on elements to build expression";

  expressionDisplay.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  expressionDisplay.addEventListener("drop", (e) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"));
    const target = e.target.closest(".expr-item");

    if (!target) return;

    const targetIndex = Array.from(expressionDisplay.children).indexOf(target);
    if (sourceIndex === targetIndex) return;

    const item = currentExpression.splice(sourceIndex, 1)[0];
    currentExpression.splice(targetIndex, 0, item);
    updateExpressionDisplay();
  });

  const instructionsText = document.createElement("p");
  instructionsText.textContent =
    "Drag items to reorder. Use parentheses for complex expressions.";
  instructionsText.style.fontSize = "12px";
  instructionsText.style.color = "#666";
  instructionsText.style.margin = "5px 0";

  const buttonsContainer = document.createElement("div");
  buttonsContainer.style.display = "grid";
  buttonsContainer.style.gridTemplateColumns = "repeat(3, 1fr)";
  buttonsContainer.style.gap = "5px";
  buttonsContainer.style.marginBottom = "10px";

  const andBtn = createOperatorButton("AND", () =>
    addOperatorToExpression("AND")
  );
  const orBtn = createOperatorButton("OR", () => addOperatorToExpression("OR"));
  const notBtn = createOperatorButton("NOT", () =>
    addOperatorToExpression("NOT")
  );
  const leftParenBtn = createOperatorButton("(", () =>
    addOperatorToExpression("(")
  );
  const rightParenBtn = createOperatorButton(")", () =>
    addOperatorToExpression(")")
  );
  const deleteBtn = createOperatorButton("Delete", deleteLastCondition);
  const resetBtn = createOperatorButton("Reset", resetExpression);
  const searchBtn = createOperatorButton("Search", executeSearch);
  const undoBtn = createOperatorButton("Undo", undoLastAction);

  buttonsContainer.appendChild(andBtn);
  buttonsContainer.appendChild(orBtn);
  buttonsContainer.appendChild(notBtn);
  buttonsContainer.appendChild(leftParenBtn);
  buttonsContainer.appendChild(rightParenBtn);
  buttonsContainer.appendChild(deleteBtn);
  buttonsContainer.appendChild(undoBtn);
  buttonsContainer.appendChild(resetBtn);
  buttonsContainer.appendChild(searchBtn);

  const savedExpressionsContainer = document.createElement("div");
  savedExpressionsContainer.id = "savedExpressions";
  savedExpressionsContainer.style.borderTop = "1px solid #eee";
  savedExpressionsContainer.style.paddingTop = "10px";
  savedExpressionsContainer.style.marginTop = "10px";

  const savedExpressionsTitle = document.createElement("h4");
  savedExpressionsTitle.textContent = "Saved Expressions";
  savedExpressionsTitle.style.margin = "0 0 5px 0";
  savedExpressionsTitle.style.fontSize = "14px";

  const savedExpressionsList = document.createElement("div");
  savedExpressionsList.id = "savedExpressionsList";
  savedExpressionsList.style.maxHeight = "100px";
  savedExpressionsList.style.overflowY = "auto";

  const saveExpressionBtn = document.createElement("button");
  saveExpressionBtn.textContent = "Save Current Expression";
  saveExpressionBtn.style.marginTop = "5px";
  saveExpressionBtn.style.width = "100%";
  saveExpressionBtn.style.padding = "5px";
  saveExpressionBtn.onclick = saveCurrentExpression;

  savedExpressionsContainer.appendChild(savedExpressionsTitle);
  savedExpressionsContainer.appendChild(savedExpressionsList);
  savedExpressionsContainer.appendChild(saveExpressionBtn);

  // Append the content elements into the content container.
  contentContainer.appendChild(expressionDisplay);
  contentContainer.appendChild(instructionsText);
  contentContainer.appendChild(buttonsContainer);
  contentContainer.appendChild(savedExpressionsContainer);

  // Append header and content container to the main container.
  container.appendChild(headerContainer);
  container.appendChild(contentContainer);

  // Make the container draggable using the header as the drag handle.
  makeDraggable(container, headerContainer);
}

function makeDraggable(dragElement, handleElement) {
  let offsetX = 0, offsetY = 0;
  let isMouseDown = false;

  handleElement.addEventListener("mousedown", function(e) {
    isMouseDown = true;
    // Calculate where inside the element the click happened
    const rect = dragElement.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
    e.preventDefault();
  });

  function mouseMoveHandler(e) {
    if (!isMouseDown) return;
    dragElement.style.left = (e.clientX - offsetX) + "px";
    dragElement.style.top = (e.clientY - offsetY) + "px";
  }

  function mouseUpHandler() {
    isMouseDown = false;
    document.removeEventListener("mousemove", mouseMoveHandler);
    document.removeEventListener("mouseup", mouseUpHandler);
  }
}

// The rest of your functions remain unchanged
function toggleExpressionBuilderPause() {
  window.expressionBuilderPaused = !window.expressionBuilderPaused;
}

function updatePauseButtonState(button) {
  if (window.expressionBuilderPaused) {
    button.textContent = "Resume";
    button.title = "Resume expression builder";
    button.style.background = "#ffe0e0";
  } else {
    button.textContent = "Pause";
    button.title = "Pause expression builder";
    button.style.background = "#e0e0e0";
  }
}

function executeSearch() {
  if (currentExpression.length === 0) {
    alert("Please build an expression first");
    return;
  }

  try {
    if (!validateExpression(currentExpression)) {
      alert(
        "The expression is invalid. Please check your expression structure."
      );
      return;
    }

    // Convert expression to postfix notation for evaluation
    const postfix = infixToPostfix(currentExpression);
    const result = evaluatePostfix(postfix);

    // Update user column display
    updateUserColumnWithResults(result);
    localUpdateAfterClick();
  } catch (error) {
    console.error("Error executing search:", error);
    alert(
      "An error occurred while evaluating the expression. Check the console for details."
    );
  }
}

function infixToPostfix(infix) {
  const output = [];
  const operatorStack = [];
  const precedence = { NOT: 3, AND: 2, OR: 1 };
  infix.forEach((token) => {
    if (token.type === "skill") {
      output.push(token);
    } else if (token.value === "(") {
      operatorStack.push(token);
    } else if (token.value === ")") {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1].value !== "("
      ) {
        output.push(operatorStack.pop());
      }
      operatorStack.pop();
    } else {
      while (
        operatorStack.length > 0 &&
        precedence[operatorStack[operatorStack.length - 1].value] >=
          precedence[token.value]
      ) {
        output.push(operatorStack.pop());
      }
      operatorStack.push(token);
    }
  });

  while (operatorStack.length > 0) {
    output.push(operatorStack.pop());
  }

  return output;
}

function evaluatePostfix(postfix) {
  const stack = [];

  postfix.forEach((token) => {
    if (
      token.type === "skill" ||
      token.type === "role" ||
      token.type === "unit" ||
      token.type === "subject"
    ) {
      let subjects;
      if (token.entityId && token.entityType) {
        subjects = getSubjectsBySkillIdAndEntity(
          token.value,
          token.entityId,
          token.entityType
        );
      } else {
        subjects = getSubjectsBySkillId(token.value);
      }
      stack.push(new Set(subjects.map((s) => s.uid)));
    } else {
      const operator = token.value;
      if (operator === "NOT") {
        if (stack.length < 1) {
          console.error("Error: NOT operator requires at least one operand");
          stack.push(new Set());
          return;
        }
        const a = stack.pop();
        const allSubjects = new Set(
          Array.from(document.querySelectorAll(".subject")).map((s) =>
            s.getAttribute("data-uid")
          )
        );
        const result = new Set([...allSubjects].filter((uid) => !a.has(uid)));
        stack.push(result);
      } else {
        if (stack.length < 2) {
          console.error(`Error: ${operator} operator requires two operands`);
          stack.push(new Set());
          return;
        }
        const b = stack.pop();
        const a = stack.pop();
        let result;
        if (operator === "AND") {
          result = new Set([...a].filter((uid) => b.has(uid)));
        } else if (operator === "OR") {
          result = new Set([...a, ...b]);
        }
        stack.push(result);
      }
    }
  });

  return stack.pop() || new Set();
}

function updateUserColumnWithResults(resultSet) {
  const userColumn = document.getElementById("usercolumn");
  const subjects = userColumn.querySelectorAll(".subject");

  subjects.forEach((subject) => {
    const uid = subject.getAttribute("data-uid");
    if (resultSet.has(uid)) {
      subject.style.display = "";
      subject.classList.add("highlight");
    } else {
      subject.style.display = "none";
      subject.classList.remove("highlight");
    }
  });
}

function createOperatorButton(label, onClick) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.padding = "5px 8px";
  btn.style.fontSize = "12px";
  btn.style.cursor = "pointer";
  btn.style.border = "1px solid #ccc";
  btn.style.borderRadius = "3px";
  btn.style.background = "#f0f0f0";

  btn.addEventListener("mouseenter", function () {
    this.style.background = "#e0e0e0";
  });

  btn.addEventListener("mouseleave", function () {
    this.style.background = "#f0f0f0";
  });

  btn.onclick = function (event) {
    onClick();
    event.stopPropagation();
  };
  return btn;
}

function addEntityToExpression(entityId, entityType, element) {
  saveExpressionState();
  const displayType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  currentExpression.push({
    type: entityType,
    value: entityId,
    element: element,
    displayValue: `${displayType}:${entityId}`,
  });
  element.classList.add("active-filter-element");
  updateExpressionDisplay();
}

function addSkillToExpression(skillId, element, entityId, entityType) {
  saveExpressionState();
  const displayType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  const displayValue = `Skill:${skillId} (of ${displayType}:${entityId})`;
  currentExpression.push({
    type: "skill",
    value: skillId,
    element: element,
    entityId: entityId,
    entityType: entityType,
    displayValue: displayValue,
    relationship: {
      type: "belongsTo",
      entity: {
        id: entityId,
        type: entityType,
      },
    },
  });
  element.classList.add("active-filter-element");
  updateExpressionDisplay();
}

function addOperatorToExpression(operator) {
  if (
    currentExpression.length === 0 &&
    operator !== "NOT" &&
    operator !== "("
  ) {
    alert("Add an element before using this operator");
    return;
  }
  saveExpressionState();
  currentExpression.push({
    type: "operator",
    value: operator,
    displayValue: operator,
  });
  updateExpressionDisplay();
}

function deleteLastCondition() {
  if (currentExpression.length === 0) return;
  saveExpressionState();
  const lastItem = currentExpression.pop();
  if (lastItem.element) {
    lastItem.element.classList.remove("active-filter-element");
  }
  updateExpressionDisplay();
}

function resetExpression() {
  if (currentExpression.length === 0) return;
  saveExpressionState();
  currentExpression.forEach((item) => {
    if (item.element) {
      item.element.classList.remove("active-filter-element");
    }
  });
  currentExpression = [];
  updateExpressionDisplay();
}

function saveExpressionState() {
  expressionHistory.push(
    JSON.parse(
      JSON.stringify(
        currentExpression.map((item) => {
          const { element, ...rest } = item;
          return rest;
        })
      )
    )
  );
  if (expressionHistory.length > 20) {
    expressionHistory.shift();
  }
}

function undoLastAction() {
  if (expressionHistory.length === 0) {
    alert("Nothing to undo");
    return;
  }
  currentExpression.forEach((item) => {
    if (item.element) {
      item.element.classList.remove("active-filter-element");
    }
  });
  currentExpression = expressionHistory.pop();
  updateExpressionDisplay();
}

function updateExpressionDisplay() {
  const display = document.getElementById("currentExpression");
  display.innerHTML = "";
  currentExpression.forEach((item, index) => {
    const span = document.createElement("span");
    span.className = `expr-item ${item.type}`;
    span.textContent = item.displayValue || item.value;
    span.setAttribute("draggable", "true");
    span.style.padding = "3px 6px";
    span.style.margin = "2px";
    span.style.borderRadius = "3px";
    span.style.display = "inline-block";
    span.style.cursor = "grab";

    if (item.type === "operator") {
      span.style.background = "#d0d0ff";
    } else if (item.type === "skill") {
      span.title = `${item.value} belongs to ${item.entityType} ${item.entityId}`;
      span.style.background = "#d0ffd0";
    } else {
      span.style.background = "#ffd0d0";
    }

    span.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", index.toString());
      setTimeout(() => this.classList.add("dragging"), 0);
    });

    span.addEventListener("dragend", function () {
      this.classList.remove("dragging");
    });

    span.addEventListener("dblclick", function () {
      saveExpressionState();
      if (currentExpression[index].element) {
        currentExpression[index].element.classList.remove("active-filter-element");
      }
      currentExpression.splice(index, 1);
      updateExpressionDisplay();
    });

    display.appendChild(span);
    if (index < currentExpression.length - 1) {
      display.appendChild(document.createTextNode(" "));
    }
  });

  if (currentExpression.length === 0) {
    display.textContent = "Click on elements to build expression";
  }
}

function saveCurrentExpression() {
  if (currentExpression.length === 0) {
    alert("No expression to save");
    return;
  }
  const expressionName = prompt(
    "Name this expression:",
    "Expression " + new Date().toLocaleTimeString()
  );
  if (!expressionName) return;

  const savedExpressionsList = document.getElementById("savedExpressionsList");
  const expressionItem = document.createElement("div");
  expressionItem.style.padding = "5px";
  expressionItem.style.borderBottom = "1px solid #eee";
  expressionItem.style.cursor = "pointer";

  const expressionText = document.createElement("span");
  expressionText.textContent = expressionName;

  const loadButton = document.createElement("button");
  loadButton.textContent = "Load";
  loadButton.style.marginLeft = "10px";
  loadButton.style.fontSize = "10px";
  loadButton.style.padding = "2px 4px";

  loadButton.onclick = function (e) {
    e.stopPropagation();
    currentExpression.forEach((item) => {
      if (item.element) {
        item.element.classList.remove("active-filter-element");
      }
    });
    const savedExpression = JSON.parse(
      expressionItem.getAttribute("data-expression")
    );
    currentExpression = savedExpression;
    updateExpressionDisplay();
  };

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "×";
  deleteButton.style.float = "right";
  deleteButton.style.background = "none";
  deleteButton.style.border = "none";
  deleteButton.style.fontSize = "12px";
  deleteButton.style.cursor = "pointer";
  deleteButton.style.color = "#f00";

  deleteButton.onclick = function (e) {
    e.stopPropagation();
    savedExpressionsList.removeChild(expressionItem);
  };

  expressionItem.appendChild(expressionText);
  expressionItem.appendChild(loadButton);
  expressionItem.appendChild(deleteButton);

  expressionItem.setAttribute(
    "data-expression",
    JSON.stringify(
      currentExpression.map((item) => {
        const { element, ...rest } = item;
        return rest;
      })
    )
  );

  savedExpressionsList.appendChild(expressionItem);
}

// Add CSS for dragging elements and highlight styling
const style = document.createElement("style");
style.textContent = `
  .expr-item.dragging {
    opacity: 0.4;
  }
  .active-filter-element {
    stroke: #ff0000;
    stroke-width: 3px;
  }
`;
document.head.appendChild(style);

function getSubjectsBySkillId(skillId) {
  console.log(`Looking for subjects with skill ${skillId}`);
  const subjects = [];
  try {
    document.querySelectorAll(".subject").forEach((subject) => {
      if (
        subject.getAttribute("data-skills") &&
        subject.getAttribute("data-skills").includes(skillId)
      ) {
        subjects.push({
          uid: subject.getAttribute("data-uid"),
          element: subject,
        });
      }
    });
  } catch (error) {
    console.error("Error in getSubjectsBySkillId:", error);
  }
  console.log(`Found ${subjects.length} subjects with skill ${skillId}`);
  return subjects;
}

function getSubjectsBySkillIdAndEntity(skillId, entityId, entityType) {
  console.log(
    `Looking for subjects with skill ${skillId} related to ${entityType} ${entityId}`
  );
  const subjects = [];
  document.querySelectorAll(".subject").forEach((subject) => {
    const hasSkill =
      subject.getAttribute("data-skills") &&
      subject.getAttribute("data-skills").includes(skillId);
    const isRelatedToEntity =
      subject.getAttribute(`data-related-${entityType}`) === entityId;
    if (hasSkill && isRelatedToEntity) {
      subjects.push({
        uid: subject.getAttribute("data-uid"),
        element: subject,
      });
    }
  });
  return subjects;
}

function localUpdateAfterClick() {
  console.log("Expression updated:", currentExpression);
}

function validateExpression(expression) {
  let openParens = 0;
  let operators = 0;
  let operands = 0;
  let lastWasOperator = false;

  for (let i = 0; i < expression.length; i++) {
    const item = expression[i];

    if (item.type === "operator") {
      if (item.value === "(") {
        openParens++;
      } else if (item.value === ")") {
        openParens--;
        if (openParens < 0) return false;
      } else if (item.value === "AND" || item.value === "OR") {
        operators++;
        if (i === 0 || i === expression.length - 1) return false;
        if (lastWasOperator && expression[i - 1].value !== ")") return false;
        lastWasOperator = true;
      } else if (item.value === "NOT") {
        operators++;
        if (i === expression.length - 1) return false;
        lastWasOperator = true;
      }
    } else {
      operands++;
      lastWasOperator = false;
    }
  }
  if (openParens !== 0) return false;
  if (operators > 0 && operands === 0) return false;
  return true;
}
