"use client";

import { useCallback, useRef, useState } from "react";
import type { UploadedFile } from "../lib/types";

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "mkv"];

function classifyFile(file: File): "video" | "document" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXTENSIONS.includes(ext) || file.type.startsWith("video/")) {
    return "video";
  }
  return "document";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface FileDropZoneProps {
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
}

export default function FileDropZone({
  files,
  onAdd,
  onRemove,
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const newFiles: UploadedFile[] = Array.from(fileList).map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        type: classifyFile(f),
        name: f.name,
        size: f.size,
      }));
      onAdd(newFiles);
    },
    [onAdd]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles]
  );

  return (
    <div className="space-y-3">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onInputChange}
          accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.srt,.vtt,.txt,.json,.pdf,.doc,.docx"
        />
        <div className="text-4xl mb-2">📁</div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Videos (mp4, webm, mov) &middot; Transcripts (srt, vtt, txt, json)
          &middot; Documents (pdf, doc)
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span>{f.type === "video" ? "🎬" : "📄"}</span>
                <span className="truncate">{f.name}</span>
                <span className="text-gray-400 shrink-0">
                  {formatSize(f.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
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
