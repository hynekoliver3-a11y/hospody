import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { AllergenTable } from "@/lib/pdf/allergen-table";
import { registerFonts } from "@/lib/pdf/fonts";
import { getPublicMenu } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (viewer.kind !== "owner") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: location } = await supabase
    .from("locations")
    .select("id, public_slug")
    .eq("id", request.nextUrl.searchParams.get("location") ?? "")
    .maybeSingle();
  if (!location) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const menu = await getPublicMenu(location.public_slug);
  if (!menu) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const url = `${publicEnv.siteUrl()}/menu/${location.public_slug}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 300 });

  registerFonts();
  const t = await getT();
  const pdf = await renderToBuffer(<AllergenTable menu={menu} t={t} qrDataUrl={qrDataUrl} url={url} />);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="alergeny-${location.public_slug}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
