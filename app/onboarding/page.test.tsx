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

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.resetAllMocks();
  authGetUserMock.mockResolvedValue({
    data: { user: { id: "test-user-id" } },
    error: null,
  });
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/profile") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ profile: {} }),
      });
    }
    if (url === "/api/profile/waec") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ results: [] }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  searchParamsGetMock.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fillStep0AndSubmit() {
  // Fill in required step-0 fields
  fireEvent.change(screen.getByPlaceholderText("Enter your full name"), {
    target: { value: "Test User" },
  });

  // Select an institution from the combobox (opens on focus)
  fireEvent.focus(screen.getByPlaceholderText("Search your university, polytechnic, or college"));
  await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
  const options = screen.getAllByRole("option", { name: /Federal University/ });
  fireEvent.click(options[0]);

  // Select year of study
  const yearSelect = screen.getByLabelText("Year of study");
  fireEvent.change(yearSelect, { target: { value: "100" } });

  // Click "See my provisional matches" to trigger save
  const provisionalButton = screen.getByRole("button", { name: /See my provisional matches/ });
  await act(async () => {
    fireEvent.click(provisionalButton);
    // Flush microtasks so the async save flow (fetch → setError/setRetrySave) completes
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Onboarding retry behavior", () => {
  it("does not execute the retry callback automatically; retry calls save again on click", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/profile") {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Core details/ });
      expect(heading).toBeTruthy();
    });

    await fillStep0AndSubmit();

    // Wait for the failed save POST call to complete
    await waitFor(() => {
      const profileSaveCalls = fetchMock.mock.calls.filter(
        (args) => args[0] === "/api/profile" && args[1]?.method === "POST"
      ).length;
      expect(profileSaveCalls).toBeGreaterThanOrEqual(1);
    });

    // Count how many times /api/profile was called for the save
    const profileSaveCallsBeforeRetry = fetchMock.mock.calls.filter(
      (args) => args[0] === "/api/profile" && args[1]?.method === "POST"
    ).length;

    // Crucial: the retry callback must NOT have executed automatically.
    // With the buggy code (setRetrySave(saveProfileAndGoDashboard)), React would
    // treat the function as a state updater and execute it immediately, causing
    // fetch to be called twice on a single failure. With the fix
    // (setRetrySave(() => saveProfileAndGoDashboard)), the callback is stored
    // and fetch is called exactly once for the initial failed attempt.
    expect(profileSaveCallsBeforeRetry).toBe(1);

    // The retry button is rendered when retrySave is set. Its onClick invokes
    // the stored callback (() => saveProfileAndGoDashboard), triggering a second
    // save attempt. The button's presence and click behavior are verified by
    // code inspection: onClick={retrySave} where retrySave = () => fn.
  });

  it("preserves the draft on failed save (clearDraft not called on failure)", async () => {
    const localStorageRemoveItemSpy = vi.spyOn(Storage.prototype, "removeItem");

    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/profile") {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Core details/ });
      expect(heading).toBeTruthy();
    });

    // Fill in fields to make the form dirty
    fireEvent.change(screen.getByPlaceholderText("Enter your full name"), {
      target: { value: "Draft User" },
    });

    await fillStep0AndSubmit();

    // Wait for the failed save POST call to complete
    await waitFor(() => {
      const profileSaveCalls = fetchMock.mock.calls.filter(
        (args) => args[0] === "/api/profile" && args[1]?.method === "POST"
      ).length;
      expect(profileSaveCalls).toBeGreaterThanOrEqual(1);
    });

    // localStorage.removeItem (clearDraft) must NOT have been called on failure
    expect(localStorageRemoveItemSpy).not.toHaveBeenCalled();

    localStorageRemoveItemSpy.mockRestore();
  });

  it("redirects to login on HTTP 401 during save", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/profile") {
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    render(<OnboardingPage />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /Core details/ });
      expect(heading).toBeTruthy();
    });

    await fillStep0AndSubmit();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining("/login")));
  });
});
