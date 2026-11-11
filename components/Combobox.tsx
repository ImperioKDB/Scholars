"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "@/components/FormField";

export type ComboboxOption = {
  value: string;
  label: string;
  sublabel?: string;
};

// Search-and-select input: filters options as you type, and commits a
// value when you pick an option from the list. Typing alone also commits
// now when the typed text is an EXACT, unambiguous match for one option's
// label (case-insensitive) -- on blur, click-outside, or Enter. That
// closes the product-audit drop-off where someone typed "Computer
// Science", saw the right row, tabbed away, and silently had nothing
// saved because they never clicked the option. Fields that opt into
// allowCustom also preserve and commit meaningful free text instead of
// silently resetting it when the field loses focus.
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  emptyMessage = "No matches -- try a different search.",
  allowCustom = false,
  id,
  name,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  allowCustom?: boolean;
  id?: string;
  name?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? `combobox-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const selected = options.find((o) => o.value === value);
  const selectedLabel = selected?.label ?? value;
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  // Commit an exact catalogue match, or meaningful custom text for fields
  // that explicitly allow it. Returns true when something was committed.
  function commitExactMatch(): boolean {
    const typed = query.trim().toLowerCase();
    if (!typed) return false;
    const exact = options.filter((o) => o.label.toLowerCase() === typed);
    if (exact.length === 1) {
      onChange(exact[0].value);
      setQuery(exact[0].label);
      return true;
    }
    if (allowCustom) {
      const custom = query.trim();
      onChange(custom);
      setQuery(custom);
      return true;
    }
    setQuery(selectedLabel);
    return false;
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        commitExactMatch();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // query/options in the deps so the listener always sees the latest
    // typed text (the closure would otherwise go stale between renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedLabel, options, query, allowCustom]);

  const filtered =
    query.trim() === "" || query === selectedLabel
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const activeOption = filtered[highlighted];

  function select(option: ComboboxOption) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Prefer an exact label match over whatever row happens to be
      // highlighted, so "type the full name + Enter" always lands on
      // that exact option even when the filtered list starts somewhere
      // else.
      const typed = query.trim().toLowerCase();
      const exact = options.find((o) => o.label.toLowerCase() === typed);
      const option = exact ?? filtered[highlighted];
      if (option) {
        select(option);
      } else if (allowCustom && typed) {
        commitExactMatch();
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(selectedLabel);
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        id={inputId}
        name={name}
        className={inputClass}
        type="text"
        maxLength={allowCustom ? 200 : undefined}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Keyboard users tabbing away get the same exact-match commit
          // mouse users get via the click-outside handler. Option-button
          // clicks never reach this handler -- their onMouseDown calls
          // preventDefault(), which keeps focus on this input.
          commitExactMatch();
        }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={open && activeOption ? `${listboxId}-option-${highlighted}` : undefined}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        autoComplete="off"
      />
      {open && (
        <ul id={listboxId} role="listbox" className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-hairline bg-white shadow-card py-1">
          {filtered.length === 0 && (
            <li className="px-3.5 py-2.5 text-sm text-navy-light">
              <span className="block">{emptyMessage}</span>
              {allowCustom && query.trim() && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    commitExactMatch();
                    setOpen(false);
                  }}
                  className="mt-2 font-medium text-navy underline"
                >
                  Use “{query.trim()}”
                </button>
              )}
            </li>
          )}
          {filtered.map((option, i) => (
            <li key={option.value} id={`${listboxId}-option-${i}`} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(option)}
                className={
                  "w-full text-left px-3.5 py-2.5 text-sm " +
                  (i === highlighted ? "bg-navy-50 text-navy" : "text-ink hover:bg-navy-50")
                }
              >
                {option.label}
                {option.sublabel && (
                  <span className="block text-xs text-navy-light">{option.sublabel}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
