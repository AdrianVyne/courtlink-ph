import { CodeChallengeMethod, OAuth2Client, type TokenPayload } from "google-auth-library";
import type { GoogleOAuthIdentity, GoogleOAuthProvider } from "./google-oauth.service.js";
import { GoogleOAuthError } from "./google-oauth.service.js";

type OAuthClient = Pick<OAuth2Client, "generateAuthUrl" | "getToken" | "verifyIdToken">;

interface OpenIdPayload extends TokenPayload {
  name?: string;
  nonce?: string;
}

export class GoogleOAuthClient implements GoogleOAuthProvider {
  private readonly client: OAuthClient;

  constructor(
    private readonly clientId: string,
    clientSecret: string,
    private readonly redirectUri: string,
    client?: OAuthClient,
  ) {
    this.client = client ?? new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  authorizationUrl(input: { state: string; nonce: string; codeChallenge: string }): string {
    const url = new URL(
      this.client.generateAuthUrl({
        access_type: "online",
        include_granted_scopes: true,
        scope: ["openid", "email", "profile"],
        state: input.state,
        nonce: input.nonce,
        code_challenge: input.codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
    );
    url.searchParams.set("nonce", input.nonce);
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    codeVerifier: string;
    expectedNonce: string;
  }): Promise<GoogleOAuthIdentity> {
    try {
      const { tokens } = await this.client.getToken({
        code: input.code,
        codeVerifier: input.codeVerifier,
        redirect_uri: this.redirectUri,
      });
      if (!tokens.id_token) throw new Error("Missing Google ID token");
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });
      const payload = ticket.getPayload() as OpenIdPayload | undefined;
      if (!payload || payload.nonce !== input.expectedNonce) {
        throw new Error("Google nonce mismatch");
      }
      return {
        subject: payload.sub ?? "",
        email: payload.email ?? "",
        emailVerified: payload.email_verified === true,
        displayName: payload.name ?? "CourtLink Player",
      };
    } catch (error) {
      if (error instanceof GoogleOAuthError) throw error;
      throw new GoogleOAuthError(
        "GOOGLE_OAUTH_IDENTITY_INVALID",
        "Google did not provide a verified identity",
      );
    }
  }
}
