import { z } from "zod";
import type {
  GithubPrReviewDivergenceResult,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestMergeResult,
  GithubPullRequestRemoteSummary,
} from "../model/githubPrHub.types";

const githubPullRequestRemoteSummarySchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  htmlUrl: z.string(),
  userLogin: z.string().nullable(),
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  baseRef: z.string(),
  headRef: z.string(),
  headSha: z.string(),
  draft: z.boolean(),
  mergeable: z.boolean().nullable(),
  mergeableState: z.string().nullable(),
});

const githubPullRequestDetailSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string(),
  state: z.string(),
  htmlUrl: z.string(),
  userLogin: z.string().nullable(),
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  baseRef: z.string(),
  headRef: z.string(),
  headSha: z.string(),
  draft: z.boolean(),
  mergeable: z.boolean().nullable(),
  mergeableState: z.string().nullable(),
  additions: z.number(),
  deletions: z.number(),
  changedFiles: z.number(),
  commits: z.number(),
  checksState: z.string().nullable(),
});

const githubPullRequestFileSchema = z.object({
  sha: z.string(),
  filename: z.string(),
  status: z.string(),
  patch: z.string().nullable(),
  previousFilename: z.string().nullable(),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
});

const githubPullRequestMergeResultSchema = z.object({
  merged: z.boolean(),
  sha: z.string().nullable(),
  message: z.string(),
  method: z.string(),
  mergedAtMs: z.number().nullable(),
});

const githubPrReviewDivergenceResultSchema = z.object({
  id: z.number(),
  projectId: z.number(),
  name: z.string(),
  branch: z.string(),
  path: z.string(),
  createdAt: z.string(),
  hasDiverged: z.boolean(),
});

function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  throw new Error(`Invalid ${label}: ${formatSchemaError(result.error)}`);
}

export function parseGithubPullRequestRemoteSummaries(value: unknown): GithubPullRequestRemoteSummary[] {
  return parseWithSchema(
    z.array(githubPullRequestRemoteSummarySchema),
    value,
    "GitHub pull request summaries",
  );
}

export function parseGithubPullRequestDetail(value: unknown): GithubPullRequestDetail {
  return parseWithSchema(githubPullRequestDetailSchema, value, "GitHub pull request detail");
}

export function parseGithubPullRequestFiles(value: unknown): GithubPullRequestFile[] {
  return parseWithSchema(z.array(githubPullRequestFileSchema), value, "GitHub pull request files");
}

export function parseGithubPullRequestMergeResult(value: unknown): GithubPullRequestMergeResult {
  return parseWithSchema(
    githubPullRequestMergeResultSchema,
    value,
    "GitHub pull request merge result",
  );
}

export function parseGithubPrReviewDivergenceResult(value: unknown): GithubPrReviewDivergenceResult {
  return parseWithSchema(
    githubPrReviewDivergenceResultSchema,
    value,
    "GitHub PR review divergence result",
  );
}
