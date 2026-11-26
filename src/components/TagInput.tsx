"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function TagInput({
  value,
  onChange,
  placeholder,
  prefix = "#",
  transform = (t: string) => t.toLowerCase(),
  max = 20,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  prefix?: string;
  transform?: (t: string) => string;
  max?: number;
  label: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((t) => transform(t.trim())).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])].slice(0, max));
    setDraft("");
  };

  return (
    <div className="input flex min-h-12 flex-wrap items-center gap-1.5 py-2">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-fern-light px-2.5 py-0.5 text-xs font-medium text-fern">
          {prefix}
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        value={draft}
        onChange={(e) => (/[,;]/.test(e.target.value) ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => commit(draft)}
        className="min-w-40 flex-1 bg-transparent outline-none"
        placeholder={value.length ? "" : placeholder}
      />
    </div>
  );
}
