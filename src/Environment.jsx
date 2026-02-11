// Full-screen visual environment layer — gradients, particles, and a central orb.
// All visuals are driven by the distress prop (0–10). CSS transitions handle smooth
// interpolation within the 200ms performance constraint. (Req 8)

import { useMemo } from "react";

// Linearly interpolates between two values.
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpolates between two RGB arrays, returns "rgb(r, g, b)".
function lerpColor(c1, c2, t) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))}, ${Math.round(lerp(c1[1], c2[1], t))}, ${Math.round(lerp(c1[2], c2[2], t))})`;
}

// Color palette at extreme distress levels.
const HIGH = {
  bg1: [58, 10, 10],     // dark crimson
  bg2: [42, 10, 46],     // dark purple
  orb: [255, 80, 50],    // red-orange
  particle: [255, 100, 60],
};
const LOW = {
  bg1: [220, 235, 235],  // soft teal-white
  bg2: [230, 238, 245],  // near white
  orb: [160, 210, 240],  // soft blue
  particle: [170, 210, 230],
};

// Generates deterministic particle properties so they don't shuffle on re-render.
function generateParticles(count) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      left: ((i * 37 + 13) % 100),           // pseudo-random horizontal position
      delay: ((i * 53 + 7) % 20) / 10,        // animation delay 0–2s
      size: 2 + ((i * 17 + 3) % 6),           // 2–7px
      driftX: ((i * 41 + 11) % 60) - 30,      // horizontal drift -30 to 30px
    });
  }
  return particles;
}

const ALL_PARTICLES = generateParticles(30);

export default function Environment({ distress }) {
  // t = 0 at max distress, 1 at full calm — drives all visual interpolation.
  const t = 1 - distress / 10;

  // Derive colors from distress level.
  const bg1 = lerpColor(HIGH.bg1, LOW.bg1, t);
  const bg2 = lerpColor(HIGH.bg2, LOW.bg2, t);
  const orbColor = lerpColor(HIGH.orb, LOW.orb, t);
  const particleColor = lerpColor(HIGH.particle, LOW.particle, t);

  // Derive motion parameters from distress level.
  const orbSize = Math.round(lerp(280, 150, t));
  const orbPulseSpeed = lerp(1.2, 4, t);         // seconds per pulse cycle
  const orbOpacity = lerp(0.6, 0.25, t);
  const particleSpeed = lerp(3, 10, t);           // seconds per float cycle
  const visibleCount = Math.round(distress * 3);  // 0 at calm, 30 at max

  // Memoize the particle style objects to avoid recalculating on every render.
  const particleElements = useMemo(() => {
    return ALL_PARTICLES.slice(0, visibleCount).map((p) => (
      <span
        key={p.id}
        style={{
          position: "absolute",
          left: `${p.left}%`,
          bottom: "-10px",
          width: `${p.size}px`,
          height: `${p.size}px`,
          borderRadius: "50%",
          backgroundColor: particleColor,
          opacity: lerp(0.7, 0.2, t),
          animation: `float ${particleSpeed}s ease-in-out ${p.delay}s infinite`,
        }}
      />
    ));
  }, [visibleCount, particleColor, particleSpeed, t]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        background: `linear-gradient(160deg, ${bg1}, ${bg2})`,
        transition: "background 1s ease",
        overflow: "hidden",
      }}
    >
      {/* Central orb — pulsing light that represents Aria's emotional core */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: `${orbSize}px`,
          height: `${orbSize}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${orbColor}, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          opacity: orbOpacity,
          animation: `pulse ${orbPulseSpeed}s ease-in-out infinite`,
          transition: "width 1s ease, height 1s ease, opacity 1s ease",
        }}
      />

      {/* Floating particles — count and speed reflect distress intensity */}
      {particleElements}

      {/* Keyframe definitions injected as a style tag */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.25); }
        }
        @keyframes float {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
