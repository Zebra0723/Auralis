import Link from "next/link";
import { AuralisWordmark } from "@/components/logo";
import { releases, VERSION } from "@/lib/changelog";

export const metadata = {
  title: "Changelog",
  description: "Everything that has shipped in Auralis, newest first.",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-50"
        style={{
          background: "color-mix(in srgb, var(--paper) 88%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <div className="mx-auto max-w-[760px] px-6 h-16 flex items-center justify-between">
          <Link href="/" className="no-underline">
            <AuralisWordmark />
          </Link>
          <Link href="/" className="btn btn-ghost btn-sm">
            Back to site
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[760px] w-full px-6 py-14 md:py-20">
        <p className="eyebrow">Changelog</p>
        <h1 className="display mt-4 text-[clamp(2rem,4vw,2.8rem)]">
          What has shipped.
        </h1>
        <p className="mt-4 text-[15px] measure" style={{ color: "var(--ink-soft)" }}>
          Auralis is on version {VERSION}. The number goes up by one with every
          change, newest first.
        </p>

        <ol className="mt-14 list-none p-0 m-0">
          {releases.map((release, index) => {
            const version = releases.length - index;
            const isLatest = index === 0;
            return (
              <li
                key={version}
                className="grid gap-x-6 gap-y-2 pb-9 mb-9 border-b sm:grid-cols-[76px_1fr]"
                style={{ borderColor: "var(--line-soft)" }}
              >
                <div>
                  <span
                    className="badge"
                    style={{
                      background: isLatest ? "var(--accent-soft)" : "var(--raised)",
                      color: isLatest ? "var(--accent)" : "var(--ink-soft)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    v{version}
                  </span>
                </div>

                <div>
                  <h2 className="title text-[16.5px]">{release.summary}</h2>
                  <time
                    className="block mt-1 text-[12.5px]"
                    style={{ color: "var(--ink-faint)" }}
                    dateTime={release.date}
                  >
                    {formatDate(release.date)}
                  </time>

                  {release.notes && (
                    <ul className="mt-3 flex flex-col gap-2 list-none p-0">
                      {release.notes.map((note) => (
                        <li
                          key={note}
                          className="text-[14px] leading-[1.6] pl-4 relative"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          <span
                            className="absolute left-0 top-[9px] w-[4px] h-[4px] rounded-full"
                            style={{ background: "var(--ink-faint)" }}
                          />
                          {note}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--line-soft)" }}>
        <div className="mx-auto max-w-[760px] px-6 py-8">
          <p className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
            Auralis is a DailyOS company.
          </p>
        </div>
      </footer>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
