"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { api } from "@/lib/client-fetch";

export function LogoutButton() {
  const router = useRouter();
  async function signOut() {
    await api("/api/auth/student/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <Button variant="secondary" onClick={signOut} className="!py-1.5 !px-3 text-sm">Sign out</Button>
  );
}
