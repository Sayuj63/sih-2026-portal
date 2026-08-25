import { NextRequest } from "next/server";
import { verify } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";
import { AdminLoginSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { getAdminSession } from "@/lib/session";
import { fail, ok } from "@/lib/http";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = AdminLoginSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid credentials format.");

  const ip = clientIp(req);
  const rl = await checkRateLimit({
    key: `admin:login:${parsed.data.username}:${ip}`,
    max: 10,
    windowSec: 15 * 60,
  });
  if (!rl.allowed) return fail("RATE_LIMITED", "Too many attempts. Try again shortly.", { status: 429 });

  const college = await getCollege();
  const admin = await prisma.admin.findUnique({
    where: { collegeId_username: { collegeId: college.id, username: parsed.data.username } },
  });

  // Constant-work path — always attempt to verify to reduce timing side-channel.
  const passwordOk = admin
    ? await verify(admin.passwordHash, parsed.data.password).catch(() => false)
    : await verify(
        "$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$Zn9UGV3LMkGvI4y2ntZ4B5B8Kb2VXfDXhAqOaW/6qGY",
        parsed.data.password,
      ).catch(() => false);

  if (!admin || !admin.isActive || !passwordOk) {
    await audit({
      actorType: "SYSTEM",
      action: "ADMIN_LOGIN_FAILED",
      resource: "Admin",
      resourceId: parsed.data.username,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return fail("BAD_CREDENTIALS", "Invalid username or password.", { status: 401 });
  }

  const session = await getAdminSession();
  session.adminId = admin.id;
  session.username = admin.username;
  session.role = admin.role as "SUPER_ADMIN" | "SPOC_ADMIN" | "REVIEWER" | "READ_ONLY";
  await session.save();

  await audit({
    actorType: "ADMIN",
    adminId: admin.id,
    action: "ADMIN_LOGIN",
    resource: "Admin",
    resourceId: admin.id,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  return ok({ role: admin.role, name: admin.fullName });
}
