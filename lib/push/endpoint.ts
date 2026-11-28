export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "fcm.googleapis.com" ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host === "push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host === "notify.windows.com" ||
      host.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}
