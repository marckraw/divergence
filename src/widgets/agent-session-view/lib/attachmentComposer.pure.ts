import type { AgentRuntimeAttachmentKind } from "../../../shared";

export function buildAttachmentInputAccept(
  attachmentKinds: AgentRuntimeAttachmentKind[]
): string | null {
  const accepts: string[] = [];
  if (attachmentKinds.includes("image")) {
    accepts.push("image/*");
  }
  if (attachmentKinds.includes("pdf")) {
    accepts.push("application/pdf");
  }
  return accepts.length > 0 ? accepts.join(",") : null;
}

export function getAttachmentButtonLabel(
  attachmentKinds: AgentRuntimeAttachmentKind[]
): string {
  if (attachmentKinds.includes("image") && attachmentKinds.includes("pdf")) {
    return "Add attachment";
  }
  if (attachmentKinds.includes("pdf")) {
    return "Add PDF";
  }
  return "Add image";
}

export function supportsAttachmentMimeType(
  mimeType: string,
  attachmentKinds: AgentRuntimeAttachmentKind[]
): boolean {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (!normalizedMimeType) {
    return false;
  }

  if (normalizedMimeType.startsWith("image/")) {
    return attachmentKinds.includes("image");
  }

  if (normalizedMimeType === "application/pdf") {
    return attachmentKinds.includes("pdf");
  }

  return false;
}
