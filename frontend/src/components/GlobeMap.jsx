import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView, { Layer, Source, useControl } from 'react-map-gl/mapbox';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { GeoJsonLayer } from '@deck.gl/layers';
import 'mapbox-gl/dist/mapbox-gl.css';
import { normalizeCountryName } from '../utils/countryData';

const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || process.env.REACT_APP_MAPBOX_TOKEN;
const INTRO_ROTATION_DURATION_MS = 2000;

const INITIAL_VIEW_STATE = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
  pitch: 0,
  bearing: 0
};

const COUNTRY_LABEL_HALO_LAYER = {
  id: 'country-label-halo',
  type: 'symbol',
  minzoom: 1.35,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 1.35, 8, 2, 10, 3, 11.5, 4.5, 13],
    'text-letter-spacing': 0.12,
    'text-max-width': 7.5,
    'text-allow-overlap': false,
    'text-ignore-placement': false
  },
  paint: {
    'text-color': 'rgba(0, 0, 0, 0)',
    'text-halo-color': 'rgba(2, 6, 23, 0.94)',
    'text-halo-width': 1.4,
    'text-opacity': ['interpolate', ['linear'], ['zoom'], 1.35, 0, 1.7, 0.55, 3.5, 0.9]
  }
};

const COUNTRY_LABEL_TEXT_LAYER = {
  id: 'country-label-text',
  type: 'symbol',
  minzoom: 1.35,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 1.35, 8, 2, 10, 3, 11.5, 4.5, 13],
    'text-letter-spacing': 0.12,
    'text-max-width': 7.5,
    'text-allow-overlap': false,
    'text-ignore-placement': false
  },
  paint: {
    'text-color': [
      'match',
      ['get', 'tone'],
      'selected', '#ffe4e6',
      'hovered', '#fbcfe8',
      '#dbeafe'
    ],
    'text-opacity': ['interpolate', ['linear'], ['zoom'], 1.35, 0, 1.7, 0.7, 3.5, 0.96]
  }
};

const flyEasing = (t) => 1 - Math.pow(1 - t, 3.2);

function DeckGLOverlay(props) {
  const overlay = useControl(() => new MapboxOverlay({ interleaved: true, ...props }));
  overlay.setProps({ interleaved: true, ...props });
  return null;
}

function collectCoordinates(node, points = []) {
  if (!Array.isArray(node)) {
    return points;
  }

  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    points.push([node[0], node[1]]);
    return points;
  }

  node.forEach((child) => collectCoordinates(child, points));
  return points;
}

function getRingArea(ring = []) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }

  return area / 2;
}

function getRingCentroid(ring = []) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return null;
  }

  const area = getRingArea(ring);
  if (Math.abs(area) < 1e-7) {
    const fallback = ring.slice(0, -1);
    if (fallback.length === 0) {
      return null;
    }

    return [
      fallback.reduce((sum, [lng]) => sum + lng, 0) / fallback.length,
      fallback.reduce((sum, [, lat]) => sum + lat, 0) / fallback.length
    ];
  }

  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const factor = x1 * y2 - x2 * y1;
    x += (x1 + x2) * factor;
    y += (y1 + y2) * factor;
  }

  return [x / (6 * area), y / (6 * area)];
}

function pointInRing(point, ring = []) {
  if (!point || !Array.isArray(ring) || ring.length < 3) {
    return false;
  }

  const [px, py] = point;
  let isInside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > py) !== (yj > py))
      && (px < ((xj - xi) * (py - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function pointInPolygon(point, polygon = []) {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return false;
  }

  if (!pointInRing(point, polygon[0])) {
    return false;
  }

  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i])) {
      return false;
    }
  }

  return true;
}

function pointInFeature(point, feature) {
  const geometry = feature?.geometry;
  if (!point || !geometry) {
    return false;
  }

  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  }

  return false;
}

function getLargestOuterRing(feature) {
  const geometry = feature?.geometry;
  if (!geometry) {
    return null;
  }

  if (geometry.type === 'Polygon') {
    return geometry.coordinates?.[0] || null;
  }

  if (geometry.type !== 'MultiPolygon') {
    return null;
  }

  let largestRing = null;
  let largestArea = 0;

  geometry.coordinates.forEach((polygon) => {
    const outerRing = polygon?.[0];
    if (!outerRing) {
      return;
    }

    const area = Math.abs(getRingArea(outerRing));
    if (area > largestArea) {
      largestArea = area;
      largestRing = outerRing;
    }
  });

  return largestRing;
}

function getRepresentativePoint(feature) {
  const primaryRing = getLargestOuterRing(feature);
  if (primaryRing) {
    const centroid = getRingCentroid(primaryRing);
    if (centroid && pointInFeature(centroid, feature)) {
      return centroid;
    }

    const midpoint = primaryRing[Math.floor(primaryRing.length / 2)];
    if (midpoint) {
      return midpoint;
    }
  }

  const fallbackPoints = collectCoordinates(feature?.geometry?.coordinates);
  if (fallbackPoints.length === 0) {
    return null;
  }

  return [
    fallbackPoints.reduce((sum, [lng]) => sum + lng, 0) / fallbackPoints.length,
    fallbackPoints.reduce((sum, [, lat]) => sum + lat, 0) / fallbackPoints.length
  ];
}

const GlobeMap = ({
  geoJsonData,
  populationData,
  selectedCountry,
  onCountrySelect = () => {}
}) => {
  const mapRef = useRef();
  const lastAnimatedCountryRef = useRef(null);
  const introRotationActiveRef = useRef(true);

  const [hoverInfo, setHoverInfo] = useState(null);

  const popMap = useMemo(() => {
    const map = {};
    if (Array.isArray(populationData)) {
      populationData.forEach((item) => {
        const rawName = item.countryName || item.country || item.name || '';
        const normalizedName = normalizeCountryName(rawName).toLowerCase();
        if (normalizedName) {
          map[normalizedName] = item;
        }
      });
    }
    return map;
  }, [populationData]);

  const countryFeatureMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(geoJsonData?.features)) {
      geoJsonData.features.forEach((feature) => {
        const name = feature?.properties?.ADMIN || feature?.properties?.name;
        if (name) {
          map.set(name.toLowerCase(), feature);
          map.set(normalizeCountryName(name).toLowerCase(), feature);
        }
      });
    }
    return map;
  }, [geoJsonData]);

  const selectedFeature = useMemo(() => {
    if (!selectedCountry) {
      return null;
    }

    return countryFeatureMap.get(selectedCountry.toLowerCase()) || null;
  }, [countryFeatureMap, selectedCountry]);

  const selectedFeatureCollection = useMemo(() => (
    selectedFeature
      ? { type: 'FeatureCollection', features: [selectedFeature] }
      : { type: 'FeatureCollection', features: [] }
  ), [selectedFeature]);

  const hoverFeatureSource = useMemo(() => (
    hoverInfo?.object?.feature || hoverInfo?.object || null
  ), [hoverInfo]);

  const hoveredFeature = useMemo(() => {
    if (!hoverFeatureSource?.properties) {
      return null;
    }

    const hoverName = hoverFeatureSource.properties.ADMIN || hoverFeatureSource.properties.name;
    if (!hoverName) {
      return null;
    }

    if (selectedCountry && normalizeCountryName(hoverName) === normalizeCountryName(selectedCountry)) {
      return null;
    }

    return countryFeatureMap.get(normalizeCountryName(hoverName).toLowerCase()) || null;
  }, [countryFeatureMap, hoverFeatureSource, selectedCountry]);

  const hoveredFeatureCollection = useMemo(() => (
    hoveredFeature
      ? { type: 'FeatureCollection', features: [hoveredFeature] }
      : { type: 'FeatureCollection', features: [] }
  ), [hoveredFeature]);

  const getSmoothColor = useCallback((population) => {
    if (!population) {
      return [46, 64, 95, 112];
    }

    const maxPop = 100_000_000;
    const t = Math.min(population / maxPop, 1.0);
    const stops = [
      { stop: 0.0, color: [34, 97, 193] },
      { stop: 0.5, color: [124, 92, 255] },
      { stop: 1.0, color: [244, 81, 122] }
    ];

    let left = stops[0];
    let right = stops[1];
    if (t > 0.5) {
      left = stops[1];
      right = stops[2];
    }

    const localT = (t - left.stop) / (right.stop - left.stop);
    const r = Math.round(left.color[0] + (right.color[0] - left.color[0]) * localT);
    const g = Math.round(left.color[1] + (right.color[1] - left.color[1]) * localT);
    const b = Math.round(left.color[2] + (right.color[2] - left.color[2]) * localT);

    return [r, g, b, 118];
  }, []);

  const countryLabelCollection = useMemo(() => {
    if (!Array.isArray(geoJsonData?.features)) {
      return { type: 'FeatureCollection', features: [] };
    }

    return {
      type: 'FeatureCollection',
      features: geoJsonData.features
        .map((feature) => {
          const name = feature?.properties?.ADMIN || feature?.properties?.name;
          const anchor = getRepresentativePoint(feature);

          if (!name || !anchor) {
            return null;
          }

          const normalizedName = normalizeCountryName(name).toLowerCase();
          const tone = selectedCountry && normalizedName === normalizeCountryName(selectedCountry).toLowerCase()
            ? 'selected'
            : hoveredFeature && normalizedName === normalizeCountryName(
              hoveredFeature.properties.ADMIN || hoveredFeature.properties.name || ''
            ).toLowerCase()
              ? 'hovered'
              : 'default';

          return {
            type: 'Feature',
            properties: {
              name,
              tone
            },
            geometry: {
              type: 'Point',
              coordinates: anchor
            }
          };
        })
        .filter(Boolean)
    };
  }, [geoJsonData, hoveredFeature, selectedCountry]);

  useEffect(() => {
    if (!selectedCountry || !selectedFeature || !mapRef.current) {
      return;
    }

    if (lastAnimatedCountryRef.current === selectedCountry) {
      return;
    }

    const center = getRepresentativePoint(selectedFeature);
    if (!center) {
      return;
    }

    const map = mapRef.current.getMap();
    lastAnimatedCountryRef.current = selectedCountry;
    introRotationActiveRef.current = false;
    map.flyTo({
      center,
      zoom: 3.45,
      duration: 1900,
      essential: true,
      curve: 1.35,
      easing: flyEasing
    });
  }, [selectedCountry, selectedFeature]);

  useEffect(() => {
    let animationId;
    let introTimeoutId;

    const rotateGlobe = () => {
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        const zoom = map.getZoom();

        if (
          introRotationActiveRef.current &&
          !selectedCountry &&
          zoom < 3 &&
          !map.isMoving()
        ) {
          const center = map.getCenter();
          center.lng += 0.04;
          map.easeTo({ center, duration: 0, animate: false });
        }
      }

      animationId = window.requestAnimationFrame(rotateGlobe);
    };

    introTimeoutId = window.setTimeout(() => {
      introRotationActiveRef.current = false;
    }, INTRO_ROTATION_DURATION_MS);

    animationId = window.requestAnimationFrame(rotateGlobe);
    return () => {
      window.clearTimeout(introTimeoutId);
      window.cancelAnimationFrame(animationId);
    };
  }, [selectedCountry]);

  const baseCountryLayer = useMemo(() => new GeoJsonLayer({
    id: 'countries-population',
    data: geoJsonData || { type: 'FeatureCollection', features: [] },
    filled: true,
    stroked: true,
    pickable: true,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
    lineJointRounded: true,
    lineCapRounded: true,
    getLineColor: (feature) => {
      const name = normalizeCountryName(feature.properties.ADMIN || feature.properties.name || '').toLowerCase();
      if (selectedCountry && name === normalizeCountryName(selectedCountry).toLowerCase()) {
        return [255, 122, 134, 235];
      }
      if (hoveredFeature && name === normalizeCountryName(hoveredFeature.properties.ADMIN || hoveredFeature.properties.name || '').toLowerCase()) {
        return [255, 148, 220, 225];
      }
      return [173, 210, 255, 88];
    },
    getLineWidth: (feature) => {
      const name = normalizeCountryName(feature.properties.ADMIN || feature.properties.name || '').toLowerCase();
      if (selectedCountry && name === normalizeCountryName(selectedCountry).toLowerCase()) {
        return 2.2;
      }
      if (hoveredFeature && name === normalizeCountryName(hoveredFeature.properties.ADMIN || hoveredFeature.properties.name || '').toLowerCase()) {
        return 1.75;
      }
      return 1;
    },
    getFillColor: (feature) => {
      const geoName = normalizeCountryName(feature.properties.ADMIN || feature.properties.name || '').toLowerCase();
      const isSelected = selectedCountry && geoName === normalizeCountryName(selectedCountry).toLowerCase();
      const isHovered = hoveredFeature && geoName === normalizeCountryName(
        hoveredFeature.properties.ADMIN || hoveredFeature.properties.name || ''
      ).toLowerCase();

      if (isSelected || isHovered) {
        return [0, 0, 0, 0];
      }

      const [r, g, b] = getSmoothColor(popMap[geoName]?.population);
      return [Math.round(r * 0.82), Math.round(g * 0.86), Math.round(b * 0.94), 112];
    },
    transitions: {
      getFillColor: 320,
      getLineColor: 260,
      getLineWidth: 220
    },
    onHover: (info) => {
      setHoverInfo(info);
    },
    onClick: (info) => {
      if (!info.object) {
        return;
      }

      const countryName = info.object.properties.ADMIN || info.object.properties.name;
      introRotationActiveRef.current = false;
      onCountrySelect(countryName);
    },
    updateTriggers: {
      getLineColor: [hoveredFeature, selectedCountry],
      getLineWidth: [hoveredFeature, selectedCountry],
      getFillColor: [hoveredFeature, popMap, selectedCountry]
    }
  }), [geoJsonData, getSmoothColor, hoveredFeature, onCountrySelect, popMap, selectedCountry]);

  const hoveredFillLayer = useMemo(() => new GeoJsonLayer({
    id: 'hover-country-fill',
    data: hoveredFeatureCollection,
    filled: true,
    stroked: false,
    pickable: false,
    getFillColor: [255, 102, 194, 88],
    parameters: {
      depthTest: false
    },
    transitions: {
      getFillColor: 180
    }
  }), [hoveredFeatureCollection]);

  const selectedFillLayer = useMemo(() => new GeoJsonLayer({
    id: 'selected-country-fill',
    data: selectedFeatureCollection,
    filled: true,
    stroked: false,
    pickable: false,
    getFillColor: [255, 88, 102, 96],
    parameters: {
      depthTest: false
    },
    transitions: {
      getFillColor: 220
    }
  }), [selectedFeatureCollection]);

  const selectedGlowLayer = useMemo(() => new GeoJsonLayer({
    id: 'selected-country-glow',
    data: selectedFeatureCollection,
    filled: false,
    stroked: true,
    pickable: false,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 5,
    lineJointRounded: true,
    lineCapRounded: true,
    getLineColor: [255, 110, 110, 140],
    getLineWidth: 5,
    parameters: {
      depthTest: false
    },
    transitions: {
      getLineColor: 300,
      getLineWidth: 300
    }
  }), [selectedFeatureCollection]);

  const selectedOutlineLayer = useMemo(() => new GeoJsonLayer({
    id: 'selected-country-outline',
    data: selectedFeatureCollection,
    filled: false,
    stroked: true,
    pickable: false,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 2.3,
    lineJointRounded: true,
    lineCapRounded: true,
    getLineColor: [255, 182, 188, 230],
    getLineWidth: 2.3,
    parameters: {
      depthTest: false
    },
    transitions: {
      getLineColor: 280,
      getLineWidth: 280
    }
  }), [selectedFeatureCollection]);

  const geoLayers = useMemo(() => (
    selectedFeature
      ? [baseCountryLayer, hoveredFillLayer, selectedFillLayer, selectedGlowLayer, selectedOutlineLayer]
      : [baseCountryLayer, hoveredFillLayer]
  ), [
    baseCountryLayer,
    hoveredFillLayer,
    selectedFeature,
    selectedFillLayer,
    selectedGlowLayer,
    selectedOutlineLayer
  ]);

  return (
    <div className="absolute inset-0 z-10 pointer-events-auto">
      <MapView
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        projection="globe"
        antialias
        fog={{
          range: [0.5, 10.5],
          color: '#2c4b74',
          'high-color': '#0d1d3d',
          'space-color': '#030814',
          'horizon-blend': 0.18,
          'star-intensity': 0.42
        }}
      >
        <DeckGLOverlay layers={geoLayers} />

        <Source id="country-labels" type="geojson" data={countryLabelCollection}>
          <Layer {...COUNTRY_LABEL_HALO_LAYER} />
          <Layer {...COUNTRY_LABEL_TEXT_LAYER} />
        </Source>
      </MapView>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(98,194,255,0.14),rgba(8,17,32,0)_32%),radial-gradient(circle_at_16%_14%,rgba(168,85,247,0.12),rgba(8,17,32,0)_24%),radial-gradient(circle_at_82%_12%,rgba(244,63,94,0.08),rgba(8,17,32,0)_22%),linear-gradient(180deg,rgba(3,7,18,0.06),rgba(3,7,18,0.3))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(255,255,255,0.06),rgba(255,255,255,0)_22%),radial-gradient(circle_at_50%_68%,rgba(2,6,23,0.32),rgba(2,6,23,0)_36%)] mix-blend-screen" />

      {hoverInfo && hoverInfo.object && (
        <div
          className="absolute z-50 pointer-events-none rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(8,15,31,0.82),rgba(7,11,23,0.72))] px-4 py-3 text-white shadow-[0_22px_60px_rgba(0,0,0,0.35),0_0_24px_rgba(56,189,248,0.08)] backdrop-blur-xl transform -translate-x-1/2 -translate-y-full transition-all duration-200"
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          {(() => {
            const rawName = hoverInfo.object.properties?.ADMIN || hoverInfo.object.properties?.name || 'Unknown';
            const backendData = popMap[normalizeCountryName(rawName).toLowerCase()];

            return (
              <div className="flex min-w-[170px] flex-col gap-1">
                <span className="text-base font-bold tracking-tight text-cyan-200">{rawName}</span>
                {backendData ? (
                  <>
                    <div className="mt-1 flex items-center justify-between border-t border-white/8 pt-2 text-sm">
                      <span className="text-slate-400">Population</span>
                      <span className="font-semibold text-slate-100">{(backendData.population || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Year</span>
                      <span className="text-slate-200">{backendData.year || '2024'}</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 border-t border-white/8 pt-2 text-xs italic text-slate-300/80">
                    No population data available.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default GlobeMap;
