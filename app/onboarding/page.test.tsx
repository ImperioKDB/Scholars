import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import OnboardingPage from "./page";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
const pushMock = vi.fn();
const replaceMock = vi.fn();
const refreshMock = vi.fn();
const searchParamsGetMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => ({
    get: searchParamsGetMock,
  }),
}));

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const authGetUserMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: authGetUserMock,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock fetch for /api/profile and /api/profile/waec
// ---------------------------------------------------------------------------
const fetchMock = vi.fn();

let stepParam: string | null = null;
let failPostProfileCount = 0;

// A deferred promise so a retry request can be held pending for in-flight tests.
let deferredResolve: ((value: any) => void) | null = null;
let deferredReject: ((reason?: any) => void) | null = null;

beforeEach(() => {
  stepParam = null;
  failPostProfileCount = 0;
  deferredResolve = null;
  deferredReject = null;
  vi.stubGlobal("fetch", fetchMock);
  vi.resetAllMocks();
  authGetUserMock.mockResolvedValue({
    data: { user: { id: "test-user-id" } },
    error: null,
  });
  fetchMock.mockImplementation((url: string, init?: any) => {
    const isPost = init?.method === "POST";
    if (url === "/api/profile" && isPost) {
      // If a deferred retry is in flight, hold it pending until resolved.
      if (deferredResolve) {
        return new Promise((resolve, reject) => {
          deferredResolve = resolve;
          deferredReject = reject;
        });
      }
      if (failPostProfileCount > 0) {
        failPostProfileCount--;
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }
    if (url === "/api/profile/waec" && isPost) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }
    if (url === "/api/profile" && !isPost) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ profile: {} }) });
    }
    if (url === "/api/profile/waec" && !isPost) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ results: [] }) });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  searchParamsGetMock.mockImplementation((key: string) => {
    if (key === "step") return stepParam;
    if (key === "next") return null;
    return null;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  deferredResolve = null;
  deferredReject = null;
});

async function fillStep0AndSubmit() {
  fireEvent.change(screen.getByPlaceholderText("Enter your full name"), {
    target: { value: "Test User" },
  });
  fireEvent.focus(screen.getByPlaceholderText("Search your university, polytechnic, or college"));
  await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
  // Click the button element inside the option li (Combobox renders buttons inside li.role="option")
  const institutionButtons = screen.getAllByRole("button", { name: /Federal University/ });
  fireEvent.click(institutionButtons[0]);
  const yearSelect = screen.getByLabelText("Year of study");
  fireEvent.change(yearSelect, { target: { value: "100" } });
  const provisionalButton = screen.getByRole("button", { name: /See my provisional matches/ }) as HTMLButtonElement;
  await waitFor(() => expect(provisionalButton.disabled).toBe(false));
  await act(async () => {
    fireEvent.click(provisionalButton);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function clickMatchingAuthorizedCheckbox() {
  const checkbox = screen.getByRole("checkbox", { name: /authorize Scholars to use the information/ });
  fireEvent.click(checkbox);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function countPostProfileCalls() {
  return fetchMock.mock.calls.filter(
    (args) => args[0] === "/api/profile" && args[1]?.method === "POST"
  ).length;
}

describe("Onboarding retry behavior", () => {
  it("does not execute retry callback automatically; clicking Try again triggers second save", async () => {
    // failCount=2: tracking POST consumes 1, save POST fails with 500
    failPostProfileCount = 2;

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Core details/ });
      expect(heading).toBeTruthy();
    });

    await fillStep0AndSubmit();

    // Wait for the failed save POST call to complete
    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThanOrEqual(1);
    });

    // Callback stored, not executed automatically: count of POST /api/profile calls.
    // With failCount=2: tracking consumes 1 (fails), save consumes 1 (fails).
    // So we should see 2 POST calls total, both failing.
    const postProfileCallsBeforeRetry = countPostProfileCalls();
    expect(postProfileCallsBeforeRetry).toBeGreaterThanOrEqual(2);

    // Click the rendered Try again button
    const retryButton = screen.getByRole("button", { name: /Try again/ });
    expect(retryButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(retryButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThan(postProfileCallsBeforeRetry);
    });
  });

  it("failed profile save then successful retry navigates to dashboard", async () => {
    failPostProfileCount = 2;

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Core details/ });
      expect(heading).toBeTruthy();
    });

    await fillStep0AndSubmit();

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThanOrEqual(1);
    });

    // Click retry - should succeed now (failPostProfileCount exhausted)
    const retryButton = screen.getByRole("button", { name: /Try again/ });
    await act(async () => {
      fireEvent.click(retryButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThan(2);
    });

    // Successful retry navigates to dashboard
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    });
  });

  it("handleFinish failure then successful retry", async () => {
    stepParam = "4";
    failPostProfileCount = 2;

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Get better scholarship matches/ });
      expect(heading).toBeTruthy();
    });

    await clickMatchingAuthorizedCheckbox();

    const finishButton = screen.getByRole("button", { name: /Finish & see matches/ });
    await act(async () => {
      fireEvent.click(finishButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThanOrEqual(1);
    });

    // Click retry on handleFinish path
    const retryButton = screen.getByRole("button", { name: /Try again/ });
    await act(async () => {
      fireEvent.click(retryButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThan(2);
    });

    // Successful retry navigates to dashboard
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    });
  });

  it("handleSkip failure then successful retry", async () => {
    stepParam = "1";
    failPostProfileCount = 2;

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Personal information/ });
      expect(heading).toBeTruthy();
    });

    const skipButton = screen.getByRole("button", { name: /Skip for now/ });
    await act(async () => {
      fireEvent.click(skipButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThanOrEqual(1);
    });

    // Click retry on handleSkip path
    const retryButton = screen.getByRole("button", { name: /Try again/ });
    await act(async () => {
      fireEvent.click(retryButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThan(2);
    });

    // Successful retry navigates to dashboard
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    });
  });

  it("draft preserved on failed save, cleared only after successful completion", async () => {
    const localStorageRemoveItemSpy = vi.spyOn(Storage.prototype, "removeItem");

    failPostProfileCount = 2;

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Core details/ });
      expect(heading).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("Enter your full name"), {
      target: { value: "Draft User" },
    });

    await fillStep0AndSubmit();

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThanOrEqual(1);
    });

    // clearDraft (localStorage.removeItem) must NOT have been called on failure
    expect(localStorageRemoveItemSpy).not.toHaveBeenCalled();

    // Now retry succeeds
    const retryButton = screen.getByRole("button", { name: /Try again/ });
    await act(async () => {
      fireEvent.click(retryButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThan(2);
    });

    // After successful save, clearDraft should have been called
    expect(localStorageRemoveItemSpy).toHaveBeenCalled();

    localStorageRemoveItemSpy.mockRestore();
  });

  it("retry button unavailable while a retry request is in flight", async () => {
    failPostProfileCount = 2;

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Core details/ });
      expect(heading).toBeTruthy();
    });

    await fillStep0AndSubmit();

    // Wait for the failed save POST call to complete
    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThanOrEqual(1);
    });

    // Retry button is present before clicking
    const retryButton = screen.getByRole("button", { name: /Try again/ });
    expect(retryButton).toBeTruthy();

    // Set up a deferred promise BEFORE clicking retry, so the retry POST
    // stays pending until we resolve it.
    const retryPromise = new Promise((resolve) => {
      deferredResolve = resolve;
    });

    // Click retry - this triggers saveProfileAndGoDashboard, which calls
    // setRetrySave(null) synchronously before the fetch. The button should
    // disappear immediately while the request is in flight.
    fireEvent.click(retryButton);

    // While the retry request is pending (deferred), the retry button should
    // no longer be rendered because setRetrySave(null) runs at save start.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
    });

    // The saving state should be visible while the retry is in flight.
    const savingIndicator = screen.getByText(/Saving your profile…/);
    expect(savingIndicator).toBeTruthy();

    // Resolve the deferred retry request successfully.
    deferredResolve?.({ ok: true, status: 200, json: () => Promise.resolve({}) });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThan(2);
    });

    // Successful retry navigates to dashboard.
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    });
  });

  it("successful retry navigation and save endpoints called correctly", async () => {
    failPostProfileCount = 2;

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Core details/ });
      expect(heading).toBeTruthy();
    });

    await fillStep0AndSubmit();

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThanOrEqual(1);
    });

    const retryButton = screen.getByRole("button", { name: /Try again/ });
    await act(async () => {
      fireEvent.click(retryButton);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(countPostProfileCalls()).toBeGreaterThan(2);
    });

    // All calls were POST to /api/profile
    const postProfileCalls = fetchMock.mock.calls.filter(
      (args) => args[0] === "/api/profile" && args[1]?.method === "POST"
    );
    // At least one save POST call should contain full_name in the body
    const saveCalls = postProfileCalls.filter((args) =>
      typeof args[1]?.body === "string" && args[1].body.includes("full_name")
    );
    expect(saveCalls.length).toBeGreaterThanOrEqual(1);
    saveCalls.forEach((args) => {
      expect(args[1]?.method).toBe("POST");
    });

    // Navigation to dashboard
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    });
  });
});
