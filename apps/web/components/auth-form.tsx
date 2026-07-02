"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { Button, Field, Input } from "./ui";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordId = useId();
  const passwordHintId = mode === "register" ? `${passwordId}-hint` : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("displayName") ?? "");

    try {
      if (mode === "register") {
        await apiFetch<unknown>("/auth/register", {
          method: "POST",
          body: { email, password, displayName },
        });
      }
      await apiFetch<unknown>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === "AUTH_INVALID_CREDENTIALS" ? "Email or password is incorrect." : err.message,
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {mode === "register" ? (
        <Field label="Full name">
          <Input autoComplete="name" minLength={1} name="displayName" required type="text" />
        </Field>
      ) : null}
      <Field label="Email">
        <Input autoComplete="email" name="email" required type="email" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-ink-700" htmlFor={passwordId}>
          Password
        </label>
        <div className="relative">
          <Input
            aria-describedby={passwordHintId}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="w-full pr-12"
            id={passwordId}
            minLength={mode === "register" ? 12 : 1}
            name="password"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-ink-500 hover:text-court-800"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
            <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
          </button>
        </div>
        {passwordHintId ? (
          <p className="m-0 text-[0.82rem] text-ink-500" id={passwordHintId}>
            Use at least 12 characters.
          </p>
        ) : null}
      </div>
      {error ? (
        <p
          className="m-0 rounded-(--radius-control) border border-danger-fg/30 bg-danger-bg px-3 py-2.5 text-sm text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button loading={pending} type="submit">
        {pending ? "Please wait" : mode === "register" ? "Create account" : "Log in"}
      </Button>
    </form>
  );
}
