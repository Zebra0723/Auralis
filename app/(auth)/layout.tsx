import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <rect x="0.75" y="0.75" width="18.5" height="18.5" rx="5.5" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="3" fill="var(--signal)" />
          </svg>
          <span className="title text-[16.5px]" style={{ color: "var(--ink)" }}>Auralis</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[380px] rise">{children}</div>
      </main>
    </div>
  );
}
