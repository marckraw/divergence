import { describe, expect, it } from "vitest";
import {
  buildAttachmentInputAccept,
  getAttachmentButtonLabel,
  supportsAttachmentMimeType,
} from "./attachmentComposer.pure";

describe("attachmentComposer.pure", () => {
  it("builds an image-only accept string", () => {
    expect(buildAttachmentInputAccept(["image"])).toBe("image/*");
    expect(getAttachmentButtonLabel(["image"])).toBe("Add image");
  });

  it("builds a mixed image and pdf accept string", () => {
    expect(buildAttachmentInputAccept(["image", "pdf"])).toBe("image/*,application/pdf");
    expect(getAttachmentButtonLabel(["image", "pdf"])).toBe("Add attachment");
  });

  it("returns null when no attachment kinds are supported", () => {
    expect(buildAttachmentInputAccept([])).toBeNull();
  });

  it("matches supported attachment mime types", () => {
    expect(supportsAttachmentMimeType("image/png", ["image"])).toBe(true);
    expect(supportsAttachmentMimeType("application/pdf", ["pdf"])).toBe(true);
    expect(supportsAttachmentMimeType("application/pdf", ["image"])).toBe(false);
    expect(supportsAttachmentMimeType("text/plain", ["image", "pdf"])).toBe(false);
  });
});
