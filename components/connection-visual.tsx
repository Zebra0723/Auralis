"use client";

/**
 * The hero diagram: services on the left and right, Auralis in the middle,
 * with signal travelling along the connectors.
 *
 * Drawn as one inline SVG so it scales cleanly, needs no images, and inherits
 * the theme through currentColor and CSS variables. Motion is pure CSS, so it
 * costs nothing at runtime and stops entirely under prefers-reduced-motion.
 */

const LEFT = [
  { label: "Google", mark: "G", y: 40 },
  { label: "Microsoft", mark: "M", y: 110 },
  { label: "Slack", mark: "S", y: 180 },
  { label: "GitHub", mark: "GH", y: 250 },
];

const RIGHT = [
  { label: "Zoom", mark: "Z", y: 40 },
  { label: "Trello", mark: "T", y: 110 },
  { label: "Dropbox", mark: "D", y: 180 },
  { label: "Asana", mark: "A", y: 250 },
];

export function ConnectionVisual() {
  return (
    <div className="w-full" aria-hidden="true">
      <svg
        viewBox="0 0 720 300"
        className="w-full h-auto"
        style={{ maxHeight: 340 }}
        role="presentation"
      >
        <defs>
          <linearGradient id="fade-left" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--line)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="fade-right" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--line)" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {LEFT.map((node, i) => (
          <g key={node.label}>
            <path
              d={`M 138 ${node.y + 16} C 230 ${node.y + 16}, 250 150, 322 150`}
              stroke="url(#fade-left)"
              strokeWidth="1.25"
              fill="none"
            />
            <path
              d={`M 138 ${node.y + 16} C 230 ${node.y + 16}, 250 150, 322 150`}
              stroke="var(--signal)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="3 220"
              style={{
                animation: `a-dash ${7 + i * 1.3}s linear infinite`,
                animationDelay: `${i * 0.8}s`,
                opacity: 0.85,
              }}
            />
            <Node x={40} y={node.y} mark={node.mark} label={node.label} />
          </g>
        ))}

        {RIGHT.map((node, i) => (
          <g key={node.label}>
            <path
              d={`M 398 150 C 470 150, 490 ${node.y + 16}, 582 ${node.y + 16}`}
              stroke="url(#fade-right)"
              strokeWidth="1.25"
              fill="none"
            />
            <path
              d={`M 398 150 C 470 150, 490 ${node.y + 16}, 582 ${node.y + 16}`}
              stroke="var(--signal)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="3 220"
              style={{
                animation: `a-dash ${6.5 + i * 1.1}s linear infinite`,
                animationDelay: `${1.4 + i * 0.7}s`,
                opacity: 0.85,
              }}
            />
            <Node x={582} y={node.y} mark={node.mark} label={node.label} />
          </g>
        ))}

        {/* Auralis core */}
        <g>
          <rect
            x="322"
            y="114"
            width="76"
            height="72"
            rx="14"
            fill="var(--surface)"
            stroke="var(--signal)"
            strokeWidth="1.5"
          />
          <circle cx="360" cy="150" r="5" fill="var(--signal)" className="live-dot" />
          <circle
            cx="360"
            cy="150"
            r="15"
            fill="none"
            stroke="var(--signal)"
            strokeWidth="1"
            opacity="0.35"
          />
          <text
            x="360"
            y="203"
            textAnchor="middle"
            fontSize="11"
            fill="var(--ink-faint)"
            letterSpacing="0.14em"
            fontWeight="500"
          >
            AURALIS
          </text>
        </g>
      </svg>
    </div>
  );
}

function Node({ x, y, mark, label }: { x: number; y: number; mark: string; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="98"
        height="32"
        rx="8"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="1"
      />
      <circle cx={x + 17} cy={y + 16} r="7" fill="var(--raised)" />
      <text
        x={x + 17}
        y={y + 19.5}
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="600"
        fill="var(--ink-soft)"
      >
        {mark}
      </text>
      <text x={x + 32} y={y + 20} fontSize="11.5" fill="var(--ink-soft)" fontWeight="450">
        {label}
      </text>
    </g>
  );
}
