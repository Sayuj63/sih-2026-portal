import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCollege } from "@/lib/college";
import { OtpVerifySchema, requireCollegeEmail, ValidationError } from "@/lib/validation";
import { verifyOtp } from "@/lib/otp";
import { audit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { getStudentSession } from "@/lib/session";
import { fail, ok } from "@/lib/http";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = OtpVerifySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid request.");

  let normalizedEmail: string;
  try {
    normalizedEmail = requireCollegeEmail(parsed.data.email);
  } catch (e) {
    if (e instanceof ValidationError) return fail("BAD_EMAIL", e.message);
    return fail("BAD_EMAIL", "Invalid email.");
  }

  const ip = clientIp(req);
  const rl = await checkRateLimit({
    key: `otp:verify:${normalizedEmail}`,
    max: 10,
    windowSec: 15 * 60,
  });
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many attempts. Please request a new OTP.", { status: 429 });
  }

  const result = await verifyOtp(normalizedEmail, parsed.data.otp);
  if (!result.ok) {
    await audit({
      actorType: "SYSTEM",
      action: "OTP_VERIFY_FAILED",
      resource: "OtpChallenge",
      resourceId: normalizedEmail,
      reason: result.reason,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return fail("OTP_INVALID", friendlyOtp(result.reason));
  }

  const college = await getCollege();
  const student = await prisma.student.findUnique({
    where: { collegeId_normalizedEmail: { collegeId: college.id, normalizedEmail } },
    select: { id: true, isActive: true, fullName: true },
  });
  if (!student || !student.isActive) {
    // Rare — OTP was issued only when the account existed. Treat as generic failure.
    return fail("OTP_INVALID", "Could not verify. Please contact SPOC.");
  }

  const session = await getStudentSession();
  session.studentId = student.id;
  session.email = normalizedEmail;
  await session.save();

  await audit({
    actorType: "STUDENT",
    actorId: student.id,
    action: "STUDENT_LOGIN",
    resource: "Student",
    resourceId: student.id,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  return ok({ studentId: student.id, name: student.fullName });
}

function friendlyOtp(reason: "NOT_FOUND" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "MISMATCH"): string {
  switch (reason) {
    case "NOT_FOUND":         return "No pending code for this email. Request a new one.";
    case "EXPIRED":           return "OTP expired. Request a new one.";
    case "TOO_MANY_ATTEMPTS": return "Too many wrong attempts. Request a new OTP.";
    case "MISMATCH":          return "Incorrect OTP.";
  }
}
