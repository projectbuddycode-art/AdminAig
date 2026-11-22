import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const configurationError =
    params.error === "configuration" || params.error === "Configuration"
      ? "Sign-in is not configured. Add AUTH_SECRET in Vercel, set AUTH_URL to this site's https address, and redeploy."
      : null;
  const callbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/";
  return <LoginForm configurationError={configurationError} callbackUrl={callbackUrl} />;
}
