const morgan = require("morgan");
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
const cookieParser = require('cookie-parser');

// Define the namespace once for consistent use throughout the application
const XML_NAMESPACE = "http://ns/organisation/1.0";
const NS_PREFIX = "ns";
const expressionBuilderStates = new Map();

class UpdateEmitter extends EventEmitter {}
const updateEmitter = new UpdateEmitter();

const app = express();
app.use(morgan("tiny"));

// CORS configuration - remove any other CORS configurations
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8000",
  "http://localhost:8080", 
  "http://127.0.0.1:5500",
  "https://lehre.bpm.in.tum.de"
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true
}));

// CORS debugging middleware
app.use((req, res, next) => {
  console.log(`[CORS Debug] Request from origin: ${req.headers.origin || 'unknown'}`);
  next();
});

// Add OPTIONS pre-flight handler for all routes
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,UPDATE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(200).send();
  } else {
    res.status(403).send();
  }
});

const PORT = 3000;
const XML_FILE = path.join(__dirname, "organisation.xml");

app.use(cookieParser());

// Add session middleware
app.use((req, res, next) => {
  let sessionId = req.cookies.sessionId;
  if (!sessionId || !expressionBuilderStates.has(sessionId)) {
    sessionId = require('crypto').randomBytes(16).toString('hex');
    res.cookie('sessionId', sessionId, { 
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      httpOnly: true,
      sameSite: 'strict'
    });
    expressionBuilderStates.set(sessionId, {
      currentExpression: [],
      expressionHistory: [],
      paused: false,
      savedExpressions: []
    });
  }
  req.sessionId = sessionId;
  next();
});

// Add state endpoints
app.get('/expression-state', (req, res) => {
  res.json(expressionBuilderStates.get(req.sessionId));
});

app.post('/expression-state', express.json(), (req, res) => {
  expressionBuilderStates.set(req.sessionId, req.body);
  res.sendStatus(200);
});
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
const readXML = () => {
  const xmlData = fs.readFileSync(XML_FILE, "utf-8");
  return ensureNamespace(new DOMParser().parseFromString(xmlData, "text/xml"));
};

const safeWriteXML = (doc, updateType = "general") => {
  try {
    const xml = new XMLSerializer().serializeToString(doc);
    const formattedXML = format(xml, {
      indentation: "  ",
      collapseContent: true,
      lineSeparator: "\n",
    });

    fs.writeFileSync(XML_FILE, formattedXML);
    console.log(`XML file updated successfully (${updateType} change)`);

    updateEmitter.emit("update", {
      timestamp: Date.now(),
      type: updateType,
      message: `Organization structure updated: ${updateType}`,
    });
    return true;
  } catch (error) {
    console.error("Error writing XML file:", error);
    return false;
  }
};

const writeXML = safeWriteXML;

app.get("/events", (req, res) => {
  // Get the requesting origin
  const origin = req.headers.origin;
  
  // Set headers for SSE
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // Use the actual origin instead of wildcard
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : '',
    "Access-Control-Allow-Credentials": "true",
    "X-Accel-Buffering": "no",
  });
  
  // Send initial connection message
  res.write(`id: ${Date.now()}\n`);
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ status: "connected" })}\n\n`);

  // Define event handler
  const onUpdate = (data) => {
    const eventId = Date.now();
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
    // Log request information for debugging
    console.log(`[GET /organisation] Request from origin: ${req.headers.origin || 'unknown'}, with credentials: ${req.headers.cookie ? 'yes' : 'no'}`);
    
    // Set proper CORS headers explicitly for this endpoint
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    const doc = readXML();
    const xml = new XMLSerializer().serializeToString(doc);
    res.type("application/xml").send(xml);
  } catch (error) {
    console.error("[GET /organisation] Error:", error.message);
    res.status(500).send(error.message);
  }
});

app.get("/units", (req, res) => {
  try {
    const doc = readXML();
    const units = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit`,
      doc
    ).map((unitNode) => {
      const id = unitNode.getAttribute("id");
      const parentNode = select(`${NS_PREFIX}:parent`, unitNode)[0];
      const permissions = select(`${NS_PREFIX}:permissions/*`, unitNode).map(
        (perm) => perm.nodeName
      );
      
      return {
        id,
        parent: parentNode ? parentNode.textContent : null,
        permissions: permissions,
      };
    });
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
    writeXML(doc, "unit-added"); // Specify update type

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
    console.log(`PUT /units/${id} - Content-Type:`, req.headers['content-type']);
    console.log(`PUT /units/${id} - Request body:`, req.body);
    console.log(`PUT /units/${id} - Raw body:`, req.rawBody);
    console.log(`PUT /units/${id} - Raw body type:`, typeof req.rawBody);
    
    // Use rawBody for XML parsing, with fallback to req.body
    let xmlBody = req.rawBody || req.body;
    
    // Validate that we have a body to work with
    if (!xmlBody) {
      console.log("No request body provided");
      return res.status(400).send("Request body is required");
    }
    
    // Ensure it's a string
    if (typeof xmlBody !== 'string') {
      try {
        xmlBody = JSON.stringify(xmlBody);
      } catch (e) {
        xmlBody = String(xmlBody);
      }
    }
    
    console.log(`PUT /units/${id} - XML body to parse:`, xmlBody);
    
    let docBody;
    try {
      docBody = new DOMParser().parseFromString(
        xmlBody,
        "application/xml"
      );
    } catch (parseError) {
      console.log("DOMParser error:", parseError);
      return res.status(400).send("Failed to parse XML: " + parseError.message);
    }
    
    // Check if docBody was created successfully
    if (!docBody) {
      console.log("Failed to create XML document from body");
      return res.status(400).send("Failed to parse XML");
    }
    
    // Check for XML parsing errors
    const parseError = docBody.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      console.log("XML parsing error:", parseError[0].textContent);
      return res.status(400).send("Invalid XML format: " + parseError[0].textContent);
    }
    
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

    writeXML(doc, "unit-updated");
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
    writeXML(doc, "unit-deleted");

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
    ).map((roleNode) => {
      const id = roleNode.getAttribute("id");
      const permissions = select(`${NS_PREFIX}:permissions/*`, roleNode).map(
        (p) => p.nodeName
      );
      const parentNodes = select(`${NS_PREFIX}:parent`, roleNode);
      const parents = parentNodes.map(node => node.textContent);
      
      return { id, parents, permissions };
    });
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

    const parentNodes = select(`${NS_PREFIX}:parent`, roleNode);
    const parents = parentNodes.map(node => node.textContent);

    res.send({ id, parents, permissions });
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

    writeXML(doc, "role-added");
    res.status(201).send("Role added successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.put("/roles/:id", (req, res) => {
  try {
    const { id } = req.params;
    console.log(`PUT /roles/${id} - Content-Type:`, req.headers['content-type']);
    console.log(`PUT /roles/${id} - Request body:`, req.body);
    console.log(`PUT /roles/${id} - Raw body:`, req.rawBody);
    console.log(`PUT /roles/${id} - Raw body type:`, typeof req.rawBody);
    
    // Use rawBody for XML parsing, with fallback to req.body
    let xmlBody = req.rawBody || req.body;
    
    // Validate that we have a body to work with
    if (!xmlBody) {
      console.log("No request body provided");
      return res.status(400).send("Request body is required");
    }
    
    // Ensure it's a string
    if (typeof xmlBody !== 'string') {
      try {
        xmlBody = JSON.stringify(xmlBody);
      } catch (e) {
        xmlBody = String(xmlBody);
      }
    }
    
    console.log(`PUT /roles/${id} - XML body to parse:`, xmlBody);
    
    let docBody;
    try {
      docBody = new DOMParser().parseFromString(
        xmlBody,
        "application/xml"
      );
    } catch (parseError) {
      console.log("DOMParser error:", parseError);
      return res.status(400).send("Failed to parse XML: " + parseError.message);
    }
    
    // Check if docBody was created successfully
    if (!docBody) {
      console.log("Failed to create XML document from body");
      return res.status(400).send("Failed to parse XML");
    }
    
    // Check for XML parsing errors
    const parseError = docBody.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      console.log("XML parsing error:", parseError[0].textContent);
      return res.status(400).send("Invalid XML format: " + parseError[0].textContent);
    }
    
    // Safely extract permissions - check if permissions node exists first
    let permissions = [];
    const permissionsNodes = select("//permissions/permission/text()", docBody);
    if (permissionsNodes && permissionsNodes.length > 0) {
      permissions = permissionsNodes.map((p) => p.nodeValue);
    }
    
    // Extract parent IDs
    const parentIds = select("//role/parent/text()", docBody).map(
      (p) => p.nodeValue
    );

    console.log(`Found ${parentIds.length} parent IDs:`, parentIds);

    const doc = readXML();
    const roleNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${id}']`,
      doc
    )[0];
    if (!roleNode) {
      console.log(`Role '${id}' not found for update`);
      return res.status(404).send("Role not found");
    }

    // Update permissions only if permissions node exists in role
    const permissionsNode = select(`${NS_PREFIX}:permissions`, roleNode)[0];
    if (permissionsNode) {
      const existingPerms = select("*", permissionsNode);
      existingPerms.forEach((p) => permissionsNode.removeChild(p));

      if (Array.isArray(permissions) && permissions.length > 0) {
        permissions.forEach((p) => {
          const permNode = doc.createElement(p);
          permissionsNode.appendChild(permNode);
        });
      }
    }

    // Update parents
    const existingParents = select(`${NS_PREFIX}:parent`, roleNode);
    existingParents.forEach((p) => p.parentNode.removeChild(p));

    if (Array.isArray(parentIds) && parentIds.length > 0) {
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

    writeXML(doc, "role-updated");
    console.log(`Role '${id}' updated successfully`);
    res.send("Role updated successfully");
  } catch (error) {
    console.error("Error updating role:", error);
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
    writeXML(doc, "role-deleted");

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
      
      // Use getElementsByTagName to get relation elements (they're not namespaced)
      const relationElements = Array.from(node.getElementsByTagName("relation"));
      const relations = relationElements.map((rel) => ({
        id: rel.getAttribute("id"),
        type: rel.getAttribute("type") || "Similar",
        strength: rel.getAttribute("strength") || rel.getAttribute("score") || "5"
      }));
      
      // Keep backward compatibility with old format
      const related = select(`${NS_PREFIX}:relatedSkill`, node).map(
        (n) => n.textContent
      );
      
      // Return both formats for compatibility
      const relatedSkills = related.length > 0 ? related : relations.map(r => r.id);
      
      console.log(`Skill ${id}: ${relations.length} relations, ${relatedSkills.length} related skills`);
      return { 
        id, 
        relatedSkills: relatedSkills,
        relations: relations
      };
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

    // Use getElementsByTagName to get relation elements (they're not namespaced)
    const relationElements = Array.from(skillNode.getElementsByTagName("relation"));
    const relations = relationElements.map((rel) => ({
      id: rel.getAttribute("id"),
      type: rel.getAttribute("type") || "Similar",
      strength: rel.getAttribute("strength") || rel.getAttribute("score") || "5"
    }));
    
    // Keep backward compatibility
    const related = select(`${NS_PREFIX}:relatedSkill`, skillNode).map(
      (n) => n.textContent
    );
    
    res.send({ 
      id, 
      relatedSkills: related.length > 0 ? related : relations.map(r => r.id),
      relations: relations
    });
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
      // Create and append the relation element with all attributes
      const relationNode = doc.createElement("relation");
      relationNode.setAttribute("id", relationId);
      
      const relType = rel.getAttribute("type");
      if (relType) {
        relationNode.setAttribute("type", relType);
      }
      
      const strength = rel.getAttribute("strength");
      if (strength) {
        relationNode.setAttribute("strength", strength);
      }
      
      skillNode.appendChild(relationNode);
    }
    skillsNode.appendChild(skillNode);
    if (!writeXML(doc, "skill-added")) {
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
    
    // Use rawBody if available, otherwise stringify the parsed body
    let xmlString;
    if (req.rawBody) {
      xmlString = req.rawBody;
    } else {
      xmlString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
    
    console.log("PUT /skills - Raw XML:", xmlString);
    
    const docBody = new DOMParser().parseFromString(xmlString, "application/xml");
    
    // Check for parsing errors
    const parseError = docBody.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      console.error("XML parsing error:", parseError[0].textContent);
      return res.status(400).send("Invalid XML format");
    }
    
    // Get new relation elements from the incoming XML
    const newRelations = Array.from(docBody.getElementsByTagName("relation"));
    console.log("Found relations:", newRelations.length);
    
    const doc = readXML();
    const skillNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:skills/${NS_PREFIX}:skill[@id='${id}']`,
      doc
    )[0];
    
    if (!skillNode) {
      console.log("Skill not found:", id);
      return res.status(404).send("Skill not found.");
    }
    
    // Remove existing <relation> children
    const existingRelations = Array.from(
      skillNode.getElementsByTagName("relation")
    );
    existingRelations.forEach((r) => skillNode.removeChild(r));
    
    // Append each new relation with all attributes
    newRelations.forEach((rel) => {
      const relationId = rel.getAttribute("id");
      if (!relationId) return; // Skip invalid relation
      
      const relationNode = doc.createElement("relation");
      relationNode.setAttribute("id", relationId);
      
      const relType = rel.getAttribute("type");
      if (relType) {
        relationNode.setAttribute("type", relType);
      }
      
      const strength = rel.getAttribute("strength");
      if (strength) {
        relationNode.setAttribute("strength", strength);
      }
      
      skillNode.appendChild(relationNode);
    });
    
    writeXML(doc);
    res.send("Skill updated successfully");
  } catch (error) {
    console.error("PUT /skills error:", error);
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
    writeXML(doc, "subject-added");

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

    // Remove both potential skill containers to prevent duplication
    const existingSkills = select(`${NS_PREFIX}:skills`, subjectNode)[0];
    if (existingSkills) {
      existingSkills.parentNode.removeChild(existingSkills);
    }
    
    const existingSubjectSkills = select(`${NS_PREFIX}:subjectSkills`, subjectNode)[0];
    if (existingSubjectSkills) {
      existingSubjectSkills.parentNode.removeChild(existingSubjectSkills);
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
        const skillRefNode = doc.createElement("ref");
        skillRefNode.setAttribute("id", skill.getAttribute("id"));
        skillsNode.appendChild(skillRefNode);
      });
      subjectNode.appendChild(skillsNode);
    }

    writeXML(doc, "subject-updated");
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
    writeXML(doc, "subject-deleted");
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
    const skillId = select("//ref/id/text()", docBody)[0]?.nodeValue;
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
      `${NS_PREFIX}:ref[@id='${skillId}']`,
      subjectSkillsNode
    )[0];
    if (existingRef)
      return res
        .status(409)
        .send("Skill is already referenced by the subject.");

    const skillRefNode = doc.createElement("ref");
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
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@id='${id}']/${NS_PREFIX}:subjectSkills/${NS_PREFIX}:ref[@id='${skillId}']`,
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
    
    console.log(`Looking for subject with uid: ${uid}`);
    
    // Try both namespaced and non-namespaced selectors for subject lookup
    let subjectNode = select(
      `//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject[@uid='${uid}']`,
      doc
    )[0];
    
    if (!subjectNode) {
      // Try without namespace
      subjectNode = select(`//subject[@uid='${uid}']`, doc)[0];
    }
    
    if (!subjectNode) return res.status(404).send("Subject not found");

    const id = subjectNode.getAttribute("id");
    console.log(`Found subject: ${id} (uid: ${uid})`);
    
    // Try both namespaced and non-namespaced selectors for relations
    let relations = select(`${NS_PREFIX}:relation`, subjectNode);
    if (relations.length === 0) {
      relations = select(`relation`, subjectNode);
    }
    
    const relationsData = relations.map((r) => ({
      unit: r.getAttribute("unit"),
      role: r.getAttribute("role"),
    }));
    
    // Try both namespaced and non-namespaced selectors for skills
    let skillRefs = select(`${NS_PREFIX}:subjectSkills/${NS_PREFIX}:ref`, subjectNode);
    if (skillRefs.length === 0) {
      skillRefs = select(`subjectSkills/ref`, subjectNode);
    }
    
    const skillRefsData = skillRefs.map((sr) => sr.getAttribute("id"));

    console.log(`Subject ${uid} - Found ${relationsData.length} relations and ${skillRefsData.length} skills`);
    console.log(`Relations:`, relationsData);
    res.send({ id, uid, relations: relationsData, skillRefs: skillRefsData });
  } catch (error) {
    console.error("Error in /subjects/byuid:", error);
    res.status(500).send(error.message);
  }
});

// --- Expression Search Endpoint ---
app.get('/search', (req, res) => {
  try {
    const exprParam = req.query.expression;
    if (!exprParam) {
      return res.status(400).json({ error: 'Missing expression parameter' });
    }
    let expression;
    try {
      expression = JSON.parse(decodeURIComponent(exprParam));
    } catch (e) {
      return res.status(400).json({ error: 'Invalid expression format' });
    }
    // Read the org XML
    const doc = readXML();
    // Helper: get all subjects
    const allSubjects = select(`//${NS_PREFIX}:organisation/${NS_PREFIX}:subjects/${NS_PREFIX}:subject`, doc);
    const allSubjectUids = allSubjects.map(s => s.getAttribute('uid'));

    // Debug: print the received expression
    console.log('--- Expression Search Debug ---');
    console.log('Received expression:', JSON.stringify(expression, null, 2));

    // Helper: parse displayValue for type and ids
    function parseDisplayValue(displayValue) {
      // Examples:
      // Skill: SkillId
      // Skill: SkillId (unitId)
      // Skill: SkillId (roleId)
      // Unit: UnitId
      // Unit: UnitId (context)
      // Role: RoleId
      // Role: RoleId (context)
      // Subject: SubjectId
      if (!displayValue || typeof displayValue !== 'string') return null;
      // Helper to resolve context displayName to ID
      function resolveContextId(context) {
        if (!context || typeof context !== 'string') return context;
        // Role <id> or Role <displayName>
        const roleDisplayMatch = context.match(/^Role (.+)$/);
        if (roleDisplayMatch) {
          const value = roleDisplayMatch[1].trim();
          // Try by id
          const roleNodes = select(`//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role`, doc);
          for (const roleNode of roleNodes) {
            if (roleNode.getAttribute('id') === value) {
              return value;
            }
          }
          // Try by displayName
          for (const roleNode of roleNodes) {
            const displayNameNode = select(`${NS_PREFIX}:displayName`, roleNode)[0];
            if (displayNameNode && displayNameNode.textContent.trim() === value) {
              return roleNode.getAttribute('id');
            }
          }
        }
        // Unit <id> or Unit <displayName>
        const unitDisplayMatch = context.match(/^Unit (.+)$/);
        if (unitDisplayMatch) {
          const value = unitDisplayMatch[1].trim();
          // Try by id
          const unitNodes = select(`//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit`, doc);
          for (const unitNode of unitNodes) {
            if (unitNode.getAttribute('id') === value) {
              return value;
            }
          }
          // Try by displayName
          for (const unitNode of unitNodes) {
            const displayNameNode = select(`${NS_PREFIX}:displayName`, unitNode)[0];
            if (displayNameNode && displayNameNode.textContent.trim() === value) {
              return unitNode.getAttribute('id');
            }
          }
        }
        // --- NEW: Try context as a unit or role displayName or id directly ---
        // Try as unit id
        const unitNodes = select(`//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit`, doc);
        for (const unitNode of unitNodes) {
          if (unitNode.getAttribute('id') === context) {
            return context;
          }
        }
        // Try as unit displayName
        for (const unitNode of unitNodes) {
          const displayNameNode = select(`${NS_PREFIX}:displayName`, unitNode)[0];
          if (displayNameNode && displayNameNode.textContent.trim() === context) {
            return unitNode.getAttribute('id');
          }
        }
        // Try as role id
        const roleNodes = select(`//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role`, doc);
        for (const roleNode of roleNodes) {
          if (roleNode.getAttribute('id') === context) {
            return context;
          }
        }
        // Try as role displayName
        for (const roleNode of roleNodes) {
          const displayNameNode = select(`${NS_PREFIX}:displayName`, roleNode)[0];
          if (displayNameNode && displayNameNode.textContent.trim() === context) {
            return roleNode.getAttribute('id');
          }
        }
        return context;
      }
      const skillMatch = displayValue.match(/^Skill:\s*([^()]+?)(?: \(([^)]+)\))?$/);
      if (skillMatch) {
        let context = skillMatch[2] ? skillMatch[2].trim() : undefined;
        if (context && context.length > 0) {
          context = resolveContextId(context);
        }
        return { type: 'skill', skillId: skillMatch[1].trim(), contextId: context && context.length > 0 ? context : undefined };
      }
      const unitMatch = displayValue.match(/^Unit:\s*([^()]+?)(?: \(([^)]+)\))?$/);
      if (unitMatch) {
        let context = unitMatch[2] ? unitMatch[2].trim() : undefined;
        if (context && context.length > 0) {
          context = resolveContextId(context);
        }
        return { type: 'unit', unitId: unitMatch[1].trim(), contextId: context && context.length > 0 ? context : undefined };
      }
      const roleMatch = displayValue.match(/^Role:\s*([^()]+?)(?: \(([^)]+)\))?$/);
      if (roleMatch) {
        let context = roleMatch[2] ? roleMatch[2].trim() : undefined;
        if (context && context.length > 0) {
          context = resolveContextId(context);
        }
        return { type: 'role', roleId: roleMatch[1].trim(), contextId: context && context.length > 0 ? context : undefined };
      }
      const subjMatch = displayValue.match(/^Subject:\s*([^()]+)$/);
      if (subjMatch) {
        return { type: 'subject', subjectId: subjMatch[1].trim() };
      }
      return null;
    }

    // Recursively evaluate the expression array
    function evalExpr(expr) {
      if (!Array.isArray(expr)) return new Set();
      let resultSet = null;
      let currentOp = null;
      for (let i = 0; i < expr.length; i++) {
        const item = expr[i];
        console.error(`[Block] Processing item ${i}:`, item);
        if (Array.isArray(item)) {
          console.log(`[Block] Entering sub-array at index ${i}:`, JSON.stringify(item));
          const subResult = evalExpr(item);
          console.log(`[Block] Sub-array result (${JSON.stringify(item)}):`, Array.from(subResult));
          if (resultSet === null) {
            resultSet = subResult;
          } else if (currentOp) {
            console.log(`[Block] Applying operator '${currentOp}' to block result`);
            resultSet = applyOp(resultSet, subResult, currentOp);
            currentOp = null;
          }
        } else if (item.operator) {
          currentOp = item.operator;
          console.log(`[Operator] Set current operator: ${currentOp}`);
        } else if (item.displayValue) {
          const parsed = parseDisplayValue(item.displayValue);
          let matchSet = new Set();
          console.log(`[Parse] Parsed displayValue '${item.displayValue}':`, parsed);
          if (!parsed) {
            console.log(`[Parse] Could not parse displayValue: ${item.displayValue}`);
          } else if (parsed.type === 'skill' && !parsed.contextId) {
            // Skill: SkillId
            const matches = allSubjects.filter(s => {
              const skills = select(`${NS_PREFIX}:subjectSkills/${NS_PREFIX}:ref`, s);
              const hasSkill = skills.some(skill => skill.getAttribute('id') === parsed.skillId);
              if (hasSkill) {
                console.log(`[Skill] Subject ${s.getAttribute('uid')} has skill ${parsed.skillId}`);
              }
              return hasSkill;
            });
            matchSet = new Set(matches.map(s => s.getAttribute('uid')));
            console.log(`[Skill] SkillId=${parsed.skillId} =>`, Array.from(matchSet));
          } else if (parsed.type === 'skill' && parsed.contextId) {
            // Check if contextId is a valid unit or role
            const isUnit = select(`//${NS_PREFIX}:organisation/${NS_PREFIX}:units/${NS_PREFIX}:unit[@id='${parsed.contextId}']`, doc).length > 0;
            const isRole = select(`//${NS_PREFIX}:organisation/${NS_PREFIX}:roles/${NS_PREFIX}:role[@id='${parsed.contextId}']`, doc).length > 0;
            if (!isUnit && !isRole) {
              console.log(`[Skill+Context] ContextId '${parsed.contextId}' is not a valid unit or role. Treating as Skill only.`);
              const matches = allSubjects.filter(s => {
                const skills = select(`${NS_PREFIX}:subjectSkills/${NS_PREFIX}:ref`, s);
                const hasSkill = skills.some(skill => skill.getAttribute('id') === parsed.skillId);
                if (hasSkill) {
                  console.log(`[Skill] Subject ${s.getAttribute('uid')} has skill ${parsed.skillId}`);
                }
                return hasSkill;
              });
              matchSet = new Set(matches.map(s => s.getAttribute('uid')));
              console.log(`[Skill] SkillId=${parsed.skillId} =>`, Array.from(matchSet));
            } else {
              // Skill: SkillId (unit or role Id) -- must have BOTH the skill and a relation with the context as role or unit
              const matches = allSubjects.filter(s => {
                const hasSkill = select(`${NS_PREFIX}:subjectSkills/${NS_PREFIX}:ref[@id='${parsed.skillId}']`, s).length > 0;
                if (!hasSkill) {
                  console.log(`[Skill+Context] Subject ${s.getAttribute('uid')} does NOT have skill ${parsed.skillId}`);
                  return false;
                }
                const rels = select(`${NS_PREFIX}:relation`, s);
                const hasRelation = rels.some(rel => rel.getAttribute('unit') === parsed.contextId || rel.getAttribute('role') === parsed.contextId);
                if (hasRelation) {
                  console.log(`[Skill+Context] Subject ${s.getAttribute('uid')} has skill ${parsed.skillId} AND relation with context ${parsed.contextId}`);
                } else {
                  console.log(`[Skill+Context] Subject ${s.getAttribute('uid')} has skill ${parsed.skillId} but NO relation with context ${parsed.contextId}`);
                }
                return hasRelation;
              });
              matchSet = new Set(matches.map(s => s.getAttribute('uid')));
              console.log(`[Skill+Context] SkillId=${parsed.skillId}, ContextId=${parsed.contextId} =>`, Array.from(matchSet));
            }
          } else if (parsed.type === 'unit') {
            // Unit: UnitId
            const matches = allSubjects.filter(s => {
              const rels = select(`${NS_PREFIX}:relation`, s);
              const hasUnit = rels.some(rel => rel.getAttribute('unit') === parsed.unitId);
              if (hasUnit) {
                console.log(`[Unit] Subject ${s.getAttribute('uid')} has unit ${parsed.unitId}`);
              }
              return hasUnit;
            });
            matchSet = new Set(matches.map(s => s.getAttribute('uid')));
            console.log(`[Unit] UnitId=${parsed.unitId} =>`, Array.from(matchSet));
          } else if (parsed.type === 'role') {
            // Role: RoleId
            const matches = allSubjects.filter(s => {
              const rels = select(`${NS_PREFIX}:relation`, s);
              const hasRole = rels.some(rel => rel.getAttribute('role') === parsed.roleId);
              if (hasRole) {
                console.log(`[Role] Subject ${s.getAttribute('uid')} has role ${parsed.roleId}`);
              }
              return hasRole;
            });
            matchSet = new Set(matches.map(s => s.getAttribute('uid')));
            console.log(`[Role] RoleId=${parsed.roleId} =>`, Array.from(matchSet));
          } else if (parsed.type === 'subject') {
            // Subject: SubjectId
            const matches = allSubjects.filter(s => s.getAttribute('id') === parsed.subjectId || s.getAttribute('uid') === parsed.subjectId);
            if (matches.length > 0) {
              console.log(`[Subject] Found subject(s) for id/uid ${parsed.subjectId}:`, matches.map(s => s.getAttribute('uid')));
            } else {
              console.log(`[Subject] No subject found for id/uid ${parsed.subjectId}`);
            }
            matchSet = new Set(matches.map(s => s.getAttribute('uid')));
            console.log(`[Subject] SubjectId=${parsed.subjectId} =>`, Array.from(matchSet));
          }
          // --- NEGATION SUPPORT ---
          if (item.negated) {
            // Invert the matchSet: all subjects except those in matchSet
            const allUids = new Set(allSubjects.map(s => s.getAttribute('uid')));
            matchSet = new Set([...allUids].filter(uid => !matchSet.has(uid)));
            console.log(`[Negation] Negated result for item:`, Array.from(matchSet));
          }
          if (resultSet === null) {
            resultSet = matchSet;
          } else if (currentOp) {
            console.log(`[ApplyOp] Applying operator '${currentOp}' to sets:`, Array.from(resultSet), 'and', Array.from(matchSet));
            resultSet = applyOp(resultSet, matchSet, currentOp);
            currentOp = null;
          }
        }
      }
      return resultSet || new Set();
    }

    // Apply logical operator
    function applyOp(setA, setB, op) {
      if (!setA) return setB;
      if (!setB) return setA;
      let result;
      if (op === 'AND') {
        result = new Set([...setA].filter(x => setB.has(x)));
        console.log(`[AND]`, Array.from(setA), 'AND', Array.from(setB), '=', Array.from(result));
      } else if (op === 'OR') {
        result = new Set([...setA, ...setB]);
        console.log(`[OR]`, Array.from(setA), 'OR', Array.from(setB), '=', Array.from(result));
      } else if (op === 'NOT') {
        result = new Set([...setA].filter(x => !setB.has(x)));
        console.log(`[NOT]`, Array.from(setA), 'NOT', Array.from(setB), '=', Array.from(result));
      } else {
        result = setA;
      }
      return result;
    }

    // Evaluate the expression
    const resultSet = evalExpr(expression);
    const resultArr = Array.from(resultSet);
    // Debug: print the final result
    console.log('Final subjectUids:', resultArr);
    // Compose a result URL (for example, a link to a filtered view)
    const resultUrl = `/subjects?uids=${encodeURIComponent(resultArr.join(','))}`;
    res.json({ subjectUids: resultArr, resultUrl });
  } catch (err) {
    console.error('Error in /search:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
