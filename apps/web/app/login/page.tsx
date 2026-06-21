import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "../../components/auth-form";
import { SiteHeader } from "../../components/site-header";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main>
      <SiteHeader session={null} />
      <section className="auth-panel">
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in to manage your bookings and venues.</p>
        <AuthForm mode="login" />
        <p className="auth-switch">
          New to CourtLink? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
