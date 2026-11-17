import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { verifyToken } from "@/lib/auth";
import SettingsClient from "@/components/settings/SettingsClient";

export const metadata = { title: "Settings" };

/** Settings for every role: your account and preferences; the admin also runs the store from here. */
export default async function SettingsPage() {
  const token = (await cookies()).get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) redirect("/login");
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-recess" />}>
      <SettingsClient role={payload.role} />
    </Suspense>
  );
}
