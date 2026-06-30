import "server-only";
import { google } from "googleapis";
import { env } from "@/lib/env";
import { getRefreshToken } from "@/services/users";

/**
 * The OAuth2 client type as exposed by `googleapis`. We derive it from the
 * constructor to avoid a type clash with the duplicate `google-auth-library`
 * copy that firebase-admin/google-gax pulls in.
 */
export type OAuthClient = InstanceType<typeof google.auth.OAuth2>;

/** Build an OAuth2 client from an access token (interactive session path). */
export function oauthClientFromAccessToken(accessToken: string): OAuthClient {
  const client = new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret
  );
  client.setCredentials({ access_token: accessToken });
  return client;
}

/**
 * Build an OAuth2 client from the user's stored refresh token (server-side /
 * cron path — works with no active session). The library refreshes the access
 * token automatically when needed.
 */
export async function oauthClientForUser(
  uid: string
): Promise<OAuthClient | null> {
  const refreshToken = await getRefreshToken(uid);
  if (!refreshToken) return null;
  const client = new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function calendarFor(client: OAuthClient) {
  return google.calendar({ version: "v3", auth: client });
}
