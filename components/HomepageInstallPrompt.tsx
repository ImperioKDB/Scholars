"use client";

import { useEffect } from "react";
import { requestInstallPrompt } from "@/components/InstallAppPrompt";

type StandaloneNavigator = Navigator & { standalone?: boolean };

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as StandaloneNavigator).standalone);
}

export function HomepageInstallPrompt() {
  useEffect(() => {
    if (isStandalone()) return;
    const timer = window.setTimeout(() => {
      void requestInstallPrompt();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
