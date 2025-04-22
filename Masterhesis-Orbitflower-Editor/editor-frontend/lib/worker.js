const RNG = `<grammar xmlns="http://relaxng.org/ns/structure/1.0" datatypeLibrary="http://www.w3.org/2001/XMLSchema-datatypes" ns="http://ns/organisation/1.0">
    <start>
        <element name="organisation">
            <ref name="units" />
            <ref name="roles" />
            <ref name="subjects" />
        </element>
    </start>
    <define name="units">
        <element name="units">
            <zeroOrMore>
                <element name="unit">
                    <ref name="thing" />
                </element>
            </zeroOrMore>
        </element>
    </define>
    <define name="roles">
        <element name="roles">
            <zeroOrMore>
                <element name="role">
                    <ref name="thing" />
                </element>
            </zeroOrMore>
        </element>
    </define>
    <define name="thing">
        <attribute name="id">
            <data type="string" />
        </attribute>
        <zeroOrMore>
            <element name="parent">
                <data type="string" />
            </element>
        </zeroOrMore>
        <ref name="permissions" />
    </define>
    <define name="subjects">
        <element name="subjects">
            <zeroOrMore>
                <ref name="subject" />
            </zeroOrMore>
        </element>
    </define>
    <define name="subject">
        <element name="subject">
            <attribute name="id">
                <data type="string" />
            </attribute>
            <attribute name="uid">
                <data type="string" />
            </attribute>
            <oneOrMore>
                <choice>
                    <element name="relation">
                        <attribute name="role">
                            <data type="string" />
                        </attribute>
                        <attribute name="unit">
                            <data type="string" />
                        </attribute>
                    </element>
                </choice>
            </oneOrMore>
        </element>
    </define>
    <define name="permissions">
        <element name="permissions">
            <empty />
        </element>
    </define>
</grammar>
`;

/**
 * Helper function to execute XPath queries in the browser
 * @param {string} xpath - The XPath expression
 * @param {Node} context - The context node
 * @param {Object} namespaceResolver - Object mapping prefix to namespace URI
 * @returns {Array} - Array of matching nodes
 */

class GraphWorker {
  /**
   * @param {string} xmlContent - The XML content (as a string) to be processed.
   * @param {string} xpathExpression - XPath expression for selecting nodes.
   * @param {string} subjects - XPath for subject elements.
   * @param {object} nopts - Additional options.
   */
  constructor(xmlContent, xpathExpression, subjects, nopts) {
    this.nodes = [];
    this.paths = [];
    this.roots = [];
    this.subjects = [];
    this.maxsubjects = 0;

    // Parse the RNG schema and the provided XML content.
    const schema = this.loadXML(RNG);
    const doc = xmlContent;
    if (!this.validateAgainstSchema(doc, schema)) {
      return;
    }

    // Define namespace mappings.
    const namespaceResolver = {
      o: "http://ns/organisation/1.0",
    };

    const nodes = this.buildNodes(
      doc,
      xpathExpression,
      subjects,
      nopts,
      namespaceResolver
    );
    this.nodes = nodes;

    this.subjects = this.processSubjects(doc, subjects, namespaceResolver);

    this.replaceParentReferences();

    this.calculatePaths();

    const groups = this.calculateGroups(this.paths);

    this.addGroupIds(groups);

    this.findRoots(groups);
  }

  // Now accepts an XML string directly.
  loadXML(xmlString) {
    return new DOMParser().parseFromString(xmlString, "text/xml");
  }

  validateAgainstSchema(doc, schema) {
    // Add schema validation if required.
    return true;
  }

  buildNodes(doc, xpathExpression, subjects, nopts, namespaceResolver) {
    const nodes = [];
    const nsResolver = (prefix) =>
      prefix === "o" ? "http://ns/organisation/1.0" : null;

    try {
      const nodeElements = doc.evaluate(
        xpathExpression,
        doc,
        nsResolver,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      for (let i = 0; i < nodeElements.snapshotLength; i++) {
        const ru = nodeElements.snapshotItem(i);
        const type = ru.tagName; // "unit" or "role"
        const id = ru.getAttribute("id");

        try {
          const node = new Node(id, type, nopts);
          node.numsubjects = this.countSubjects(
            doc,
            subjects,
            type,
            id,
            nsResolver
          );

          // Get parent references using namespace-aware XPath
          const parents = doc.evaluate(
            "o:parent",
            ru,
            nsResolver,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );

          for (let j = 0; j < parents.snapshotLength; j++) {
            const pa = parents.snapshotItem(j);
            const parentId = pa.textContent.trim();

            // Find parent node in the same section (units/roles)
            const parentNode = doc.evaluate(
              `../o:*[@id="${parentId}"]`, // Use o:* to match namespaced elements
              ru,
              nsResolver,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue;

            if (parentNode) {
              node.parents.push([parentNode.tagName, parentId]);
            }
          }

          nodes.push(node);
        } catch (error) {
          console.error("Error building node:", error);
        }
      }
    } catch (error) {
      console.error("XPath error:", error);
    }

    return nodes;
  }

  // Helper method to dump document structure for debugging
  dumpDocumentStructure(node, level = 0) {
    let structure = "";
    const indent = "  ".repeat(level);

    structure += `${indent}${node.nodeName}`;
    if (node.nodeType === 1) {
      // Element node
      if (node.hasAttributes()) {
        const attrs = Array.from(node.attributes)
          .map((attr) => `${attr.name}="${attr.value}"`)
          .join(" ");
        structure += ` [${attrs}]`;
      }
    }
    structure += "\n";

    for (let child of node.childNodes) {
      structure += this.dumpDocumentStructure(child, level + 1);
    }

    return structure;
  }

  countSubjects(doc, subjects, type, id, namespaceResolver) {
    const subjectPath = `${subjects.replace(
      /\/*$/,
      ""
    )}[o:relation[@${type}="${id}"]]`;
    const matchedSubjects = this.evaluateXPath(
      subjectPath,
      doc,
      namespaceResolver
    );
    return matchedSubjects.length;
  }

  processSubjects(doc, subjectsPath, namespaceResolver) {
    const subjectsList = [];
    const nsResolver = (prefix) =>
      prefix === "o" ? "http://ns/organisation/1.0" : null;

    try {
      const subjectElements = doc.evaluate(
        subjectsPath,
        doc,
        nsResolver,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      for (let i = 0; i < subjectElements.snapshotLength; i++) {
        const subjectNode = subjectElements.snapshotItem(i);
        const subject = new Subject(
          subjectNode.getAttribute("id"),
          subjectNode.getAttribute("uid")
        );

        // Get relations using namespace-aware XPath
        const relations = doc.evaluate(
          "o:relation",
          subjectNode,
          nsResolver,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );

        for (let j = 0; j < relations.snapshotLength; j++) {
          const rel = relations.snapshotItem(j);
          const unitId = rel.getAttribute("unit");
          const roleId = rel.getAttribute("role");

          // Find matching unit and role nodes
          const unit = this.nodes.find(
            (n) => n.id === unitId && n.type === "unit"
          );
          const role = this.nodes.find(
            (n) => n.id === roleId && n.type === "role"
          );

          if (unit && role) {
            subject.relations.push(new Relation(unit, role));
            unit.subjects = [...new Set([...unit.subjects, subject])];
            role.subjects = [...new Set([...role.subjects, subject])];
          }
        }

        subjectsList.push(subject);
      }
    } catch (error) {
      console.error("Error processing subjects:", error);
    }

    return subjectsList;
  }
  /**
   * Helper method to evaluate XPath expressions with namespace support
   * @param {string} xpath - The XPath expression to evaluate
   * @param {Node} context - The context node to evaluate against
   * @param {Object} namespaceResolver - Object containing namespace mappings
   * @returns {Array} - Array of matching nodes
   */
  evaluateXPath(xpath, context, namespaceResolver) {
    // Ensure context is a valid node
    if (!context) {
      return [];
    }

    const nsResolver = (prefix) => {
      if (prefix === "o") {
        return "http://ns/organisation/1.0";
      }
      return null;
    };

    try {
      const result = [];
      const xpathResult = context.evaluate(
        xpath,
        context,
        nsResolver,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      for (let i = 0; i < xpathResult.snapshotLength; i++) {
        result.push(xpathResult.snapshotItem(i));
      }
      return result;
    } catch (error) {
      return [];
    }
  }

  replaceParentReferences() {
    this.nodes.forEach((node) => {
      this.maxsubjects = Math.max(this.maxsubjects, node.numsubjects);
      if (node.parents.length > 0) {
        const tparents = node.parents
          .map((p) => this.nodes.find((n) => n.type === p[0] && n.id === p[1]))
          .filter(Boolean);
        node.parents = tparents;
      }
    });
  }

  calculatePaths() {
    this.nodes.forEach((node) => {
      const path = [node];
      this.paths.push(path);
      this.calculatePath(this.paths, path);
    });
  }

  calculatePath(paths, path) {
    const parents = path[path.length - 1].parents;
    switch (parents.length) {
      case 0:
        break;
      case 1:
        if (!path.includes(parents[0])) {
          path.push(parents[0]);
          this.calculatePath(paths, path);
        }
        break;
      default:
        const tpath = [...path];
        parents.forEach((parent, index) => {
          if (!tpath.includes(parent)) {
            if (index === 0) {
              path.push(parent);
              this.calculatePath(paths, path);
            } else {
              const newPath = [...tpath, parent];
              paths.push(newPath);
              this.calculatePath(paths, newPath);
            }
          }
        });
    }
  }

  calculateGroups(paths) {
    const groups = [];
    let tpath = [];
    paths.forEach((path) => {
      if (path.some((node) => tpath.includes(node))) {
        tpath = [...new Set([...tpath, ...path])];
        groups[groups.length - 1] = tpath;
      } else {
        groups.push(path);
        tpath = path;
      }
    });
    return groups;
  }

  addGroupIds(groups) {
    groups.forEach((group, groupId) => {
      this.nodes.forEach((node) => {
        if (group.includes(node)) {
          node.group = groupId;
        }
      });
    });
  }

  findRoots(groups) {
    this.paths.sort((a, b) => {
      if (a[0].group !== b[0].group) {
        return a[0].group - b[0].group;
      }
      return b.length - a.length;
    });

    const grouproots = [];
    this.paths.forEach((path) => {
      const group = path[0].group;
      grouproots[group] = grouproots[group] || path.length;
      if (grouproots[group] === path.length) {
        this.roots.push(path[path.length - 1]);
      }
    });
    this.roots = [...new Set(this.roots)];
  }

  rank_short() {
    this.paths.forEach((path) => {
      let ndx = 1;
      if (path.length === this.paths[0].length) {
        path
          .slice()
          .reverse()
          .forEach((node) => {
            node.rank = Math.min(node.rank || Infinity, ndx++);
          });
      } else {
        path
          .slice()
          .reverse()
          .forEach((node) => {
            if (!node.rank) {
              node.rank = ndx++;
            } else {
              ndx = node.rank + 1;
            }
          });
      }
    });
    this.nodes.sort((a, b) => [a.group, a.rank] - [b.group, b.rank]);
  }

  rank_long() {
    this.paths.forEach((path) => {
      let ndx = 1;
      path
        .slice()
        .reverse()
        .forEach((node) => {
          if (!node.rank) {
            node.rank = ndx++;
          } else {
            ndx = node.rank + 1;
          }
        });
    });
    this.nodes.sort((a, b) => [a.group, a.rank] - [b.group, b.rank]);
  }

  debug() {
    let output = "";
    output += "---Group => Length: Path--------------------\n";
    this.paths.forEach((path) => {
      output += `${path[0].group} => ${path.length}: ${path
        .map((node) => node.id)
        .join("->")}\n`;
    });
    output += "---Root Candidates--------------------------\n";
    this.roots.forEach((root) => {
      output += `${root.id}\n`;
    });
    output += "---Rank------------------------------------\n";
    this.nodes
      .sort((a, b) => a.rank - b.rank)
      .forEach((node) => {
        output += `${node.id} => ${node.rank}\n`;
      });
    return output;
  }
}
