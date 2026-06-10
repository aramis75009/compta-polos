"use client";

import { useEffect, useRef, useState } from "react";

export default function EditableCell({
  value,
  display,
  type = "text",
  align = "left",
  editable = true,
  placeholder = "—",
  onSave,
}: {
  value: string | number | null;
  display?: string;
  type?: "text" | "number";
  align?: "left" | "right" | "center";
  editable?: boolean;
  placeholder?: string;
  onSave: (raw: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const start = () => {
    if (!editable) return;
    setDraft(value == null ? "" : String(value));
    setEditing(true);
  };

  const commit = async () => {
    setEditing(false);
    const original = value == null ? "" : String(value);
    if (draft !== original) {
      await onSave(draft);
    }
  };

  const cancel = () => setEditing(false);

  const alignCls =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        step={type === "number" ? "any" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className={`w-full rounded border border-primary bg-surface px-2 py-1 text-ink outline-none ring-2 ring-primary/15 ${alignCls}`}
      />
    );
  }

  const shown = display ?? (value == null || value === "" ? placeholder : String(value));
  const isPlaceholder = display
    ? false
    : value == null || value === "";

  return (
    <div
      onDoubleClick={start}
      title={editable ? "Double-clic pour modifier" : undefined}
      className={`truncate rounded px-2 py-1 ${alignCls} ${
        editable ? "cursor-cell hover:bg-surface-container" : "cursor-default"
      } ${isPlaceholder ? "text-ink-faint" : ""}`}
    >
      {shown}
    </div>
  );
}
