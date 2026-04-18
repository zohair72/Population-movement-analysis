const COUNTRY_NAME_ALIASES = {
  'united states of america': 'United States',
  'united states': 'United States',
  usa: 'United States',
  us: 'United States',
  'united kingdom': 'United Kingdom',
  uk: 'United Kingdom',
  britain: 'United Kingdom',
  russia: 'Russian Federation',
  'russian federation': 'Russian Federation',
  'south korea': 'Korea, Rep.',
  korea: 'Korea, Rep.',
  'north korea': "Korea, Dem. People's Rep.",
  iran: 'Iran, Islamic Rep.',
  egypt: 'Egypt, Arab Rep.',
  'egypt, arab rep.': 'Egypt, Arab Rep.',
  syria: 'Syrian Arab Republic',
  yemen: 'Yemen, Rep.',
  'yemen, rep.': 'Yemen, Rep.',
  laos: 'Lao PDR',
  vietnam: 'Viet Nam',
  venezuela: 'Venezuela, RB',
  turkey: 'Turkiye',
  'czech republic': 'Czechia',
  brunei: 'Brunei Darussalam',
  'east timor': 'Timor-Leste',
  'federated states of micronesia': 'Micronesia, Fed. Sts.',
  gambia: 'Gambia, The',
  'hong kong': 'Hong Kong SAR, China',
  'hong kong sar': 'Hong Kong SAR, China',
  'hong kong s.a.r.': 'Hong Kong SAR, China',
  kyrgyzstan: 'Kyrgyz Republic',
  macao: 'Macao SAR, China',
  macau: 'Macao SAR, China',
  'macao s.a.r': 'Macao SAR, China',
  palestine: 'West Bank and Gaza',
  'puerto rico': 'Puerto Rico (US)',
  'republic of serbia': 'Serbia',
  'republic of the congo': 'Congo, Rep.',
  'saint kitts and nevis': 'St. Kitts and Nevis',
  'saint lucia': 'St. Lucia',
  'saint martin': 'St. Martin (French part)',
  'saint pierre and miquelon': 'St. Pierre and Miquelon',
  'saint vincent and the grenadines': 'St. Vincent and the Grenadines',
  'sint maarten': 'Sint Maarten (Dutch part)',
  slovakia: 'Slovak Republic',
  somalia: 'Somalia, Fed. Rep.',
  'são tomé and principe': 'Sao Tome and Principe',
  'sao tome and principe': 'Sao Tome and Principe',
  taiwan: 'Taiwan, China',
  'the bahamas': 'Bahamas, The',
  'united republic of tanzania': 'Tanzania',
  'united states virgin islands': 'Virgin Islands (U.S.)',
  curacao: 'Curacao',
  'falkland islands': 'Falkland Islands (Islas Malvinas)',
  'ivory coast': "Cote d'Ivoire",
  'democratic republic of the congo': 'Congo, Dem. Rep.'
};

function normalizeLookupKey(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeCountryName(countryName) {
  if (!countryName) {
    return '';
  }

  const trimmed = countryName.trim();
  return COUNTRY_NAME_ALIASES[normalizeLookupKey(trimmed)] || trimmed;
}

export const fallbackCountryData = {
  Pakistan: {
    country: 'Pakistan',
    population: 240485658,
    populationYear: 2023,
    migrationRate: 3.5,
    brainDrainRate: 12.4,
    topDestinations: [
      { name: 'United Kingdom', percentage: 28 },
      { name: 'United States', percentage: 24 },
      { name: 'Canada', percentage: 18 },
      { name: 'UAE', percentage: 16 },
      { name: 'Saudi Arabia', percentage: 14 }
    ]
  },
  India: {
    country: 'India',
    population: 1428627663,
    populationYear: 2023,
    migrationRate: 1.8,
    brainDrainRate: 4.3,
    topDestinations: [
      { name: 'United States', percentage: 38 },
      { name: 'Canada', percentage: 22 },
      { name: 'United Kingdom', percentage: 15 },
      { name: 'Australia', percentage: 14 },
      { name: 'Germany', percentage: 11 }
    ]
  },
  'United States': {
    country: 'United States',
    population: 334914895,
    populationYear: 2023,
    migrationRate: 0.4,
    brainDrainRate: 0.6,
    topDestinations: [
      { name: 'Canada', percentage: 30 },
      { name: 'United Kingdom', percentage: 25 },
      { name: 'Germany', percentage: 18 },
      { name: 'Australia', percentage: 15 },
      { name: 'Singapore', percentage: 12 }
    ]
  },
  'United Kingdom': {
    country: 'United Kingdom',
    population: 69138192,
    populationYear: 2023,
    migrationRate: 2.1,
    brainDrainRate: 6.8,
    topDestinations: [
      { name: 'Australia', percentage: 30 },
      { name: 'United States', percentage: 28 },
      { name: 'Canada', percentage: 18 },
      { name: 'UAE', percentage: 14 },
      { name: 'Singapore', percentage: 10 }
    ]
  },
  Canada: {
    country: 'Canada',
    population: 40097761,
    populationYear: 2023,
    migrationRate: 1.3,
    brainDrainRate: null,
    topDestinations: [
      { name: 'United States', percentage: 28 },
      { name: 'United Kingdom', percentage: 23 },
      { name: 'Australia', percentage: 19 },
      { name: 'France', percentage: 16 },
      { name: 'Germany', percentage: 14 }
    ]
  },
  Germany: {
    country: 'Germany',
    population: 84552242,
    populationYear: 2023,
    migrationRate: 1.9,
    brainDrainRate: 5.1,
    topDestinations: [
      { name: 'Switzerland', percentage: 28 },
      { name: 'United States', percentage: 25 },
      { name: 'Austria', percentage: 20 },
      { name: 'United Kingdom', percentage: 15 },
      { name: 'Canada', percentage: 12 }
    ]
  },
  Nigeria: {
    country: 'Nigeria',
    population: 223804632,
    populationYear: 2023,
    migrationRate: 0.7,
    brainDrainRate: 10.7,
    topDestinations: [
      { name: 'United Kingdom', percentage: 35 },
      { name: 'United States', percentage: 30 },
      { name: 'Canada', percentage: 18 },
      { name: 'Ghana', percentage: 10 },
      { name: 'South Africa', percentage: 7 }
    ]
  },
  China: {
    country: 'China',
    population: 1410710000,
    populationYear: 2023,
    migrationRate: 0.7,
    brainDrainRate: 3.8,
    topDestinations: [
      { name: 'United States', percentage: 40 },
      { name: 'Canada', percentage: 20 },
      { name: 'Australia', percentage: 18 },
      { name: 'United Kingdom', percentage: 12 },
      { name: 'Japan', percentage: 10 }
    ]
  },
  Brazil: {
    country: 'Brazil',
    population: 216422446,
    populationYear: 2023,
    migrationRate: 0.8,
    brainDrainRate: 2.6,
    topDestinations: [
      { name: 'United States', percentage: 35 },
      { name: 'Portugal', percentage: 25 },
      { name: 'Canada', percentage: 18 },
      { name: 'Germany', percentage: 12 },
      { name: 'United Kingdom', percentage: 10 }
    ]
  },
  Australia: {
    country: 'Australia',
    population: 26652770,
    populationYear: 2023,
    migrationRate: 1.5,
    brainDrainRate: null,
    topDestinations: [
      { name: 'United Kingdom', percentage: 29 },
      { name: 'United States', percentage: 24 },
      { name: 'New Zealand', percentage: 19 },
      { name: 'Canada', percentage: 16 },
      { name: 'Singapore', percentage: 12 }
    ]
  }
};

export function getFallbackCountryData(countryName) {
  const normalizedName = normalizeCountryName(countryName);
  return fallbackCountryData[normalizedName] || null;
}

export function resolveCountryDisplayName(countryNames = [], countryName) {
  if (!countryName) {
    return null;
  }

  const trimmed = countryName.trim();
  const normalizedInput = normalizeCountryName(trimmed).toLowerCase();

  const exactMatch = countryNames.find((name) => name.toLowerCase() === trimmed.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedMatch = countryNames.find(
    (name) => normalizeCountryName(name).toLowerCase() === normalizedInput
  );

  return normalizedMatch || trimmed;
}
