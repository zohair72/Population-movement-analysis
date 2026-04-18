// ============================================================
// worldbankService.js
// ------------------------------------------------------------
// This service fetches population data from the World Bank API
// and provides helper functions to look up countries reliably.
//
// KEY DESIGN DECISIONS:
// 1. We fetch ALL pages from the World Bank API (it paginates 
//    the data across multiple pages of 5000 records each).
// 2. We cache the results for 1 hour to avoid hammering the API.
// 3. We match country names locally using case-insensitive
//    comparison and common aliases (e.g. "USA" → "United States").
// 4. For each country, we keep only the latest non-null population.
// ============================================================

const axios = require('axios');

// World Bank API base URL for total population indicator
const POPULATION_API_BASE =
  'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=5000';

// ------------------------------------------------------------
// Country Name Aliases
// ------------------------------------------------------------
// Some country names have common short forms or alternate names.
// This map lets users type "USA" and still match "United States".
// Keys MUST be lowercase. Values should match the World Bank name exactly.
const COUNTRY_ALIASES = {
  'usa': 'United States',
  'us': 'United States',
  'america': 'United States',
  'uk': 'United Kingdom',
  'britain': 'United Kingdom',
  'great britain': 'United Kingdom',
  'uae': 'United Arab Emirates',
  'south korea': 'Korea, Rep.',
  'korea': 'Korea, Rep.',
  'north korea': "Korea, Dem. People's Rep.",
  'russia': 'Russian Federation',
  'iran': 'Iran, Islamic Rep.',
  'venezuela': 'Venezuela, RB',
  'egypt': 'Egypt, Arab Rep.',
  'yemen': 'Yemen, Rep.',
  'syria': 'Syrian Arab Republic',
  'laos': 'Lao PDR',
  'vietnam': 'Viet Nam',
  'brunei': 'Brunei Darussalam',
  'east timor': 'Timor-Leste',
  'federated states of micronesia': 'Micronesia, Fed. Sts.',
  'gambia': 'Gambia, The',
  'hong kong': 'Hong Kong SAR, China',
  'hong kong sar': 'Hong Kong SAR, China',
  'hong kong s.a.r.': 'Hong Kong SAR, China',
  'kyrgyzstan': 'Kyrgyz Republic',
  'macao': 'Macao SAR, China',
  'macau': 'Macao SAR, China',
  'macao s.a.r': 'Macao SAR, China',
  'palestine': 'West Bank and Gaza',
  'puerto rico': 'Puerto Rico (US)',
  'republic of serbia': 'Serbia',
  'republic of the congo': 'Congo, Rep.',
  'saint kitts and nevis': 'St. Kitts and Nevis',
  'saint lucia': 'St. Lucia',
  'saint martin': 'St. Martin (French part)',
  'saint pierre and miquelon': 'St. Pierre and Miquelon',
  'saint vincent and the grenadines': 'St. Vincent and the Grenadines',
  'sint maarten': 'Sint Maarten (Dutch part)',
  'slovakia': 'Slovak Republic',
  'somalia': 'Somalia, Fed. Rep.',
  'são tomé and principe': 'Sao Tome and Principe',
  'sao tome and principe': 'Sao Tome and Principe',
  'taiwan': 'Taiwan, China',
  'the bahamas': 'Bahamas, The',
  'united republic of tanzania': 'Tanzania',
  'united states virgin islands': 'Virgin Islands (U.S.)',
  'curaçao': 'Curacao',
  'curacao': 'Curacao',
  'falkland islands': 'Falkland Islands (Islas Malvinas)',
  'congo': 'Congo, Dem. Rep.',
  'ivory coast': "Cote d'Ivoire",
  'czech republic': 'Czechia',
  'turkey': 'Turkiye'
};

// ------------------------------------------------------------
// In-memory cache
// ------------------------------------------------------------
// We cache the grouped "latest population per country" map so
// we don't call the World Bank API on every single request.
// The cache expires after 1 hour.
let latestPopulationMap = null;   // { "pakistan": { country, countryCode, year, population }, ... }
let allRecordsCache = null;       // Full flat array of all records
let cacheTimestamp = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function normalizeLookupKey(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Checks if the cache is still fresh.
 */
function isCacheFresh() {
  return latestPopulationMap && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION_MS);
}

/**
 * Resolves a user-supplied country name to the name the World Bank uses.
 * 
 * Steps:
 *   1. Trim whitespace and convert to lowercase
 *   2. Check if it's a known alias (e.g. "usa" → "United States")
 *   3. If not an alias, return the original input (we'll match case-insensitively later)
 */
function resolveCountryName(input) {
  const cleaned = normalizeLookupKey(input);

  // Check if the input matches a known alias
  if (COUNTRY_ALIASES[cleaned]) {
    return COUNTRY_ALIASES[cleaned];
  }

  // Return the original input (will be matched case-insensitively later)
  return input.trim();
}

/**
 * Fetches ALL pages of population data from the World Bank API.
 * 
 * The World Bank API paginates results. With per_page=5000, a dataset
 * of ~17,500 records spans 4 pages. We must fetch every page to
 * guarantee we have data for ALL countries (Pakistan, India, etc.
 * may appear on page 2, 3, or 4).
 * 
 * Returns a flat array of simplified records.
 */
async function fetchAllPopulationData() {
  // Return cached data if it's still fresh
  if (isCacheFresh() && allRecordsCache) {
    console.log('Using cached population data');
    return allRecordsCache;
  }

  try {
    console.log('Fetching fresh population data from World Bank API (all pages)...');

    // Step 1: Fetch page 1 to learn how many pages there are
    const firstResponse = await axios.get(`${POPULATION_API_BASE}&page=1`);
    const metadata = firstResponse.data[0];  // { page, pages, per_page, total }
    const totalPages = metadata.pages;

    console.log(`  World Bank API: ${metadata.total} total records across ${totalPages} pages`);

    // Collect records from page 1
    let allRawRecords = firstResponse.data[1] || [];

    // Step 2: Fetch remaining pages (2, 3, 4, ...)
    for (let page = 2; page <= totalPages; page++) {
      console.log(`  Fetching page ${page} of ${totalPages}...`);
      const pageResponse = await axios.get(`${POPULATION_API_BASE}&page=${page}`);
      const pageRecords = pageResponse.data[1] || [];
      allRawRecords = allRawRecords.concat(pageRecords);
    }

    // Step 3: Filter out null values and simplify
    const populationData = allRawRecords
      .filter(record => record.value !== null)
      .map(record => ({
        country: record.country.value,        // e.g. "Pakistan"
        countryCode: record.countryiso3code,   // e.g. "PAK"
        year: parseInt(record.date),           // e.g. 2023
        population: record.value               // e.g. 240485658
      }));

    // Step 4: Build the "latest population per country" lookup map
    // Group by country name (lowercase), keep only the most recent year
    const latestMap = {};
    for (const record of populationData) {
      const key = record.country.toLowerCase();
      if (!latestMap[key] || record.year > latestMap[key].year) {
        latestMap[key] = record;
      }
    }

    // Save to cache
    allRecordsCache = populationData;
    latestPopulationMap = latestMap;
    cacheTimestamp = Date.now();

    console.log(`  Cached ${populationData.length} records, ${Object.keys(latestMap).length} unique countries`);

    return populationData;
  } catch (error) {
    console.error('Error fetching population data from World Bank:', error.message);
    throw error;
  }
}

/**
 * Gets the LATEST population for a specific country by name.
 * 
 * HOW IT WORKS (and why this is reliable):
 *   1. Ensure all data is fetched and cached (all pages)
 *   2. Resolve any aliases (e.g. "USA" → "United States")
 *   3. Look up the country in our pre-built latestPopulationMap
 *      (keyed by lowercase country name)
 *   4. Return the record with the most recent year's population
 * 
 * This is much more reliable than passing a country name directly
 * to the World Bank API, because:
 *   - The API expects ISO3 codes for single-country lookups
 *   - We fetch ALL data and search locally, which always works
 *   - We handle aliases so "USA", "UK", etc. resolve correctly
 */
async function getLatestPopulation(countryName) {
  // Make sure data is fetched and cached
  await fetchAllPopulationData();

  // Resolve aliases (e.g. "UK" → "United Kingdom")
  const resolvedName = resolveCountryName(countryName);

  // Look up in the pre-built map (lowercase key)
  const key = resolvedName.toLowerCase();
  
  // DEBUG: Log the lookup details
  console.log(`  [DEBUG] getLatestPopulation: input="${countryName}", resolved="${resolvedName}", key="${key}"`);
  console.log(`  [DEBUG] latestPopulationMap has ${latestPopulationMap ? Object.keys(latestPopulationMap).length : 0} entries`);
  console.log(`  [DEBUG] Map has key "${key}": ${latestPopulationMap ? (key in latestPopulationMap) : 'map is null'}`);
  
  // Check if a partial match exists (for debugging)
  if (latestPopulationMap && !(key in latestPopulationMap)) {
    const similar = Object.keys(latestPopulationMap).filter(k => k.includes(key) || key.includes(k));
    if (similar.length > 0) {
      console.log(`  [DEBUG] Similar keys found: ${similar.slice(0, 5).join(', ')}`);
    }
  }
  
  return latestPopulationMap[key] || null;
}

// Export the functions
module.exports = {
  fetchAllPopulationData,
  getLatestPopulation,
  resolveCountryName
};
