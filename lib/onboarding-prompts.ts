export type PromptKind = "install" | "push";

export type PromptEligibilityInput = {
  pwaInstalled: boolean;
  pushEnableClicked: boolean;
  canInstall: boolean;
  canPush: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  hasSubscription: boolean;
  isAdmin: boolean;
};

export function eligiblePrompts(input: PromptEligibilityInput): PromptKind[] {
  const prompts: PromptKind[] = [];
  if (!input.pwaInstalled && input.canInstall) prompts.push("install");
  const pushEligible =
    !input.isAdmin &&
    !input.pushEnableClicked &&
    input.canPush &&
    input.notificationPermission === "default" &&
    !input.hasSubscription;
  if (pushEligible) prompts.push("push");
  return prompts;
}

export function nextPrompt(input: PromptEligibilityInput): PromptKind | null {
  return eligiblePrompts(input)[0] ?? null;
}
