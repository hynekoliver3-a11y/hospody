import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEVICE_COOKIE = "haccp_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function setDeviceCookie(token: string) {
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export interface PairedDevice {
  id: string;
  company_id: string;
  location_id: string;
  name: string;
  location: { name: string; timezone: string };
}

/** Spárovaný tablet podle cookie (ověřeno service rolí – cookie je jediný důkaz). */
export async function getPairedDevice(): Promise<PairedDevice | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("devices")
    .select("id, company_id, location_id, name, revoked_at, locations(name, timezone)")
    .eq("token_hash", hashToken(token))
    .maybeSingle<{
      id: string;
      company_id: string;
      location_id: string;
      name: string;
      revoked_at: string | null;
      locations: { name: string; timezone: string };
    }>();
  if (!data || data.revoked_at) return null;
  return {
    id: data.id,
    company_id: data.company_id,
    location_id: data.location_id,
    name: data.name,
    location: data.locations,
  };
}

export async function touchDevice(deviceId: string) {
  await createAdminClient().from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", deviceId);
}
