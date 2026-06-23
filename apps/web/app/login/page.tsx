import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "../../components/auth-form";
import { GoogleSignIn } from "../../components/google-sign-in";
import { SiteHeader } from "../../components/site-header";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

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
    <main>
      <SiteHeader session={null} />
      <section className="auth-panel">
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in to manage your bookings and venues.</p>
        <AuthForm mode="login" />
        <GoogleSignIn
          enabled={process.env.GOOGLE_OAUTH_ENABLED === "true"}
          oauthError={oauthError}
        />
        <p className="auth-switch">
          New to CourtLink? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
