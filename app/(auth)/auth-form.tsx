"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "One moment…" : label}
    </button>
  );
}

export function AuthForm({
  mode,
  action,
}: {
  mode: "signin" | "signup";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const isSignUp = mode === "signup";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isSignUp && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Your name</span>
          <input
            name="name"
            className="input"
            autoComplete="name"
            placeholder="Optional"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          className="input"
          autoComplete="email"
          placeholder="you@company.com"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          className="input"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder={isSignUp ? "At least 10 characters" : ""}
          minLength={isSignUp ? 10 : undefined}
        />
      </label>

      {state?.error && (
        <p
          role="alert"
          className="text-[13px] rounded-[6px] px-3 py-2.5"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          {state.error}
        </p>
      )}

      <SubmitButton label={isSignUp ? "Create workspace" : "Sign in"} />
    </form>
  );
}
