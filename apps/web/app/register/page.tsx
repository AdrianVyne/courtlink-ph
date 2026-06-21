import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "../../components/auth-form";
import { SiteHeader } from "../../components/site-header";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main>
      <SiteHeader session={null} />
      <section className="auth-panel">
        <h1>Create your account</h1>
        <p className="auth-sub">Book courts and coaches across the Philippines.</p>
        <AuthForm mode="register" />
        <p className="auth-switch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
