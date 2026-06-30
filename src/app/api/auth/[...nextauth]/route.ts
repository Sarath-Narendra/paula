import { handlers } from "@/auth";

// Firebase Admin (used in auth callbacks) requires the Node.js runtime.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
