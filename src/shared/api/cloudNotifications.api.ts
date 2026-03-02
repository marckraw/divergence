function buildAuthHeaders(cloudApiToken: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
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

export interface PostNotificationInput {
  baseUrl: string;
  cloudApiToken: string;
  kind: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

export interface PostNotificationResult {
  notificationId: string;
  sent: number;
  failed: number;
}

/**
 * POST /api/v1/notifications
 *
 * Creates a notification in the cloud and dispatches it to all
 * registered mobile devices via Expo Push API.
 */
export async function postCloudNotification(
  input: PostNotificationInput,
): Promise<PostNotificationResult> {
  const url = `${normalizeBaseUrl(input.baseUrl)}/api/v1/notifications`;
  const response = await fetch(url, {
    method: "POST",
    headers: buildAuthHeaders(input.cloudApiToken),
    body: JSON.stringify({
      kind: input.kind,
      title: input.title,
      body: input.body,
      payload: input.payload,
    }),
  });
  const text = await response.text();
  assertOk(response, text);

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(
      `Failed to parse notification response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = parsed as PostNotificationResult;
  return {
    notificationId: result.notificationId ?? "",
    sent: result.sent ?? 0,
    failed: result.failed ?? 0,
  };
}

/**
 * POST /api/v1/device-tokens
 *
 * Mints a device-scoped credential for a mobile device during pairing.
 * Called by Desktop only — requires server-grade CLOUD_API_TOKENS.
 */
export async function mintCloudDeviceToken(input: {
  baseUrl: string;
  cloudApiToken: string;
  deviceName: string;
}): Promise<string> {
  const url = `${normalizeBaseUrl(input.baseUrl)}/api/v1/device-tokens`;
  const response = await fetch(url, {
    method: "POST",
    headers: buildAuthHeaders(input.cloudApiToken),
    body: JSON.stringify({ deviceName: input.deviceName }),
  });
  const text = await response.text();
  assertOk(response, text);

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(
      `Failed to parse device token response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = parsed as { deviceToken: string };
  if (!result.deviceToken) {
    throw new Error("No device token returned from cloud");
  }
  return result.deviceToken;
}
