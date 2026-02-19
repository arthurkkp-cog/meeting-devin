"use client";

import { useCallback, useState } from "react";
import type { LinkItem, UploadedFile, UploadResponse } from "../lib/types";
import FileDropZone from "./FileDropZone";
import LinkInput from "./LinkInput";

type Status = "idle" | "uploading" | "success" | "error";

export default function UploadForm() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((newFiles: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const addLink = useCallback((link: LinkItem) => {
    setLinks((prev) => [...prev, link]);
  }, []);

  const removeLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const totalItems = files.length + links.length;

  const handleSubmit = useCallback(async () => {
    if (totalItems === 0) return;

    setStatus("uploading");
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();

      files.forEach((f) => {
        formData.append("files", f.file);
      });

      links.forEach((l) => {
        formData.append("links", l.url);
      });

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ?? `Upload failed with status ${res.status}`
        );
      }

      const data: UploadResponse = await res.json();
      setResult(data);
      setStatus("success");
      setFiles([]);
      setLinks([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  }, [files, links, totalItems]);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
          Files &amp; Videos
        </h2>
        <FileDropZone files={files} onAdd={addFiles} onRemove={removeFile} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
          Links
        </h2>
        <LinkInput links={links} onAdd={addLink} onRemove={removeLink} />
      </section>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-gray-500">
          {totalItems === 0
            ? "Add files or links to get started"
            : `${totalItems} item${totalItems !== 1 ? "s" : ""} ready`}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={totalItems === 0 || status === "uploading"}
          className="rounded-xl bg-blue-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {status === "uploading" ? "Uploading..." : "Process Meeting Context"}
        </button>
      </div>

      {status === "success" && result && (
        <div className="rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-sm">
          <p className="font-medium text-green-800 dark:text-green-200">
            {result.message}
          </p>
          <p className="text-green-600 dark:text-green-400 mt-1">
            Meeting ID: {result.meeting_id}
          </p>
        </div>
      )}

      {status === "error" && error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm">
          <p className="font-medium text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
}
