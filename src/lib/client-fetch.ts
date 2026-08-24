"use client";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export async function api<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      error: body?.error ?? { code: `HTTP_${res.status}`, message: "Request failed." },
    };
  }
  return { ok: true, data: body.data as T };
}
