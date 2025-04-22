const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT =9000;

// In-memory storage for expression state
let currentExpression = [];
const sseClients = new Set();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../editor-frontend')));

// SSE setup - keep connection alive and stream updates
app.get('/expression-state', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial data
  const data = JSON.stringify({ expression: currentExpression });
  res.write(`event: expression-state\ndata: ${data}\n\n`);
  
  // Add client to connected clients set
  sseClients.add(res);
  
  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Save expression endpoint
app.post('/save-expression', async (req, res) => {
  try {
    const { expression } = req.body;
    if (!expression || !Array.isArray(expression)) {
      return res.status(400).json({ error: 'Invalid expression format' });
    }
    
    // Update in-memory state
    currentExpression = expression;
    
    // Save to file for persistence
    await fs.writeFile(
      path.join(__dirname, 'data', 'expression-state.json'), 
      JSON.stringify({ expression })
    ).catch(err => console.log('Failed to write to file, using in-memory only:', err));
    
    // Broadcast to all connected clients
    broadcastExpression(expression);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving expression:', error);
    res.status(500).json({ error: 'Server error saving expression' });
  }
});

// Get current expression endpoint
app.get('/get-expression', async (req, res) => {
  try {
    // First try to read from file for persistence across server restarts
    try {
      const data = await fs.readFile(
        path.join(__dirname, 'data', 'expression-state.json'), 
        'utf8'
      );
      const parsed = JSON.parse(data);
      if (parsed.expression && Array.isArray(parsed.expression)) {
        currentExpression = parsed.expression;
      }
    } catch (err) {
      // File might not exist yet, which is fine
      if (err.code !== 'ENOENT') console.error('Error reading expression file:', err);
    }
    
    res.json({ expression: currentExpression });
  } catch (error) {
    console.error('Error retrieving expression:', error);
    res.status(500).json({ error: 'Server error retrieving expression' });
  }
});

// Organisation data endpoint (assuming you have this file)
app.get('/organisation', async (req, res) => {
  try {
    const data = await fs.readFile(
      path.join(__dirname, 'data', 'organisation.xml'),
      'utf8'
    );
    res.type('application/xml');
    res.send(data);
  } catch (error) {
    console.error('Error retrieving organisation data:', error);
    res.status(500).json({ error: 'Server error retrieving organisation data' });
  }
});

// Helper function to broadcast expression updates to all SSE clients
function broadcastExpression(expression) {
  const data = JSON.stringify({ expression });
  sseClients.forEach(client => {
    client.write(`event: expression-state\ndata: ${data}\n\n`);
  });
}

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// Start server
async function startServer() {
  await ensureDataDir();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('SSE endpoint available at /expression-state');
    console.log('Expression endpoints: POST /save-expression, GET /get-expression');
    console.log('Organisation data endpoint: GET /organisation');
  });
}

startServer();
