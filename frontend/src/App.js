import React, { useEffect, useMemo, useState } from 'react';
import StarBackground from './components/StarBackground';
import GlobeMap from './components/GlobeMap';
import LeftPanel from './components/LeftPanel';
import SearchBar from './components/SearchBar';
import { resolveCountryDisplayName } from './utils/countryData';
import { fetchJson } from './utils/api';
import { fetchWorldBankPopulation, normalizePopulationPayload } from './utils/populationApi';

const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

function App() {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [populationData, setPopulationData] = useState([]);
  const [populationLoading, setPopulationLoading] = useState(true);
  const [populationError, setPopulationError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load countries');
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setGeoJsonData(data);
        }
      })
      .catch((error) => {
        console.error('GeoJSON load error:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchJson('/api/population')
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setPopulationData(normalizePopulationPayload(payload));
        setPopulationLoading(false);
        setPopulationError(null);
      })
      .catch(async (error) => {
        if (!isMounted) {
          return;
        }

        console.error('Population API error:', error);

        try {
          const worldBankData = await fetchWorldBankPopulation();
          if (!isMounted) {
            return;
          }

          setPopulationData(worldBankData);
          setPopulationLoading(false);
          setPopulationError(null);
        } catch (fallbackError) {
          if (!isMounted) {
            return;
          }

          console.error('World Bank fallback error:', fallbackError);
          setPopulationData([]);
          setPopulationLoading(false);
          setPopulationError('Population API is currently unavailable.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const countryNames = useMemo(() => {
    if (!Array.isArray(geoJsonData?.features)) {
      return [];
    }

    return geoJsonData.features
      .map((feature) => feature?.properties?.ADMIN || feature?.properties?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [geoJsonData]);

  const handleCountrySelect = (countryName) => {
    setSelectedCountry(resolveCountryDisplayName(countryNames, countryName));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans text-gray-100">
      <StarBackground />

      <SearchBar
        countryNames={countryNames}
        selectedCountry={selectedCountry}
        onCountrySelect={handleCountrySelect}
      />

      <GlobeMap
        geoJsonData={geoJsonData}
        populationData={populationData}
        selectedCountry={selectedCountry}
        onCountrySelect={handleCountrySelect}
      />

      <LeftPanel
        populationData={populationData}
        populationLoading={populationLoading}
        populationError={populationError}
        selectedCountry={selectedCountry}
      />
    </div>
  );
}

export default App;
