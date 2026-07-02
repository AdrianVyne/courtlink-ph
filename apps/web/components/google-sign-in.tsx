const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  GOOGLE_OAUTH_STATE_INVALID: "Google sign-in expired. Please try again.",
  GOOGLE_OAUTH_IDENTITY_INVALID: "Google could not verify this account.",
  GOOGLE_ACCOUNT_UNAVAILABLE: "This CourtLink account is unavailable.",
  GOOGLE_OAUTH_DISABLED: "Google sign-in is not available right now.",
};

export function GoogleSignIn({
  enabled,
  oauthError,
}: {
  enabled: boolean;
  oauthError?: string | undefined;
}) {
  const errorMessage = oauthError
    ? (ERROR_MESSAGES[oauthError] ?? "Google sign-in could not be completed.")
    : null;
  if (!enabled && !errorMessage) return null;

  return (
    <div className="mt-4 grid gap-4">
      {errorMessage ? (
        <p
          className="m-0 rounded-[10px] border border-[#f1b5b0] bg-danger-bg px-[0.8rem] py-[0.6rem] text-[0.88rem] text-danger-fg"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {enabled ? (
        <>
          <div
            className="flex items-center gap-3 text-[0.78rem] uppercase text-ink-500 before:h-px before:flex-1 before:bg-sand-200 before:content-[''] after:h-px after:flex-1 after:bg-sand-200 after:content-['']"
            aria-hidden="true"
          >
            <span>or</span>
          </div>
          <a
            className="flex items-center justify-center gap-[0.65rem] rounded-[10px] border border-sand-200 bg-white px-4 py-3 font-bold text-ink-900 hover:border-court-700"
            href="/api/v1/auth/google/start?returnTo=%2Fdashboard"
          >
            <span className="text-[1.05rem] font-extrabold text-[#4285f4]" aria-hidden="true">
              G
            </span>
            Continue with Google
          </a>
        </>
      ) : null}
    </div>
  );
}
