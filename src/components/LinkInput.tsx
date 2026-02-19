"use client";

import { useCallback, useState } from "react";
import type { LinkItem } from "../lib/types";

interface LinkInputProps {
  links: LinkItem[];
  onAdd: (link: LinkItem) => void;
  onRemove: (id: string) => void;
}

export default function LinkInput({ links, onAdd, onRemove }: LinkInputProps) {
  const [value, setValue] = useState("");

  const addLink = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd({ id: crypto.randomUUID(), url: trimmed });
    setValue("");
  }, [value, onAdd]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addLink();
      }
    },
    [addLink]
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Paste a meeting link or recording URL..."
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addLink}
          disabled={!value.trim()}
          className="rounded-lg bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>

      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span>🔗</span>
                <span className="truncate text-blue-600 dark:text-blue-400">
                  {link.url}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(link.id)}
                className="ml-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
