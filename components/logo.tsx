/**
 * The Auralis mark.
 *
 * A sculptural rounded "A" — two thick strokes with rounded ends meeting at a
 * rounded apex — with a wave ribbon crossing through it, inside a thin ring.
 * The gradient runs deep blue on the left to lavender on the right.
 *
 * Drawn as SVG rather than shipped as a bitmap so it stays sharp at every size
 * and the ring can be rendered complete rather than cropped.
 *
 * Detail is dropped as the mark gets smaller, because a wave ribbon and a
 * hairline ring turn to mud below about 40px: the ring goes first, then the
 * wave, leaving the bare peak in navigation.
 */

let seq = 0;

interface MarkProps {
  size?: number;
  /** Draw the surrounding ring. Ignored below 40px, where it cannot resolve. */
  ring?: boolean;
}

export function AuralisMark({ size = 24, ring = false }: MarkProps) {
  // Each instance needs its own gradient ids, or every mark on the page
  // resolves to the first one's.
  const id = seq++;
  const strokeGradient = `auralis-a-${id}`;
  const waveGradient = `auralis-wave-${id}`;
  const ringGradient = `auralis-ring-${id}`;

  const showRing = ring && size >= 40;
  const showWave = size >= 26;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={strokeGradient} x1="14" y1="56" x2="52" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e3fa8" />
          <stop offset="0.45" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id={waveGradient} x1="16" y1="40" x2="48" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bfdbfe" />
          <stop offset="0.5" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#ddd6fe" />
        </linearGradient>
        <linearGradient id={ringGradient} x1="4" y1="32" x2="60" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93c5fd" />
          <stop offset="1" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>

      {showRing && (
        <circle cx="32" cy="32" r="30" stroke={`url(#${ringGradient})`} strokeWidth="1" fill="none" />
      )}

      {/* The two strokes of the A, drawn separately so each keeps a rounded
          end rather than being joined into a single chevron. */}
      <path
        d="M17 51 L29.5 17"
        stroke={`url(#${strokeGradient})`}
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M47 51 L34.5 17"
        stroke={`url(#${strokeGradient})`}
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Rounded apex joining the two strokes. */}
      <path
        d="M29.5 17 Q32 10.5 34.5 17"
        stroke={`url(#${strokeGradient})`}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {showWave && (
        <path
          d="M18 42 Q24 31 30 39 T42 36"
          stroke={`url(#${waveGradient})`}
          strokeWidth="4.4"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

/**
 * Mark plus wordmark. The wordmark is set in wide-tracked capitals to match the
 * logo artwork rather than the interface typeface.
 */
export function AuralisWordmark({
  size = 15,
  markSize = 26,
}: {
  size?: number;
  markSize?: number;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <AuralisMark size={markSize} />
      <span
        style={{
          fontSize: size,
          fontWeight: 400,
          letterSpacing: "0.22em",
          color: "var(--brand-ink)",
          lineHeight: 1,
          // The tracking adds space after the final letter; pull it back so the
          // wordmark is optically centred against the mark.
          marginRight: "-0.22em",
        }}
      >
        AURALIS
      </span>
    </span>
  );
}

/** The full lockup: mark inside its ring, with the wordmark beneath. */
export function AuralisLockup({ width = 220 }: { width?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        width,
      }}
    >
      <AuralisMark size={Math.round(width * 0.5)} ring />
      <span
        style={{
          fontSize: Math.round(width * 0.115),
          letterSpacing: "0.3em",
          color: "var(--brand-ink)",
          marginRight: "-0.3em",
        }}
      >
        AURALIS
      </span>
    </span>
  );
}
