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
    <div className="google-sign-in">
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {enabled ? (
        <>
          <div className="auth-divider" aria-hidden="true">
            <span>or</span>
          </div>
          <a className="google-button" href="/api/v1/auth/google/start?returnTo=%2Fdashboard">
            <span className="google-mark" aria-hidden="true">
              G
            </span>
            Continue with Google
          </a>
        </>
      ) : null}
    </div>
  );
}
