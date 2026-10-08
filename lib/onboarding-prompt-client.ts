export type PromptState = {
  pwaInstalledAt: string | null;
  pushEnableClickedAt: string | null;
};

export async function getPromptState(): Promise<PromptState | null> {
  const response = await fetch("/api/onboarding/prompts", { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<PromptState>;
}

export async function recordPromptAction(action: "pwa_installed" | "push_enable_clicked"): Promise<boolean> {
  try {
    const response = await fetch("/api/onboarding/prompts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
