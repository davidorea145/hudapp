import { useEffect, useRef, useState } from "react";

interface HexStatProps {
  label: string;
  value: string | number;
  sublabel?: string;
  side: "left" | "right";
}

export function HexStat({ label, value, sublabel, side }: HexStatProps) {
  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="relative flex items-center justify-center" style={{ width: 280, height: 320 }}>
        <svg viewBox="0 0 100 110" className="absolute inset-0 w-full h-full">
          <polygon
            points="50,4 94,28 94,82 50,106 6,82 6,28"
            fill="oklch(0.08 0.02 25 / 0.85)"
            stroke="var(--hud-white)"
            strokeWidth="2"
          />
          <polygon
            points="50,4 94,28 94,82 50,106 6,82 6,28"
            fill="none"
            stroke="var(--hud-red)"
            strokeWidth="1"
            opacity="0.4"
            transform="scale(0.9) translate(5.5, 6)"
          />
        </svg>
        <div className="relative flex flex-col items-center">
          <span className="hud-text font-bold text-hud-white tabular-nums" style={{ fontSize: 84, lineHeight: 1 }}>
            {value}
          </span>
          {sublabel && (
            <span className="hud-text text-hud-white/80 mt-1" style={{ fontSize: 28 }}>{sublabel}</span>
          )}
        </div>
      </div>
      <div className="hud-text text-hud-white font-bold" style={{ fontSize: 26, letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div className="hud-text font-bold text-hud-red" style={{ fontSize: 24, letterSpacing: "0.1em" }}>
        {side === "left" ? "MÁXIMA" : "DE QUEIMA"}
      </div>
    </div>
  );
}

interface PowerGaugeProps {
  value: number;
  max: number;
}

export function PowerGauge({ value }: PowerGaugeProps) {
  const cx = 200;
  const cy = 130;
  const rx = 180; // wider
  const ry = 110; // flatter

  return (
    <div className="relative w-full mx-auto pointer-events-none" style={{ maxWidth: 900 }}>
      <svg viewBox="0 0 400 140" className="w-full">
        {/* dome body */}
        <path
          d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy} Z`}
          fill="oklch(0.06 0.02 25 / 0.92)"
          stroke="var(--hud-red)"
          strokeWidth="2"
        />
        {/* inner highlight */}
        <path
          d={`M ${cx - rx + 10} ${cy} A ${rx - 10} ${ry - 8} 0 0 1 ${cx + rx - 10} ${cy}`}
          fill="none"
          stroke="var(--hud-red)"
          strokeWidth="1"
          opacity="0.35"
        />
        {/* centered value + label inside dome */}
        <text
          x={cx}
          y={cy - 38}
          textAnchor="middle"
          className="hud-text"
          fill="var(--hud-white)"
          style={{ fontSize: 30, fontWeight: 700, fontFamily: "Orbitron, system-ui, sans-serif", letterSpacing: "0.08em" }}
        >
          {Math.round(value)}
        </text>
        <text
          x={cx}
          y={cy - 16}
          textAnchor="middle"
          className="hud-text"
          fill="var(--hud-white)"
          opacity="0.9"
          style={{ fontSize: 11, fontWeight: 700, fontFamily: "Orbitron, system-ui, sans-serif", letterSpacing: "0.18em" }}
        >
          POTÊNCIA - G
        </text>
      </svg>
    </div>
  );
}

interface HudFrameProps {
  children?: React.ReactNode;
}

export function HudFrame({ children }: HudFrameProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        viewBox="0 0 1000 560"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        {/* top-left bracket */}
        <polyline
          points="20,120 20,40 120,40 160,20 320,20"
          fill="none"
          stroke="var(--hud-red)"
          strokeWidth="4"
        />
        <polyline
          points="40,140 40,60 130,60 170,40 320,40"
          fill="none"
          stroke="var(--hud-red)"
          strokeWidth="2"
          opacity="0.6"
        />
        {/* top-right bracket */}
        <polyline
          points="980,120 980,40 880,40 840,20 680,20"
          fill="none"
          stroke="var(--hud-red)"
          strokeWidth="4"
        />
        <polyline
          points="960,140 960,60 870,60 830,40 680,40"
          fill="none"
          stroke="var(--hud-red)"
          strokeWidth="2"
          opacity="0.6"
        />
        {/* bottom-left bracket */}
        <polyline
          points="20,440 20,520 120,520 160,540 320,540"
          fill="none"
          stroke="var(--hud-red)"
          strokeWidth="4"
        />
        {/* bottom-right */}
        <polyline
          points="980,440 980,520 880,520 840,540 680,540"
          fill="none"
          stroke="var(--hud-red)"
          strokeWidth="4"
        />
        {/* diagonal stripes accents */}
        <g opacity="0.9">
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`tl-${i}`}
              x1={60 + i * 18}
              y1={20}
              x2={80 + i * 18}
              y2={50}
              stroke="var(--hud-red)"
              strokeWidth="6"
            />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`tr-${i}`}
              x1={940 - i * 18}
              y1={20}
              x2={920 - i * 18}
              y2={50}
              stroke="var(--hud-red)"
              strokeWidth="6"
            />
          ))}
        </g>
      </svg>
      {children}
    </div>
  );
}
