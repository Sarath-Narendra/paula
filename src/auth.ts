import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";
import { upsertUserFromOAuth, saveRefreshToken } from "@/services/users";

/**
 * Scopes:
 *  - identity (openid/email/profile)
 *  - calendar: full read/write so Paula can query free/busy and write blocks.
 */
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

/** Refresh an expired Google access token using the stored refresh token. */
async function refreshGoogleAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }
  return {
    accessToken: data.access_token as string,
    expiresAt: Date.now() + (data.expires_in as number) * 1000,
    // Google only returns a new refresh_token rarely; keep the old one otherwise.
    refreshToken: (data.refresh_token as string) ?? refreshToken,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Cloud Run sits behind a proxy; trust the forwarded host for callback URLs.
  trustHost: true,
  providers: [
    Google({
      // Read directly (not via the throwing env getter) so module import during
      // `next build` doesn't fail before secrets are wired. Missing values only
      // matter at request time, where Auth.js surfaces a clear error.
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline", // request a refresh token
          prompt: "consent", // force consent so refresh token is returned
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign-in: capture tokens + provision the user in Firestore.
      if (account && profile) {
        token.uid = (profile.sub as string) ?? token.sub;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;

        try {
          await upsertUserFromOAuth({
            uid: token.uid as string,
            email: (profile.email as string) ?? "",
            name: profile.name as string | undefined,
            image: (profile.picture as string) ?? undefined,
          });
          if (account.refresh_token) {
            await saveRefreshToken(token.uid as string, account.refresh_token);
          }
        } catch (err) {
          console.error("[auth] failed to persist user/token", err);
        }
        return token;
      }

      // Subsequent requests: refresh the access token if it has expired.
      if (token.expiresAt && Date.now() < (token.expiresAt as number) - 60_000) {
        return token;
      }
      if (!token.refreshToken) return token;
      try {
        const refreshed = await refreshGoogleAccessToken(
          token.refreshToken as string
        );
        token.accessToken = refreshed.accessToken;
        token.expiresAt = refreshed.expiresAt;
        token.refreshToken = refreshed.refreshToken;
      } catch (err) {
        console.error("[auth] token refresh error", err);
        token.error = "RefreshTokenError";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.uid as string) ?? token.sub ?? "";
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
});
