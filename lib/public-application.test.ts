import { describe, expect, it } from "vitest";
import { getApplicationLinkLabel, getPublicApplicationDetails, getSafeApplicationUrl } from "./public-application";

describe("public scholarship application links", () => {
  it.each(["https://provider.example/apply", "http://provider.example/apply"])(
    "accepts valid %s destinations",
    (value) => {
      expect(getSafeApplicationUrl(value)?.toString()).toBe(value);
    },
  );

  it("accepts a mailto destination", () => {
    expect(getSafeApplicationUrl("mailto:apply@provider.example")?.protocol).toBe("mailto:");
  });

  it.each(["javascript:alert(1)", "data:text/html,unsafe", "ftp://provider.example/apply", "not a url"])(
    "rejects unsafe or unsupported destination %s",
    (value) => {
      expect(getSafeApplicationUrl(value)).toBeNull();
    },
  );

  it("uses the open label for HTTP destinations", () => {
    expect(getApplicationLinkLabel({ closed: false, protocol: "https:" })).toBe(
      "Open application destination",
    );
  });

  it("uses the open email label for mailto destinations", () => {
    expect(getApplicationLinkLabel({ closed: false, protocol: "mailto:" })).toBe(
      "Contact the provider by email",
    );
  });

  it("uses the historical label for closed destinations", () => {
    expect(getApplicationLinkLabel({ closed: true, protocol: "https:" })).toBe(
      "View application destination for historical information",
    );
  });

  it("preserves meaningful instructions", () => {
    expect(getPublicApplicationDetails({ instructions: "  Submit the form.  ", url: null }).instructions).toBe(
      "Submit the form.",
    );
  });

  it("treats whitespace-only instructions as missing", () => {
    expect(getPublicApplicationDetails({ instructions: " \n\t ", url: null })).toEqual({
      instructions: null,
      url: null,
    });
  });

  it.each([
    ["instructions-only", { instructions: "Submit the form.", url: null }, true],
    ["URL-only", { instructions: null, url: "https://provider.example/apply" }, true],
    ["both fields", { instructions: "Submit the form.", url: "https://provider.example/apply" }, true],
    ["neither usable field", { instructions: "  ", url: "javascript:alert(1)" }, false],
  ])("determines application-details availability for %s records", (_name, record, expected) => {
    const details = getPublicApplicationDetails(record);
    expect(Boolean(details.instructions || details.url)).toBe(expected);
  });
});
