export interface GithubPrMergedAutomationEvent {
  eventId: string;
  externalEventId: string;
  kind: "github_pr_merged";
  repoKey: string;
  prNumber: number;
  baseRef: string;
  headRef: string;
  mergeCommitSha: string;
  htmlUrl: string;
  mergedAtMs: number;
  receivedAtMs: number;
}

interface PullAutomationEventsResponse {
  events: GithubPrMergedAutomationEvent[];
}

export interface CloudAutomationEventQueueCount {
  repoKey: string;
  baseRef: string;
  queuedCount: number;
}

interface PullAutomationEventQueueCountsResponse {
  queueCounts: CloudAutomationEventQueueCount[];
}

function buildAuthHeaders(cloudApiToken: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${cloudApiToken.trim()}`,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function assertOk(response: Response, body: string): void {
  if (response.ok) return;
  throw new Error(
    `Cloud API request failed with status ${response.status}: ${body.slice(0, 400)}`,
  );
}

export async function pullCloudAutomationEvents(input: {
  baseUrl: string;
  cloudApiToken: string;
  limit?: number;
}): Promise<GithubPrMergedAutomationEvent[]> {
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 25)));
  const url = `${normalizeBaseUrl(input.baseUrl)}/api/v1/automation-events?limit=${limit}`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders(input.cloudApiToken),
  });
  const text = await response.text();
  assertOk(response, text);

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Failed to parse cloud events response: ${error instanceof Error ? error.message : String(error)}`);
  }

  const payload = (parsed && typeof parsed === "object" && "events" in parsed)
    ? parsed as PullAutomationEventsResponse
    : { events: [] };
  return Array.isArray(payload.events) ? payload.events : [];
}

export async function ackCloudAutomationEvent(input: {
  baseUrl: string;
  cloudApiToken: string;
  eventId: string;
}): Promise<void> {
  const url = `${normalizeBaseUrl(input.baseUrl)}/api/v1/automation-events/${encodeURIComponent(input.eventId)}/ack`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(input.cloudApiToken),
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const text = await response.text();
  assertOk(response, text);
}

export async function nackCloudAutomationEvent(input: {
  baseUrl: string;
  cloudApiToken: string;
  eventId: string;
  reason: string;
}): Promise<void> {
  const url = `${normalizeBaseUrl(input.baseUrl)}/api/v1/automation-events/${encodeURIComponent(input.eventId)}/nack`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(input.cloudApiToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason: input.reason }),
  });
  const text = await response.text();
  assertOk(response, text);
}

export async function pullCloudAutomationEventQueueCounts(input: {
  baseUrl: string;
  cloudApiToken: string;
}): Promise<CloudAutomationEventQueueCount[]> {
  const url = `${normalizeBaseUrl(input.baseUrl)}/api/v1/automation-events/queue-counts`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders(input.cloudApiToken),
  });
  const text = await response.text();
  if (response.status === 404) {
    return [];
  }
  assertOk(response, text);

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Failed to parse cloud queue counts response: ${error instanceof Error ? error.message : String(error)}`);
  }

  const payload = (parsed && typeof parsed === "object" && "queueCounts" in parsed)
    ? parsed as PullAutomationEventQueueCountsResponse
    : { queueCounts: [] };
  return Array.isArray(payload.queueCounts) ? payload.queueCounts : [];
}
