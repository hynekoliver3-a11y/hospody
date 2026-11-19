import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Optimistická kontrola přihlášení. Skutečná autorizace je v layoutu (getViewer) a v RLS.
const OWNER_AREAS = ["/admin", "/onboarding"];
const EMPLOYEE_AREAS = ["/ukoly"];

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!userId) {
    if (OWNER_AREAS.some((p) => pathname.startsWith(p))) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (EMPLOYEE_AREAS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/tablet", request.url));
    }
  }
  return response;
}

export const config = {
  matcher: [
    // vše kromě statických souborů, service workeru a veřejných stránek alergenů
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|menu/|api/cron).*)",
  ],
};
