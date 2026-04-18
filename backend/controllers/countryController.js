// ============================================================
// countryController.js
// ------------------------------------------------------------
// Controllers handle each API request. They receive req/res
// from Express, call services or read data files, and send
// back JSON responses.
//
// WHAT CHANGED:
// - getCountryByName now fetches ALL population data from the
//   World Bank API, then matches the country locally instead
//   of searching by name in the API (which was unreliable).
// - The response format is simplified and flattened.
// - Country aliases (USA, UK, etc.) are now supported.
// ============================================================

const path = require('path');
const fs = require('fs');
const {
  fetchAllPopulationData,
  getLatestPopulation,
  resolveCountryName
} = require('../services/worldbankService');

// ---------------------
// Helper: Load JSON file
// ---------------------
function loadJsonFile(filename) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// ============================================================
// Controller Functions
// ============================================================

/**
 * GET /api/population
 * Fetches population data for all countries from the World Bank API.
 * (Unchanged — still fetches all data from the World Bank.)
 */
async function getPopulation(req, res) {
  try {
    const data = await fetchAllPopulationData();
    res.json({
      message: 'Population data fetched successfully from World Bank API',
      totalRecords: data.length,
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch population data from World Bank API.' });
  }
}

/**
 * GET /api/migration
 * Returns dummy migration data from migrationData.json.
 * (Unchanged.)
 */
function getMigration(req, res) {
  try {
    const data = loadJsonFile('migrationData.json');
    res.json({
      message: 'Migration data loaded successfully',
      totalRecords: data.length,
      data: data
    });
  } catch (error) {
    console.error('Error reading migration data:', error.message);
    res.status(500).json({ error: 'Failed to load migration data.' });
  }
}

/**
 * GET /api/brain-drain
 * Returns dummy brain drain data from brainDrainData.json.
 * (Unchanged.)
 */
function getBrainDrain(req, res) {
  try {
    const data = loadJsonFile('brainDrainData.json');
    res.json({
      message: 'Brain drain data loaded successfully',
      totalRecords: data.length,
      data: data
    });
  } catch (error) {
    console.error('Error reading brain drain data:', error.message);
    res.status(500).json({ error: 'Failed to load brain drain data.' });
  }
}

/**
 * GET /api/country/:countryName
 * 
 * Returns COMBINED data for a single country in a clean, flat format:
 *   - population (from World Bank API, matched locally)
 *   - migration rate (from dummy data)
 *   - brain drain rate (from dummy data)
 *   - top brain drain destinations
 * 
 * HOW MATCHING WORKS:
 *   1. Resolve aliases: "USA" → "United States", "UK" → "United Kingdom"
 *   2. Fetch ALL population data from World Bank (cached for 1 hour)
 *   3. Match the resolved name case-insensitively against World Bank data
 *   4. Also match against our local migration/brain drain JSON files
 *   5. Return the combined result
 * 
 * WHY THIS IS MORE RELIABLE:
 *   Previously we tried to pass the country name directly to the World Bank
 *   API, which often returned null because the API expects ISO3 codes for
 *   single-country lookups, not plain names like "Pakistan".
 *   Now we fetch ALL data first and search locally — which always works.
 */
async function getCountryByName(req, res) {
  try {
    const rawName = req.params.countryName;

    // Step 1: Resolve aliases (e.g. "USA" → "United States")
    const resolvedName = resolveCountryName(rawName);
    console.log(`[CTRL DEBUG] rawName="${rawName}", resolvedName="${resolvedName}"`);

    // Step 2: Get latest population from World Bank (fetches all, matches locally)
    const populationRecord = await getLatestPopulation(rawName);
    console.log(`[CTRL DEBUG] populationRecord:`, populationRecord ? JSON.stringify(populationRecord).substring(0, 200) : 'NULL');

    // Step 3: Load and match migration data (case-insensitive)
    const migrationAll = loadJsonFile('migrationData.json');
    const migration = migrationAll.find(
      m => m.country.toLowerCase() === resolvedName.toLowerCase()
    ) || null;

    // Step 4: Load and match brain drain data (case-insensitive)
    const brainDrainAll = loadJsonFile('brainDrainData.json');
    const brainDrain = brainDrainAll.find(
      b => b.country.toLowerCase() === resolvedName.toLowerCase()
    ) || null;

    // Step 5: Check if we found anything at all
    if (!populationRecord && !migration && !brainDrain) {
      return res.status(404).json({
        error: `No data found for country: "${rawName}". Try the full name (e.g. "Pakistan", "United States") or a common alias (e.g. "USA", "UK").`
      });
    }

    // Step 6: Build the clean, flat response
    const response = {
      country: populationRecord ? populationRecord.country : resolvedName,
      population: populationRecord ? populationRecord.population : null,
      populationYear: populationRecord ? populationRecord.year : null,
      migrationRate: migration ? migration.emigrationRate : null,
      brainDrainRate: brainDrain ? brainDrain.skilledEmigrationRate : null,
      topDestinations: brainDrain
        ? brainDrain.topDestinationCountries.map(d => ({
            country: d.name,
            percentage: d.percentage
          }))
        : []
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching country data:', error.message);
    res.status(500).json({ error: 'Failed to fetch combined country data.' });
  }
}

// Export all controller functions
module.exports = {
  getPopulation,
  getMigration,
  getBrainDrain,
  getCountryByName
};
