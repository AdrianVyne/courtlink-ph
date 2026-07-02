import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "../../components/auth-form";
import { SiteHeader } from "../../components/site-header";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <>
      <SiteHeader session={null} />
      <main className="mx-auto my-16 w-full max-w-md rounded-(--radius-card) border border-sand-200 bg-white px-8 py-9">
        <h1 className="m-0 font-display text-3xl font-bold tracking-tight text-ink-900">
          Create your account
        </h1>
        <p className="m-0 mt-1 mb-6 text-ink-500">
          Book courts and coaches across the Philippines.
        </p>
        <AuthForm mode="register" />
        <p className="m-0 mt-5 text-sm text-ink-500">
          Already have an account?{" "}
          <Link className="font-semibold text-court-800 hover:underline" href="/login">
            Log in
          </Link>
        </p>
      </main>
    </>
  );
}
