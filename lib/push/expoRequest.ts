type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
};

export const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export function expoPushRequest(messages: PushMessage[]): RequestInit {
  return {
    method: "POST",
    headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
    body: JSON.stringify(messages.map((message) => ({ ...message, sound: "default", priority: "high" }))),
  };
}
