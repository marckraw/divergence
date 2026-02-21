import { describe, it, expect } from "vitest";
import {
  detectFrameworkFromDependencies,
  buildPortEnvVars,
  getAdapterById,
  getAdapterLabels,
  FRAMEWORK_ADAPTERS,
} from "./frameworkAdapters.pure";

describe("frameworkAdapters", () => {
  describe("detectFrameworkFromDependencies", () => {
    it("detects Next.js from dependencies", () => {
      const result = detectFrameworkFromDependencies({ next: "14.0.0", react: "18.0.0" }, {});
      expect(result?.id).toBe("nextjs");
    });

    it("detects Vite from devDependencies", () => {
      const result = detectFrameworkFromDependencies({}, { vite: "5.0.0" });
      expect(result?.id).toBe("vite");
    });

    it("detects CRA from react-scripts", () => {
      const result = detectFrameworkFromDependencies({ "react-scripts": "5.0.0" }, {});
      expect(result?.id).toBe("cra");
    });

    it("detects Nuxt", () => {
      const result = detectFrameworkFromDependencies({ nuxt: "3.0.0" }, {});
      expect(result?.id).toBe("nuxt");
    });

    it("detects Remix", () => {
      const result = detectFrameworkFromDependencies({}, { "@remix-run/dev": "2.0.0" });
      expect(result?.id).toBe("remix");
    });

    it("detects Astro", () => {
      const result = detectFrameworkFromDependencies({}, { astro: "4.0.0" });
      expect(result?.id).toBe("astro");
    });

    it("detects Angular", () => {
      const result = detectFrameworkFromDependencies({}, { "@angular/cli": "17.0.0" });
      expect(result?.id).toBe("angular");
    });

    it("detects SvelteKit", () => {
      const result = detectFrameworkFromDependencies({}, { "@sveltejs/kit": "2.0.0" });
      expect(result?.id).toBe("sveltekit");
    });

    it("returns null for unknown dependencies", () => {
      const result = detectFrameworkFromDependencies({ express: "4.0.0" }, {});
      expect(result).toBeNull();
    });

    it("returns null for empty dependencies", () => {
      const result = detectFrameworkFromDependencies({}, {});
      expect(result).toBeNull();
    });

    it("returns first matching adapter when multiple match", () => {
      const result = detectFrameworkFromDependencies(
        { next: "14.0.0" },
        { vite: "5.0.0" },
      );
      expect(result?.id).toBe("nextjs");
    });
  });

  describe("buildPortEnvVars", () => {
    it("returns base env vars without framework", () => {
      const result = buildPortEnvVars(3100, null, null);
      expect(result).toEqual({
        PORT: "3100",
        DIVERGENCE_PORT: "3100",
      });
    });

    it("includes framework-specific env vars for Next.js", () => {
      const result = buildPortEnvVars(3100, "nextjs", null);
      expect(result).toEqual({
        PORT: "3100",
        DIVERGENCE_PORT: "3100",
      });
    });

    it("includes framework-specific env vars for Vite", () => {
      const result = buildPortEnvVars(5200, "vite", null);
      expect(result).toEqual({
        PORT: "5200",
        DIVERGENCE_PORT: "5200",
        VITE_PORT: "5200",
      });
    });

    it("includes proxy URL when hostname is provided", () => {
      const result = buildPortEnvVars(3100, "nextjs", "feature.myproject.divergence.localhost");
      expect(result).toEqual({
        PORT: "3100",
        DIVERGENCE_PORT: "3100",
        DIVERGENCE_PROXY_URL: "http://feature.myproject.divergence.localhost",
      });
    });

    it("handles unknown framework id gracefully", () => {
      const result = buildPortEnvVars(3100, "unknown-framework", null);
      expect(result).toEqual({
        PORT: "3100",
        DIVERGENCE_PORT: "3100",
      });
    });
  });

  describe("getAdapterById", () => {
    it("returns adapter for known id", () => {
      const adapter = getAdapterById("nextjs");
      expect(adapter?.label).toBe("Next.js");
    });

    it("returns null for unknown id", () => {
      expect(getAdapterById("unknown")).toBeNull();
    });
  });

  describe("getAdapterLabels", () => {
    it("returns all adapter labels", () => {
      const labels = getAdapterLabels();
      expect(labels.length).toBe(FRAMEWORK_ADAPTERS.length);
      expect(labels[0]).toEqual({ id: "nextjs", label: "Next.js" });
    });
  });
});
