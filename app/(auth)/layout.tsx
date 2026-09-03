import Link from "next/link";
import { AuralisWordmark } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <AuralisWordmark />
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[380px] rise">{children}</div>
      </main>
    </div>
  );
}
