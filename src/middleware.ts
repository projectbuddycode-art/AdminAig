import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { TEMPORARY_COOKIE } from "@/lib/temporary-access";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const temporary = request.cookies.get(TEMPORARY_COOKIE)?.value === "1";
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const signedIn = Boolean(token) || temporary;

  if (!signedIn && !isLogin && (pathname.startsWith("/api/admin") || !pathname.startsWith("/api/"))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/v1|api/health).*)"],
};
