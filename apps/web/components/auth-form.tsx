"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {mode === "register" ? (
        <label className="field">
          <span className="field-label">Full name</span>
          <input name="displayName" type="text" required minLength={1} autoComplete="name" />
        </label>
      ) : null}
      <label className="field">
        <span className="field-label">Email</span>
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className="field">
        <span className="field-label">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 12 : 1}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />
      </label>
      {mode === "register" ? <p className="field-hint">Use at least 12 characters.</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Please wait..." : mode === "register" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
