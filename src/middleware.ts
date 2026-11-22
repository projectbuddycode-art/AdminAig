import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function authSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

function secureSessionCookie(request: NextRequest) {
  return (
    request.nextUrl.protocol === "https:" ||
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const secret = authSecret();

  const token = secret
    ? await getToken({
        req: request,
        secret,
        secureCookie: secureSessionCookie(request),
      })
    : null;

  if (!token && !isLogin && (pathname.startsWith("/api/admin") || !pathname.startsWith("/api/"))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (token && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/v1|api/health).*)"],
};
