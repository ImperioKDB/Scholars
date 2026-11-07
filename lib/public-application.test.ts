import { describe, expect, it } from "vitest";
import { getApplicationLinkLabel, getSafeApplicationUrl } from "./public-application";

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

  it("supports instructions-only, URL-only, both, and neither records", () => {
    const records = [
      { howToApply: "Submit the form.", applicationUrl: null },
      { howToApply: null, applicationUrl: "https://provider.example/apply" },
      { howToApply: "Submit the form.", applicationUrl: "https://provider.example/apply" },
      { howToApply: null, applicationUrl: null },
    ];

    expect(
      records.map((record) => Boolean(record.howToApply || getSafeApplicationUrl(record.applicationUrl))),
    ).toEqual([true, true, true, false]);
  });
});
