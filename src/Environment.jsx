// Full-screen visual environment — therapist office with a window to the outside.
// The window scene (sky, clouds, rain) and interior lighting all shift based on the
// distress prop (0–10). High distress = dark storm, dim lamp. Calm = golden sky, warm glow.
// CSS transitions handle smooth interpolation within the 200ms performance constraint. (Req 8)

import { useMemo } from "react";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))}, ${Math.round(lerp(c1[1], c2[1], t))}, ${Math.round(lerp(c1[2], c2[2], t))})`;
}

// Room wall colors.
const ROOM_HIGH = [34, 28, 24];
const ROOM_LOW = [58, 50, 42];

// Sky through the window.
const SKY_TOP_HIGH = [28, 30, 45];
const SKY_TOP_LOW = [130, 180, 220];
const SKY_BOT_HIGH = [48, 44, 56];
const SKY_BOT_LOW = [255, 200, 125];

// Window frame.
const FRAME_HIGH = [52, 40, 30];
const FRAME_LOW = [140, 118, 92];

// Lamp glow.
const LAMP_HIGH = [160, 100, 40];
const LAMP_LOW = [255, 210, 140];

// Plant foliage.
const LEAF_HIGH = [22, 35, 20];
const LEAF_LOW = [45, 72, 40];
const POT_HIGH = [42, 32, 25];
const POT_LOW = [85, 68, 50];

// Pre-compute deterministic rain drops so they don't reshuffle on re-render.
function generateRain(count) {
  const drops = [];
  for (let i = 0; i < count; i++) {
    drops.push({
      id: i,
      left: ((i * 37 + 13) % 100),
      delay: ((i * 53 + 7) % 30) / 30,
      height: 12 + ((i * 17 + 3) % 20),
      speed: 0.5 + ((i * 11) % 8) / 10,
    });
  }
  return drops;
}

const ALL_RAIN = generateRain(40);

const CLOUDS = [
  { top: "8%", left: "-5%", w: "55%", h: "28%", anim: "cloudDrift1", dur: "28s", opFactor: 1 },
  { top: "3%", left: "45%", w: "50%", h: "22%", anim: "cloudDrift2", dur: "22s", opFactor: 0.85 },
  { top: "18%", left: "15%", w: "65%", h: "18%", anim: "cloudDrift3", dur: "32s", opFactor: 0.7 },
];

const LEAVES = [
  { bottom: "25%", left: "8%", w: 34, h: 48, rotate: "-15deg" },
  { bottom: "32%", left: "30%", w: 38, h: 54, rotate: "5deg" },
  { bottom: "28%", left: "55%", w: 28, h: 42, rotate: "20deg" },
];

export default function Environment({ distress }) {
  const t = 1 - distress / 10; // 0 = max distress, 1 = full calm

  // Room
  const roomColor = lerpColor(ROOM_HIGH, ROOM_LOW, t);

  // Sky
  const skyTop = lerpColor(SKY_TOP_HIGH, SKY_TOP_LOW, t);
  const skyBot = lerpColor(SKY_BOT_HIGH, SKY_BOT_LOW, t);

  // Frame
  const frameColor = lerpColor(FRAME_HIGH, FRAME_LOW, t);

  // Lamp
  const lampColor = lerpColor(LAMP_HIGH, LAMP_LOW, t);
  const lampOpacity = lerp(0.12, 0.38, t);
  const lampSize = Math.round(lerp(220, 380, t));

  // Rain
  const rainCount = Math.round(lerp(35, 0, t));
  const rainOpacity = lerp(0.5, 0, t);

  // Clouds
  const cloudBright = Math.round(lerp(50, 225, t));
  const cloudOpacity = lerp(0.7, 0.25, t);
  const cloudBlur = Math.round(lerp(12, 22, t));

  // Plant + pot
  const leafColor = lerpColor(LEAF_HIGH, LEAF_LOW, t);
  const potColor = lerpColor(POT_HIGH, POT_LOW, t);
  const plantOpacity = lerp(0.15, 0.3, t);

  // Floor
  const floorColor = lerpColor([38, 30, 23], [110, 95, 75], t);

  // Memoize rain elements to avoid recalculating every render.
  const rainElements = useMemo(() => {
    return ALL_RAIN.slice(0, rainCount).map((d) => (
      <div
        key={d.id}
        style={{
          position: "absolute",
          left: `${d.left}%`,
          top: "-20px",
          width: "1px",
          height: `${d.height}px`,
          background: `rgba(170, 195, 220, ${rainOpacity})`,
          animation: `rain ${d.speed}s linear ${d.delay}s infinite`,
        }}
      />
    ));
  }, [rainCount, rainOpacity]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        background: roomColor,
        transition: "background 1.5s ease",
        overflow: "hidden",
      }}
    >
      {/* Wall shading — darker toward the floor */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.15) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ─── Window ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          right: "5%",
          width: "34%",
          height: "52%",
          minWidth: "160px",
          minHeight: "180px",
          borderRadius: "3px",
          border: `4px solid ${frameColor}`,
          overflow: "hidden",
          boxShadow: `0 0 ${Math.round(lerp(25, 70, t))}px rgba(${LAMP_LOW.join(",")}, ${lampOpacity * 0.4})`,
          transition: "border-color 1.5s ease, box-shadow 1.5s ease",
        }}
      >
        {/* Sky gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, ${skyTop} 0%, ${skyBot} 100%)`,
            transition: "background 1.5s ease",
          }}
        />

        {/* Clouds */}
        {CLOUDS.map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: c.top,
              left: c.left,
              width: c.w,
              height: c.h,
              borderRadius: "50%",
              background: `rgba(${cloudBright}, ${cloudBright + 2}, ${cloudBright + 8}, ${cloudOpacity * c.opFactor})`,
              filter: `blur(${cloudBlur}px)`,
              animation: `${c.anim} ${c.dur} ease-in-out infinite`,
              transition: "background 1.5s ease",
            }}
          />
        ))}

        {/* Rain streaks */}
        {rainElements}

        {/* Window cross divider — vertical */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            width: "3px",
            height: "100%",
            background: frameColor,
            transform: "translateX(-50%)",
            transition: "background 1.5s ease",
          }}
        />
        {/* Window cross divider — horizontal */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: "100%",
            height: "3px",
            background: frameColor,
            transform: "translateY(-50%)",
            transition: "background 1.5s ease",
          }}
        />
      </div>

      {/* ─── Lamp glow ──────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          left: "6%",
          width: `${lampSize}px`,
          height: `${lampSize}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${LAMP_LOW.join(",")}, ${lampOpacity}) 0%, transparent 70%)`,
          transition: "all 1.5s ease",
          pointerEvents: "none",
        }}
      />

      {/* ─── Plant silhouette ───────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: "2%",
          width: "80px",
          height: "120px",
          opacity: plantOpacity,
          transition: "opacity 1.5s ease",
          pointerEvents: "none",
        }}
      >
        {/* Pot */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "18%",
            width: "64%",
            height: "28%",
            background: potColor,
            borderRadius: "3px 3px 6px 6px",
            transition: "background 1.5s ease",
          }}
        />
        {/* Leaves */}
        {LEAVES.map((leaf, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: leaf.bottom,
              left: leaf.left,
              width: `${leaf.w}px`,
              height: `${leaf.h}px`,
              borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
              background: leafColor,
              transform: `rotate(${leaf.rotate})`,
              transition: "background 1.5s ease",
            }}
          />
        ))}
      </div>

      {/* ─── Baseboard ──────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "3px",
          background: floorColor,
          transition: "background 1.5s ease",
        }}
      />

      {/* ─── Keyframes ──────────────────────────────────────────── */}
      <style>{`
        @keyframes rain {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(55vh); opacity: 0.2; }
        }
        @keyframes cloudDrift1 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(15px); }
        }
        @keyframes cloudDrift2 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-12px); }
        }
        @keyframes cloudDrift3 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
