"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

type MilestoneId = "welcome_tour" | "discover_tip" | "saved_tip" | "application_tip";
type Context = "dashboard" | "discover" | "applications";
type TargetRect = { top: number; left: number; width: number; height: number };

type TourStep = {
  id: string;
  title: string;
  body: string;
  target?: string;
  action: string;
};

const STORAGE_KEY = "scholars.onboarding.milestones.v1";
const MILESTONE_EVENT = "scholars:milestone";

const DASHBOARD_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Scholars",
    body: "Find verified scholarships and opportunities that fit your background, then keep every next step in one place.",
    action: "Next",
  },
  {
    id: "profile",
    title: "Start with your profile",
    body: "A few details about your course, school, and year help Scholars surface opportunities you can realistically pursue.",
    target: "profile",
    action: "Next",
  },
  {
    id: "matches",
    title: "Read your match score",
    body: "Each score is a quick signal of how closely an opportunity fits the information in your profile. Complete more fields to make it sharper.",
    target: "matches",
    action: "Next",
  },
  {
    id: "save",
    title: "Build a shortlist",
    body: "Save anything worth a closer look. Your saved opportunities stay together while you prepare documents and compare deadlines.",
    target: "save",
    action: "Next",
  },
  {
    id: "ready",
    title: "You are ready",
    body: "Complete your profile, open a match, and save one opportunity. That is the fastest way to get value from Scholars today.",
    action: "Find my opportunities",
  },
];

const CONTEXT_STEPS: Record<Context, TourStep> = {
  discover: {
    id: "discover_tip",
    title: "Explore the full catalog",
    body: "Browse every verified listing here. Your dashboard is where personalized eligibility scores and your strongest matches live.",
    target: "scholarships-list",
    action: "Got it",
  },
  applications: {
    id: "application_tip",
    title: "Keep the next step visible",
    body: "When you track an application, you can update its status, prepare materials, and return to the provider link before the deadline.",
    target: "applications-list",
    action: "Got it",
  },
  dashboard: {
    id: "saved_tip",
    title: "Your shortlist is ready",
    body: "You can find this opportunity again in Saved. Use it as your working list while you decide what to apply for.",
    target: "saved",
    action: "Got it",
  },
};

function readState(): Partial<Record<MilestoneId, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeState(state: Partial<Record<MilestoneId, boolean>>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Onboarding remains usable when storage is blocked.
  }
}

export function announceMilestone(milestone: Exclude<MilestoneId, "welcome_tour">) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MILESTONE_EVENT, { detail: milestone }));
}

function getTargetRect(target?: string): TargetRect | null {
  if (!target || typeof document === "undefined") return null;
  const element = document.querySelector(`[data-tour="${target}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function MilestoneOnboarding({ context }: { context: Context }) {
  const router = useRouter();
  const [state, setState] = useState<Partial<Record<MilestoneId, boolean>>>({});
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [contextStep, setContextStep] = useState<TourStep | null>(null);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const dashboardTour = context === "dashboard" ? DASHBOARD_STEPS : [];
  const activeStep = contextStep ?? (tourIndex === null ? null : dashboardTour[tourIndex]);
  const isDashboardTour = contextStep === null && tourIndex !== null;
  const stepCount = dashboardTour.length;

  useEffect(() => {
    const initial = readState();
    setState(initial);
    if (context === "dashboard" && !initial.welcome_tour) {
      setTourIndex(0);
    } else if (context === "discover" && !initial.discover_tip) {
      setContextStep(CONTEXT_STEPS.discover);
    }

    function handleMilestone(event: Event) {
      const milestone = (event as CustomEvent<Exclude<MilestoneId, "welcome_tour">>).detail;
      if (milestone !== "saved_tip" && milestone !== "application_tip") return;
      const latest = readState();
      if (latest[milestone] || (context === "dashboard" && tourIndex !== null)) return;
      setContextStep(CONTEXT_STEPS[context]);
    }

    window.addEventListener(MILESTONE_EVENT, handleMilestone);
    return () => window.removeEventListener(MILESTONE_EVENT, handleMilestone);
    // The listener intentionally reads the state at event time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  useEffect(() => {
    if (!activeStep) {
      setTargetRect(null);
      return;
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTargetRect(getTargetRect(activeStep.target)));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeStep]);

  useEffect(() => {
    if (!activeStep) return;
    const index = isDashboardTour ? tourIndex ?? 0 : 0;
    track("onboarding_step_viewed", { step: index, label: activeStep.id, path: "milestone" });
  }, [activeStep, isDashboardTour, tourIndex]);

  const tooltipStyle = useMemo(() => {
    if (!targetRect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } as const;
    }
    const cardHeight = 220;
    const top = targetRect.top + targetRect.height + 18 + cardHeight < window.innerHeight
      ? targetRect.top + targetRect.height + 18
      : Math.max(18, targetRect.top - cardHeight - 18);
    const left = Math.min(Math.max(16, targetRect.left), Math.max(16, window.innerWidth - 380));
    return { top, left } as const;
  }, [targetRect]);

  if (!activeStep) return null;

  function finishContextStep() {
    const id = activeStep?.id;
    if (!id || id === "welcome" || id === "profile" || id === "matches" || id === "save" || id === "ready") return;
    const next = { ...state, [id]: true };
    setState(next);
    writeState(next);
    setContextStep(null);
    track("onboarding_step_completed", { step: 0, label: id, path: "milestone" });
  }

  function finishDashboardTour() {
    const next = { ...state, welcome_tour: true };
    setState(next);
    writeState(next);
    setTourIndex(null);
    track("onboarding_step_completed", { step: tourIndex ?? 0, label: activeStep?.id ?? "ready", path: "milestone" });
    if (activeStep?.id === "ready") router.push("/discover");
  }

  function next() {
    if (contextStep) {
      finishContextStep();
      return;
    }
    if (tourIndex === null) return;
    if (tourIndex >= stepCount - 1) {
      finishDashboardTour();
      return;
    }
    track("onboarding_step_completed", { step: tourIndex, label: activeStep?.id ?? "unknown", path: "milestone" });
    setTourIndex((index) => (index === null ? null : index + 1));
  }

  function skip() {
    const nextState = { ...state, welcome_tour: true };
    setState(nextState);
    writeState(nextState);
    setTourIndex(null);
    track("onboarding_abandoned", { step: tourIndex ?? 0, label: activeStep?.id ?? "unknown", reason: "skip_milestone_tour" });
  }

  const spotlightStyle = targetRect
    ? { top: targetRect.top - 8, left: targetRect.left - 8, width: targetRect.width + 16, height: targetRect.height + 16 }
    : undefined;

  return (
    <div className="fixed inset-0 z-[90]" role="presentation">
      <div className="absolute inset-0 bg-navy/70" aria-hidden="true" />
      {spotlightStyle && <div className="absolute rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(11,30,61,0.7)]" style={spotlightStyle} aria-hidden="true" />}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-onboarding-title"
        className="absolute w-[calc(100%-2rem)] max-w-[360px] rounded-2xl border border-white/20 bg-white p-5 text-ink shadow-2xl"
        style={tooltipStyle}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {isDashboardTour && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald">{(tourIndex ?? 0) + 1} of {stepCount}</p>}
            <h2 id="milestone-onboarding-title" className="font-display text-xl font-semibold leading-tight text-navy">{activeStep.title}</h2>
          </div>
          {isDashboardTour && <button type="button" onClick={skip} className="min-h-[44px] shrink-0 px-1 text-xs font-medium text-navy-light underline underline-offset-2">Skip tour</button>}
        </div>
        <p className="text-sm leading-6 text-navy-light">{activeStep.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          {!isDashboardTour ? <span className="text-xs text-navy-light">You can revisit this anytime.</span> : <span />}
          <button type="button" onClick={next} className="inline-flex min-h-[44px] items-center justify-center rounded-seal bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-light">{activeStep.action}</button>
        </div>
      </div>
    </div>
  );
}
