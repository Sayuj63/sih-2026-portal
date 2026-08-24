import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";
import { OtpRequestSchema, requireCollegeEmail, ValidationError } from "@/lib/validation";
import { issueOtp } from "@/lib/otp";
import { audit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { config } from "@/lib/config";
import { fail, ok } from "@/lib/http";

// POST /api/auth/student/otp — sends a 6-digit code to a college email.
export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  const parsed = OtpRequestSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid request.");

  let normalizedEmail: string;
  try {
    normalizedEmail = requireCollegeEmail(parsed.data.email);
  } catch (e) {
    if (e instanceof ValidationError) return fail("BAD_EMAIL", e.message);
    return fail("BAD_EMAIL", "Invalid email.");
  }

  const ip = clientIp(req);
  const emailBucket = await checkRateLimit({
    key: `otp:req:email:${normalizedEmail}`,
    max: 5,
    windowSec: 15 * 60,
  });
  if (!emailBucket.allowed) {
    return fail("RATE_LIMITED", "Too many OTP requests. Try again shortly.", { status: 429 });
  }
  const ipBucket = await checkRateLimit({
    key: `otp:req:ip:${ip}`,
    max: 30,
    windowSec: 15 * 60,
  });
  if (!ipBucket.allowed) {
    return fail("RATE_LIMITED", "Too many OTP requests from this network. Try again shortly.", { status: 429 });
  }

  const college = await getCollege();
  const student = await prisma.student.findUnique({
    where: { collegeId_normalizedEmail: { collegeId: college.id, normalizedEmail } },
    select: { id: true, isActive: true },
  });

  // Anti-enumeration (§86): behave the same whether the email exists or not.
  let devOtp: string | undefined;
  if (student && student.isActive) {
    const { otp, expiresAt } = await issueOtp(normalizedEmail);
    if (config.otp.devEcho) {
      console.log(`[DEV] OTP for ${normalizedEmail}: ${otp} (expires ${expiresAt.toISOString()})`);
      // Demo mode surfaces the code to the client. Set DEV_ECHO_OTP=false in a real deployment.
      devOtp = otp;
    } else if (config.smtp.url) {
      // Real SMTP would go here.
    }
    await audit({
      actorType: "SYSTEM",
      action: "OTP_ISSUED",
      resource: "OtpChallenge",
      resourceId: normalizedEmail,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
  }

  return ok({ sent: true, ttlSec: config.otp.ttlSec, ...(devOtp ? { devOtp } : {}) });
}

async function safeJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
