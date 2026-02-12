import { invoke } from "@tauri-apps/api/core";

interface WriteAutomationBriefResponse {
  path: string;
}

export async function writeAutomationBriefFile(
  workspacePath: string,
  markdown: string
): Promise<WriteAutomationBriefResponse> {
  return invoke<WriteAutomationBriefResponse>("write_review_brief_file", {
    workspacePath,
    markdown,
  });
}
