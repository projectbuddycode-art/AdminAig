import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const configurationError =
    params.error === "configuration" || params.error === "Configuration"
      ? "Sign-in is not configured. Add AUTH_SECRET in Vercel, set AUTH_URL to this site's https address, and redeploy."
      : null;
  return <LoginForm configurationError={configurationError} />;
}
