import { normalizeCountryName } from './countryData';

const DESTINATION_POOL = [
  'United States',
  'Canada',
  'United Kingdom',
  'Germany',
  'Australia',
  'France',
  'Japan',
  'Singapore',
  'UAE',
  'Saudi Arabia',
  'Netherlands',
  'Switzerland'
];

function hashString(value) {
  return value.split('').reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) % 1000003, 7);
}

function buildDestinationMix(countryName, seed) {
  const filtered = DESTINATION_POOL.filter((destination) => destination !== countryName);
  const startIndex = seed % filtered.length;
  const ordered = [
    ...filtered.slice(startIndex),
    ...filtered.slice(0, startIndex)
  ].slice(0, 5);
  const percentages = [31, 24, 18, 15, 12];

  return ordered.map((name, index) => ({
    name,
    percentage: percentages[index]
  }));
}

export function buildCountryAnalytics(countryName, populationRecord) {
  const normalizedName = normalizeCountryName(countryName);
  const seed = hashString(normalizedName.toLowerCase());
  const population = populationRecord?.population ?? null;
  const populationYear = populationRecord?.year ?? null;
  const populationScale = population ? Math.min(population / 500000000, 1) : 0.35;

  const migrationRate = Number((0.6 + ((seed % 180) / 100) + populationScale * 1.4).toFixed(1));
  const brainDrainRate = Number((1.8 + ((seed % 420) / 100) + populationScale * 3.2).toFixed(1));

  return {
    country: normalizedName,
    population,
    populationYear,
    migrationRate,
    brainDrainRate,
    topDestinations: buildDestinationMix(normalizedName, seed)
  };
}
