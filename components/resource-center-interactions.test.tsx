import { describe, expect, it, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ResourceMobileNav } from "./resource-center-interactions";

afterEach(() => cleanup());

describe("ResourceMobileNav", () => {
  it("opens the menu when the trigger is clicked", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    expect(screen.queryByRole("navigation", { name: "Mobile Resource Center navigation" })).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);

    expect(screen.getByRole("navigation", { name: "Mobile Resource Center navigation" })).toBeDefined();
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes the menu when the trigger is clicked again", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.queryByRole("navigation", { name: "Mobile Resource Center navigation" })).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps aria-controls valid in both open and closed states", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    expect(button.getAttribute("aria-controls")).toBe("resource-mobile-menu");
    expect(document.getElementById("resource-mobile-menu")).not.toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("resource-mobile-menu")).not.toBeNull();
  });

  it("restores focus to the trigger when Escape closes the menu", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("restores focus to the trigger when a navigation link closes the menu", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(button);

    const link = screen.getByRole("link", { name: /Resource desk/ });
    fireEvent.click(link);

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the menu on outside pointer click", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(button);
    expect(screen.getByRole("navigation", { name: "Mobile Resource Center navigation" })).toBeDefined();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("navigation", { name: "Mobile Resource Center navigation" })).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("does not close the menu when clicking inside the menu panel", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(button);

    const menu = document.getElementById("resource-mobile-menu");
    expect(menu).not.toBeNull();
    fireEvent.click(menu!);

    expect(screen.getByRole("navigation", { name: "Mobile Resource Center navigation" })).toBeDefined();
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggles the menu closed when the trigger is clicked while open", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(button);
    expect(screen.getByRole("navigation", { name: "Mobile Resource Center navigation" })).toBeDefined();
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(button);

    expect(screen.queryByRole("navigation", { name: "Mobile Resource Center navigation" })).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("exposes navigation links in DOM order for keyboard navigation", () => {
    render(<ResourceMobileNav />);
    const button = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(button);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0].textContent).toBe("Resource desk");
    expect(links[1].textContent).toBe("Find scholarships");
    expect(links[2].textContent).toBe("Opportunities");
  });
});
