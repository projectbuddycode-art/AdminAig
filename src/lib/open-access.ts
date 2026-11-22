/** When true, the admin UI is reachable without signing in. Turn off for real deployments. */
export function openDashboardAccess() {
  const value = process.env.OPEN_DASHBOARD?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}
