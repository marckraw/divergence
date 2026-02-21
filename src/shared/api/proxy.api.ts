const CADDY_ADMIN_BASE = "http://localhost:2019";
const CADDY_ROUTES_PATH = "/config/apps/http/servers/divergence/routes";

interface CaddyRoute {
  match?: Array<{ host?: string[] }>;
  handle?: Array<{ handler: string; upstreams?: Array<{ dial: string }> }>;
}

export async function isCaddyRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${CADDY_ADMIN_BASE}/config/`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function addProxyRoute(hostname: string, targetPort: number): Promise<void> {
  const route: CaddyRoute = {
    match: [{ host: [hostname] }],
    handle: [
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: `localhost:${targetPort}` }],
      },
    ],
  };

  const response = await fetch(`${CADDY_ADMIN_BASE}${CADDY_ROUTES_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(route),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to add Caddy route: ${response.status} ${text}`);
  }
}

export async function removeProxyRoute(hostname: string): Promise<void> {
  const response = await fetch(`${CADDY_ADMIN_BASE}${CADDY_ROUTES_PATH}`);
  if (!response.ok) {
    return;
  }

  const routes: CaddyRoute[] = await response.json();
  const index = routes.findIndex(
    (r) => r.match?.some((m) => m.host?.includes(hostname)),
  );

  if (index === -1) {
    return;
  }

  const deleteResponse = await fetch(
    `${CADDY_ADMIN_BASE}${CADDY_ROUTES_PATH}/${index}`,
    { method: "DELETE" },
  );

  if (!deleteResponse.ok) {
    const text = await deleteResponse.text();
    throw new Error(`Failed to remove Caddy route: ${deleteResponse.status} ${text}`);
  }
}
