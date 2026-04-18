// ============================================================
// countryRoutes.js
// ------------------------------------------------------------
// This file defines all the API routes for our dashboard.
// It uses Express Router to keep routes organized and separate
// from the main server file (index.js).
// 
// Each route points to a controller function that handles
// the actual logic.
// ============================================================

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  getPopulation,
  getMigration,
  getBrainDrain,
  getCountryByName
} = require('../controllers/countryController');

// ------------------------------------------------------------
// Route Definitions
// ------------------------------------------------------------

// GET /api/population
// → Fetches population data for all countries from the World Bank API
router.get('/population', getPopulation);

// GET /api/migration
// → Returns dummy migration data from migrationData.json
router.get('/migration', getMigration);

// GET /api/brain-drain
// → Returns dummy brain drain data from brainDrainData.json
router.get('/brain-drain', getBrainDrain);

// GET /api/country/:countryName
// → Returns combined data (population + migration + brain drain) for one country
// → Example: /api/country/Pakistan
router.get('/country/:countryName', getCountryByName);

// Export the router so index.js can use it
module.exports = router;
