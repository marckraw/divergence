import { invoke } from "@tauri-apps/api/core";

interface WriteReviewBriefResponse {
  path: string;
}

export async function writeReviewBriefFile(
  workspacePath: string,
  markdown: string
): Promise<WriteReviewBriefResponse> {
  return invoke<WriteReviewBriefResponse>("write_review_brief_file", {
    workspacePath,
    markdown,
  });
}
