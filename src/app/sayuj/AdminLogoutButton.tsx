"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { api } from "@/lib/client-fetch";

export function AdminLogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      className="!py-1.5 !px-3 text-sm"
      onClick={async () => {
        await api("/api/auth/sayuj/logout", { method: "POST" });
        router.push("/sayuj/login");
        router.refresh();
      }}
    >Sign out</Button>
  );
}
