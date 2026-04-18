const WORLD_BANK_API_BASE =
  'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=5000';

function simplifyPopulationRecords(records = []) {
  const latestByCountry = new Map();

  records
    .filter((record) => record && record.value !== null)
    .forEach((record) => {
      const simplified = {
        country: record.country?.value,
        countryCode: record.countryiso3code,
        year: Number(record.date),
        population: record.value
      };

      if (!simplified.country || !Number.isFinite(simplified.year)) {
        return;
      }

      const existing = latestByCountry.get(simplified.country);
      if (!existing || simplified.year > existing.year) {
        latestByCountry.set(simplified.country, simplified);
      }
    });

  return Array.from(latestByCountry.values());
}

export function normalizePopulationPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

export async function fetchWorldBankPopulation() {
  const firstResponse = await fetch(`${WORLD_BANK_API_BASE}&page=1`);
  if (!firstResponse.ok) {
    throw new Error('World Bank population API request failed.');
  }

  const firstPayload = await firstResponse.json();
  const metadata = firstPayload?.[0];
  const firstPageRecords = firstPayload?.[1] || [];
  const totalPages = Number(metadata?.pages || 1);
  let allRecords = [...firstPageRecords];

  for (let page = 2; page <= totalPages; page += 1) {
    const pageResponse = await fetch(`${WORLD_BANK_API_BASE}&page=${page}`);
    if (!pageResponse.ok) {
      throw new Error(`World Bank population API page ${page} failed.`);
    }

    const pagePayload = await pageResponse.json();
    allRecords = allRecords.concat(pagePayload?.[1] || []);
  }

  return simplifyPopulationRecords(allRecords);
}
