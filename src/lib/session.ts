import "server-only";
import { auth } from "@/auth";
import { oauthClientFromAccessToken, type OAuthClient } from "@/lib/google";

export interface SessionContext {
  uid: string;
  name?: string | null;
  email?: string | null;
  client: OAuthClient | null;
  error?: string;
}

/**
 * Resolve the current user's id + a Calendar-ready OAuth client from the
 * active session. Returns null if unauthenticated.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const client = session.accessToken
    ? oauthClientFromAccessToken(session.accessToken)
    : null;
  return {
    uid: session.user.id,
    name: session.user.name,
    email: session.user.email,
    client,
    error: session.error,
  };
}
