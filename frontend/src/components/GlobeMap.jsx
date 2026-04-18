import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView, { useControl } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
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
  const barMarkersRef = useRef([]);
  const markerStyleFrameRef = useRef(null);
  const lastAnimatedCountryRef = useRef(null);
  const introRotationActiveRef = useRef(true);

  const [hoverInfo, setHoverInfo] = useState(null);
  const [barGrowth, setBarGrowth] = useState(0);

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

  useEffect(() => {
    let animationFrameId;
    const start = performance.now();
    const duration = 1200;

    const animate = (timestamp) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setBarGrowth(eased);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animate);
      }
    };

    animationFrameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);

  const hoverFeatureSource = useMemo(() => (
    hoverInfo?.object?.feature || hoverInfo?.object?.properties?.sourceFeature || hoverInfo?.object || null
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
      return [74, 93, 128, 92];
    }

    const maxPop = 100_000_000;
    const t = Math.min(population / maxPop, 1.0);
    const stops = [
      { stop: 0.0, color: [30, 64, 175] },
      { stop: 0.5, color: [168, 85, 247] },
      { stop: 1.0, color: [244, 63, 94] }
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

    return [r, g, b, 156];
  }, []);

  const barData = useMemo(() => {
    if (!Array.isArray(geoJsonData?.features)) {
      return [];
    }

    return geoJsonData.features
      .map((feature) => {
        const countryName = feature?.properties?.ADMIN || feature?.properties?.name;
        if (!countryName) {
          return null;
        }

        const normalizedName = normalizeCountryName(countryName).toLowerCase();
        const populationRecord = popMap[normalizedName];
        const anchor = getRepresentativePoint(feature);

        if (!populationRecord?.population || !anchor) {
          return null;
        }

        return {
          countryName,
          normalizedName,
          population: populationRecord.population,
          year: populationRecord.year,
          anchor,
          feature
        };
      })
      .filter(Boolean);
  }, [geoJsonData, popMap]);

  const maxPopulation = useMemo(() => (
    barData.reduce((maxValue, item) => Math.max(maxValue, item.population), 1)
  ), [barData]);

  const getBarHeight = useCallback((population) => {
    const normalizedPopulation = Math.min(population / maxPopulation, 1);
    const shapedPopulation = Math.pow(normalizedPopulation, 0.42);
    const minHeight = 150000;
    const maxHeight = 1650000;
    return (minHeight + shapedPopulation * (maxHeight - minHeight)) * barGrowth;
  }, [barGrowth, maxPopulation]);

  const getBarVisualMetrics = useCallback((population, isSelected, zoom) => {
    const normalizedPopulation = Math.min(population / maxPopulation, 1);
    const prominence = Math.pow(normalizedPopulation, 0.36);
    const zoomFactor = Math.min(Math.max(0.84 + (zoom - 1.35) * 0.19, 0.78), 1.68);
    const selectedBoost = isSelected ? 1.16 : 1;

    return {
      heightPx: (24 + prominence * 116) * zoomFactor,
      widthPx: (9 + prominence * 14) * selectedBoost,
      glowWidth: (26 + prominence * 24) * (isSelected ? 1.16 : 1),
      floatOffset: -2 - prominence * 5,
      glowOpacity: isSelected ? 0.52 : 0.28,
      coreOpacity: isSelected ? 0.97 : 0.9
    };
  }, [maxPopulation]);

  const resolvedBarData = useMemo(() => (
    barData.map((item) => {
      return {
        ...item,
        barHeight: getBarHeight(item.population)
      };
    })
  ), [barData, getBarHeight]);

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
      zoom: 3.65,
      duration: 2000,
      essential: true,
      curve: 1.45,
      easing: flyEasing
    });
  }, [selectedCountry, selectedFeature]);

  useEffect(() => {
    if (!mapRef.current) {
      return undefined;
    }

    const map = mapRef.current.getMap();

    barMarkersRef.current.forEach(({ marker }) => marker.remove());
    barMarkersRef.current = [];

    if (resolvedBarData.length === 0) {
      return undefined;
    }

    const markerEntries = resolvedBarData.map((item) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'population-bar-marker';
      element.setAttribute('aria-label', `${item.countryName} population bar`);

      const glow = document.createElement('span');
      glow.className = 'population-bar-marker__glow';

      const shaft = document.createElement('span');
      shaft.className = 'population-bar-marker__shaft';

      const cap = document.createElement('span');
      cap.className = 'population-bar-marker__cap';

      element.append(glow, shaft, cap);

      const markerHoverObject = {
        countryName: item.countryName,
        population: item.population,
        year: item.year,
        feature: item.feature
      };

      const handleHover = (event) => {
        setHoverInfo({
          x: event.clientX,
          y: event.clientY,
          object: markerHoverObject
        });
      };

      const handleLeave = () => {
        setHoverInfo((current) => (
          current?.object?.countryName === item.countryName ? null : current
        ));
      };

      const handleClick = () => {
        introRotationActiveRef.current = false;
        onCountrySelect(item.countryName);
      };

      element.addEventListener('mouseenter', handleHover);
      element.addEventListener('mousemove', handleHover);
      element.addEventListener('mouseleave', handleLeave);
      element.addEventListener('click', handleClick);

      const marker = new mapboxgl.Marker({
        element,
        anchor: 'bottom',
        rotationAlignment: 'horizon',
        pitchAlignment: 'auto',
        occludedOpacity: 0.02
      })
        .setLngLat(item.anchor)
        .addTo(map);

      return {
        marker,
        element,
        glow,
        shaft,
        cap,
        item,
        handleHover,
        handleLeave,
        handleClick
      };
    });

    const applyMarkerStyles = () => {
      const zoom = map.getZoom();

      markerEntries.forEach((entry) => {
        const { element, glow, shaft, cap, item } = entry;
        const isSelected = selectedCountry
          && item.normalizedName === normalizeCountryName(selectedCountry).toLowerCase();
        const metrics = getBarVisualMetrics(item.population, Boolean(isSelected), zoom);
        const [r, g, b] = isSelected ? [255, 92, 112] : getSmoothColor(item.population);
        const edgeTint = [Math.min(r + 54, 255), Math.min(g + 54, 255), Math.min(b + 54, 255)];
        const shadowTint = isSelected ? '255,92,112' : `${r}, ${g}, ${b}`;
        const rgbaCore = `rgba(${r}, ${g}, ${b}, ${metrics.coreOpacity})`;
        const rgbaGlow = `rgba(${r}, ${g}, ${b}, ${metrics.glowOpacity})`;
        const rgbaCap = `rgba(${edgeTint[0]}, ${edgeTint[1]}, ${edgeTint[2]}, 0.98)`;
        const rgbaEdge = `rgba(${edgeTint[0]}, ${edgeTint[1]}, ${edgeTint[2]}, 0.54)`;
        const rgbaHighlight = `rgba(255, 255, 255, ${isSelected ? 0.52 : 0.34})`;

        element.classList.toggle('population-bar-marker--selected', Boolean(isSelected));
        element.style.setProperty('--bar-height', `${metrics.heightPx.toFixed(2)}px`);
        element.style.setProperty('--bar-width', `${metrics.widthPx.toFixed(2)}px`);
        element.style.setProperty('--bar-glow-width', `${metrics.glowWidth.toFixed(2)}px`);
        element.style.setProperty('--bar-color', rgbaCore);
        element.style.setProperty('--bar-glow', rgbaGlow);
        element.style.setProperty('--bar-cap', rgbaCap);
        element.style.setProperty('--bar-edge', rgbaEdge);
        element.style.setProperty('--bar-highlight', rgbaHighlight);
        element.style.setProperty('--bar-shadow', isSelected ? '0 0 24px rgba(255,92,112,0.42)' : `0 0 18px rgba(${shadowTint}, 0.24)`);
        element.style.setProperty('--bar-float', `${metrics.floatOffset.toFixed(2)}px`);

        shaft.style.height = `${metrics.heightPx.toFixed(2)}px`;
        glow.style.height = `${Math.max(metrics.heightPx - 6, 20).toFixed(2)}px`;
        cap.style.width = `${Math.max(metrics.widthPx + 5.5, 12).toFixed(2)}px`;
      });
    };

    const scheduleMarkerStyleSync = () => {
      if (markerStyleFrameRef.current) {
        window.cancelAnimationFrame(markerStyleFrameRef.current);
      }

      markerStyleFrameRef.current = window.requestAnimationFrame(() => {
        applyMarkerStyles();
      });
    };

    scheduleMarkerStyleSync();
    map.on('zoom', scheduleMarkerStyleSync);
    map.on('resize', scheduleMarkerStyleSync);

    barMarkersRef.current = markerEntries;

    return () => {
      map.off('zoom', scheduleMarkerStyleSync);
      map.off('resize', scheduleMarkerStyleSync);
      if (markerStyleFrameRef.current) {
        window.cancelAnimationFrame(markerStyleFrameRef.current);
        markerStyleFrameRef.current = null;
      }
      markerEntries.forEach(({ marker, element, handleHover, handleLeave, handleClick }) => {
        element.removeEventListener('mouseenter', handleHover);
        element.removeEventListener('mousemove', handleHover);
        element.removeEventListener('mouseleave', handleLeave);
        element.removeEventListener('click', handleClick);
        marker.remove();
      });
      barMarkersRef.current = [];
    };
  }, [getBarVisualMetrics, getSmoothColor, maxPopulation, onCountrySelect, resolvedBarData, selectedCountry]);

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
          center.lng += 0.045;
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
        return [255, 110, 110, 230];
      }
      if (hoveredFeature && name === normalizeCountryName(hoveredFeature.properties.ADMIN || hoveredFeature.properties.name || '').toLowerCase()) {
        return [255, 120, 195, 220];
      }
      return [196, 224, 255, 70];
    },
    getLineWidth: (feature) => {
      const name = normalizeCountryName(feature.properties.ADMIN || feature.properties.name || '').toLowerCase();
      if (selectedCountry && name === normalizeCountryName(selectedCountry).toLowerCase()) {
        return 2.4;
      }
      if (hoveredFeature && name === normalizeCountryName(hoveredFeature.properties.ADMIN || hoveredFeature.properties.name || '').toLowerCase()) {
        return 1.8;
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

      const baseColor = getSmoothColor(popMap[geoName]?.population);
      return baseColor;
    },
    transitions: {
      getFillColor: 350,
      getLineColor: 300,
      getLineWidth: 250
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
    getFillColor: [255, 92, 182, 168],
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
    getFillColor: [255, 76, 76, 182],
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
    getLineColor: [255, 110, 110, 145],
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
    lineWidthMinPixels: 2.4,
    lineJointRounded: true,
    lineCapRounded: true,
    getLineColor: [255, 160, 160, 230],
    getLineWidth: 2.4,
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
        mapStyle="mapbox://styles/mapbox/satellite-v9"
        projection="globe"
        antialias
        fog={{
          range: [0.42, 10.8],
          color: '#304b7a',
          'high-color': '#10224d',
          'space-color': '#040916',
          'horizon-blend': 0.16,
          'star-intensity': 0.36
        }}
      >
        <DeckGLOverlay layers={geoLayers} />
      </MapView>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(80,190,255,0.14),rgba(8,17,32,0)_28%),radial-gradient(circle_at_18%_16%,rgba(168,85,247,0.14),rgba(8,17,32,0)_24%),radial-gradient(circle_at_82%_14%,rgba(244,63,94,0.1),rgba(8,17,32,0)_22%),linear-gradient(180deg,rgba(2,6,23,0.04),rgba(2,6,23,0.3))]" />
      <div className="pointer-events-none absolute inset-[10%] rounded-full border border-cyan-300/6 shadow-[0_0_120px_rgba(56,189,248,0.12),inset_0_0_90px_rgba(56,189,248,0.04)]" />

      {hoverInfo && hoverInfo.object && (
        <div
          className="absolute z-50 pointer-events-none rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(8,15,31,0.82),rgba(7,11,23,0.72))] px-4 py-3 text-white shadow-[0_22px_60px_rgba(0,0,0,0.35),0_0_24px_rgba(56,189,248,0.08)] backdrop-blur-xl transform -translate-x-1/2 -translate-y-full transition-all duration-200"
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          {(() => {
            const rawName = hoverInfo.object.countryName
              || hoverInfo.object.properties?.countryName
              || hoverInfo.object.properties?.ADMIN
              || hoverInfo.object.properties?.name
              || 'Unknown';
            const backendData = hoverInfo.object.population
              ? { population: hoverInfo.object.population, year: hoverInfo.object.year }
              : hoverInfo.object.properties?.population
                ? { population: hoverInfo.object.properties.population, year: hoverInfo.object.properties.year }
              : popMap[normalizeCountryName(rawName).toLowerCase()];

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
                  <div className="mt-1 border-t border-white/8 pt-2 text-xs italic text-rose-200/80">
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
