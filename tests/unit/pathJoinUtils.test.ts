import { describe, expect, it } from "vitest";
import { joinPath } from "../../src/shared/lib/pathJoin.pure";

describe("joinPath", () => {
  it("joins with forward slash separator", () => {
    expect(joinPath("/home/user", "file.txt")).toBe("/home/user/file.txt");
  });

  it("joins when parent has trailing slash", () => {
    expect(joinPath("/home/user/", "file.txt")).toBe("/home/user/file.txt");
  });

  it("returns child unchanged when it starts with /", () => {
    expect(joinPath("/home/user", "/absolute/path")).toBe("/absolute/path");
  });

  it("returns child unchanged when it starts with backslash", () => {
    expect(joinPath("C:\\Users", "\\absolute")).toBe("\\absolute");
  });

  it("uses backslash separator for Windows paths", () => {
    expect(joinPath("C:\\Users\\me", "file.txt")).toBe("C:\\Users\\me\\file.txt");
  });

  it("treats child starting with / as absolute", () => {
    expect(joinPath("/home/user", "///extra.txt")).toBe("///extra.txt");
  });

  it("returns parent unchanged when child is empty", () => {
    expect(joinPath("/home/user", "")).toBe("/home/user");
  });
});
