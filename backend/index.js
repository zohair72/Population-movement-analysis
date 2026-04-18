// ============================================================
// index.js  —  Main Entry Point for the Backend Server
// ------------------------------------------------------------
// This is the file you run with `node index.js`.
// It creates the Express app, registers the API routes,
// and starts listening on port 5000.
// ============================================================

const express = require('express');
const cors = require('cors');

// Import our route definitions
const countryRoutes = require('./routes/countryRoutes');

// Create the Express app
const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------
// Parse incoming JSON request bodies (needed for POST/PUT later)
app.use(express.json());

// Enable CORS so separately hosted frontends can call this API
app.use(cors());

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------

// Root route — simple health check
app.get('/', (req, res) => {
  res.json({
    message: 'Web GIS Dashboard Backend is running!',
    availableEndpoints: [
      'GET /api/population        → Population data from World Bank API',
      'GET /api/migration         → Dummy migration data',
      'GET /api/brain-drain       → Dummy brain drain data',
      'GET /api/country/:name     → Combined data for a single country'
    ]
  });
});

// Mount all /api routes from countryRoutes
app.use('/api', countryRoutes);

// ------------------------------------------------------------
// Start the Server
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Available API endpoints:');
  console.log('  GET /api/population');
  console.log('  GET /api/migration');
  console.log('  GET /api/brain-drain');
  console.log('  GET /api/country/:countryName');
});
