import { describe, expect, it } from "vitest";
import { fuzzyMatch, fuzzyMatchPath } from "./fuzzyMatch.pure";

describe("fuzzyMatch.pure", () => {
  describe("fuzzyMatch", () => {
    it("matches exact strings with a higher score than scattered matches", () => {
      const exact = fuzzyMatch("abc", "abc");
      const scattered = fuzzyMatch("abc", "aXbXc");

      expect(exact.match).toBe(true);
      expect(exact.matchedIndices).toEqual([0, 1, 2]);
      expect(exact.score).toBeGreaterThan(scattered.score);
    });

    it("supports non-contiguous sequential matches", () => {
      expect(fuzzyMatch("abc", "aXbXc")).toEqual({
        match: true,
        score: expect.any(Number),
        matchedIndices: [0, 2, 4],
      });
    });

    it("returns no match when the query is longer than the target", () => {
      expect(fuzzyMatch("abc", "ab")).toEqual({
        match: false,
        score: 0,
        matchedIndices: [],
      });
    });

    it("treats an empty query as a match with zero score", () => {
      expect(fuzzyMatch("", "anything")).toEqual({
        match: true,
        score: 0,
        matchedIndices: [],
      });
    });

    it("matches case-insensitively", () => {
      expect(fuzzyMatch("abc", "ABC")).toEqual({
        match: true,
        score: expect.any(Number),
        matchedIndices: [0, 1, 2],
      });
    });

    it("rewards camel-case and separator word boundaries", () => {
      const camelCase = fuzzyMatch("cc", "CommandCenter");
      const hyphen = fuzzyMatch("fs", "file-service");
      const underscore = fuzzyMatch("ap", "app_settings");

      expect(camelCase.match).toBe(true);
      expect(camelCase.matchedIndices).toEqual([0, 7]);
      expect(camelCase.score).toBeGreaterThan(fuzzyMatch("cc", "codecamp").score);

      expect(hyphen.match).toBe(true);
      expect(hyphen.matchedIndices).toEqual([0, 5]);

      expect(underscore.match).toBe(true);
      expect(underscore.matchedIndices).toEqual([0, 1]);
    });

    it("supports multi-word fuzzy queries", () => {
      const commandCenter = fuzzyMatch("cmd center", "CommandCenter");
      const appSettings = fuzzyMatch("app pure", "appSettings.pure.ts");

      expect(commandCenter.match).toBe(true);
      expect(commandCenter.matchedIndices).toEqual([0, 2, 6, 7, 8, 9, 10, 11, 12]);

      expect(appSettings.match).toBe(true);
      expect(appSettings.matchedIndices).toEqual([0, 1, 2, 12, 13, 14, 15]);
    });
  });

  describe("fuzzyMatchPath", () => {
    it("prefers filename matches and returns filename-relative indices", () => {
      const result = fuzzyMatchPath("idx", "src/components/index.ts");

      expect(result.match).toBe(true);
      expect(result.matchedIndices).toEqual([0, 2, 4]);
      expect(result.score).toBeGreaterThan(fuzzyMatch("idx", "index.ts").score);
    });

    it("falls back to the full path when the filename does not match", () => {
      const result = fuzzyMatchPath("cmp", "src/components/index.ts");

      expect(result.match).toBe(true);
      expect(result.matchedIndices).toEqual([2, 6, 7]);
    });

    it("prefers shorter paths for equal filename matches", () => {
      const shortPath = fuzzyMatchPath("main", "src/main.ts");
      const longPath = fuzzyMatchPath("main", "src/features/command-center/ui/main.ts");

      expect(shortPath.match).toBe(true);
      expect(longPath.match).toBe(true);
      expect(shortPath.score).toBeGreaterThan(longPath.score);
    });
  });
});
