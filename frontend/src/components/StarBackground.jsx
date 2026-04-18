import React, { useMemo } from 'react';

const STAR_LAYERS = [
  { count: 36, size: 1, opacity: 0.45, duration: 9, delayStep: 0.17 },
  { count: 24, size: 1.5, opacity: 0.35, duration: 12, delayStep: 0.22 },
  { count: 14, size: 2, opacity: 0.25, duration: 15, delayStep: 0.31 }
];

const StarBackground = () => {
  const starLayers = useMemo(() => (
    STAR_LAYERS.map((layer, layerIndex) => (
      Array.from({ length: layer.count }, (_, index) => {
        const top = (index * 37 + layerIndex * 11) % 100;
        const left = (index * 23 + layerIndex * 29) % 100;
        const scale = 0.75 + ((index + layerIndex) % 5) * 0.12;

        return {
          key: `star-${layerIndex}-${index}`,
          style: {
            top: `${top}%`,
            left: `${left}%`,
            width: `${layer.size}px`,
            height: `${layer.size}px`,
            opacity: layer.opacity,
            transform: `scale(${scale})`,
            animationDuration: `${layer.duration + (index % 4)}s`,
            animationDelay: `${index * layer.delayStep}s`
          }
        };
      })
    ))
  ), []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[radial-gradient(circle_at_top,#10244a_0%,#07111f_30%,#02050c_62%,#14061f_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.14),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(168,85,247,0.1),transparent_28%),radial-gradient(circle_at_50%_80%,rgba(244,63,94,0.06),transparent_22%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,34,0.1)_0%,rgba(2,4,10,0.42)_100%)]" />

      {starLayers.map((layer, layerIndex) => (
        <div key={`layer-${layerIndex}`} className="absolute inset-0">
          {layer.map((star) => (
            <span
              key={star.key}
              className="absolute rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.35)] animate-star-twinkle"
              style={star.style}
            />
          ))}
        </div>
      ))}

      <div className="absolute -left-[12%] top-[8%] h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[160px] animate-drift-slow" />
      <div className="absolute -right-[10%] bottom-[4%] h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/10 blur-[180px] animate-drift-reverse" />
    </div>
  );
};

export default StarBackground;
