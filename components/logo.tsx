/**
 * The Auralis mark, drawn as SVG rather than shipped as a bitmap so it stays
 * sharp at every size, costs almost nothing, and can pick up the brand gradient
 * from one place.
 *
 * The mark is the peaked "A" with the junction node sitting on its right
 * stroke — the same idea as the full logo lockup, reduced to what survives at
 * 20px. The connected-service nodes around it in the full artwork disappear at
 * navigation size, so they are not drawn here.
 */

let gradientSeq = 0;

export function AuralisMark({ size = 22 }: { size?: number }) {
  // Each instance needs its own gradient id, or several marks on one page all
  // reference the first one.
  const id = `auralis-mark-${gradientSeq++}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="4" y1="28" x2="28" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-blue)" />
          <stop offset="1" stopColor="var(--brand-purple)" />
        </linearGradient>
      </defs>

      {/* The A: up the left stroke, over the apex, down the right. */}
      <path
        d="M5 27 L15 6 Q16 4 17 6 L27 27"
        stroke={`url(#${id})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The junction node only survives above roughly 28px. Below that it
          collapses into a smudge on the right stroke and the plain peak reads
          better, so it is dropped rather than drawn badly. */}
      {size >= 28 && (
        <>
          <circle cx="21.4" cy="20.2" r="4" fill="var(--surface)" />
          <circle cx="21.4" cy="20.2" r="4" stroke={`url(#${id})`} strokeWidth="2.4" />
        </>
      )}
    </svg>
  );
}

export function AuralisWordmark({
  size = 17,
  markSize = 22,
}: {
  size?: number;
  markSize?: number;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <AuralisMark size={markSize} />
      <span
        style={{
          fontSize: size,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--brand-ink)",
          lineHeight: 1,
        }}
      >
        Auralis
      </span>
    </span>
  );
}

/**
 * The full lockup: mark, wordmark and the connected nodes that give the logo
 * its meaning. Only used where there is room for it to read — never in
 * navigation.
 */
export function AuralisLockup({ width = 300 }: { width?: number }) {
  const id = "auralis-lockup";
  const nodes = [
    { cx: 26, cy: 26, side: "left" as const, glyph: "calendar" },
    { cx: 18, cy: 56, side: "left" as const, glyph: "person" },
    { cx: 26, cy: 86, side: "left" as const, glyph: "mail" },
    { cx: 174, cy: 26, side: "right" as const, glyph: "doc" },
    { cx: 182, cy: 56, side: "right" as const, glyph: "check" },
    { cx: 174, cy: 86, side: "right" as const, glyph: "chart" },
  ];

  return (
    <svg
      width={width}
      viewBox="0 0 200 112"
      fill="none"
      role="img"
      aria-label="Auralis"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={id} x1="60" y1="100" x2="140" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-blue)" />
          <stop offset="1" stopColor="var(--brand-purple)" />
        </linearGradient>
      </defs>

      {nodes.map((node) => (
        <g key={`${node.side}-${node.glyph}`}>
          <path
            d={
              node.side === "left"
                ? `M ${node.cx + 13} ${node.cy} H 70`
                : `M ${node.cx - 13} ${node.cy} H 130`
            }
            stroke="var(--line)"
            strokeWidth="1.2"
            strokeDasharray="2 3"
          />
          <circle
            cx={node.cx}
            cy={node.cy}
            r="12"
            stroke={node.side === "left" ? "var(--brand-blue)" : "var(--brand-purple)"}
            strokeWidth="1.4"
          />
          <NodeGlyph
            glyph={node.glyph}
            cx={node.cx}
            cy={node.cy}
            colour={node.side === "left" ? "var(--brand-blue)" : "var(--brand-purple)"}
          />
        </g>
      ))}

      <path
        d="M78 98 L98 22 Q100 16 102 22 L122 98"
        stroke={`url(#${id})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="110" cy="72" r="9" fill="var(--surface)" />
      <circle cx="110" cy="72" r="9" stroke={`url(#${id})`} strokeWidth="5" />
    </svg>
  );
}

function NodeGlyph({
  glyph,
  cx,
  cy,
  colour,
}: {
  glyph: string;
  cx: number;
  cy: number;
  colour: string;
}) {
  const common = {
    stroke: colour,
    strokeWidth: 1.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  switch (glyph) {
    case "calendar":
      return (
        <g {...common}>
          <rect x={cx - 5} y={cy - 4.5} width="10" height="9" rx="1.5" />
          <path d={`M${cx - 5} ${cy - 1.5} h10 M${cx - 2.5} ${cy - 6} v3 M${cx + 2.5} ${cy - 6} v3`} />
        </g>
      );
    case "person":
      return (
        <g {...common}>
          <circle cx={cx} cy={cy - 2} r="2.6" />
          <path d={`M${cx - 4.5} ${cy + 5.5} a4.5 4.5 0 0 1 9 0`} />
        </g>
      );
    case "mail":
      return (
        <g {...common}>
          <rect x={cx - 5.5} y={cy - 4} width="11" height="8" rx="1.5" />
          <path d={`M${cx - 5.5} ${cy - 3} l5.5 4 l5.5 -4`} />
        </g>
      );
    case "doc":
      return (
        <g {...common}>
          <path d={`M${cx - 4} ${cy - 5.5} h5 l3 3 v8 h-8 z`} />
          <path d={`M${cx - 2} ${cy} h4 M${cx - 2} ${cy + 2.5} h4`} />
        </g>
      );
    case "check":
      return <path d={`M${cx - 4} ${cy} l3 3 l5 -6`} {...common} strokeWidth={1.7} />;
    case "chart":
      return (
        <g {...common}>
          <path d={`M${cx - 4} ${cy + 4} v-4 M${cx} ${cy + 4} v-7 M${cx + 4} ${cy + 4} v-2`} strokeWidth={1.8} />
        </g>
      );
    default:
      return null;
  }
}
