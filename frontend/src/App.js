import React, { useEffect, useMemo, useState } from 'react';
import StarBackground from './components/StarBackground';
import GlobeMap from './components/GlobeMap';
import LeftPanel from './components/LeftPanel';
import SearchBar from './components/SearchBar';
import { resolveCountryDisplayName } from './utils/countryData';
import { fetchJson } from './utils/api';
import { fetchWorldBankPopulation, normalizePopulationPayload } from './utils/populationApi';

const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

class AnalyticsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Analytics panel render error:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="premium-panel absolute bottom-3 left-3 right-3 z-20 rounded-[28px] p-4 text-white sm:bottom-4 sm:left-4 sm:right-auto sm:top-4 sm:w-[22rem] sm:p-5 lg:w-[24rem]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-300/40 to-transparent" />
          <div className="rounded-3xl border border-white/8 bg-[linear-gradient(135deg,rgba(251,113,133,0.16),rgba(168,85,247,0.08),rgba(10,15,28,0.26))] p-4">
            <h2 className="text-xl font-bold text-rose-100">Analytics temporarily unavailable</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300/80">
              The selected country loaded, but this device hit a panel rendering issue. Try closing and reopening the panel.
            </p>
            <button
              type="button"
              onClick={this.props.onClose}
              className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              Close analytics
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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

      <AnalyticsErrorBoundary
        resetKey={selectedCountry}
        onClose={() => setSelectedCountry(null)}
      >
        <LeftPanel
          populationData={populationData}
          populationLoading={populationLoading}
          populationError={populationError}
          selectedCountry={selectedCountry}
          onClose={() => setSelectedCountry(null)}
        />
      </AnalyticsErrorBoundary>
    </div>
  );
}

export default App;
