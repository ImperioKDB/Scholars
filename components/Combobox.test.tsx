import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Combobox } from "./Combobox";

afterEach(() => cleanup());

const OPTIONS = [
  { value: "cs", label: "Computer Science" },
  { value: "se", label: "Software Engineering" },
  { value: "ee", label: "Electrical Engineering" },
];

function renderCombobox(props: Partial<Parameters<typeof Combobox>[0]> = {}) {
  const onChange = vi.fn();
  const defaultProps = {
    options: OPTIONS,
    value: "",
    onChange,
    placeholder: "Search...",
  };
  render(<Combobox {...defaultProps} {...props} />);
  const input = screen.getByRole("combobox") as HTMLInputElement;
  return { input, onChange };
}

describe("Combobox", () => {
  it("renders the input and listbox when focused", () => {
    const { input } = renderCombobox({ value: "" });
    expect(input).toBeDefined();
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeDefined();
  });

  it("typing with an existing value does not prematurely clear the committed value", () => {
    const { input, onChange } = renderCombobox({ value: "cs" });
    expect(input.value).toBe("Computer Science");

    fireEvent.change(input, { target: { value: "S" } });

    // The committed value must be preserved: onChange must NOT be called
    // with "" (the previous behaviour wiped the value on the first keystroke).
    expect(onChange).not.toHaveBeenCalledWith("");
    expect(onChange).not.toHaveBeenCalled();
    // The internal query reflects what was typed while the value stays intact.
    expect(input.value).toBe("S");
  });

  it("selecting a replacement option commits the new value", () => {
    const { input, onChange } = renderCombobox({ value: "cs" });
    fireEvent.focus(input);

    const option = screen.getByRole("button", { name: "Software Engineering" });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith("se");
    expect(input.value).toBe("Software Engineering");
  });

  it("pressing Escape preserves the original value", () => {
    const { input, onChange } = renderCombobox({ value: "cs" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "S" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(onChange).not.toHaveBeenCalledWith("");
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("Computer Science");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("blurring without a valid replacement preserves the original value", () => {
    const { input, onChange } = renderCombobox({ value: "cs" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "No such course" } });

    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("Computer Science");
  });

  it("custom entry still works when allowCustom is enabled", () => {
    const { input, onChange } = renderCombobox({
      value: "",
      allowCustom: true,
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Custom Course" } });

    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("Custom Course");
    expect(input.value).toBe("Custom Course");
  });

  it("keyboard: ArrowDown opens and highlights, Enter selects the highlighted option", () => {
    const { input, onChange } = renderCombobox({ value: "" });

    fireEvent.keyDown(input, { key: "ArrowDown" }); // opens listbox, highlights Computer Science
    fireEvent.keyDown(input, { key: "ArrowDown" }); // moves to Software Engineering

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("se");
    expect(input.value).toBe("Software Engineering");
  });

  it("Enter commits an exact catalogue match", () => {
    const { input, onChange } = renderCombobox({ value: "" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Computer Science" } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("cs");
    expect(input.value).toBe("Computer Science");
  });
});
