import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getT } from "@/i18n/server";
import { getViewer } from "@/lib/auth";
import { buildReport } from "@/lib/pdf/build-report";
import { registerFonts } from "@/lib/pdf/fonts";
import { HaccpReport } from "@/lib/pdf/haccp-report";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (viewer.kind !== "owner") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams;
  const locationId = q.get("location") ?? "";
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (!DATE.test(from) || !DATE.test(to) || !(days >= 0 && days <= 93)) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: location } = await supabase
    .from("locations")
    .select("id, name, address, timezone")
    .eq("id", locationId)
    .maybeSingle();
  if (!location) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const t = await getT();
  const locale = await getLocale();
  const data = await buildReport(supabase, t, locale, {
    company: { name: viewer.company.name, ico: viewer.company.ico, address: viewer.company.address },
    location,
    from,
    to,
    now: new Date(),
  });

  registerFonts();
  const pdf = await renderToBuffer(<HaccpReport data={data} t={t} />);
  const filename = `haccp-${location.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-${from}-${to}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
