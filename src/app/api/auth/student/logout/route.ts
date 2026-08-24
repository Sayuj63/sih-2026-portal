import { getStudentSession } from "@/lib/session";
import { ok } from "@/lib/http";

export async function POST() {
  const session = await getStudentSession();
  session.destroy();
  return ok({ signedOut: true });
}
