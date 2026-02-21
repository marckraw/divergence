---
"divergence": minor
---

feat(port-management): automatic port allocation, framework detection, and reverse proxy support for divergences

Divergences now get automatic dev server port allocation (range 3100-3999) on creation, with framework-specific ENV injection (PORT, DIVERGENCE_PORT, VITE_PORT, etc.) into terminal sessions. Supports Next.js, Vite, CRA, Nuxt, Remix, Astro, Angular, and SvelteKit via an extensible adapter registry. Includes a Caddy reverse proxy API for friendly URLs like `feature-branch.myproject.divergence.localhost`, a port dashboard in the work sidebar, project-level port/framework settings, and a Rust TCP port availability check command.
