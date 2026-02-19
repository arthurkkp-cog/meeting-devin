"use client";

import { useCallback, useState } from "react";
import type {
  DispatchResponse,
  FileSummary,
  TranscriptSegment,
  UploadResponse,
} from "../lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const DEFAULT_PROMPT = `You are analyzing a meeting recording and transcript.

Please:
1. Summarize the key discussion points
2. Extract all action items with owners and deadlines
3. Identify any decisions that were made
4. Flag any open questions or unresolved topics`;

function TranscriptView({ file }: { file: FileSummary }) {
  const [expanded, setExpanded] = useState(false);
  const transcript = file.transcript;
  if (!transcript) return null;

  const hasTimestamps = transcript.segments.some(
    (s: TranscriptSegment) => s.start !== null
  );

  return (
    <div className="mt-2 ml-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {expanded ? "Hide transcript" : "Show transcript"} ({transcript.source_format}, {transcript.segments.length} segment{transcript.segments.length !== 1 ? "s" : ""})
      </button>
      {expanded && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-xs font-mono space-y-2">
          {hasTimestamps ? (
            transcript.segments.map((seg: TranscriptSegment, j: number) => (
              <div key={j} className="flex gap-2">
                {seg.start && (
                  <span className="text-gray-400 shrink-0 w-24">
                    {seg.start}
                  </span>
                )}
                {seg.speaker && (
                  <span className="text-blue-500 font-semibold shrink-0">
                    {seg.speaker}:
                  </span>
                )}
                <span className="text-gray-700 dark:text-gray-300">
                  {seg.text}
                </span>
              </div>
            ))
          ) : (
            <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {transcript.raw_text}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

interface IngestionResultProps {
  result: UploadResponse;
  onReset: () => void;
}

export default function IngestionResult({
  result,
  onReset,
}: IngestionResultProps) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [apiKey, setApiKey] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] =
    useState<DispatchResponse | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const handleDispatch = useCallback(async () => {
    setDispatching(true);
    setDispatchError(null);
    setDispatchResult(null);

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_id: result.meeting_id,
          prompt: prompt.trim(),
          api_key: apiKey.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ?? `Dispatch failed with status ${res.status}`
        );
      }

      const data: DispatchResponse = await res.json();
      setDispatchResult(data);
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setDispatching(false);
    }
  }, [result.meeting_id, prompt, apiKey]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Ingestion Result</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Meeting ID: {result.meeting_id}
            </p>
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
            {result.status}
          </span>
        </div>

        {result.files.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Files ({result.files.length})
            </h3>
            <ul className="space-y-1.5">
              {result.files.map((f, i) => (
                <li key={i}>
                  <div className="flex items-center gap-2 text-sm">
                    <span>{f.type === "video" ? "🎬" : "📄"}</span>
                    <span className="truncate">{f.name}</span>
                    <span className="text-gray-400 text-xs shrink-0">
                      {formatSize(f.size)}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">
                      {f.type}
                    </span>
                    {f.transcript && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 shrink-0">
                        transcript parsed
                      </span>
                    )}
                  </div>
                  <TranscriptView file={f} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.links.length > 0 && (
          <div className="px-5 py-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Links ({result.links.length})
            </h3>
            <ul className="space-y-1.5">
              {result.links.map((url, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span>🔗</span>
                  <span className="truncate text-blue-600 dark:text-blue-400">
                    {url}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!dispatchResult && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="api-key"
              className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
            >
              Devin API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Devin API / service key..."
              className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Your key is sent server-side per request and is not stored.
            </p>
          </div>

          <div>
            <label
              htmlFor="dispatch-prompt"
              className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
            >
              Prompt for Devin
            </label>
            <textarea
              id="dispatch-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onReset}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Upload more context
            </button>
            <button
              type="button"
              onClick={handleDispatch}
              disabled={dispatching || !prompt.trim() || !apiKey.trim()}
              className="rounded-xl bg-blue-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {dispatching ? "Dispatching..." : "Dispatch to Devin"}
            </button>
          </div>
        </div>
      )}

      {dispatchResult && (
        <div
          className={`rounded-xl p-4 text-sm border ${
            dispatchResult.status === "dispatched"
              ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
          }`}
        >
          <p
            className={`font-medium ${
              dispatchResult.status === "dispatched"
                ? "text-green-800 dark:text-green-200"
                : "text-red-800 dark:text-red-200"
            }`}
          >
            {dispatchResult.message}
          </p>
          {dispatchResult.session_url && (
            <a
              href={dispatchResult.session_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-blue-600 dark:text-blue-400 underline"
            >
              View Devin session
            </a>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={onReset}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Process another meeting
            </button>
          </div>
        </div>
      )}

      {dispatchError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm">
          <p className="font-medium text-red-800 dark:text-red-200">
            {dispatchError}
          </p>
          <button
            type="button"
            onClick={handleDispatch}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
          >
            Retry dispatch
          </button>
        </div>
      )}
    </div>
  );
}
