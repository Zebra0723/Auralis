"use client";

/**
 * The hero panel: connected services on the left, the fields they hold in
 * common on the right, Auralis reconciling between them.
 *
 * Drawn as one inline SVG so it scales cleanly, needs no image assets, and
 * inherits the palette through CSS variables. Motion is pure CSS and stops
 * entirely under prefers-reduced-motion.
 */

const SERVICES = [
  { label: "Google", mark: "G", y: 24 },
  { label: "Microsoft", mark: "M", y: 78 },
  { label: "Slack", mark: "S", y: 132 },
  { label: "GitHub", mark: "GH", y: 186 },
  { label: "Zoom", mark: "Z", y: 240 },
];

const FIELDS = [
  { label: "Display name", y: 38 },
  { label: "Job title", y: 92 },
  { label: "Phone number", y: 146 },
  { label: "Location", y: 200 },
];

export function ConnectionVisual() {
  return (
    <div
      className="card overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
      aria-hidden="true"
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: "var(--line-soft)", background: "var(--raised)" }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full live-dot"
          style={{ background: "var(--accent)" }}
        />
        <span className="eyebrow" style={{ fontSize: 10.5 }}>
          Synchronizing
        </span>
      </div>

      <div className="p-4">
        <svg viewBox="0 0 520 290" className="w-full h-auto" role="presentation">
          {SERVICES.map((node, i) => (
            <g key={node.label}>
              {/* Resting connector */}
              <path
                d={`M 152 ${node.y + 15} C 205 ${node.y + 15}, 215 145, 244 145`}
                stroke="var(--line)"
                strokeWidth="1"
                fill="none"
              />
              {/* Travelling signal */}
              <path
                d={`M 152 ${node.y + 15} C 205 ${node.y + 15}, 215 145, 244 145`}
                stroke="var(--accent)"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 160"
                style={{
                  animation: `a-dash ${5 + i * 0.9}s linear infinite`,
                  animationDelay: `${i * 0.5}s`,
                }}
              />
              <Chip x={14} y={node.y} w={138} mark={node.mark} label={node.label} />
            </g>
          ))}

          {FIELDS.map((field, i) => (
            <g key={field.label}>
              <path
                d={`M 276 145 C 305 145, 315 ${field.y + 14}, 348 ${field.y + 14}`}
                stroke="var(--line)"
                strokeWidth="1"
                fill="none"
              />
              <path
                d={`M 276 145 C 305 145, 315 ${field.y + 14}, 348 ${field.y + 14}`}
                stroke="var(--accent)"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 160"
                style={{
                  animation: `a-dash ${5.4 + i * 0.8}s linear infinite`,
                  animationDelay: `${0.9 + i * 0.45}s`,
                }}
              />
              <FieldChip x={348} y={field.y} label={field.label} />
            </g>
          ))}

          {/* Auralis core */}
          <rect
            x="244"
            y="121"
            width="32"
            height="48"
            rx="8"
            fill="var(--surface)"
            stroke="var(--ink)"
            strokeWidth="1.25"
          />
          <circle cx="260" cy="145" r="4" fill="var(--accent)" className="live-dot" />
        </svg>
      </div>
    </div>
  );
}

function Chip({
  x,
  y,
  w,
  mark,
  label,
}: {
  x: number;
  y: number;
  w: number;
  mark: string;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height="30"
        rx="6"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="1"
      />
      <rect x={x + 8} y={y + 8} width="14" height="14" rx="4" fill="var(--raised)" />
      <text
        x={x + 15}
        y={y + 18.5}
        textAnchor="middle"
        fontSize="7"
        fontWeight="600"
        fill="var(--ink-soft)"
      >
        {mark}
      </text>
      <text x={x + 30} y={y + 19.5} fontSize="11" fill="var(--ink)" fontWeight="450">
        {label}
      </text>
    </g>
  );
}

function FieldChip({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="158"
        height="28"
        rx="6"
        fill="var(--accent-soft)"
        stroke="none"
      />
      <text x={x + 12} y={y + 18} fontSize="11" fill="var(--accent)" fontWeight="500">
        {label}
      </text>
      <path
        d={`M ${x + 140} ${y + 14} l 3 3.5 l 6 -7`}
        stroke="var(--accent)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}
