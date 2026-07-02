import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "../../components/auth-form";
import { GoogleSignIn } from "../../components/google-sign-in";
import { SiteHeader } from "../../components/site-header";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ oauthError?: string | string[] }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const query = await searchParams;
  const oauthError = Array.isArray(query.oauthError) ? query.oauthError[0] : query.oauthError;

  return (
    <>
      <SiteHeader session={null} />
      <main className="mx-auto my-16 w-full max-w-md rounded-(--radius-card) border border-sand-200 bg-white px-8 py-9">
        <h1 className="m-0 font-display text-3xl font-bold tracking-tight text-ink-900">
          Welcome back
        </h1>
        <p className="m-0 mt-1 mb-6 text-ink-500">Log in to manage your bookings and venues.</p>
        <AuthForm mode="login" />
        <GoogleSignIn
          enabled={process.env.GOOGLE_OAUTH_ENABLED === "true"}
          oauthError={oauthError}
        />
        <p className="m-0 mt-5 text-sm text-ink-500">
          New to CourtLink?{" "}
          <Link className="font-semibold text-court-800 hover:underline" href="/register">
            Create an account
          </Link>
        </p>
      </main>
    </>
  );
}
