import Link from "next/link";
import { ConnectionVisual } from "@/components/connection-visual";
import { AuralisWordmark } from "@/components/logo";
import { latestRelease, VERSION_LABEL } from "@/lib/changelog";
import { allDescriptors, connectableState } from "@/lib/integrations/registry";
import { getSession } from "@/lib/auth";

export default async function LandingPage() {
  const session = await getSession();
  const descriptors = allDescriptors().filter((d) => d.key !== "vault");

  return (
    <div>
      <SiteNav signedIn={Boolean(session)} />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <SupportedServices descriptors={descriptors} />
        <AutomationExamples />
        <Security />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------- nav */

function SiteNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "color-mix(in srgb, var(--paper) 86%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      <div className="mx-auto max-w-[1140px] px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Wordmark />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
          <a href="#how" className="hover:opacity-70 transition-opacity no-underline" style={{ color: "inherit" }}>How it works</a>
          <a href="#services" className="hover:opacity-70 transition-opacity no-underline" style={{ color: "inherit" }}>Services</a>
          <a href="#security" className="hover:opacity-70 transition-opacity no-underline" style={{ color: "inherit" }}>Security</a>
          <a href="#pricing" className="hover:opacity-70 transition-opacity no-underline" style={{ color: "inherit" }}>Pricing</a>
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className="btn btn-primary btn-sm">Open dashboard</Link>
          ) : (
            <>
              <Link href="/signin" className="btn btn-ghost btn-sm hidden sm:inline-flex">Sign in</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Wordmark() {
  return <AuralisWordmark />;
}

/* ------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="border-b" style={{ borderColor: "var(--line)" }}>
      <div className="mx-auto max-w-[1160px] px-6 py-16 md:py-24">
        {/* Two columns so the concept is visible in the same glance as the
            claim, rather than half the fold being empty. */}
        <div className="grid gap-12 lg:gap-16 lg:grid-cols-[1fr_minmax(0,520px)] lg:items-center">
          <div>
            <p className="eyebrow rise">Account synchronization infrastructure</p>
            <h1
              className="display mt-6 text-[clamp(2.6rem,6vw,4.4rem)] rise"
              style={{ animationDelay: "60ms" }}
            >
              Everything,
              <br />
              connected.
            </h1>
            <p
              className="mt-6 text-[16px] leading-[1.6] max-w-[46ch] rise"
              style={{ color: "var(--ink-soft)", animationDelay: "120ms" }}
            >
              Connect the services you use. Keep the information that matters
              synchronized. Change something once and Auralis works out which of
              your accounts support that field, then updates them for you.
            </p>
            <div
              className="mt-8 flex flex-wrap items-center gap-2.5 rise"
              style={{ animationDelay: "180ms" }}
            >
              <Link href="/signup" className="btn btn-primary">
                Connect your first service
              </Link>
              <a href="#how" className="btn btn-secondary">
                See how it works
              </a>
            </div>
            <p
              className="mt-6 text-[13px] rise"
              style={{ color: "var(--ink-faint)", animationDelay: "240ms" }}
            >
              No password for any connected service ever reaches us.
            </p>
          </div>

          <div className="rise" style={{ animationDelay: "260ms" }}>
            <ConnectionVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- problem */

function Problem() {
  const symptoms = [
    {
      title: "The same change, over and over",
      body: "A new phone number means editing it in Google, then Microsoft, then Slack, then the three places you forget until someone calls the old one.",
    },
    {
      title: "Quietly out of date",
      body: "Most of your accounts still say the job you had two roles ago, because nothing ever prompted you to fix them.",
    },
    {
      title: "No single source of truth",
      body: "When two services disagree, there is nothing to tell you which one is right, or even that they disagree at all.",
    },
  ];

  return (
    <section className="border-t" style={{ borderColor: "var(--line-soft)" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-20 md:py-28">
        <p className="eyebrow">The problem</p>
        <h2 className="display mt-5 text-[clamp(1.9rem,3.6vw,2.75rem)] max-w-[19ch]">
          Your information lives in thirty places and agrees in none of them.
        </h2>

        <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
          {symptoms.map((s, i) => (
            <div key={s.title}>
              <div
                className="text-[12px] font-mono mb-4 tabular-nums"
                style={{ color: "var(--ink-faint)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="title text-[17px]">{s.title}</h3>
              <p className="mt-3 text-[14.5px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ how it works */

function HowItWorks() {
  const steps = [
    {
      title: "Connect",
      body: "Authorise each service through its own login screen. Auralis receives a scoped token and never sees your password.",
    },
    {
      title: "Choose what matters",
      body: "Pick the fields worth keeping in step. Auralis shows only the fields both services can actually exchange, so a sync cannot be set up to fail.",
    },
    {
      title: "Leave it alone",
      body: "Changes propagate in the background on your schedule. If two services disagree, Auralis stops and asks rather than overwriting anything.",
    },
  ];

  return (
    <section id="how" className="border-t" style={{ borderColor: "var(--line-soft)", background: "var(--raised)" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-20 md:py-28">
        <p className="eyebrow">How Auralis works</p>
        <h2 className="display mt-5 text-[clamp(1.9rem,3.6vw,2.75rem)] max-w-[17ch]">
          Set it up once. Then forget it exists.
        </h2>

        <ol className="mt-14 grid gap-6 md:grid-cols-3 list-none p-0">
          {steps.map((step, i) => (
            <li key={step.title} className="card card-pad" style={{ background: "var(--surface)" }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium mb-5"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {i + 1}
              </div>
              <h3 className="title text-[17px]">{step.title}</h3>
              <p className="mt-3 text-[14.5px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-[14px] measure" style={{ color: "var(--ink-faint)" }}>
          Auralis reconciles every service against one canonical record rather than
          wiring services to each other. Connecting a tenth service adds one mapping,
          not nine.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- services */

function SupportedServices({
  descriptors,
}: {
  descriptors: ReturnType<typeof allDescriptors>;
}) {
  return (
    <section id="services" className="border-t" style={{ borderColor: "var(--line-soft)" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-20 md:py-28">
        <p className="eyebrow">Supported services</p>
        <h2 className="display mt-5 text-[clamp(1.9rem,3.6vw,2.75rem)] max-w-[20ch]">
          Every integration is built the same way.
        </h2>
        <p className="measure mt-5 text-[15px]" style={{ color: "var(--ink-soft)" }}>
          Each service implements one common interface, so what you see here is the
          current state, not a wish list. Where a service needs credentials from your
          administrator before it can run, we say so.
        </p>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {descriptors.map((d) => {
            const state = connectableState(d);
            return (
              <div key={d.key} className="card card-pad flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-8 h-8 rounded-[7px] flex items-center justify-center text-[12px] font-semibold shrink-0"
                      style={{ background: `${d.accent}14`, color: d.accent }}
                    >
                      {d.mark}
                    </span>
                    <div className="min-w-0">
                      <div className="title text-[14.5px] truncate">{d.name}</div>
                      <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>{d.category}</div>
                    </div>
                  </div>
                  {state.connectable ? (
                    <span className="badge badge-signal">Ready</span>
                  ) : state.reason === "planned" ? (
                    <span className="badge badge-neutral">Coming soon</span>
                  ) : (
                    <span className="badge badge-amber">Needs setup</span>
                  )}
                </div>
                <p className="text-[13.5px] leading-[1.55]" style={{ color: "var(--ink-soft)" }}>
                  {d.blurb}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-[13px]" style={{ color: "var(--ink-faint)" }}>
          <span className="badge badge-amber mr-2">Needs setup</span>
          means the integration is built and waiting on API credentials for this
          deployment. Nothing here is a mock-up.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- automations */

function AutomationExamples() {
  const examples = [
    {
      when: "Your job title changes in Microsoft",
      then: "Slack, Zoom and GitHub are updated to match",
    },
    {
      when: "You add a phone number in Auralis",
      then: "Every connected service that stores one receives it",
    },
    {
      when: "Google and Slack disagree about your display name",
      then: "Both are left untouched and you are asked which is right",
    },
    {
      when: "A connection's access expires overnight",
      then: "Syncing pauses and you get one clear prompt to reconnect",
    },
  ];

  return (
    <section className="border-t" style={{ borderColor: "var(--line-soft)", background: "var(--raised)" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-20 md:py-28">
        <p className="eyebrow">Automation examples</p>
        <h2 className="display mt-5 text-[clamp(1.9rem,3.6vw,2.75rem)] max-w-[16ch]">
          Rules you can read out loud.
        </h2>

        <div className="mt-12 grid gap-3 md:grid-cols-2">
          {examples.map((ex) => (
            <div key={ex.when} className="card card-pad" style={{ background: "var(--surface)" }}>
              <div className="flex items-baseline gap-3">
                <span className="eyebrow shrink-0" style={{ width: 38 }}>When</span>
                <span className="text-[14.5px]">{ex.when}</span>
              </div>
              <div className="my-3 ml-[50px] h-4 border-l" style={{ borderColor: "var(--line)" }} />
              <div className="flex items-baseline gap-3">
                <span className="eyebrow shrink-0" style={{ width: 38, color: "var(--accent)" }}>Then</span>
                <span className="text-[14.5px]">{ex.then}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- security */

function Security() {
  const points = [
    {
      title: "We never see your passwords",
      body: "Every connection is authorised through the service's own OAuth screen, or a token you issue yourself. Auralis receives a scoped credential and nothing more.",
    },
    {
      title: "Credentials are encrypted at rest",
      body: "Tokens are sealed with AES-256-GCM under a key held outside the database, and are decrypted only inside the process that talks to the provider.",
    },
    {
      title: "Nothing is overwritten silently",
      body: "When two services disagree, Auralis records the conflict and stops. No field is ever changed on a guess.",
    },
    {
      title: "A full account of every change",
      body: "Each write is recorded with what changed, which services were involved and when. Revoke any connection and its credentials are destroyed.",
    },
  ];

  return (
    <section id="security" className="border-t" style={{ borderColor: "var(--line-soft)" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-20 md:py-28">
        <p className="eyebrow">Security and privacy</p>
        <h2 className="display mt-5 text-[clamp(1.9rem,3.6vw,2.75rem)] max-w-[18ch]">
          Handling your accounts is the entire responsibility.
        </h2>

        <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {points.map((p) => (
            <div key={p.title} className="flex gap-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" className="mt-0.5 shrink-0" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <h3 className="title text-[16px]">{p.title}</h3>
                <p className="mt-2 text-[14.5px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- pricing */

const TIERS = [
  {
    name: "Free",
    price: "£0",
    cadence: "forever",
    blurb: "For keeping a handful of personal accounts in step.",
    features: ["3 connections", "Basic syncs", "500 sync operations a month", "Conflict detection", "7 days of activity history"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Plus",
    price: "£9",
    cadence: "per month",
    blurb: "For someone whose details are spread across a real stack.",
    features: ["15 connections", "Unlimited syncs", "10,000 sync operations a month", "Advanced rules", "Priority syncing", "12 months of activity history"],
    cta: "Choose Plus",
    featured: true,
  },
  {
    name: "Business",
    price: "£29",
    cadence: "per user, per month",
    blurb: "For teams that need directory information to agree.",
    features: ["Unlimited connections", "Team workspaces and roles", "Advanced access controls", "Full audit log export", "Highest sync limits", "Priority support"],
    cta: "Talk to us",
    featured: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="border-t" style={{ borderColor: "var(--line-soft)", background: "var(--raised)" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-20 md:py-28">
        <p className="eyebrow">Pricing</p>
        <h2 className="display mt-5 text-[clamp(1.9rem,3.6vw,2.75rem)]">Priced by how much you connect.</h2>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="card flex flex-col p-7"
              style={{
                background: "var(--surface)",
                borderColor: tier.featured ? "var(--accent)" : "var(--line)",
                boxShadow: tier.featured ? "var(--shadow-card)" : "none",
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="title text-[17px]">{tier.name}</h3>
                {tier.featured && <span className="badge badge-signal">Most chosen</span>}
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="display text-[2.6rem]">{tier.price}</span>
                <span className="text-[13px]" style={{ color: "var(--ink-faint)" }}>{tier.cadence}</span>
              </div>
              <p className="mt-3 text-[14px]" style={{ color: "var(--ink-soft)" }}>{tier.blurb}</p>

              <ul className="mt-7 flex flex-col gap-2.5 list-none p-0 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[14px]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" className="mt-1 shrink-0" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ color: "var(--ink-soft)" }}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`btn mt-8 w-full ${tier.featured ? "btn-primary" : "btn-secondary"}`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[13px]" style={{ color: "var(--ink-faint)" }}>
          Billing is not yet enabled on this deployment. Every account currently runs
          on the Free plan with its limits enforced.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- faq */

const FAQS = [
  {
    q: "Does Auralis store my passwords?",
    a: "No. Connections are authorised through each service's own login and consent screen, which hands Auralis a scoped token. Your password is never sent to us and cannot be. Services connected with a personal access token work the same way: you issue the token, you control what it can do, and you can revoke it at any time.",
  },
  {
    q: "What happens when two services disagree?",
    a: "Auralis stops. It compares each side against the last value it recorded, so it can tell the difference between one service changing and both changing. When both have moved it raises a conflict, leaves both values untouched, and asks you which to keep. You can also tell it to always prefer one side.",
  },
  {
    q: "Can I sync only some fields?",
    a: "That is the normal way to use it. You choose the fields, the direction, how often it runs, and whether deletions travel. Auralis only offers fields that both services can genuinely exchange, so you cannot configure a sync that could never work.",
  },
  {
    q: "How often does it sync?",
    a: "Per sync: every 15 minutes, hourly, daily, or manually. Where a provider supports change notifications, Auralis subscribes to them and reacts within seconds instead of waiting for the next poll.",
  },
  {
    q: "What if a connection breaks?",
    a: "Transient failures are retried automatically with increasing gaps between attempts. If a token has genuinely expired, syncing for that connection pauses and you get one plain-language prompt to reconnect, rather than a stream of alerts.",
  },
  {
    q: "Can I remove everything?",
    a: "Yes. Disconnecting a service revokes the token where the provider allows it and deletes the stored credential. Deleting your workspace removes the canonical record, connections, history and audit log.",
  },
];

function Faq() {
  return (
    <section className="border-t" style={{ borderColor: "var(--line-soft)" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-20 md:py-28">
        <p className="eyebrow">Questions</p>
        <h2 className="display mt-5 text-[clamp(1.9rem,3.6vw,2.75rem)]">Answered plainly.</h2>

        <div className="mt-12 max-w-[760px]">
          {FAQS.map((item) => (
            <details key={item.q} className="group border-b py-5" style={{ borderColor: "var(--line-soft)" }}>
              <summary className="flex items-center justify-between gap-6 cursor-pointer list-none title text-[16px]">
                {item.q}
                <span
                  className="shrink-0 transition-transform duration-300 group-open:rotate-45"
                  style={{ color: "var(--ink-faint)" }}
                  aria-hidden="true"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3.5 text-[14.5px] leading-[1.65] measure" style={{ color: "var(--ink-soft)" }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- final cta */

function FinalCta() {
  return (
    <section className="border-t" style={{ borderColor: "var(--line-soft)" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-24 md:py-32 text-center">
        <h2 className="display text-[clamp(2.4rem,6vw,4rem)] max-w-[16ch] mx-auto">
          Connect once. Choose what matters.
        </h2>
        <p className="mt-6 text-[16px] max-w-[46ch] mx-auto" style={{ color: "var(--ink-soft)" }}>
          Auralis handles the rest, quietly, in the background.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="btn btn-primary">Connect your first service</Link>
          <Link href="/signin" className="btn btn-secondary">Sign in</Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--line-soft)" }}>
      <div className="mx-auto max-w-[1160px] px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <Wordmark />

        <div className="flex flex-col sm:items-end gap-1.5">
          <Link
            href="/changelog"
            className="flex items-center gap-2 no-underline text-[12.5px]"
            style={{ color: "var(--ink-soft)" }}
          >
            <span
              className="badge badge-neutral"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {VERSION_LABEL}
            </span>
            <span className="link-underline">{latestRelease.summary}</span>
          </Link>
          <p className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
            Auralis is a DailyOS company. &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
