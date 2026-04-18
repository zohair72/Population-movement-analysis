import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, AlertTriangle, Globe } from 'lucide-react';
import { normalizeCountryName } from '../utils/countryData';
import { buildCountryAnalytics } from '../utils/countryAnalytics';

const populationTrendData = [
  { year: '2019', val: 215 }, { year: '2020', val: 220 }, { year: '2021', val: 225 },
  { year: '2022', val: 235 }, { year: '2023', val: 240 }, { year: '2024', val: 251 }
];

const panelShellClassName = 'premium-panel absolute z-20 flex min-h-0 flex-col overflow-hidden rounded-[28px] text-white transition-all duration-500';

const LeftPanel = ({ populationData = [], populationLoading, populationError, selectedCountry }) => {
  const populationMap = useMemo(() => {
    const map = {};
    populationData.forEach((item) => {
      const normalizedName = normalizeCountryName(item.countryName || item.country || item.name || '').toLowerCase();
      if (!normalizedName) {
        return;
      }

      if (!map[normalizedName] || Number(item.year) > Number(map[normalizedName].year)) {
        map[normalizedName] = item;
      }
    });
    return map;
  }, [populationData]);

  const countryData = useMemo(() => {
    if (!selectedCountry) {
      return null;
    }

    const normalizedCountryName = normalizeCountryName(selectedCountry);
    const populationRecord = populationMap[normalizedCountryName.toLowerCase()] || null;
    return buildCountryAnalytics(normalizedCountryName, populationRecord);
  }, [populationMap, selectedCountry]);

  if (!selectedCountry) {
    return (
      <div className={`${panelShellClassName} left-3 right-3 top-3 p-6 sm:left-4 sm:top-4 sm:right-auto sm:w-[22rem] lg:w-[24rem]`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
        <div className="flex min-h-[13rem] flex-col items-center justify-center text-center sm:min-h-[calc(100vh-6rem)]">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/12 shadow-[0_0_35px_rgba(56,189,248,0.22)]">
            <Globe size={32} className="text-cyan-300" />
          </div>
          <h2 className="mb-2 text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-300">
            Space Analytics
          </h2>
          <p className="max-w-[18rem] text-sm leading-6 text-slate-300/78">
            Select any country on the globe to open its live demographic and migration summary.
          </p>
        </div>
      </div>
    );
  }

  if (populationLoading) {
    return (
      <div className={`${panelShellClassName} left-3 right-3 top-3 p-6 sm:left-4 sm:top-4 sm:right-auto sm:w-[22rem] lg:w-[24rem]`}>
        <div className="flex min-h-[13rem] flex-col items-center justify-center sm:min-h-[calc(100vh-6rem)]">
          <div className="mb-4 h-11 w-11 rounded-full border-4 border-cyan-400/20 border-t-cyan-300 animate-spin" />
          <p className="text-sm font-medium text-slate-300/80 animate-pulse">Loading population for {selectedCountry}...</p>
        </div>
      </div>
    );
  }

  const displayCountryName = countryData?.country || selectedCountry;
  const population = countryData?.population ?? 'N/A';
  const migrationRate = countryData?.migrationRate ?? 'N/A';
  const brainDrainRate = countryData?.brainDrainRate ?? 'N/A';
  const destinations = Array.isArray(countryData?.topDestinations) && countryData.topDestinations.length > 0
    ? countryData.topDestinations
    : [];

  return (
    <div className={`${panelShellClassName} left-3 right-3 top-3 bottom-3 p-4 sm:left-4 sm:top-4 sm:bottom-4 sm:right-auto sm:w-[22rem] sm:p-5 lg:w-[24rem]`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
      <div className="custom-scrollbar relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
        <div className="rounded-3xl border border-white/8 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(168,85,247,0.08),rgba(10,15,28,0.26))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/65">
              Country Analytics
            </div>
            <div className="rounded-full border border-cyan-300/16 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
              GIS Live
            </div>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-300">
            {displayCountryName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300/72">
            Population comes from the live API. Migration and brain-drain metrics are generated demo analytics for full country coverage.
          </p>
          {populationError && (
            <div className="mt-3 inline-flex rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-100">
              Live population API is unavailable. Population is currently unavailable for all countries.
            </div>
          )}
          {!populationError && countryData?.populationYear && (
            <div className="mt-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
              Population year: {countryData.populationYear}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-400/8 hover:shadow-[0_12px_28px_rgba(34,211,238,0.08)]">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/85">
              <Users size={14} />
              Population
            </div>
            <div className="text-xl font-bold text-slate-50">
              {typeof population === 'number' ? `${(population / 1000000).toFixed(1)}M` : population}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-violet-400/8 hover:shadow-[0_12px_28px_rgba(168,85,247,0.08)]">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200/85">
              <TrendingUp size={14} />
              Migration
            </div>
            <div className="text-xl font-bold text-slate-50">
              {migrationRate}{typeof migrationRate === 'number' && '%'}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-400/20 bg-[linear-gradient(135deg,rgba(244,63,94,0.14),rgba(15,23,42,0.1))] p-3 shadow-[0_0_22px_rgba(244,63,94,0.08)]">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-rose-300" />
            <div>
              <div className="font-semibold text-rose-100">
                {brainDrainRate}{typeof brainDrainRate === 'number' && '%'} Brain Drain Rate
              </div>
              <div className="text-xs text-rose-200/65">Critical threshold tracker</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/80">
            Historical Growth
          </div>
          <div className="h-[12rem]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={populationTrendData} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="popColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7} />
                    <stop offset="55%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(8,15,31,0.92)',
                    border: '1px solid rgba(148,163,184,0.16)',
                    borderRadius: '16px',
                    fontSize: '12px',
                    backdropFilter: 'blur(14px)',
                    color: '#e2e8f0'
                  }}
                />
                <Area type="monotone" dataKey="val" stroke="#67e8f9" strokeWidth={2.2} fillOpacity={1} fill="url(#popColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/80">
            Top Brain Drain Destinations
          </div>
          {destinations.length > 0 ? (
            <div className="space-y-3">
              {destinations.map((dest, i) => (
                <div key={dest.name || dest.country || i} className="flex items-center gap-2">
                  <span className="w-12 text-xs font-bold text-slate-300/75 truncate">{dest.name || dest.country}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10 shadow-[inset_0_0_8px_rgba(0,0,0,0.4)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-400 to-cyan-300 shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-[width] duration-700 ease-out"
                      style={{ width: `${dest.percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[10px] font-semibold text-cyan-200">{dest.percentage}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">
              No destination breakdown available for this country yet.
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(103, 232, 249, 0.16);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(103, 232, 249, 0.26); }
      `}</style>
    </div>
  );
};

export default LeftPanel;
