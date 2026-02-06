import { describe, expect, it } from "vitest";
import { getImportPathMatchFromPrefix } from "../../src/lib/utils/importPathMatch";

describe("import path match utils", () => {
  it("matches from import/export forms", () => {
    expect(getImportPathMatchFromPrefix("import x from './foo")).toEqual({
      value: "./foo",
      matchLength: 5,
    });

    expect(getImportPathMatchFromPrefix("import './bar")).toEqual({
      value: "./bar",
      matchLength: 5,
    });

    expect(getImportPathMatchFromPrefix("const x = require('./baz")).toEqual({
      value: "./baz",
      matchLength: 5,
    });
  });

  it("returns null when no import path context", () => {
    expect(getImportPathMatchFromPrefix("console.log('x')")).toBeNull();
  });
});
