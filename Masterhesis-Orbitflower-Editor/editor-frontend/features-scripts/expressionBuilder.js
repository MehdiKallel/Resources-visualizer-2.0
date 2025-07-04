class ExpressionBuilder {
  constructor(containerId) {
    this.containerId = containerId;
    this.currentExpression = [];
    this.expressionHistory = [];
    this.draggedItem = null;
    this.savedExpressions = [];
    this.apiBaseUrl = "";
    this.expressionDisplay = null; // Add this line
    this.dropTargetActive = false;
    window.addEventListener("skilldragend", this.handleSkillDrop.bind(this));
    window.addEventListener("circledragend", this.handleCircleDrop.bind(this));
    window.addEventListener("nodedragend", this.handleNodeDrop.bind(this));
    window.addEventListener("subjectdragend", this.handleSubjectDrop.bind(this));

    this.onGraphRendered = this.onGraphRendered.bind(this);

    document.addEventListener("graphRendered", this.onGraphRendered);

    $.ajax({
      url: "index.conf",
      dataType: "json",
      success: (res) => {
        this.apiBaseUrl = res.server;
        console.log(
          "ExpressionBuilder initialized with server:",
          this.apiBaseUrl
        );

        // Initialize UI
        this.createExpressionBuilderUI();

        // Load state from server
        this.loadStateFromServer();
      },
      error: (err) => {
        console.error(
          "Failed to load server configuration for ExpressionBuilder:",
          err
        );
      },
    });

    document.addEventListener('dragging-over-expression', (e) => {
      const display = document.getElementById("currentExpression");
      if (!this.dropTargetActive) {
        this.dropTargetActive = true;
        display.classList.add('drop-target-active');
        // Pulse animation on the box
        display.style.animation = 'dropPulse 1s ease-in-out infinite';
      }
    });

    document.addEventListener('dragging-exit-expression', () => {
      const display = document.getElementById("currentExpression");
      if (this.dropTargetActive) {
        this.dropTargetActive = false;
        display.classList.remove('drop-target-active');
        display.style.animation = '';
      }
    });
  }

  onGraphRendered() {
    this.highlightGraph();

    console.log("Expression Builder Loaded correctly");
  }

  handleCircleDrop({ detail }) {
    const { nodeName, nodeType, x, y } = detail;
    console.error("Circle drop event received:", detail);
    const display = document.getElementById("currentExpression");
    const rect = display.getBoundingClientRect();

    // only accept drops inside the expression box
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return;
    }

    this.saveExpressionState();


    const newItem = {
      type: nodeType, // e.g. "unit" or "role"
      value: nodeName, // the ID/text of the node
      element: null, // no DOM element to highlight
      displayValue: `${nodeType.toUpperCase()}:${nodeName}`,
    };
    console.error("new item", newItem);

    // Find target block based on drop position
    const targetBlock = this.findTargetBlock(x, y);

    if (targetBlock) {
      // Add to existing block
      if (targetBlock.items.length > 0) {
        if (!targetBlock.operators) targetBlock.operators = [];
        targetBlock.operators.push("AND");
      }
      targetBlock.items.push(newItem);
    } else {
      // Create new block
      this.currentExpression.push({
        type: "andBlock",
        items: [newItem],
        operators: [],
      });
    }

    this.updateExpressionDisplay();
  }

  highlightGraph() {
    document.querySelectorAll(".expr-highlight").forEach((el) => {
      el.classList.remove("expr-highlight");
    });

    this.currentExpression.forEach((blockOrItem) => {

      const items =
        blockOrItem.type === "andBlock" ? blockOrItem.items : [blockOrItem];

      items.forEach((it) => {
        console.error(it.type)
        if (it.type === "subject") {
          let subject = null;
          document.querySelectorAll("td.labeltext").forEach((element) => {
            if (element.textContent.includes(it.value)) {
              subject = element;
            }
          });
          if (subject) {
            const table = subject.closest("table.subject");
            if (table) {
              table.classList.add("expr-highlight");
            }
          }
          document
            .querySelectorAll(
              `table.subject[data-uid="${it.value}"], g#${it.value}`
            )
            .forEach((el) => el.classList.add("expr-highlight"));
        } else if (it.type === "skill") {
          document
            .querySelectorAll(`path[id="${it.pathId}"]`)
            .forEach((el) => el.classList.add("expr-highlight"));
          // get all documents paths which contains skill-segment in the class
          const paths = document.querySelectorAll(
            `path[class*="skill-segment"]`
          );
          paths.forEach((path) => {
            if (path.getAttribute("data-skill-id") === it.value) {
              path.classList.add("expr-highlight");
            }
          });
          // find the div element with skill-item class and the same skillId
          const skillItem = document.querySelector(
            `.skill-item[data-skill-id="${it.value}"]`
          );
          if (skillItem) {
            skillItem.classList.add("expr-highlight");
          }
          // iterate over all paths and find the one with the same pathId
        } else if (it.type === "Unit" || it.type === "Role") {
          const element = document.getElementById(it.value);

          if (element) {
            element.classList.add("expr-highlight");
          }
        }
      });
    });
  }

  handleSkillDrop({ detail }) {
    const { skillId, entityName, entityType, pathId, x, y } = detail;
    const display = document.getElementById("currentExpression");
    const rect = display.getBoundingClientRect();

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return;
    }

    this.saveExpressionState();

    const newItem = {
      type: "skill",
      value: skillId,
      element: null,
      entityId: entityName,
      entityType: entityType,
      displayValue: `Skill:${skillId} (${entityType} ${entityName})`,
      pathId: pathId,
    };

    // Find target block based on drop position 
    const targetBlock = this.findTargetBlock(x, y);

    if (targetBlock) {
      // Add to existing block
      if (targetBlock.items.length > 0) {
        if (!targetBlock.operators) targetBlock.operators = [];
        targetBlock.operators.push("AND");
      }
      targetBlock.items.push(newItem);
    } else {
      // Create new block
      this.currentExpression.push({
        type: "andBlock",
        items: [newItem],
        operators: [],
      });
    }

    this.updateExpressionDisplay();
  }

  findTargetBlock(x, y) {
    const elements = Array.from(this.expressionDisplay.children);
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        if (element.classList.contains("expr-block")) {
          const blockIndex = parseInt(element.getAttribute("data-block-index"), 10);
          return this.currentExpression[blockIndex];
        }
      }
    }
    return null;
  }

  handleNodeDrop({ detail }) {
    const {
      nodeId,
      nodeType,
      nodeText,
      entityType = "Org",
      entityName = "All",
      x,
      y
    } = detail;
    const display = document.getElementById("currentExpression");
    const rect = display.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return;
    }
    this.saveExpressionState();

    // Build a richer label including entity context
    const label = `${nodeType}: ${nodeText} (${entityType} ${entityName})`;

    const newItem = {
      type: nodeType,
      value: nodeId,
      element: null,
      entityType,
      entityId: entityName,
      displayValue: label,
    };

    // drop into an existing block or create a new one
    const targetBlock = this.findTargetBlock(x, y);
    if (targetBlock) {
      if (targetBlock.items.length > 0) {
        if (!targetBlock.operators) targetBlock.operators = [];
        targetBlock.operators.push("AND");
      }
      targetBlock.items.push(newItem);
    } else {
      this.currentExpression.push({
        type: "andBlock",
        items: [newItem],
        operators: [],
      });
    }

    this.updateExpressionDisplay();
  }

  handleSubjectDrop({ detail }) {
    const { subjectId, uid, nodeText, x, y } = detail;
    const display = document.getElementById("currentExpression");
    if (!display) return;
    const rect = display.getBoundingClientRect();

    // Only accept drops inside the expression box
    if (typeof x !== "number" || typeof y !== "number" || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return;
    }

    this.saveExpressionState();

    // Create the subject item
    const newItem = {
      type: "subject",
      value: subjectId,
      uid: uid,
      element: null,
      displayValue: `Subject:${nodeText}`,
    };

    // Find target block based on drop position
    const targetBlock = this.findTargetBlock(x, y);

    if (targetBlock) {
      if (targetBlock.items.length > 0) {
        if (!targetBlock.operators) targetBlock.operators = [];
        targetBlock.operators.push("AND");
      }
      targetBlock.items.push(newItem);
    } else {
      this.currentExpression.push({
        type: "andBlock",
        items: [newItem],
        operators: [],
      });
    }

    this.updateExpressionDisplay();
  }

  createExpressionBuilderUI() {
    const container = document.querySelector(`#${this.containerId}`);
    if (!container) {
      console.error(`Container with ID ${this.containerId} not found`);
      return;
    }

    container.innerHTML = ""; // Clear existing content
    container.style.margin = "0";
    container.style.backgroundColor = "white";
    container.style.padding = "10px";
    container.style.zIndex = "1000";
    container.style.maxWidth = "100%"; // Maximum width constraint

    // Create a header with the title and collapse/expand buttons
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
    headerContainer.appendChild(title);
    headerContainer.appendChild(buttonContainer);

    // Create a separate container for all the non-header UI (this will be togglable)
    const contentContainer = document.createElement("div");

    const expressionDisplay = document.createElement("div");
    expressionDisplay.id = "currentExpression";
    expressionDisplay.style.position = "relative";
    expressionDisplay.style.marginBottom = "10px";
    expressionDisplay.style.padding = "5px";
    expressionDisplay.style.border = "1px solid #eee";
    expressionDisplay.style.minHeight = "60px";
    expressionDisplay.style.maxHeight = "150px";
    expressionDisplay.style.overflowY = "auto";
    expressionDisplay.style.background = "#f9f9f9";
    expressionDisplay.textContent =
      "Drag and drop elements to build expression";

    this.expressionDisplay = expressionDisplay; // Store reference


    expressionDisplay.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Check if we have JSON data being dragged
      const hasJsonData = e.dataTransfer.types.includes('application/json');

      // If it's a dragged circle or other element with JSON data


      // Existing handling for expression elements
      Array.from(expressionDisplay.children).forEach((child) => {
        child.classList.remove("drop-target");
      });

      // Get all top-level elements (blocks and items)
      const elements = Array.from(expressionDisplay.children);

      // Check for direct hit on any top-level element
      let directTarget = null;
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          directTarget = element;
          break;
        }
      }

      if (directTarget) {
        directTarget.classList.add("drop-target");
      } else {
        // Find closest element based on edge proximity (horizontal)
        let closestElement = null;
        let minDistance = Infinity;

        elements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          // Calculate distance to element's left/right edges
          const distanceLeft = Math.abs(e.clientX - rect.left);
          const distanceRight = Math.abs(e.clientX - rect.right);
          const minEdgeDistance = Math.min(distanceLeft, distanceRight);

          if (minEdgeDistance < minDistance) {
            minDistance = minEdgeDistance;
            closestElement = element;
          }
        });

        if (closestElement) {
          closestElement.classList.add("drop-target");
        }
      }
      this.showBlockDropIndicator(e.clientX, e.clientY);

    });

    expressionDisplay.addEventListener("dragleave", () => {
      // Remove all highlights when leaving the container
      Array.from(expressionDisplay.children).forEach((child) => {
        child.classList.remove("drop-target");
      });
    });

    expressionDisplay.addEventListener("drop", (e) => {
      e.preventDefault();

      // Remove all drag highlights first
      Array.from(expressionDisplay.children).forEach((child) => {
        child.classList.remove("drop-target");
      });

      // Define elements array and find direct target that we'll use throughout the drop handler
      const elements = Array.from(expressionDisplay.children).filter(
        (el) => el.id !== "drop-indicator"
      );

      let directTarget = null;
      let directTargetIndex = -1;

      // Find the direct target element under cursor
      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          directTarget = elements[i];
          directTargetIndex = i;
          break;
        }
      }

      let payload = null;
      if (e.dataTransfer.types.includes("application/json")) {
        try {
          payload = JSON.parse(e.dataTransfer.getData("application/json"));
        } catch (err) {
          console.error("Error parsing drag payload:", err);
        }
      }

      // Handle skill drops
      if (payload && payload.type === "skill" && payload.id) {
        this.saveExpressionState();
        const newItem = {
          type: "skill",
          value: payload.pathId,
          element: null,
          entityId: payload.entityId || "",
          entityType: payload.entityType || "skill",
          displayValue: payload.displayValue || `Skill:${payload.id}`,
          pathId: payload.pathId || null,
        };

        // Find target block based on drop position
        const targetBlock = this.findTargetBlock(e.clientX, e.clientY);

        if (targetBlock) {
          if (targetBlock.items.length > 0) {
            if (!targetBlock.operators) targetBlock.operators = [];
            targetBlock.operators.push("AND");
          }
          targetBlock.items.push(newItem);
        } else {
          this.currentExpression.push({
            type: "andBlock",
            items: [newItem],
            operators: [],
          });
        }

        this.updateExpressionDisplay();
        return;
      }

      // Handle external entity drops
      if (payload && (payload.type === "external-entity" || payload.type === "external-subject")) {
        const nodeText = payload.nodeText || payload.entityId || "";
        const entityType = payload.entityType || "subject";
        this.addEntityToExpression(nodeText, entityType, null, e.clientX, e.clientY);
        return;
      }

      const data = e.dataTransfer.getData("text/plain");
      let sourceType, sourceBlockIndex, sourceItemIndex, sourceIndex;

      // Parse the drag data
      try {
        if (data.startsWith("block:")) {
          sourceType = "block";
          sourceIndex = parseInt(data.split(":")[1], 10);
        } else {
          const parsedData = JSON.parse(data);
          if (parsedData.type === "blockItem") {
            sourceType = "blockItem";
            sourceBlockIndex = parsedData.blockIndex;
            sourceItemIndex = parsedData.itemIndex;
          } else {
            sourceType = "item";
            sourceIndex = parseInt(data, 10);
          }
        }
      } catch {
        sourceType = "item";
        sourceIndex = parseInt(data, 10);
      }

      // Get drop position
      const dropPosition = this.getDropPosition(
        expressionDisplay,
        e.clientX,
        e.clientY,
        directTarget
      );

      // Handle block-to-block merging
      if (sourceType === "block" && dropPosition.type === "block") {
        // Prevent merging block with itself
        if (sourceIndex === dropPosition.index) {
          return;
        }

        this.saveExpressionState();
        const sourceBlock = this.currentExpression[sourceIndex];
        const targetBlock = this.currentExpression[dropPosition.index];

        // Add AND operator between the last item of target and first item of source
        if (targetBlock.items.length > 0) {
          if (!targetBlock.operators) {
            targetBlock.operators = [];
          }
          targetBlock.operators.push("AND");
        }

        // Merge items and operators
        targetBlock.items = targetBlock.items.concat(sourceBlock.items);
        if (sourceBlock.operators) {
          targetBlock.operators = targetBlock.operators.concat(sourceBlock.operators);
        }

        // Remove the source block
        this.currentExpression.splice(sourceIndex, 1);
        this.updateExpressionDisplay();
        return;
      }

      // Prevent blocks from being merged into non-block elements
      if (sourceType === "block" && dropPosition.type !== "block") {
        this.saveExpressionState();
        const block = this.currentExpression.splice(sourceIndex, 1)[0];
        if (sourceIndex < dropPosition.index) {
          dropPosition.index--;
        }
        this.currentExpression.splice(dropPosition.index, 0, block);
        this.updateExpressionDisplay();
        return;
      }

      // Standard drop position calculation
      // ── NEW: if dropping a blockItem back into its own andBlock, swap positions ──
      if (
        sourceType === "blockItem" &&
        dropPosition.type === "block" &&
        dropPosition.index === sourceBlockIndex
      ) {
        this.saveExpressionState();
        const block = this.currentExpression[sourceBlockIndex];
        const blockEl = elements[sourceBlockIndex];
        if (!blockEl) {
          console.warn("Block element not found, aborting swap");
          return;
        }
        const rect = blockEl.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const itemCount = block.items.length;
        let targetItemIndex = Math.floor((relativeX / rect.width) * itemCount);
        targetItemIndex = Math.max(0, Math.min(itemCount - 1, targetItemIndex));
        // swap in the model
        [block.items[sourceItemIndex], block.items[targetItemIndex]] = [
          block.items[targetItemIndex],
          block.items[sourceItemIndex],
        ];
        this.updateExpressionDisplay();
        return;
      }

      // ── existing: remove the dragged item from the source ──
      let draggedItem;
      if (sourceType === "blockItem") {
        const sourceBlock = this.currentExpression[sourceBlockIndex];
        if (!sourceBlock || !sourceBlock.items) {
          console.warn("Invalid source block or missing items array");
          return;
        }

        try {
          draggedItem = sourceBlock.items.splice(sourceItemIndex, 1)[0];
          if (!draggedItem) {
            console.warn("Failed to remove item from source block");
            return;
          }

          // Remove empty blocks
          if (sourceBlock.items.length === 0) {
            this.currentExpression.splice(sourceBlockIndex, 1);
            if (sourceBlockIndex < dropPosition.index) {
              dropPosition.index--;
            }
          }
        } catch (err) {
          console.error("Error handling block item drag:", err);
          return;
        }
      } else if (sourceType === "block") {
        draggedItem = this.currentExpression.splice(sourceIndex, 1)[0];
        if (sourceIndex < dropPosition.index) {
          dropPosition.index--;
        }
      } else {
        draggedItem = this.currentExpression.splice(sourceIndex, 1)[0];
        if (sourceIndex < dropPosition.index) {
          dropPosition.index--;
        }
      }

      if (!draggedItem) {
        console.warn("No valid item to drag");
        return;
      }

      // ── Handle dropping item at the new location ──
      if (dropPosition.type === "block" && draggedItem.type !== "operator") {
        // Add to existing block
        if (this.currentExpression[dropPosition.index] &&
          this.currentExpression[dropPosition.index].items) {
          this.currentExpression[dropPosition.index].items.push(draggedItem);
        }
      } else {
        // Create new block for single items
        if (draggedItem.type !== "operator" && draggedItem.type !== "andBlock") {
          draggedItem = {
            type: "andBlock",
            items: [draggedItem],
            operators: []
          };
        }
        this.currentExpression.splice(dropPosition.index, 0, draggedItem);
      }

      // clean up highlights & update UI
      Array.from(expressionDisplay.children).forEach((child) => {
        child.classList.remove("drop-target");
      });
      this.updateExpressionDisplay();
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

    const andBtn = this.createOperatorButton("AND", () =>
      this.addOperatorToExpression("AND")
    );
    const orBtn = this.createOperatorButton("OR", () =>
      this.addOperatorToExpression("OR")
    );

    const leftParenBtn = this.createOperatorButton("(", () =>
      this.addOperatorToExpression("(")
    );
    const rightParenBtn = this.createOperatorButton(")", () =>
      this.addOperatorToExpression(")")
    );

    const resetBtn = this.createOperatorButton("Reset", () =>
      this.resetExpression()
    );
    const searchBtn = this.createOperatorButton("Search", () => this.handleSearchClick());

    buttonsContainer.appendChild(resetBtn);
    buttonsContainer.appendChild(searchBtn);

    // Add explanation text for threshold slider
    const sliderExplanation = document.createElement("small");
    sliderExplanation.textContent = "Adjust similarity threshold between skills (higher = more strict matching)";
    sliderExplanation.style.color = "#666";
    sliderExplanation.style.display = "block";
    sliderExplanation.style.marginBottom = "5px";
    buttonsContainer.appendChild(sliderExplanation);

    // Create a container for slider and its label
    const sliderContainer = document.createElement("div");
    sliderContainer.style.display = "flex";
    sliderContainer.style.alignItems = "center";
    sliderContainer.style.gap = "10px";

    const thresholdSlider = document.createElement("input");
    thresholdSlider.type = "range";
    thresholdSlider.min = 0;
    thresholdSlider.max = 100;
    thresholdSlider.value = this.similarityThreshold || 50; // default to 50%

    const thresholdLabel = document.createElement("span");
    thresholdLabel.textContent = `${thresholdSlider.value}%`;
    thresholdLabel.style.minWidth = "40px";

    thresholdSlider.oninput = (e) => {
      this.similarityThreshold = parseInt(e.target.value);
      thresholdLabel.textContent = `${this.similarityThreshold}%`;
    };

    sliderContainer.appendChild(thresholdSlider);
    sliderContainer.appendChild(thresholdLabel);
    buttonsContainer.appendChild(sliderContainer);

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
    saveExpressionBtn.onclick = () => this.saveCurrentExpression();

    savedExpressionsContainer.appendChild(savedExpressionsTitle);
    savedExpressionsContainer.appendChild(savedExpressionsList);
    savedExpressionsContainer.appendChild(saveExpressionBtn);

    // Add a container for the search result URL
    const searchUrlContainer = document.createElement("div");
    searchUrlContainer.id = "searchUrlContainer";
    searchUrlContainer.style.margin = "10px 0";
    searchUrlContainer.style.display = "none";
    searchUrlContainer.style.alignItems = "center";
    searchUrlContainer.style.gap = "8px";

    const searchUrlLabel = document.createElement("span");
    searchUrlLabel.textContent = "Result URL:";
    searchUrlLabel.style.fontWeight = "bold";
    searchUrlLabel.style.marginRight = "5px";

    const searchUrlField = document.createElement("input");
    searchUrlField.type = "text";
    searchUrlField.readOnly = true;
    searchUrlField.style.width = "60%";
    searchUrlField.style.marginRight = "5px";

    const openUrlBtn = document.createElement("button");
    openUrlBtn.textContent = "Open";
    openUrlBtn.onclick = () => {
      if (searchUrlField.value) window.open(searchUrlField.value, "_blank");
    };
    openUrlBtn.style.padding = "2px 8px";
    openUrlBtn.style.fontSize = "12px";

    searchUrlContainer.appendChild(searchUrlLabel);
    searchUrlContainer.appendChild(searchUrlField);
    searchUrlContainer.appendChild(openUrlBtn);

    // Append the content elements into the content container.
    contentContainer.appendChild(expressionDisplay);
    contentContainer.appendChild(instructionsText);
    contentContainer.appendChild(buttonsContainer);
    contentContainer.appendChild(savedExpressionsContainer);
    contentContainer.appendChild(searchUrlContainer);

    // Append header and content container to the main container.
    container.appendChild(headerContainer);
    container.appendChild(contentContainer);

    // Make the container draggable using the header as the drag handle.
    this.makeDraggable(container, headerContainer);

    // Add CSS for dragging elements and highlight styling if not already added
    if (!document.getElementById("expression-builder-styles")) {
      const style = document.createElement("style");
      style.id = "expression-builder-styles";
      style.textContent = `
          .expr-item.dragging, .expr-block.dragging {
            opacity: 0.4;
          }
          .active-filter-element {
            stroke: #ff0000;
            stroke-width: 3px;
          }
          .drop-target {
            outline: 2px solid #4a90e2;
            background-color: rgba(74, 144, 226, 0.1) !important;
            transition: outline 0.2s ease, background-color 0.2s ease;
          }
          .highlight {
            background-color: #fffacd;
          }
          .negated {
            text-decoration: line-through;
            position: relative;
            background-color: rgba(255, 80, 80, 0.1) !important;
          }
          .negated::before {
            content: "NOT";
            font-size: 9px;
            position: absolute;
            top: -10px;
            left: 0;
            color: #ff5050;
            font-weight: bold;
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0% { opacity: 0.7; }
            50% { opacity: 1; }
            100% { opacity: 0.7; }
          }
          .flippable {
            cursor: pointer;
            transition: transform 0.2s ease, background-color 0.2s ease;
            transform-style: preserve-3d;
          }
          .flippable:hover {
            transform: scale(1.05);
            box-shadow: 0 0 5px rgba(0,0,0,0.2);
          }
          .flipping {
            animation: flip-3d 0.6s ease;
          }
          .operator.flipping {
            animation: flip-horizontal 0.5s ease;
          }
          @keyframes flip-3d {
            0% { transform: rotateY(0deg); }
            50% { transform: rotateY(180deg); background-color: rgba(255, 80, 80, 0.2); }
            100% { transform: rotateY(360deg); }
          }
          @keyframes flip-horizontal {
            0% { transform: rotateX(0deg); }
            50% { transform: rotateX(90deg); background-color: rgba(80, 80, 255, 0.3); }
            100% { transform: rotateX(180deg); }
          }
          .insertion-marker {
            animation: pulse 1s infinite;
          }
          @keyframes dropPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
          }
          .block-drop-target {
            outline: 2px dashed #4a90e2;
          }
        `;

      document.head.appendChild(style);
    }
  }

  makeDraggable(dragElement, handleElement) {
    let offsetX = 0,
      offsetY = 0;
    let isMouseDown = false;

    handleElement.addEventListener("mousedown", (e) => {
      isMouseDown = true;
      // Calculate where inside the element the click happened
      const rect = dragElement.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      const mouseMoveHandler = (e) => {
        if (!isMouseDown) return;
        dragElement.style.left = e.clientX - offsetX + "px";
        dragElement.style.top = e.clientY - offsetY + "px";
      };

      const mouseUpHandler = () => {
        isMouseDown = false;
        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);
      };

      document.addEventListener("mousemove", mouseMoveHandler);
      document.addEventListener("mouseup", mouseUpHandler);
      e.preventDefault();
    });
  }

  handleSearchClick() {
    if (this.currentExpression.length === 0) {
      alert("Please build an expression first");
      return;
    }
    if (!this.validateExpression(this.currentExpression)) {
      alert("The expression is invalid. Please check your expression structure.");
      return;
    }
    const expr = this.getSerializableState().currentExpression;
    const exprStr = encodeURIComponent(JSON.stringify(expr));
    const url = `${this.apiBaseUrl}/search?expression=${exprStr}`;
    const searchUrlContainer = document.getElementById("searchUrlContainer");
    const searchUrlField = searchUrlContainer && searchUrlContainer.querySelector("input[type='text']");
    if (searchUrlContainer && searchUrlField) {
      searchUrlField.value = url;
      searchUrlContainer.style.display = "flex";
    }
  }

  executeSearch() {
    if (this.currentExpression.length === 0) {
      alert("Please build an expression first");
      return;
    }

    try {
      if (!this.validateExpression(this.currentExpression)) {
        alert(
          "The expression is invalid. Please check your expression structure."
        );
        return;
      }

      // Convert expression to postfix notation for evaluation
      const postfix = this.infixToPostfix(this.currentExpression);
      const result = this.evaluatePostfix(postfix);

      this.notifyChange();
    } catch (error) {
      console.error("Error executing search:", error);
      alert(
        "An error occurred while evaluating the expression. Check the console for details."
      );
    }
  }


  showBlockDropIndicator(x, y) {
    // Clear any existing indicators
    this.clearBlockDropIndicators();

    const elements = Array.from(this.expressionDisplay.children);
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        if (element.classList.contains("expr-block")) {
          // Visual feedback for block targeting
          element.classList.add("block-drop-target");
          return;
        }
      }
    }
  }

  clearBlockDropIndicators() {
    document.querySelectorAll(".block-drop-target").forEach(el => {
      el.classList.remove("block-drop-target");
    });
  }

  infixToPostfix(infix) {
    if (!infix || !Array.isArray(infix)) {
      console.error("Invalid infix expression");
      return [];
    }

    const output = [];
    const operatorStack = [];
    const precedence = { NOT: 3, AND: 2, OR: 1 };

    // Process each token in the infix expression
    for (const token of infix) {
      if (!token) {
        console.warn("Skipping undefined token in expression");
        continue; // Skip undefined tokens
      }

      if (token.type === "andBlock") {
        // Expand AND block into individual items with operators from block.operators
        token.items.forEach((item, index) => {
          if (index > 0) {
            // Use stored operator type instead of always using AND
            const operatorType =
              token.operators && token.operators[index - 1]
                ? token.operators[index - 1]
                : "AND";

            const blockOperator = {
              type: "operator",
              value: operatorType,
              displayValue: operatorType,
            };

            while (
              operatorStack.length > 0 &&
              operatorStack[operatorStack.length - 1].value !== "(" &&
              precedence[operatorStack[operatorStack.length - 1].value] >=
              precedence[blockOperator.value]
            ) {
              output.push(operatorStack.pop());
            }
            operatorStack.push(blockOperator);
          }
          // Add the actual item to output
          output.push(item);
        });
      } else if (token.value === "(") {
        operatorStack.push(token);
      } else if (token.value === ")") {
        // Pop until matching '(' is found
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1].value !== "("
        ) {
          output.push(operatorStack.pop());
        }
        operatorStack.pop(); // Remove the '(' from stack
      } else if (token.type === "operator") {
        // Handle operator precedence
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1].value !== "(" &&
          precedence[operatorStack[operatorStack.length - 1].value] >=
          precedence[token.value]
        ) {
          output.push(operatorStack.pop());
        }
        operatorStack.push(token);
      } else {
        // Directly add operands (skills/entities) to output
        output.push(token);
      }
    }

    // Add any remaining operators to the output
    while (operatorStack.length > 0) {
      output.push(operatorStack.pop());
    }

    return output;
  }

  evaluatePostfix(postfix) {
    if (!postfix || !Array.isArray(postfix)) {
      console.error("Invalid postfix expression");
      return new Set();
    }

    const stack = [];

    postfix.forEach((token) => {
      if (!token) {
        console.warn("Skipping undefined token in postfix evaluation");
        return; // Skip this iteration
      }

      if (
        token.type === "skill" ||
        token.type === "role" ||
        token.type === "unit" ||
        token.type === "subject"
      ) {
        let subjects;
        if (token.entityId && token.entityType) {
          subjects = this.getSubjectsBySkillIdAndEntity(
            token.value,
            token.entityId,
            token.entityType
          );
        } else {
          subjects = this.getSubjectsBySkillId(token.value);
        }

        let result = new Set(subjects.map((s) => s.uid));

        // Handle negation if needed
        if (token.negated) {
          const allSubjects = new Set(
            Array.from(document.querySelectorAll(".subject")).map((s) =>
              s.getAttribute("data-uid")
            )
          );
          result = new Set([...allSubjects].filter((uid) => !result.has(uid)));
        }

        stack.push(result);
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

  flipOperator(index) {
    this.saveExpressionState();
    const op = this.currentExpression[index];
    if (op.type === "operator" && (op.value === "AND" || op.value === "OR")) {
      op.value = op.value === "AND" ? "OR" : "AND";
      op.displayValue = op.value;
      this.updateExpressionDisplay();
    }
  }

  createOperatorButton(label, onClick) {
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
    };
    return btn;
  }

  addEntityToExpression(entityId, entityType, element, x, y) { // Add x, y parameters
    this.saveExpressionState();

    const newItem = {
      type: entityType,
      value: entityId,
      element: element,
      displayValue: `${entityType.toUpperCase()}:${entityId}`,
    };

    // Find target block based on drop position
    const targetBlock = this.findTargetBlock(x, y);

    if (targetBlock) {
      if (targetBlock.items.length > 0) {
        if (!targetBlock.operators) targetBlock.operators = [];
        targetBlock.operators.push("AND");
      }
      targetBlock.items.push(newItem);
    } else {
      this.currentExpression.push({
        type: "andBlock",
        items: [newItem],
        operators: [],
      });
    }

    if (element) {
      if (element.classList != "special") {
        element.classList.add("active-filter-element");
      } else {
        const circleElement = element.parentElement.parentElement.querySelector("circle");
        circleElement.classList.add("active-filter-element");
      }
    }
    this.updateExpressionDisplay();
  }

  addSkillToExpression(skillId, element, entityId, entityType) {
    this.saveExpressionState();

    const newItem = {
      type: "skill",
      value: skillId,
      element: element,
      entityId: entityId,
      entityType: entityType,
      displayValue: `Skill:${skillId} (of ${entityType.toUpperCase()}:${entityId})`,
    };

    // Same insertion logic as addEntityToExpression
    let insertIndex = this.currentExpression.length;
    for (let i = this.currentExpression.length - 1; i >= 0; i--) {
      if (this.currentExpression[i].type === "andBlock") {
        if (
          i === this.currentExpression.length - 1 ||
          this.currentExpression[i + 1].type !== "operator"
        ) {
          insertIndex = i;
          break;
        }
      }
    }

    if (insertIndex === this.currentExpression.length) {
      this.currentExpression.push({
        type: "andBlock",
        items: [newItem],
        operators: [], // Add operators array
      });
    } else {
      // Add operator type when adding a new item to an existing block
      if (this.currentExpression[insertIndex].items.length > 0) {
        if (!this.currentExpression[insertIndex].operators) {
          this.currentExpression[insertIndex].operators = [];
        }
        this.currentExpression[insertIndex].operators.push("AND");
      }
      this.currentExpression[insertIndex].items.push(newItem);
    }

    element.classList.add("active-filter-element");
    this.updateExpressionDisplay();
  }

  isOperator(item) {
    return (
      item?.type === "operator" && item.value !== "(" && item.value !== ")"
    );
  }

  addOperatorToExpression(operator) {
    if (
      this.currentExpression.length === 0 &&
      operator !== "NOT" &&
      operator !== "("
    ) {
      alert("Add an element before using this operator");
      return;
    }
    this.saveExpressionState();
    this.currentExpression.push({
      type: "operator",
      value: operator,
      displayValue: operator,
    });
    this.updateExpressionDisplay();
  }

  notifyChange() {
    const event = new CustomEvent("expressionBuilder:change", {
      detail: { builder: this },
    });
    document.dispatchEvent(event);

    this.saveStateToServer();
  }

  resetExpression() {
    if (this.currentExpression.length === 0) return;
    this.saveExpressionState();
    this.currentExpression.forEach((item) => {
      if (item.element) {
        item.element.classList.remove("active-filter-element");
      }
    });
    this.currentExpression = [];
    this.updateExpressionDisplay();
  }

  saveExpressionState() {
    this.expressionHistory.push(
      JSON.parse(
        JSON.stringify(
          this.currentExpression.map((item) => {
            const { element, ...rest } = item;
            return rest;
          })
        )
      )
    );
    if (this.expressionHistory.length > 20) {
      this.expressionHistory.shift();
    }
  }

  getBackgroundColor(item) {
    if (!item || !item.type) return "#f0f0f0"; // Default color for invalid items

    if (item.type === "operator") return "#d0d0ff"; // blue
    if (item.type === "skill") return "#d0ffd0"; // green
    if (item.type === "subject") return "#ffd0ff"; // pink!
    return "#ffd0d0"; // other entities (unit/role)
  }
  createBlockItem(item, blockIndex, itemIndex) {
    const itemContainer = document.createElement("div");
    itemContainer.style.display = "inline-flex";
    itemContainer.style.alignItems = "center";
    itemContainer.style.margin = "0 2px";
    itemContainer.draggable = true;

    // drag start
    itemContainer.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      const data = JSON.stringify({
        type: "blockItem",
        blockIndex,
        itemIndex,
      });
      e.dataTransfer.setData("text/plain", data);
      itemContainer.classList.add("dragging");
    });

    // drag end
    itemContainer.addEventListener("dragend", () => {
      itemContainer.classList.remove("dragging");
    });

    // the visible span
    const span = document.createElement("span");
    span.textContent = item.displayValue;
    span.style.background = item.type === "skill" ? "#d0ffd0" : "#ffd0d0";
    span.style.padding = "2px 4px";
    span.style.borderRadius = "2px";
    span.classList.add("flippable");

    // ← here: double-click toggles NOT on this block-item
    span.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.saveExpressionState();
      const targetItem = this.currentExpression[blockIndex].items[itemIndex];
      targetItem.negated = !targetItem.negated;
      this.updateExpressionDisplay();
    });

    // reflect existing negation
    if (item.negated) {
      span.classList.add("negated");
    }

    // delete button
    const deleteBtn = document.createElement("span");
    deleteBtn.textContent = "×";
    deleteBtn.style.marginLeft = "2px";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.color = "#999";
    deleteBtn.style.fontSize = "10px";
    deleteBtn.style.verticalAlign = "top";

    deleteBtn.onclick = (e) => {
      this.saveExpressionState();
      if (item.element) {
        item.element.classList.remove("active-filter-element");
      }
      const block = this.currentExpression[blockIndex];
      block.items.splice(itemIndex, 1);
      if (block.items.length === 0) {
        this.currentExpression.splice(blockIndex, 1);
      }
      this.updateExpressionDisplay();
    };

    itemContainer.appendChild(span);
    itemContainer.appendChild(deleteBtn);
    return itemContainer;
  }

  createAndBlock(block, index) {
    if (!block || !block.items) {
      console.warn(
        `Attempted to create AND block with invalid block data at index ${index}`
      );
      return document.createElement("div"); // Return empty div to avoid errors
    }

    const wrapper = document.createElement("div");
    wrapper.className = "expr-block";
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.style.margin = "2px";
    wrapper.style.padding = "3px";
    wrapper.style.borderRadius = "3px";
    wrapper.style.background = "#e0e0ff";
    wrapper.style.cursor = "grab";
    wrapper.setAttribute("draggable", "true");
    wrapper.setAttribute("data-block-index", index);

    const openParen = document.createElement("span");
    openParen.textContent = "(";
    openParen.style.marginRight = "2px";
    wrapper.appendChild(openParen);

    // Ensure operators array exists
    if (!block.operators) {
      block.operators = Array(Math.max(0, block.items.length - 1)).fill("AND");
    }

    // Filter out any undefined items before processing
    block.items = block.items.filter((item) => item !== undefined);

    block.items.forEach((item, itemIndex) => {
      if (!item) {
        console.warn(
          `Skipping undefined item in block ${index} at position ${itemIndex}`
        );
        return; // Skip this iteration
      }

      if (itemIndex > 0) {
        // Create a flippable operator instead of static text
        const operatorSpan = document.createElement("span");
        const operatorType = block.operators[itemIndex - 1] || "AND";
        operatorSpan.textContent = ` ${operatorType} `;
        operatorSpan.style.margin = "0 3px";
        operatorSpan.style.padding = "1px 4px";
        operatorSpan.style.borderRadius = "3px";
        operatorSpan.style.background = "#d0d0ff";
        operatorSpan.style.cursor = "pointer";
        operatorSpan.classList.add("flippable", "block-operator");
        operatorSpan.title = "Double-click to toggle AND/OR";

        // Add event handler to flip the operator
        operatorSpan.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          this.saveExpressionState();

          // Toggle the operator
          block.operators[itemIndex - 1] =
            block.operators[itemIndex - 1] === "AND" ? "OR" : "AND";

          // Add animation class
          operatorSpan.classList.add("flipping");
          setTimeout(() => operatorSpan.classList.remove("flipping"), 600);

          this.updateExpressionDisplay();
        });

        wrapper.appendChild(operatorSpan);
      }
      const itemSpan = this.createBlockItem(item, index, itemIndex);
      wrapper.appendChild(itemSpan);
    });

    const closeParen = document.createElement("span");
    closeParen.textContent = ")";

    // Add event listener to close parenthesis for removing block
    closeParen.addEventListener("click", (e) => {
      e.stopPropagation();
      this.saveExpressionState();
      this.currentExpression.splice(index, 1);
      this.updateExpressionDisplay();
    });

    closeParen.style.marginLeft = "2px";
    wrapper.appendChild(closeParen);

    const deleteBtn = document.createElement("span");
    deleteBtn.textContent = "×";
    deleteBtn.style.marginLeft = "4px";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.color = "#999";
    deleteBtn.onclick = (e) => {
      this.saveExpressionState();

      block.items.forEach((item) => {
        if (item.element) {
          item.element.classList.remove("active-filter-element");
        }
      });

      this.currentExpression.splice(index, 1);
      this.updateExpressionDisplay();
    };

    wrapper.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", `block:${index}`);
      wrapper.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    wrapper.addEventListener("dragend", (e) => {
      wrapper.classList.remove("dragging");

      const dropIndicator = document.getElementById("drop-indicator");
      if (dropIndicator) {
        dropIndicator.remove();
      }
    });

    wrapper.appendChild(deleteBtn);
    return wrapper;
  }

  createExpressionElement(item, index) {
    if (!item) {
      console.warn(
        `Attempted to create expression element with undefined item at index ${index}`
      );
      return document.createElement("div"); // Return empty div to avoid errors
    }

    const wrapper = document.createElement("div");
    wrapper.className = `expr-item ${item.type}`;
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.style.margin = "2px";
    wrapper.style.padding = "3px 6px";
    wrapper.style.borderRadius = "3px";
    wrapper.style.background = this.getBackgroundColor(item);
    wrapper.style.cursor = "grab";
    wrapper.setAttribute("draggable", "true");

    const textSpan = document.createElement("span");
    textSpan.textContent = item.displayValue || item.value || "Unknown";
    textSpan.classList.add("flippable");

    if (item.type === "skill") {
      textSpan.title = `${item.value} belongs to ${item.entityType} ${item.entityId}`;
    }

    // Add negation class if entity is negated
    if (item.negated && item.type !== "operator") {
      textSpan.classList.add("negated");
    }

    // Add event handler for flipping operators or toggling NOT for entities
    if (
      item.type === "operator" &&
      (item.value === "AND" || item.value === "OR")
    ) {
      wrapper.title = "Double-click to toggle AND/OR";
      wrapper.addEventListener("dblclick", () => {
        this.flipOperator(index);

        // Add animation class with operator-specific animation
        wrapper.classList.add("flipping");
        setTimeout(() => wrapper.classList.remove("flipping"), 600);
      });
    } else if (item.type !== "operator") {
      // Make non-operator elements flippable for NOT
      wrapper.title = "Double-click to toggle NOT";
      wrapper.addEventListener("dblclick", () => {
        this.saveExpressionState();

        // Toggle negation
        this.currentExpression[index].negated =
          !this.currentExpression[index].negated;

        // Add animation class with 3D flip effect
        textSpan.classList.add("flipping");
        setTimeout(() => textSpan.classList.remove("flipping"), 600);

        this.updateExpressionDisplay();
      });
    }

    const deleteBtn = document.createElement("span");
    deleteBtn.textContent = "×";
    deleteBtn.style.marginLeft = "4px";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.color = "#999";
    deleteBtn.onclick = (e) => {
      this.saveExpressionState();
      if (item.element) item.element.classList.remove("active-filter-element");
      this.currentExpression.splice(index, 1);
      this.updateExpressionDisplay();
    };

    // Drag and drop handlers
    wrapper.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", index.toString());
      wrapper.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    wrapper.addEventListener("dragend", (e) => {
      wrapper.classList.remove("dragging");

      // Remove drop indicator if exists
      const dropIndicator = document.getElementById("drop-indicator");
      if (dropIndicator) {
        dropIndicator.remove();
      }
    });

    wrapper.appendChild(textSpan);
    wrapper.appendChild(deleteBtn);
    return wrapper;
  }

  normalizeBlockOperators() {
    // Remove ANDs from start and end
    while (
      this.currentExpression.length > 0 &&
      this.currentExpression[0].type === "operator" &&
      this.currentExpression[0].value === "AND"
    ) {
      this.currentExpression.shift();
    }
    while (
      this.currentExpression.length > 0 &&
      this.currentExpression[this.currentExpression.length - 1].type === "operator" &&
      this.currentExpression[this.currentExpression.length - 1].value === "AND"
    ) {
      this.currentExpression.pop();
    }

    // Remove consecutive ANDs
    for (let i = this.currentExpression.length - 1; i > 0; i--) {
      const current = this.currentExpression[i];
      const prev = this.currentExpression[i - 1];

      if (
        current?.type === "operator" && current.value === "AND" &&
        prev?.type === "operator" && prev.value === "AND"
      ) {
        // Remove one of the consecutive ANDs
        this.currentExpression.splice(i, 1);
      }
    }
    // Scan for missing ANDs between blocks
    for (let i = 0; i < this.currentExpression.length - 1; i++) {
      const current = this.currentExpression[i];
      const next = this.currentExpression[i + 1];

      // If we have two consecutive blocks or items without an operator between them
      if (
        (!this.isOperator(current) && !this.isOperator(next)) ||
        (current.type === "andBlock" && next.type === "andBlock")
      ) {
        // Insert a flippable AND operator
        this.currentExpression.splice(i + 1, 0, {
          type: "operator",
          value: "AND",
          displayValue: "AND",
          flippable: true
        });
        i++; // Skip the newly inserted operator
      }
    }
  }

  updateExpressionDisplay() {
    const display = document.getElementById("currentExpression");
    if (!display) return;

    // Normalize block operators before displaying
    this.normalizeBlockOperators();

    display.innerHTML = "";

    // Filter out any undefined items before processing
    this.currentExpression = this.currentExpression.filter((item) => !!item);

    this.currentExpression.forEach((item, index) => {
      if (!item) {
        console.warn("Skipping undefined item at index", index);
        return; // Skip undefined items
      }

      if (item.type === "andBlock") {
        if (!item.items || !Array.isArray(item.items)) {
          console.warn(
            `Invalid AND block at index ${index}: missing or invalid items array`
          );
          item.items = []; // Initialize as empty array to prevent further errors
        } else {
          // Filter out undefined items from the block
          item.items = item.items.filter((blockItem) => !!blockItem);
        }

        const blockWrapper = this.createAndBlock(item, index);
        display.appendChild(blockWrapper);
      } else {
        const elementWrapper = this.createExpressionElement(item, index);
        display.appendChild(elementWrapper);
      }
    });

    if (this.currentExpression.length === 0) {
      display.textContent = "Click on elements to build expression";
    }

    // Apply highlighting to the graph based on current expression
    this.highlightGraph();

    this.notifyChange();
  }

  saveCurrentExpression() {
    if (this.currentExpression.length === 0) {
      alert("No expression to save");
      return;
    }

    const expressionName = prompt(
      "Name this expression:",
      "Expression " + new Date().toLocaleTimeString()
    );
    if (!expressionName) return;

    // Create a clean copy of the expression without DOM references
    const cleanExpression = this.currentExpression.map((item) => {
      const { element, ...rest } = item;
      return rest;
    });

    // Add to saved expressions array
    this.savedExpressions.push({
      name: expressionName,
      expression: cleanExpression,
      createdAt: new Date().toISOString(),
    });

    // Update the UI
    this.updateSavedExpressionsList();

    // Save to server
    this.saveStateToServer();
  }

  updateSavedExpressionsList() {
    const savedExpressionsList = document.getElementById(
      "savedExpressionsList"
    );
    if (!savedExpressionsList) return;

    // Clear existing list
    savedExpressionsList.innerHTML = "";

    // Populate with saved expressions
    this.savedExpressions.forEach((savedExpression, index) => {
      const expressionItem = document.createElement("div");
      expressionItem.style.padding = "5px";
      expressionItem.style.borderBottom = "1px solid #eee";
      expressionItem.style.cursor = "pointer";

      const expressionText = document.createElement("span");
      expressionText.textContent = savedExpression.name;

      const loadButton = document.createElement("button");
      loadButton.textContent = "Load";
      loadButton.style.marginLeft = "10px";
      loadButton.style.fontSize = "10px";
      loadButton.style.padding = "2px 4px";

      loadButton.onclick = (e) => {
        this.currentExpression.forEach((item) => {
          if (item.element) {
            item.element.classList.remove("active-filter-element");
          }
        });
        this.currentExpression = JSON.parse(
          JSON.stringify(savedExpression.expression)
        );
        this.updateExpressionDisplay();
      };

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "×";
      deleteButton.style.float = "right";
      deleteButton.style.background = "none";
      deleteButton.style.border = "none";
      deleteButton.style.fontSize = "12px";
      deleteButton.style.cursor = "pointer";
      deleteButton.style.color = "#f00";

      deleteButton.onclick = (e) => {
        this.savedExpressions.splice(index, 1);
        this.updateSavedExpressionsList();
        this.saveStateToServer();
      };

      expressionItem.appendChild(expressionText);
      expressionItem.appendChild(loadButton);
      expressionItem.appendChild(deleteButton);

      savedExpressionsList.appendChild(expressionItem);
    });
  }

  getDropPosition(container, clientX, clientY, directTarget) {
    const elements = Array.from(container.children);
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const rect = element.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        // If dropping on a block
        if (element.classList.contains("expr-block")) {
          return { type: "block", index: i };
        }
        // For non-block elements, allow item drops
        const halfWidth = rect.width / 2;
        return {
          type: "element",
          index: clientX < rect.left + halfWidth ? i : i + 1,
          before: clientX < rect.left + halfWidth,
        };
      }
    }
    return { type: "element", index: elements.length, before: false };
  }

  getSubjectsBySkillId(skillId) {
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

  getSubjectsBySkillIdAndEntity(skillId, entityId, entityType) {
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

  validateExpression(expression) {
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

  // State management methods
  getState() {
    return {
      currentExpression: this.currentExpression.map((item) => {
        // Create a deep copy without element references
        const copy = JSON.parse(JSON.stringify(item));
        if (copy.element) delete copy.element;
        if (copy.items) {
          copy.items = copy.items.map((subItem) => {
            const subCopy = { ...subItem };
            if (subCopy.element) delete subCopy.element;
            return subCopy;
          });
        }
        return copy;
      }),
      expressionHistory: this.expressionHistory,
      savedExpressions: this.savedExpressions,
    };
  }

  setState(state) {
    if (state && state.currentExpression) {
      // First, clear any highlighting from current expression
      this.currentExpression.forEach((item) => {
        if (item.element) {
          item.element.classList.remove("active-filter-element");
        }
        if (item.items) {
          item.items.forEach((subItem) => {
            if (subItem.element) {
              subItem.element.classList.remove("active-filter-element");
            }
          });
        }
      });

      this.currentExpression = state.currentExpression;
      if (state.expressionHistory)
        this.expressionHistory = state.expressionHistory;
      if (state.savedExpressions)
        this.savedExpressions = state.savedExpressions;

      this.updateExpressionDisplay();
      this.updateSavedExpressionsList();
    }
  }

  // Server persistence methods
  getSerializableState() {
    return {
      currentExpression: this.currentExpression.map((item) => {
        const copy = { ...item };
        if (copy.element) delete copy.element;

        if (copy.type === "andBlock" && copy.items) {
          copy.items = copy.items.map((subItem) => {
            const subCopy = { ...subItem };
            if (subCopy.element) delete subCopy.element;
            return subCopy;
          });
        }
        return copy;
      }),
      expressionHistory: this.expressionHistory.map((historyItem) =>
        Array.isArray(historyItem)
          ? historyItem.map((item) => {
            const copy = { ...item };
            if (copy.element) delete copy.element;

            if (copy.type === "andBlock" && copy.items) {
              copy.items = copy.items.map((subItem) => {
                const subCopy = { ...subItem };
                if (subCopy.element) delete subCopy.element;
                return subCopy;
              });
            }
            return copy;
          })
          : []
      ),
      savedExpressions: this.savedExpressions,
    };
  }

  saveStateToServer() {
    try {
      const stateToSave = this.getSerializableState();

      fetch(`${this.apiBaseUrl}/expression-state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stateToSave),
        credentials: "include", // Important: send cookies for session identification
      }).catch((error) =>
        console.error("Error saving expression state to server:", error)
      );
    } catch (error) {
      console.error("Error serializing expression state:", error);
    }
  }

  loadStateFromServer() {
    fetch(`${this.apiBaseUrl}/expression-state`, {
      method: "GET",
      credentials: "include",
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw new Error("Failed to load state from server");
      })
      .then((state) => {
        if (state && Object.keys(state).length > 0) {
          this.restoreFromSerializedState(state);
        }
      })
      .catch((error) =>
        console.error("Error loading expression state from server:", error)
      );
  }

  restoreFromSerializedState(state) {
    if (!state) return;

    if (state.currentExpression) {
      this.currentExpression = state.currentExpression;
    }

    if (state.expressionHistory) {
      this.expressionHistory = state.expressionHistory;
    }

    if (state.savedExpressions) {
      this.savedExpressions = state.savedExpressions;
      this.updateSavedExpressionsList();
    }

    this.updateExpressionDisplay();
  }
}