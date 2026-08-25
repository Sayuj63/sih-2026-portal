import { getAdminSession } from "@/lib/session";
import { ok } from "@/lib/http";

export async function POST() {
  const session = await getAdminSession();
  session.destroy();
  return ok({ signedOut: true });
}
