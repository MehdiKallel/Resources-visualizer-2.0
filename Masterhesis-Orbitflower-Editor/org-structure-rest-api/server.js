const morgan = require('morgan')
const express = require("express");
const fs = require("fs");
const path = require("path");
const { DOMParser, XMLSerializer } = require("xmldom");
const xpath = require("xpath");
const format = require("xml-formatter");
const bodyParser = require("body-parser");
const cors = require("cors");
require("body-parser-xml")(bodyParser);
const EventEmitter = require("events");

// Define the namespace once for consistent use throughout the application
const XML_NAMESPACE = "http://ns/organisation/1.0";
const NS_PREFIX = "ns";

class UpdateEmitter extends EventEmitter {}
const updateEmitter = new UpdateEmitter();

const app = express();
app.use(morgan('tiny'));
app.use(cors());
const PORT = 3000;
const XML_FILE = path.join(__dirname, "organisation.xml");
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:8080",
      "http://127.0.0.1:5500",
	"https://lehre.bpm.in.tum.de",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  })
);

// Create a namespace-aware select function to use throughout the application
const select = xpath.useNamespaces({
  [NS_PREFIX]: XML_NAMESPACE,
});

// Function to create namespace-aware XML elements
function createElementWithNS(doc, name) {
  const element = doc.createElement(name);
  // Set the namespace if needed (this depends on how the XML is structured)
  return element;
}

// Helper to add namespace information to parsed XML
function ensureNamespace(doc) {
  // Ensure the root element has the right namespace if needed
  const rootElement = doc.documentElement;
  if (rootElement && !rootElement.hasAttribute("xmlns:ns")) {
    rootElement.setAttribute("xmlns:ns", XML_NAMESPACE);
  }
  return doc;
}

app.use(
  bodyParser.xml({
    limit: "1MB",
    xmlParseOptions: {
      normalize: true,
      normalizeTags: false,
      explicitArray: false,
    },
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf.toString(encoding || "utf8");
    },
  })
);
app.use(express.json());

// Middleware to log the request body for debugging
app.use((req, res, next) => {
  next();
});
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});
const readXML = () => {
  const xmlData = fs.readFileSync(XML_FILE, "utf-8");
  return ensureNamespace(new DOMParser().parseFromString(xmlData, "text/xml"));
};

// Improve the safeWriteXML function to include update type information
const safeWriteXML = (doc, updateType = 'general') => {
  try {
    const xml = new XMLSerializer().serializeToString(doc);
    const formattedXML = format(xml, {
      indentation: "  ",
      collapseContent: true,
      lineSeparator: "\n",
    });

    // Write synchronously to ensure the file is fully saved before continuing
    fs.writeFileSync(XML_FILE, formattedXML);
    console.log(`XML file updated successfully (${updateType} change)`);

    // Emit update event with more detailed information
    updateEmitter.emit("update", { 
      timestamp: Date.now(),
      type: updateType,
      message: `Organization structure updated: ${updateType}`
    });
    return true;
  } catch (error) {
    console.error("Error writing XML file:", error);
    return false;
  }
};

// Replace the existing writeXML function with our safer version
const writeXML = safeWriteXML;

//app.use(express.static(path.join(__dirname, "public")));

// Enhance the /events endpoint for better error handling and client experience
app.get("/events", (req, res) => {
  // Set headers for SSE
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
"X-Accel-Buffering": "no"
  });
  // Send initial connection message
  res.write(`id: ${Date.now()}\n`);
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ status: "connected" })}\n\n`);

  // Define event handler
  const onUpdate = (data) => {
    const eventId = Date.now();



	  console.log("*****************************************");
    res.write(`id: ${eventId}\n`);
    res.write(`event: update\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Register event handler
  updateEmitter.on("update", onUpdate);
  console.log("Client connected to SSE");

  // Set up keep-alive interval
  const keepAliveInterval = setInterval(() => {
    res.write(`:keepalive ${Date.now()}\n\n`);
  }, 30000); // Send keepalive every 30 seconds

  // Handle client disconnection
  req.on("close", () => {
    console.log("Client disconnected from SSE");
    clearInterval(keepAliveInterval);
    updateEmitter.removeListener("update", onUpdate);
  });

  // Handle connection errors
  req.on("error", (err) => {
    console.error("SSE connection error:", err);
    clearInterval(keepAliveInterval);
    updateEmitter.removeListener("update", onUpdate);
    res.end();
  });
});


app.get("/organisation", (req, res) => {
  try {
    const doc = readXML();
    const xml = new XMLSerializer().serializeToString(doc);
    res.type("application/xml").send(xml);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/units", (req, res) => {
  try {
    const doc = readXML();
    const units = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit`,
      doc
    ).map((unitNode) => unitNode.getAttribute("id"));
    console.log(units);
    res.send(units);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/units/:id", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const unitNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${id}']`,
      doc
    )[0];
    if (!unitNode) return res.status(404).send("Unit not found");

    const parentNode = select(`${NS_PREFIX}:parent`, unitNode)[0];
    const permissions = select(`${NS_PREFIX}:permissions/*`, unitNode).map(
      (perm) => perm.nodeName
    );

    const unit = {
      id,
      parent: parentNode ? parentNode.textContent : null,
      permissions: permissions,
    };
    res.send(unit);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/units", (req, res) => {
  try {
    console.log("Received unit creation request");
    const parser = new DOMParser();
    const docBody = parser.parseFromString(req.rawBody, "application/xml");

    // Extract unit details with maximum flexibility
    let unitElement = select(`//${NS_PREFIX}:unit`, docBody)[0];
    if (!unitElement) {
      unitElement = docBody.getElementsByTagName("unit")[0];
    }
    if (!unitElement) {
      return res.status(400).send("Invalid XML: no <unit> element found.");
    }

    let id = unitElement.getAttribute("id");
    let parentVal = unitElement.getAttribute("parent");

    if (!id) {
      id = select("//unit/id/text()", docBody)[0]?.nodeValue;
      parentVal = select("//unit/parent/text()", docBody)[0]?.nodeValue;
    }

    if (!id) return res.status(400).send("Unit 'id' is required.");

    // Standardize the ID by trimming whitespace
    id = id.trim();
    console.log(`Processing unit with id: '${id}'`);

    const doc = readXML();
    let unitsNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units`,
      doc
    )[0];

    // Create units node if it doesn't exist
    if (!unitsNode) {
      console.log("Units node not found, creating it");
      const orgNode = select(`//${NS_PREFIX}:organisation`, doc)[0];
      if (!orgNode) return res.status(500).send("Organisation node not found.");
      unitsNode = doc.createElement("units");
      orgNode.appendChild(unitsNode);
    }

    // Check for existing units - dump all unit IDs for debugging
    const allUnits = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit`,
      doc
    );
    console.log(
      "All existing unit IDs:",
      allUnits.map((u) => u.getAttribute("id")).join(", ")
    );

    // Look for existing unit with case-insensitive comparison
    const existing = allUnits.some((unit) => {
      const existingId = unit.getAttribute("id");
      const matches =
        existingId && existingId.trim().toLowerCase() === id.toLowerCase();
      if (matches) console.log(`Found matching unit: '${existingId}'`);
      return matches;
    });

    if (existing) {
      console.log(`Duplicate unit detected: '${id}'`);
      return res.status(409).send(`Unit with ID '${id}' already exists.`);
    }

    // Create the new unit
    console.log(`Creating new unit: '${id}'`);
    const newUnit = doc.createElement("unit");
    newUnit.setAttribute("id", id);

    if (parentVal && parentVal.trim()) {
      const parentNode = doc.createElement("parent");
      parentNode.textContent = parentVal.trim();
      newUnit.appendChild(parentNode);
    }

    const permissionsNode = doc.createElement("permissions");
    newUnit.appendChild(permissionsNode);

    unitsNode.appendChild(newUnit);
    writeXML(doc, 'unit-added'); // Specify update type

    console.log(`Unit '${id}' created successfully`);
    res.status(201).send("Unit added successfully");
  } catch (error) {
    console.error("Error adding unit:", error);
    res.status(500).send(error.message);
  }
});

app.put("/units/:id", (req, res) => {
  try {
    const { id } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.body,
      "application/xml"
    );
    const parentVal = select("//unit/parent/text()", docBody)[0]?.nodeValue;

    const doc = readXML();
    const unitNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${id}']`,
      doc
    )[0];
    if (!unitNode) return res.status(404).send("Unit not found");

    // Clear existing parent (if any) and set new if provided
    const existingParent = select(`${NS_PREFIX}:parent`, unitNode)[0];
    if (existingParent) {
      existingParent.parentNode.removeChild(existingParent);
    }

    if (parentVal) {
      const parentNode = doc.createElement("parent");
      parentNode.textContent = parentVal;
      unitNode.appendChild(parentNode);
    }

    writeXML(doc, 'unit-updated');
    res.send("Unit updated successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/units/:id", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const unitNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${id}']`,
      doc
    )[0];
    if (!unitNode) return res.status(404).send("Unit not found");

    unitNode.parentNode.removeChild(unitNode);
    writeXML(doc, 'unit-deleted');

    res.send("Unit deleted successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/units/:id/permissions", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const unitNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${id}']`,
      doc
    )[0];
    if (!unitNode) return res.status(404).send("Unit not found");

    const permissions = select(`${NS_PREFIX}:permissions/*`, unitNode).map(
      (perm) => perm.nodeName
    );
    res.send(permissions);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/units/:id/permissions", (req, res) => {
  try {
    const { id } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.body,
      "application/xml"
    );
    const permission = select("//permission/text()", docBody)[0]?.nodeValue;
    if (!permission) return res.status(400).send("Permission is required.");

    const doc = readXML();
    const unitNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${id}']`,
      doc
    )[0];
    if (!unitNode) return res.status(404).send("Unit not found");

    const permissionsNode = select(`${NS_PREFIX}:permissions`, unitNode)[0];
    const existing = select(`${NS_PREFIX}:${permission}`, permissionsNode)[0];
    if (existing)
      return res.status(409).send("Permission already exists for this unit.");

    const permNode = doc.createElement(permission);
    permissionsNode.appendChild(permNode);
    writeXML(doc);

    res.status(201).send("Permission added successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/units/:id/permissions/:permissionName", (req, res) => {
  try {
    const { id, permissionName } = req.params;
    const doc = readXML();
    const unitNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${id}']`,
      doc
    )[0];
    if (!unitNode) return res.status(404).send("Unit not found");

    const permNode = select(
      `${NS_PREFIX}:permissions/${NS_PREFIX}:${permissionName}`,
      unitNode
    )[0];
    if (!permNode) return res.status(404).send("Permission not found");

    permNode.parentNode.removeChild(permNode);
    writeXML(doc);

    res.send("Permission deleted successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Add a specific parent to a unit
app.post("/units/:id/parent/:parentId", (req, res) => {
  try {
    const { id, parentId } = req.params;
    const doc = readXML();
    const unitNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${id}']`,
      doc
    )[0];
    if (!unitNode) return res.status(404).send("Unit not found");

    const parentUnit = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${parentId}']`,
      doc
    )[0];
    if (!parentUnit) return res.status(400).send("Parent unit not found");

    const existingParent = select(
      `${NS_PREFIX}:parent[text()='${parentId}']`,
      unitNode
    )[0];
    if (existingParent)
      return res.status(409).send("Parent already exists for this unit");

    const parentNode = doc.createElement("parent");
    parentNode.textContent = parentId;
    unitNode.appendChild(parentNode);

    writeXML(doc);
    res.status(201).send("Parent added to unit successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Remove a specific parent from a unit
app.delete("/units/:id/parent/:parentId", (req, res) => {
  try {
    const { id, parentId } = req.params;
    const doc = readXML();
    const unitNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${id}']`,
      doc
    )[0];
    if (!unitNode) return res.status(404).send("Unit not found");

    const parentNode = select(
      `${NS_PREFIX}:parent[text()='${parentId}']`,
      unitNode
    )[0];
    if (!parentNode)
      return res.status(404).send("Parent not found for this unit");

    parentNode.parentNode.removeChild(parentNode);
    writeXML(doc);
    res.send("Parent removed from unit successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/roles", (req, res) => {
  try {
    const doc = readXML();
    const roles = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role`,
      doc
    ).map((role) => role.getAttribute("id"));
    res.send(roles);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/roles/:id", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const roleNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${id}']`,
      doc
    )[0];
    if (!roleNode) return res.status(404).send("Role not found");

    const permissions = select(`${NS_PREFIX}:permissions/*`, roleNode).map(
      (p) => p.nodeName
    );

    const parentNode = select(`${NS_PREFIX}:parent`, roleNode)[0];
    const parent = parentNode ? parentNode.textContent : null;

    res.send({ id, parent, permissions });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/roles", (req, res) => {
  console.log("received a new request to roles");
  console.log("body", req.body);
  if (!req.is("application/xml")) {
    return res.status(400).send("Content-Type must be 'application/xml'.");
  }
  console.log("type", typeof req.rawBody);
  console.log("body", req.rawBody);

  if (!req.rawBody || typeof req.rawBody !== "string") {
    return res.status(400).send("Empty or invalid XML body.");
  }

  let xmlString = req.rawBody;
  let docBody;
  try {
    docBody = new DOMParser().parseFromString(xmlString, "application/xml");
  } catch (err) {
    return res.status(400).send("Failed to parse XML: " + err.message);
  }
  console.log("wilyyyaa");
  try {
    let id = select("//role/id/text()", docBody)[0]?.nodeValue;
    if (!id) {
      const roleElement = select("//role", docBody)[0];
      if (roleElement) {
        id = roleElement.getAttribute("id");
      }
    }
    if (!id) return res.status(400).send("Role 'id' is required.");

    const parentId = select("//role/parent/text()", docBody)[0]?.nodeValue;

    if (!id) return res.status(400).send("Role 'id' is required.");

    const doc = readXML();
    let rolesNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles`,
      doc
    )[0];
    if (!rolesNode) {
      const orgNode = select(`//${NS_PREFIX}:organisation`, doc)[0];
      rolesNode = doc.createElement("roles");
      orgNode.appendChild(rolesNode);
    }

    const existing = select(`${NS_PREFIX}:role[@id='${id}']`, rolesNode)[0];
    if (existing) return res.status(409).send("Role already exists.");

    if (parentId) {
      const parentRole = select(
        `${NS_PREFIX}:role[@id='${parentId}']`,
        rolesNode
      )[0];
      if (!parentRole) return res.status(400).send("Parent role not found.");
    }

    const newRole = doc.createElement("role");
    newRole.setAttribute("id", id);

    if (parentId) {
      const parentNode = doc.createElement("parent");
      parentNode.textContent = parentId;
      newRole.appendChild(parentNode);
    }

    const permissionsNode = doc.createElement("permissions");
    newRole.appendChild(permissionsNode);
    rolesNode.appendChild(newRole);

    writeXML(doc, 'role-added');
    res.status(201).send("Role added successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.put("/roles/:id", (req, res) => {
  try {
    const { id } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.body,
      "application/xml"
    );
    const permissions = select("//permissions/permission/text()", docBody).map(
      (p) => p.nodeValue
    );
    const parentIds = select("//role/parent/text()", docBody).map(
      (p) => p.nodeValue
    );

    const doc = readXML();
    const roleNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${id}']`,
      doc
    )[0];
    if (!roleNode) return res.status(404).send("Role not found");

    // Update permissions
    const permissionsNode = select(`${NS_PREFIX}:permissions`, roleNode)[0];
    if (!permissionsNode)
      return res.status(500).send("Permissions node not found for role.");

    const existingPerms = select("*", permissionsNode);
    existingPerms.forEach((p) => permissionsNode.removeChild(p));

    if (Array.isArray(permissions)) {
      permissions.forEach((p) => {
        const permNode = doc.createElement(p);
        permissionsNode.appendChild(permNode);
      });
    }

    // Update parents
    const existingParents = select(`${NS_PREFIX}:parent`, roleNode);
    existingParents.forEach((p) => p.parentNode.removeChild(p));

    if (Array.isArray(parentIds)) {
      for (const parentId of parentIds) {
        const parentRole = select(
          `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${parentId}']`,
          doc
        )[0];
        if (!parentRole)
          return res.status(400).send(`Parent role '${parentId}' not found.`);

        const parentNode = doc.createElement("parent");
        parentNode.textContent = parentId;
        roleNode.appendChild(parentNode);
      }
    }

    writeXML(doc, 'role-updated');
    res.send("Role updated successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/roles/:id", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const roleNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${id}']`,
      doc
    )[0];
    if (!roleNode) return res.status(404).send("Role not found");

    // Delete all subjects associated with this role
    const subjectNodes = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[${NS_PREFIX}:relation/@role='${id}']`,
      doc
    );
    subjectNodes.forEach((subjectNode) => {
      const relations = select(
        `${NS_PREFIX}:relation[@role='${id}']`,
        subjectNode
      );
      relations.forEach((relation) => {
        relation.parentNode.removeChild(relation);
      });
      // If the subject has no more relations, delete the subject
      if (select(`${NS_PREFIX}:relation`, subjectNode).length === 0) {
        subjectNode.parentNode.removeChild(subjectNode);
      }
    });

    // Delete all child roles
    const childRoles = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[${NS_PREFIX}:parent='${id}']`,
      doc
    );
    childRoles.forEach((childRole) => {
      childRole.parentNode.removeChild(childRole);
    });

    roleNode.parentNode.removeChild(roleNode);
    writeXML(doc, 'role-deleted');

    res.send("Role, associated subjects, and child roles deleted successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/roles/:id/permissions", (req, res) => {
  try {
    const { id } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.body,
      "application/xml"
    );
    const permission = select("//permission/text()", docBody)[0]?.nodeValue;
    if (!permission) return res.status(400).send("Permission is required.");

    const doc = readXML();
    const roleNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${id}']`,
      doc
    )[0];
    if (!roleNode) return res.status(404).send("Role not found");

    const permissionsNode = select(`${NS_PREFIX}:permissions`, roleNode)[0];
    const existing = select(`${NS_PREFIX}:${permission}`, permissionsNode)[0];
    if (existing)
      return res.status(409).send("Permission already exists for this role.");

    const permNode = doc.createElement(permission);
    permissionsNode.appendChild(permNode);
    writeXML(doc);

    res.status(201).send("Permission added to role successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/roles/:id/permissions/:permissionName", (req, res) => {
  try {
    const { id, permissionName } = req.params;
    const doc = readXML();
    const roleNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${id}']`,
      doc
    )[0];
    if (!roleNode) return res.status(404).send("Role not found");

    const permNode = select(
      `${NS_PREFIX}:permissions/${NS_PREFIX}:${permissionName}`,
      roleNode
    )[0];
    if (!permNode) return res.status(404).send("Permission not found");

    permNode.parentNode.removeChild(permNode);
    writeXML(doc);

    res.send("Permission removed from role successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Add a specific parent to a role
app.post("/roles/:id/parent/:parentId", (req, res) => {
  try {
    const { id, parentId } = req.params;
    const doc = readXML();
    const roleNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${id}']`,
      doc
    )[0];
    if (!roleNode) return res.status(404).send("Role not found");

    const parentRole = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${parentId}']`,
      doc
    )[0];
    if (!parentRole) return res.status(400).send("Parent role not found");

    const existingParent = select(
      `${NS_PREFIX}:parent[text()='${parentId}']`,
      roleNode
    )[0];
    if (existingParent)
      return res.status(409).send("Parent already exists for this role");

    const parentNode = doc.createElement("parent");
    parentNode.textContent = parentId;
    roleNode.appendChild(parentNode);

    writeXML(doc);
    res.status(201).send("Parent added to role successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Remove a specific parent from a role
app.delete("/roles/:id/parent/:parentId", (req, res) => {
  try {
    const { id, parentId } = req.params;
    const doc = readXML();
    const roleNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${id}']`,
      doc
    )[0];
    if (!roleNode) return res.status(404).send("Role not found");

    const parentNode = select(
      `${NS_PREFIX}:parent[text()='${parentId}']`,
      roleNode
    )[0];
    if (!parentNode)
      return res.status(404).send("Parent not found for this role");

    parentNode.parentNode.removeChild(parentNode);
    writeXML(doc);
    res.send("Parent removed from role successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/skills", (req, res) => {
  try {
    const doc = readXML();
    const skillNodes = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill`,
      doc
    );
    const skills = skillNodes.map((node) => {
      const id = node.getAttribute("id");
      const related = select(`${NS_PREFIX}:relatedSkill`, node).map(
        (n) => n.textContent
      );
      console.log(related);
      return { id, relatedSkills: related };
    });
    res.send(skills);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/skills/:id", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const skillNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill[@id='${id}']`,
      doc
    )[0];
    if (!skillNode) return res.status(404).send("Skill not found.");

    const related = select(`${NS_PREFIX}:relatedSkill`, skillNode).map(
      (n) => n.textContent
    );
    res.send({ id, relatedSkills: related });
  } catch (error) {
    res.status(500).send(error.message);
  }
});
app.post("/skills", (req, res) => {
  try {
    console.log("Received request to create a new skill");
    const docBody = new DOMParser().parseFromString(
      req.rawBody,
      "application/xml"
    );
    const skillElement = docBody.documentElement;
    if (!skillElement || skillElement.nodeName !== "skill") {
      return res.status(400).send("Invalid XML: Root element must be 'skill'");
    }
    const id = skillElement.getAttribute("id");
    if (!id) {
      return res.status(400).send("Skill 'id' attribute is required.");
    }
    console.log(`Processing skill creation with id: '${id}'`);
    const doc = readXML();
    let skillsNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills`,
      doc
    )[0];
    if (!skillsNode) {
      const orgNode = select(`//${NS_PREFIX}:organisation`, doc)[0];
      skillsNode = doc.createElement("skills");
      orgNode.appendChild(skillsNode);
    }
    // Check for duplicate skill (case-insensitive)
    const allSkills = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill`,
      doc
    );
    const existing = allSkills.some((skill) => {
      const existingId = skill.getAttribute("id");
      return existingId && existingId.trim().toLowerCase() === id.toLowerCase();
    });
    if (existing) {
      return res.status(409).send(`Skill with ID '${id}' already exists.`);
    }
    // Create new skill node
    const skillNode = doc.createElement("skill");
    skillNode.setAttribute("id", id);
    // Process each relation element (without a "type" attribute)
    const relations = Array.from(skillElement.getElementsByTagName("relation"));
    for (const rel of relations) {
      const relationId = rel.getAttribute("id");
      if (!relationId) {
        return res
          .status(400)
          .send("Each relation must have an 'id' attribute.");
      }
      // Optionally check if the related skill exists
      const relatedSkillExists = select(
        `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill[@id='${relationId}']`,
        doc
      )[0];
      if (!relatedSkillExists) {
        return res.status(404).send(`Related skill '${relationId}' not found.`);
      }
      // Create and append the relation element using any free-text content
      const relationNode = doc.createElement("relation");
      relationNode.setAttribute("id", relationId);
      const relValue = rel.getAttribute("type");
      if (relValue) {
        relationNode.setAttribute("type", relValue);
      }
      skillNode.appendChild(relationNode);
    }
    skillsNode.appendChild(skillNode);
    if (!writeXML(doc, 'skill-added')) {
      return res.status(500).send("Failed to save skill to file.");
    }
    return res.status(201).send("Skill created successfully");
  } catch (error) {
    console.error("Error creating skill:", error);
    return res.status(500).send(error.message);
  }
});

app.put("/skills/:id", (req, res) => {
  try {
    const { id } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.body,
      "application/xml"
    );
    // Get new relation elements from the incoming XML (without "type")
    const newRelations = Array.from(docBody.getElementsByTagName("relation"));
    const doc = readXML();
    const skillNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill[@id='${id}']`,
      doc
    )[0];
    if (!skillNode) return res.status(404).send("Skill not found.");
    // Remove existing <relation> children
    const existingRelations = Array.from(
      skillNode.getElementsByTagName("relation")
    );
    existingRelations.forEach((r) => skillNode.removeChild(r));
    // Append each new relation (using only the id attribute and text content)
    newRelations.forEach((rel) => {
      const relationId = rel.getAttribute("id");
      if (!relationId) return; // Skip invalid relation
      const relationNode = doc.createElement("relation");
      relationNode.setAttribute("id", relationId);
      const relValue = rel.getAttribute("type");
      if (relValue) {
        relationNode.setAttribute("type", relValue);
      }
      skillNode.appendChild(relationNode);
    });
    writeXML(doc);
    res.send("Skill updated successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/skills/:id", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const skillNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill[@id='${id}']`,
      doc
    )[0];
    if (!skillNode) return res.status(404).send("Skill not found.");

    skillNode.parentNode.removeChild(skillNode);
    writeXML(doc);
    res.send("skill deleted successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/subjects", (req, res) => {
  try {
    const doc = readXML();
    const subjects = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject`,
      doc
    ).map((subj) => ({
      id: subj.getAttribute("id"),
      uid: subj.getAttribute("uid"),
    }));
    res.send(subjects);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/subjects/:id", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    const uid = subjectNode.getAttribute("uid");
    const relations = select(`${NS_PREFIX}:relation`, subjectNode).map(
      (rel) => ({
        unit: rel.getAttribute("unit"),
        role: rel.getAttribute("role"),
      })
    );

    const skills = select(
      `${NS_PREFIX}:skills/${NS_PREFIX}:skill`,
      subjectNode
    ).map((skill) => skill.getAttribute("id"));

    res.send({ id, uid, relations, skills });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /subjects endpoint
app.post("/subjects", (req, res) => {
  try {
    const xmlString = req.rawBody;
    if (!xmlString) {
      return res.status(400).send("Invalid XML payload.");
    }

    const parser = new DOMParser();
    const docBody = parser.parseFromString(xmlString, "application/xml");

    // Check for parsing errors
    const parseError = docBody.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      return res.status(400).send("Malformed XML.");
    }

    const select = xpath.useNamespaces({ ns: "http://ns/organisation/1.0" });
    const idNode = select("//subject/@id", docBody)[0];
    const id = idNode ? idNode.nodeValue : null;

    console.log("id", id);
    if (!id) {
      return res.status(400).send("Subject 'id' attribute is required.");
    }

    const doc = readXML();

    // Select the subjects node, considering namespaces if applicable
    let subjectsNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects`,
      doc
    )[0];
    if (!subjectsNode) {
      const orgNode = select(`//${NS_PREFIX}:organisation`, doc)[0];
      if (!orgNode) {
        return res
          .status(500)
          .send("Organisation node not found in the XML document.");
      }
      subjectsNode = doc.createElement("subjects");
      orgNode.appendChild(subjectsNode);
    }

    // Generate a unique UID
    const generatedUid = "uid-" + Date.now();

    // Create the new subject node
    const subjectNode = doc.createElement("subject");
    subjectNode.setAttribute("id", id);
    subjectNode.setAttribute("uid", generatedUid);
    subjectsNode.appendChild(subjectNode);

    // Select all relation nodes from the incoming XML
    const relationNodes = select("//subject/relation", docBody);
    if (!relationNodes.length) {
      return res.status(400).send("At least one relation is required.");
    }

    // Append each relation to the new subject node
    relationNodes.forEach((rel) => {
      const unitAttr = rel.getAttribute("unit");
      const roleAttr = rel.getAttribute("role");

      if (!unitAttr || !roleAttr) {
        // Optionally handle missing attributes
        return;
      }

      const existingUnit = select(
        `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${unitAttr}']`,
        doc
      )[0];
      if (!existingUnit)
        return res.status(404).send("Unit not found: " + unitAttr);

      const existingRole = select(
        `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${roleAttr}']`,
        doc
      )[0];
      if (!existingRole)
        return res.status(404).send("Role not found: " + roleAttr);

      const relationNode = doc.createElement("relation");
      relationNode.setAttribute("unit", unitAttr);
      relationNode.setAttribute("role", roleAttr);
      subjectNode.appendChild(relationNode);
    });

    // Save the updated XML document
    writeXML(doc, 'subject-added');

    res.status(201).send("Subject created successfully");
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Internal Server Error: " + error.message);
  }
});


app.put("/subjects/:id", (req, res) => {
  try {
    const { id } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.rawBody,
      "application/xml"
    );

    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    // Validate all relations first
    const relations = select("//relation", docBody);
    for (const rel of relations) {
      const unit = rel.getAttribute("unit");
      const role = rel.getAttribute("role");

      // Check if unit exists
      const unitExists = select(
        `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${unit}']`,
        doc
      )[0];
      if (!unitExists) {
        return res.status(400).send(`Unit "${unit}" does not exist`);
      }

      // Check if role exists
      const roleExists = select(
        `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${role}']`,
        doc
      )[0];
      if (!roleExists) {
        return res.status(400).send(`Role "${role}" does not exist`);
      }
    }

    // Validate all skills
    const skills = select("//skills/skill", docBody);
    for (const skill of skills) {
      const skillId = skill.getAttribute("id");
      const skillExists = select(
        `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill[@id='${skillId}']`,
        doc
      )[0];
      if (!skillExists) {
        return res.status(400).send(`Skill "${skillId}" does not exist`);
      }
    }

    // Remove existing relations and skills
    const existingRelations = select(`${NS_PREFIX}:relation`, subjectNode);
    existingRelations.forEach((rel) => rel.parentNode.removeChild(rel));

    const existingSkills = select(`${NS_PREFIX}:skills`, subjectNode)[0];
    if (existingSkills) {
      existingSkills.parentNode.removeChild(existingSkills);
    }

    // Add new relations
    relations.forEach((rel) => {
      const unit = rel.getAttribute("unit");
      const role = rel.getAttribute("role");
      const relationNode = doc.createElement("relation");
      relationNode.setAttribute("unit", unit);
      relationNode.setAttribute("role", role);
      subjectNode.appendChild(relationNode);
    });

    // Add new skills
    // Replace the code in your PUT /subjects/:id endpoint for adding skills:
    if (skills.length > 0) {
      // Create the node that the GET endpoint expects
      const skillsNode = doc.createElement("subjectSkills");
      skills.forEach((skill) => {
        const skillRefNode = doc.createElement("skillRef");
        skillRefNode.setAttribute("id", skill.getAttribute("id"));
        skillsNode.appendChild(skillRefNode);
      });
      subjectNode.appendChild(skillsNode);
    }

    writeXML(doc, 'subject-updated');
    res.send("Subject updated successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/subjects/:id", (req, res) => {
  try {
    const { id } = req.params;
    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    subjectNode.parentNode.removeChild(subjectNode);
    writeXML(doc, 'subject-deleted');
    res.send("Subject deleted successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/subjects/:id/relations", (req, res) => {
  try {
    const { id } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.body,
      "application/xml"
    );
    const unit = select("//relation/unit/text()", docBody)[0]?.nodeValue;
    const role = select("//relation/role/text()", docBody)[0]?.nodeValue;
    if (!unit || !role)
      return res.status(400).send("Both 'unit' and 'role' are required.");

    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    const existing = select(
      `${NS_PREFIX}:relation[@unit='${unit}' and @role='${role}']`,
      subjectNode
    )[0];
    if (existing) return res.status(409).send("Relation already exists.");

    const relationNode = doc.createElement("relation");
    relationNode.setAttribute("unit", unit);
    relationNode.setAttribute("role", role);
    subjectNode.appendChild(relationNode);

    writeXML(doc);
    res.status(201).send("Relation added successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/subjects/:id/relations", (req, res) => {
  try {
    const { id } = req.params;
    const { unit, role } = req.query;
    if (!unit || !role)
      return res
        .status(400)
        .send("'unit' and 'role' query params are required.");

    const doc = readXML();
    const relationNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']/${NS_PREFIX}:relation[@unit='${unit}' and @role='${role}']`,
      doc
    )[0];
    if (!relationNode) return res.status(404).send("Relation not found.");

    relationNode.parentNode.removeChild(relationNode);
    writeXML(doc);
    res.send("Relation removed successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/subjects/:id/skills", (req, res) => {
  try {
    const { id } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.body,
      "application/xml"
    );
    const skillId = select("//skillRef/id/text()", docBody)[0]?.nodeValue;
    if (!skillId) return res.status(400).send("skillId is required.");

    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found.");

    const globalSkill = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill[@id='${skillId}']`,
      doc
    )[0];
    if (!globalSkill) return res.status(404).send("skill not found.");

    let subjectSkillsNode = select(
      `${NS_PREFIX}:subjectSkills`,
      subjectNode
    )[0];
    if (!subjectSkillsNode) {
      subjectSkillsNode = doc.createElement("subjectSkills");
      subjectNode.appendChild(subjectSkillsNode);
    }

    const existingRef = select(
      `${NS_PREFIX}:skillRef[@id='${skillId}']`,
      subjectSkillsNode
    )[0];
    if (existingRef)
      return res
        .status(409)
        .send("Skill is already referenced by the subject.");

    const skillRefNode = doc.createElement("skillRef");
    skillRefNode.setAttribute("id", skillId);
    subjectSkillsNode.appendChild(skillRefNode);

    writeXML(doc);
    res.status(201).send("Skill reference added to subject successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/subjects/:id/skills/:skillId", (req, res) => {
  try {
    const { id, skillId } = req.params;
    const doc = readXML();
    const skillRefNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']/${NS_PREFIX}:subjectSkills/${NS_PREFIX}:skillRef[@id='${skillId}']`,
      doc
    )[0];
    if (!skillRefNode)
      return res.status(404).send("Skill reference not found on subject.");

    skillRefNode.parentNode.removeChild(skillRefNode);
    writeXML(doc);
    res.send("Skill reference removed from subject successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Get roles of a specific subject at a specific unit
app.get("/subjects/:id/unit/:unitId/roles", (req, res) => {
  try {
    const { id, unitId } = req.params;
    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    const roles = select(
      `${NS_PREFIX}:relation[@unit='${unitId}']`,
      subjectNode
    ).map((rel) => rel.getAttribute("role"));
    res.send(roles);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Add a role for a specific subject at a specific unit
app.post("/subjects/:id/unit/:unitId/roles/:roleId", (req, res) => {
  try {
    const { id, unitId, roleId } = req.params;
    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    const existingRelation = select(
      `${NS_PREFIX}:relation[@unit='${unitId}' and @role='${roleId}']`,
      subjectNode
    )[0];
    if (existingRelation)
      return res.status(409).send("Relation already exists");

    const relationNode = doc.createElement("relation");
    relationNode.setAttribute("unit", unitId);
    relationNode.setAttribute("role", roleId);
    subjectNode.appendChild(relationNode);

    writeXML(doc);
    res.status(201).send("Role added to subject at unit successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Delete a role for a specific subject at a specific unit
app.delete("/subjects/:id/unit/:unitId/roles/:roleId", (req, res) => {
  try {
    const { id, unitId, roleId } = req.params;
    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    const relationNode = select(
      `${NS_PREFIX}:relation[@unit='${unitId}' and @role='${roleId}']`,
      subjectNode
    )[0];
    if (!relationNode) return res.status(404).send("Relation not found");

    relationNode.parentNode.removeChild(relationNode);
    writeXML(doc);
    res.send("Role removed from subject at unit successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Add a new unit with a mandatory role for a specific subject
app.post("/subjects/:id/unit/:unitId", (req, res) => {
  try {
    const { id, unitId } = req.params;
    const docBody = new DOMParser().parseFromString(
      req.body,
      "application/xml"
    );
    const roleId = select("//relation/role/text()", docBody)[0]?.nodeValue;
    if (!roleId) return res.status(400).send("Role is required");

    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    const existingRelation = select(
      `${NS_PREFIX}:relation[@unit='${unitId}' and @role='${roleId}']`,
      subjectNode
    )[0];
    if (existingRelation)
      return res.status(409).send("Relation already exists");

    const relationNode = doc.createElement("relation");
    relationNode.setAttribute("unit", unitId);
    relationNode.setAttribute("role", roleId);
    subjectNode.appendChild(relationNode);

    writeXML(doc);
    res.status(201).send("Unit with role added to subject successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/subjects/byuid/:uid", (req, res) => {
  try {
    const { uid } = req.params;
    const doc = readXML();
    const subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@uid='${uid}']`,
      doc
    )[0];
    if (!subjectNode) return res.status(404).send("Subject not found");

    const id = subjectNode.getAttribute("id");
    const relations = select(`${NS_PREFIX}:relation`, subjectNode).map((r) => ({
      unit: r.getAttribute("unit"),
      role: r.getAttribute("role"),
    }));
    const skillRefs = select(
      `${NS_PREFIX}:subjectSkills/${NS_PREFIX}:skillRef`,
      subjectNode
    ).map((sr) => sr.getAttribute("id"));

    res.send({ id, uid, relations, skillRefs });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
