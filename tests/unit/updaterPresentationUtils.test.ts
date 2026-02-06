import { describe, expect, it } from "vitest";
import { getUpdaterPresentation } from "../../src/widgets/settings-modal/lib/updaterPresentation.pure";

describe("updater presentation utils", () => {
  it("maps idle/checking states", () => {
    expect(getUpdaterPresentation("idle", null, 0, null)).toEqual({
      message: "Up to date",
      isError: false,
      showProgress: false,
      showCheckButton: true,
      showInstallButton: false,
    });

    expect(getUpdaterPresentation("checking", null, 0, null).message).toBe("Checking for updates...");
  });

  it("maps available/downloading/installed states", () => {
    expect(getUpdaterPresentation("available", "1.2.3", 0, null).showInstallButton).toBe(true);

    const downloading = getUpdaterPresentation("downloading", null, 37, null);
    expect(downloading.message).toBe("Downloading update... 37%");
    expect(downloading.showProgress).toBe(true);

    expect(getUpdaterPresentation("installed", null, 0, null).message).toBe("Update installed, restarting...");
  });

  it("maps error state", () => {
    expect(getUpdaterPresentation("error", null, 0, "No network")).toEqual({
      message: "No network",
      isError: true,
      showProgress: false,
      showCheckButton: true,
      showInstallButton: false,
    });
  });
});
