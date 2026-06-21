import { cookies } from "next/headers";
import { apiFetch, type SessionUser } from "./api";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const header = cookieStore.toString();
  if (!header) return null;
  try {
    return await apiFetch<SessionUser>("/auth/me", { cookie: header });
  } catch {
    return null;
  }
}
