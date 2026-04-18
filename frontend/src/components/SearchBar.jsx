import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { normalizeCountryName, resolveCountryDisplayName } from '../utils/countryData';

const MAX_SUGGESTIONS = 8;

const SearchBar = ({ countryNames = [], selectedCountry, onCountrySelect = () => {} }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (selectedCountry) {
      setQuery(selectedCountry);
      setIsOpen(false);
      setActiveIndex(0);
    }
  }, [selectedCountry]);

  const trimmedQuery = query.trim();

  const suggestions = useMemo(() => {
    if (!trimmedQuery) {
      return countryNames.slice(0, MAX_SUGGESTIONS);
    }

    const lowerQuery = trimmedQuery.toLowerCase();
    const normalizedQuery = normalizeCountryName(trimmedQuery).toLowerCase();
    const startsWith = [];
    const contains = [];

    countryNames.forEach((name) => {
      const lowerName = name.toLowerCase();
      const normalizedName = normalizeCountryName(name).toLowerCase();

      if (lowerName.startsWith(lowerQuery) || normalizedName.startsWith(normalizedQuery)) {
        startsWith.push(name);
      } else if (lowerName.includes(lowerQuery) || normalizedName.includes(normalizedQuery)) {
        contains.push(name);
      }
    });

    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [countryNames, trimmedQuery]);

  const hasNoResults = Boolean(trimmedQuery) && suggestions.length === 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery]);

  const selectCountry = (countryName) => {
    if (!countryName) {
      return;
    }

    setQuery(countryName);
    setIsOpen(false);
    setActiveIndex(0);
    onCountrySelect(countryName);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((current) => Math.min(current + 1, Math.max(suggestions.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (suggestions[activeIndex]) {
        selectCountry(suggestions[activeIndex]);
      } else if (trimmedQuery) {
        const resolvedMatch = resolveCountryDisplayName(countryNames, trimmedQuery);
        if (countryNames.includes(resolvedMatch)) {
          selectCountry(resolvedMatch);
        } else {
          setIsOpen(true);
        }
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-3 sm:px-0">
      <div className="relative group">
        <div className="absolute -inset-0.5 rounded-[28px] bg-gradient-to-r from-cyan-500/70 via-blue-500/60 to-purple-600/70 blur opacity-35 transition duration-500 group-hover:opacity-70 group-focus-within:opacity-80" />

        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#09111f]/82 backdrop-blur-xl shadow-[0_0_34px_rgba(56,189,248,0.12)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/12 bg-cyan-400/10 text-cyan-200">
              <Search size={17} className="transition group-hover:text-cyan-100" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/60">
                Global Search
              </div>
              <input
                type="text"
                className="mt-1 w-full bg-transparent text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none"
                placeholder="Jump to any country..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsOpen(false), 100);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="hidden sm:flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-mono tracking-[0.24em] text-slate-400">
              ENTER
            </div>
          </div>
        </div>

        {isOpen && (
          <div className="absolute top-[calc(100%+0.8rem)] w-full overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[#08101f]/94 backdrop-blur-xl shadow-[0_24px_70px_rgba(0,0,0,0.45),0_0_30px_rgba(34,211,238,0.12)]">
            {suggestions.map((country, index) => (
              <button
                key={country}
                type="button"
                className={`w-full px-4 py-3 text-left text-sm transition ${
                  index === activeIndex
                    ? 'bg-cyan-400/12 text-cyan-100'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCountry(country)}
              >
                {country}
              </button>
            ))}

            {hasNoResults && (
              <div className="px-4 py-3 text-sm text-gray-400">
                No results
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
