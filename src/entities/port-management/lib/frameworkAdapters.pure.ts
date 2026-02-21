export interface FrameworkAdapter {
  id: string;
  label: string;
  detectDependencies: string[];
  defaultPort: number;
  buildEnvVars: (port: number) => Record<string, string>;
}

export const FRAMEWORK_ADAPTERS: FrameworkAdapter[] = [
  {
    id: "nextjs",
    label: "Next.js",
    detectDependencies: ["next"],
    defaultPort: 3000,
    buildEnvVars: (port) => ({ PORT: String(port) }),
  },
  {
    id: "vite",
    label: "Vite",
    detectDependencies: ["vite"],
    defaultPort: 5173,
    buildEnvVars: (port) => ({ VITE_PORT: String(port), PORT: String(port) }),
  },
  {
    id: "cra",
    label: "Create React App",
    detectDependencies: ["react-scripts"],
    defaultPort: 3000,
    buildEnvVars: (port) => ({ PORT: String(port) }),
  },
  {
    id: "nuxt",
    label: "Nuxt",
    detectDependencies: ["nuxt"],
    defaultPort: 3000,
    buildEnvVars: (port) => ({ PORT: String(port), NUXT_PORT: String(port) }),
  },
  {
    id: "remix",
    label: "Remix",
    detectDependencies: ["@remix-run/dev"],
    defaultPort: 3000,
    buildEnvVars: (port) => ({ PORT: String(port) }),
  },
  {
    id: "astro",
    label: "Astro",
    detectDependencies: ["astro"],
    defaultPort: 4321,
    buildEnvVars: (port) => ({ PORT: String(port) }),
  },
  {
    id: "angular",
    label: "Angular",
    detectDependencies: ["@angular/cli"],
    defaultPort: 4200,
    buildEnvVars: (port) => ({ PORT: String(port) }),
  },
  {
    id: "sveltekit",
    label: "SvelteKit",
    detectDependencies: ["@sveltejs/kit"],
    defaultPort: 5173,
    buildEnvVars: (port) => ({ PORT: String(port) }),
  },
];

export function detectFrameworkFromDependencies(
  deps: Record<string, string>,
  devDeps: Record<string, string>,
): FrameworkAdapter | null {
  const allDeps = { ...deps, ...devDeps };
  for (const adapter of FRAMEWORK_ADAPTERS) {
    if (adapter.detectDependencies.some((dep) => dep in allDeps)) {
      return adapter;
    }
  }
  return null;
}

export function buildPortEnvVars(
  port: number,
  frameworkId: string | null,
  proxyHostname: string | null,
): Record<string, string> {
  const adapter = frameworkId ? getAdapterById(frameworkId) : null;
  const frameworkEnv = adapter?.buildEnvVars(port) ?? {};

  return {
    PORT: String(port),
    DIVERGENCE_PORT: String(port),
    ...frameworkEnv,
    ...(proxyHostname ? { DIVERGENCE_PROXY_URL: `http://${proxyHostname}` } : {}),
  };
}

export function getAdapterById(id: string): FrameworkAdapter | null {
  return FRAMEWORK_ADAPTERS.find((a) => a.id === id) ?? null;
}

export function getAdapterLabels(): Array<{ id: string; label: string }> {
  return FRAMEWORK_ADAPTERS.map((a) => ({ id: a.id, label: a.label }));
}
