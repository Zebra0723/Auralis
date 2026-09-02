import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "../auth-form";
import { signInAction } from "../actions";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <div>
      <h1 className="title text-[26px]">Welcome back</h1>
      <p className="mt-2 mb-8 text-[14px]" style={{ color: "var(--ink-soft)" }}>
        Sign in to your Auralis workspace.
      </p>
      <AuthForm mode="signin" action={signInAction} />
      <p className="mt-6 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
        No workspace yet?{" "}
        <Link href="/signup" className="link-underline" style={{ color: "var(--ink)" }}>
          Create one
        </Link>
      </p>
    </div>
  );
}
