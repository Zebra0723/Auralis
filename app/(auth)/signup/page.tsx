import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "../auth-form";
import { signUpAction } from "../actions";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Create your workspace" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <div>
      <h1 className="title text-[26px]">Create your workspace</h1>
      <p className="mt-2 mb-8 text-[14px]" style={{ color: "var(--ink-soft)" }}>
        Connect your first service in about a minute.
      </p>
      <AuthForm mode="signup" action={signUpAction} />
      <p className="mt-6 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
        Already have one?{" "}
        <Link href="/signin" className="link-underline" style={{ color: "var(--ink)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
