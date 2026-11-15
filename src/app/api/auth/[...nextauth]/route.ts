import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function withConfigurationRedirect(request: NextRequest, response: Response) {
  if (response.status !== 500) return response;
  const body = await response.clone().json().catch(() => null);
  const message = body && typeof body === "object" && "message" in body ? String(body.message) : "";
  if (!message.includes("server configuration")) return response;
  console.error("[Auth] Auth.js rejected the request. Confirm AUTH_SECRET is set for this deployment.");
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", "configuration");
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  return withConfigurationRedirect(request, await handlers.GET(request));
}

export async function POST(request: NextRequest) {
  return withConfigurationRedirect(request, await handlers.POST(request));
}
