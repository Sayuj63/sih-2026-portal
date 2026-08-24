// Uniform JSON error/response helpers. Never returns raw exceptions to the client.

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data }, init);
}

export function fail(code: string, message: string, init?: ResponseInit): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status: init?.status ?? 400, ...init },
  );
}

export function unauthorized(msg = "Not signed in."): Response {
  return fail("UNAUTHORIZED", msg, { status: 401 });
}

export function forbidden(msg = "Not allowed."): Response {
  return fail("FORBIDDEN", msg, { status: 403 });
}

// Return 404 instead of 403 for authenticated-but-not-owned resources (§54 privacy-preserving IDOR).
export function notFound(msg = "Not found."): Response {
  return fail("NOT_FOUND", msg, { status: 404 });
}
