import crypto from "node:crypto";
import { prisma } from "./db";

// Human-friendly, unpredictable, and cheap. Retries on collision.
export async function generateTeamCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const suffix = crypto.randomInt(1000, 10000).toString();
    const code = `ISU-SIH-${suffix}`;
    const exists = await prisma.team.findUnique({ where: { teamCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  // Extremely unlikely.
  throw new Error("Could not allocate a unique team code.");
}
