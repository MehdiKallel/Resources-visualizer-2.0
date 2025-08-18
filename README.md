# OrbitSkill

## Overview

OrbitSkill is a web-based, interactive tool for real-time organizational visualization, skill tracking, and collaborative editing of entity data.It enables users to explore organizational structures, manage subjects, units, roles, and skills, and build complex queries using a drag-and-drop expression builder. The visualization is dynamic, replacing legacy static approaches with a modern client-server architecture supporting real-time updates.

## Folder Structure

```
orbitskill/
│
├── Masterhesis-Orbitflower-Editor/        # Main project directory
│   ├── editor-frontend/                   # Frontend application
│   │   ├── features-scripts/              # Feature implementations
│   │   │   ├── skillsFeature.js           # Skill management functionality
│   │   │   └── ...
│   │   ├── form-handlers/                 # UI form handling
│   │   │   ├── formHandler.js             # General form processing
│   │   │   └── ...
│   │   └── ...
│   │
│   ├── org-structure-rest-api/            # Backend REST API
│   │   ├── server.js                      # Main server implementation
│   │   ├── organisation.xml               # XML data store
│   │   └── ...
│   │
│   └── reference.xml                      # Reference XML schema
│
└── README.md                              # Project documentation
```

## System Architecture

- **Client–Server Model:** The browser client renders the UI and communicates with a REST API backend.
- **Backend:** Manages organizational data (subjects, units, roles, skills), supports CRUD operations, and exposes endpoints for integration (e.g., skill updates from external systems).
- **Frontend:** Modular JavaScript components handle visualization, data management, and interactive querying. UI updates automatically on server events.
- **Real-Time Updates:** Changes are propagated to all clients via server-sent events or websockets.

## Main Features

- **Organizational Visualization:** Interactive SVG-based display of units, roles, subjects, and skills.
- **Skill Exploration:** Multiple filtering modes (unit/role → skill, skill → unit/role), visual mapping of skills as rings, nodes, and list items.
- **Expression Builder:** Drag-and-drop interface for building logical queries, with syntax error prevention and persistent state.
- **Data Management UI:** Dedicated tabs for adding, editing, and deleting subjects, units, roles, and skills.
- **Visual Feedback:** Glow effects highlight selected entities, with state persistence across sessions.
- **Integration:** REST endpoints for external systems (e.g., CPEE, Jira) to update skill profiles and retrieve filtered subject lists.

## Data Model

The application uses an XML-based data model with the following main entities:

- **Units:** Organizational divisions with hierarchical relationships
- **Roles:** Positions that subjects can hold within units
- **Skills:** Capabilities that can be assigned to subjects
- **Subjects:** Individuals with unit-role relations and skills

### XML Data Structure

Skills are associated with subjects using the following structure:

```xml
<subject id="Subject Name" uid="uniqueId">
  <subjectSkills>
    <ref id="SkillId" strength="75"/>
  </subjectSkills>
  <relation unit="UnitId" role="RoleId"/>
</subject>
```

## Integration with External Systems

### CPEE Integration Endpoint

To enable integration with CPEE (Cloud Process Execution Engine) or other external systems, the OrbitSkill solution provides the following endpoint to update subject skill strengths:

#### Update Subject Skill Strength

```
PUT /subjects/:id/skills/:skillId/strength
```

**Request Parameters:**
- `id` (path parameter): Subject ID or UID
- `skillId` (path parameter): ID of the skill to update

**Request Body:**
```json
{
  "strength": 85
}
```

**Response:**
- Status: 200 OK
- Body: "Skill strength updated successfully"

**Error Responses:**
- 404 Not Found: Subject or skill not found
- 400 Bad Request: Invalid strength value (must be 0-100)


### Integration Usage Examples

#### Example 1: CPEE Task Completion Update

When a CPEE task is completed, it can update the subject's skill strength in OrbitSkill:

```
curl -X PUT http://localhost:3000/subjects/John%20Doe/skills/JavaScript/strength \
  -H "Content-Type: application/json" \
  -d '{"strength": 85}'
```

#### Example 2: Automated Skill Assessment

External assessment systems can update skills in OrbitSkill based on evaluations:

```javascript
// Example JavaScript integration
async function updateSkillStrength(subjectId, skillId, newStrength) {
  const response = await fetch(`http://localhost:3000/subjects/${subjectId}/skills/${skillId}/strength`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ strength: newStrength }),
  });
  
  return response.ok;
}
```

## Usage

1. **Start the OrbitSkill backend server** (from the org-structure-rest-api directory):
   ```
   npm install
   node server.js
   ```

2. **Access the OrbitSkill frontend** by opening index.html in a browser or serving the editor-frontend directory.

3. **Explore, manage, and query organizational data** using the interactive features.
