type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export async function sendExpoPushMessages(messages: PushMessage[]): Promise<{ tickets: ExpoTicket[]; invalidTokens: string[] }> {
  if (messages.length === 0) return { tickets: [], invalidTokens: [] };
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
    body: JSON.stringify(messages.map((message) => ({ ...message, sound: "default", priority: "high" }))),
  });
  if (!response.ok) throw new Error(`Expo Push API returned HTTP ${response.status}`);
  const payload = (await response.json()) as { data?: ExpoTicket[]; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message ?? "Expo Push API error").join("; "));
  const tickets = payload.data ?? [];
  const invalidTokens = messages.filter((_, index) => tickets[index]?.details?.error === "DeviceNotRegistered").map((message) => message.to);
  return { tickets, invalidTokens };
}
