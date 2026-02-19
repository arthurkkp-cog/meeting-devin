"use client";

import { useCallback, useState } from "react";
import type {
  DispatchResponse,
  FileSummary,
  ParsedTranscriptData,
  TranscriptionResult,
  TranscriptionTool,
  TranscriptSegment,
  UploadResponse,
} from "../lib/types";
import { TRANSCRIPTION_TOOLS } from "../lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const DEFAULT_INSTRUCTIONS = `You are analyzing a meeting recording and transcript.

Please:
1. Summarize the key discussion points
2. Extract all action items with owners and deadlines
3. Identify any decisions that were made
4. Flag any open questions or unresolved topics`;

function buildFullPrompt(
  instructions: string,
  transcript: ParsedTranscriptData | null,
  toolName: string | null,
  fileName: string | null,
  links: string[]
): string {
  const parts: string[] = [instructions.trim()];

  if (transcript && toolName && fileName) {
    parts.push(`\n\n---\n\n## Transcript Content`);
    parts.push(`**Source:** ${fileName}`);
    parts.push(`**Transcription tool:** ${toolName}\n`);
    for (const seg of transcript.segments) {
      const prefix = [seg.start, seg.speaker].filter(Boolean).join(" ");
      parts.push(prefix ? `[${prefix}] ${seg.text}` : seg.text);
    }
  }

  if (links.length > 0) {
    parts.push("\n---\n\n## Meeting Links\n");
    for (const url of links) {
      parts.push(`- ${url}`);
    }
  }

  return parts.join("\n");
}

function TranscriptViewer({ transcript }: { transcript: ParsedTranscriptData }) {
  const hasTimestamps = transcript.segments.some(
    (s: TranscriptSegment) => s.start !== null
  );

  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-xs font-mono space-y-2">
      {hasTimestamps ? (
        transcript.segments.map((seg: TranscriptSegment, j: number) => (
          <div key={j} className="flex gap-2">
            {seg.start && (
              <span className="text-gray-400 shrink-0 w-24">{seg.start}</span>
            )}
            {seg.speaker && (
              <span className="text-blue-500 font-semibold shrink-0">
                {seg.speaker}:
              </span>
            )}
            <span className="text-gray-700 dark:text-gray-300">{seg.text}</span>
          </div>
        ))
      ) : (
        <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
          {transcript.raw_text}
        </pre>
      )}
    </div>
  );
}

function FileTranscriptView({ file }: { file: FileSummary }) {
  const [expanded, setExpanded] = useState(false);
  const transcript = file.transcript;
  if (!transcript) return null;

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
        <div className="mt-2">
          <TranscriptViewer transcript={transcript} />
        </div>
      )}
    </div>
  );
}

interface PerResultDispatchProps {
  meetingId: string;
  transcriptionResult: TranscriptionResult;
  instructions: string;
  links: string[];
  devinApiKey: string;
}

function PerResultDispatch({
  meetingId,
  transcriptionResult,
  instructions,
  links,
  devinApiKey,
}: PerResultDispatchProps) {
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<DispatchResponse | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fullPrompt = buildFullPrompt(
    instructions,
    transcriptionResult.transcript,
    transcriptionResult.tool_name,
    transcriptionResult.file_name,
    links
  );

  const handleDispatch = useCallback(async () => {
    setDispatching(true);
    setDispatchError(null);
    setDispatchResult(null);

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_id: meetingId,
          prompt: fullPrompt,
          api_key: devinApiKey.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Dispatch failed with status ${res.status}`);
      }

      const data: DispatchResponse = await res.json();
      setDispatchResult(data);
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setDispatching(false);
    }
  }, [meetingId, fullPrompt, devinApiKey]);

  if (dispatchResult) {
    return (
      <div
        className={`rounded-lg p-3 text-xs border ${
          dispatchResult.status === "dispatched"
            ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
        }`}
      >
        <p className={`font-medium ${
          dispatchResult.status === "dispatched"
            ? "text-green-800 dark:text-green-200"
            : "text-red-800 dark:text-red-200"
        }`}>
          {dispatchResult.message}
        </p>
        {dispatchResult.session_url && (
          <a
            href={dispatchResult.session_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-1 text-blue-600 dark:text-blue-400 underline"
          >
            View Devin session
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showPreview ? "Hide" : "Preview"} prompt ({fullPrompt.length.toLocaleString()} chars)
        </button>
        {showPreview && (
          <pre className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-xs whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300">
            {fullPrompt}
          </pre>
        )}
      </div>
      <button
        type="button"
        onClick={handleDispatch}
        disabled={dispatching || !devinApiKey.trim()}
        className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {dispatching ? "Dispatching..." : `Dispatch (${transcriptionResult.tool_name})`}
      </button>
      {dispatchError && (
        <p className="text-xs text-red-600 dark:text-red-400">{dispatchError}</p>
      )}
    </div>
  );
}

interface IngestionResultProps {
  result: UploadResponse;
  originalFiles: File[];
  onReset: () => void;
}

export default function IngestionResult({
  result,
  originalFiles,
  onReset,
}: IngestionResultProps) {
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [devinApiKey, setDevinApiKey] = useState("");

  const [selectedTools, setSelectedTools] = useState<Set<TranscriptionTool>>(new Set());
  const [toolApiKeys, setToolApiKeys] = useState<Record<string, string>>({});
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>([]);
  const [transcriptionErrors, setTranscriptionErrors] = useState<string | null>(null);

  const videoFiles = result.files.filter((f) => f.type === "video");
  const hasVideoFiles = videoFiles.length > 0;
  const hasTextTranscripts = result.files.some((f) => f.transcript !== null);

  const toggleTool = useCallback((toolId: TranscriptionTool) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  }, []);

  const setToolKey = useCallback((toolId: string, key: string) => {
    setToolApiKeys((prev) => ({ ...prev, [toolId]: key }));
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (selectedTools.size === 0 || videoFiles.length === 0) return;

    setTranscribing(true);
    setTranscriptionErrors(null);
    setTranscriptionResults([]);

    const requests: Promise<TranscriptionResult>[] = [];

    for (const vf of videoFiles) {
      const origFile = originalFiles.find((f) => f.name === vf.name);
      if (!origFile) continue;

      for (const toolId of selectedTools) {
        const apiKey = toolApiKeys[toolId] ?? "";
        if (!apiKey.trim()) continue;

        const formData = new FormData();
        formData.append("file", origFile);
        formData.append("tool", toolId);
        formData.append("api_key", apiKey);

        requests.push(
          fetch("/api/transcribe", { method: "POST", body: formData })
            .then(async (res) => {
              const data = await res.json();
              return data as TranscriptionResult;
            })
            .catch((err) => ({
              tool: toolId,
              tool_name: TRANSCRIPTION_TOOLS.find((t) => t.id === toolId)?.name ?? toolId,
              file_name: vf.name,
              status: "failed" as const,
              transcript: null,
              error: err instanceof Error ? err.message : "Request failed",
              duration_ms: 0,
            }))
        );
      }
    }

    if (requests.length === 0) {
      setTranscriptionErrors("Please enter API keys for the selected tools.");
      setTranscribing(false);
      return;
    }

    const results = await Promise.all(requests);
    setTranscriptionResults(results);
    setTranscribing(false);
  }, [selectedTools, videoFiles, toolApiKeys, originalFiles]);

  const allToolsHaveKeys = Array.from(selectedTools).every(
    (t) => (toolApiKeys[t] ?? "").trim().length > 0
  );

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
                  <FileTranscriptView file={f} />
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

      {hasVideoFiles && transcriptionResults.length === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold">Transcription Tools</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Select one or more tools to transcribe {videoFiles.length} video file{videoFiles.length !== 1 ? "s" : ""}. Results will be shown side by side for comparison.
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {TRANSCRIPTION_TOOLS.map((tool) => (
              <div key={tool.id} className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTools.has(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{tool.name}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tool.description}
                    </p>
                  </div>
                </label>
                {selectedTools.has(tool.id) && (
                  <input
                    type="password"
                    value={toolApiKeys[tool.id] ?? ""}
                    onChange={(e) => setToolKey(tool.id, e.target.value)}
                    placeholder={tool.keyPlaceholder}
                    className="ml-7 w-[calc(100%-1.75rem)] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}

            {transcriptionErrors && (
              <p className="text-xs text-red-600 dark:text-red-400">{transcriptionErrors}</p>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-400">
                {selectedTools.size} tool{selectedTools.size !== 1 ? "s" : ""} selected
              </p>
              <button
                type="button"
                onClick={handleTranscribe}
                disabled={transcribing || selectedTools.size === 0 || !allToolsHaveKeys}
                className="rounded-xl bg-purple-600 text-white px-5 py-2 text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                {transcribing ? "Transcribing..." : "Transcribe"}
              </button>
            </div>
          </div>
        </div>
      )}

      {transcriptionResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Transcription Results ({transcriptionResults.length})
            </h2>
            <button
              type="button"
              onClick={() => setTranscriptionResults([])}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Re-select tools
            </button>
          </div>

          <div>
            <label
              htmlFor="devin-api-key"
              className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
            >
              Devin API Key
            </label>
            <input
              id="devin-api-key"
              type="password"
              value={devinApiKey}
              onChange={(e) => setDevinApiKey(e.target.value)}
              placeholder="Enter your Devin API / service key..."
              className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Used to dispatch each result to a separate Devin session.
            </p>
          </div>

          <div>
            <label
              htmlFor="dispatch-instructions-multi"
              className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
            >
              Instructions for Devin
            </label>
            <p className="text-xs text-gray-400 mt-1">
              Each dispatch includes the transcript from a specific tool + these instructions. The tool name is tagged in each prompt.
            </p>
            <textarea
              id="dispatch-instructions-multi"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div className={`grid gap-4 ${transcriptionResults.length === 1 ? "grid-cols-1" : transcriptionResults.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
            {transcriptionResults.map((tr, i) => (
              <div
                key={i}
                className={`rounded-xl border overflow-hidden ${
                  tr.status === "success"
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-red-200 dark:border-red-800"
                }`}
              >
                <div className={`px-4 py-2 border-b flex items-center justify-between ${
                  tr.status === "success"
                    ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                }`}>
                  <div>
                    <h3 className="text-sm font-semibold">{tr.tool_name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tr.file_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tr.status === "success"
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                    }`}>
                      {tr.status}
                    </span>
                    {tr.duration_ms > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(tr.duration_ms / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {tr.status === "success" && tr.transcript ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {tr.transcript.segments.length} segments
                        </p>
                        <TranscriptViewer transcript={tr.transcript} />
                      </div>
                      <PerResultDispatch
                        meetingId={result.meeting_id}
                        transcriptionResult={tr}
                        instructions={instructions}
                        links={result.links}
                        devinApiKey={devinApiKey}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {tr.error ?? "Transcription failed"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(hasTextTranscripts || !hasVideoFiles) && transcriptionResults.length === 0 && (
        <TextTranscriptDispatch
          result={result}
          instructions={instructions}
          setInstructions={setInstructions}
          devinApiKey={devinApiKey}
          setDevinApiKey={setDevinApiKey}
        />
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Upload more context
        </button>
      </div>
    </div>
  );
}

interface TextTranscriptDispatchProps {
  result: UploadResponse;
  instructions: string;
  setInstructions: (v: string) => void;
  devinApiKey: string;
  setDevinApiKey: (v: string) => void;
}

function TextTranscriptDispatch({
  result,
  instructions,
  setInstructions,
  devinApiKey,
  setDevinApiKey,
}: TextTranscriptDispatchProps) {
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<DispatchResponse | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const transcripts = result.files.filter((f) => f.transcript !== null);
  const combinedTranscript: ParsedTranscriptData | null =
    transcripts.length > 0
      ? {
          source_format: transcripts.map((f) => f.transcript?.source_format ?? "").join("+"),
          segments: transcripts.flatMap((f) => f.transcript?.segments ?? []),
          raw_text: transcripts.map((f) => f.transcript?.raw_text ?? "").join("\n\n"),
        }
      : null;

  const fullPrompt = buildFullPrompt(
    instructions,
    combinedTranscript,
    combinedTranscript ? "text file parser" : null,
    transcripts.map((f) => f.name).join(", ") || null,
    result.links
  );

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
          prompt: fullPrompt,
          api_key: devinApiKey.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Dispatch failed with status ${res.status}`);
      }

      const data: DispatchResponse = await res.json();
      setDispatchResult(data);
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setDispatching(false);
    }
  }, [result.meeting_id, fullPrompt, devinApiKey]);

  if (dispatchResult) {
    return (
      <div
        className={`rounded-xl p-4 text-sm border ${
          dispatchResult.status === "dispatched"
            ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
        }`}
      >
        <p className={`font-medium ${
          dispatchResult.status === "dispatched"
            ? "text-green-800 dark:text-green-200"
            : "text-red-800 dark:text-red-200"
        }`}>
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
        {dispatchResult.repo_debug && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer">Repo fetch debug</summary>
            <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">{dispatchResult.repo_debug}</pre>
          </details>
        )}
        {dispatchResult.repos_found && dispatchResult.repos_found.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500">Repos found ({dispatchResult.repos_found.length}):</p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 ml-4 list-disc">
              {dispatchResult.repos_found.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="devin-api-key-text"
          className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
        >
          Devin API Key
        </label>
        <input
          id="devin-api-key-text"
          type="password"
          value={devinApiKey}
          onChange={(e) => setDevinApiKey(e.target.value)}
          placeholder="Enter your Devin API / service key..."
          className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Your key is sent server-side per request and is not stored.
        </p>
      </div>

      <div>
        <label
          htmlFor="dispatch-instructions-text"
          className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
        >
          Instructions for Devin
        </label>
        <p className="text-xs text-gray-400 mt-1">
          Transcript content and links will be auto-appended below your instructions.
        </p>
        <textarea
          id="dispatch-instructions-text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={6}
          className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showPreview ? "Hide" : "Preview"} full prompt ({fullPrompt.length.toLocaleString()} chars)
        </button>
        {showPreview && (
          <pre className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 text-xs whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300">
            {fullPrompt}
          </pre>
        )}
      </div>

      <button
        type="button"
        onClick={handleDispatch}
        disabled={dispatching || !instructions.trim() || !devinApiKey.trim()}
        className="w-full rounded-xl bg-blue-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {dispatching ? "Dispatching..." : "Dispatch to Devin"}
      </button>

      {dispatchError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm">
          <p className="font-medium text-red-800 dark:text-red-200">{dispatchError}</p>
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
