export interface UploadedFile {
  id: string;
  file: File;
  type: "video" | "document";
  name: string;
  size: number;
}

export interface LinkItem {
  id: string;
  url: string;
}

export interface TranscriptSegment {
  speaker: string | null;
  start: string | null;
  end: string | null;
  text: string;
}

export interface ParsedTranscriptData {
  source_format: string;
  segments: TranscriptSegment[];
  raw_text: string;
}

export interface FileSummary {
  name: string;
  size: number;
  type: "video" | "document";
  mime: string;
  transcript: ParsedTranscriptData | null;
}

export interface UploadResponse {
  meeting_id: string;
  status: "uploaded" | "processing" | "dispatched" | "failed";
  file_count: number;
  link_count: number;
  files: FileSummary[];
  links: string[];
  message: string;
}

export type TranscriptionTool = "whisper" | "deepgram" | "assemblyai";

export const TRANSCRIPTION_TOOLS: {
  id: TranscriptionTool;
  name: string;
  description: string;
  keyPlaceholder: string;
}[] = [
  {
    id: "whisper",
    name: "OpenAI Whisper",
    description: "High accuracy, supports 97 languages",
    keyPlaceholder: "OpenAI API key (sk-...)",
  },
  {
    id: "deepgram",
    name: "Deepgram",
    description: "Fast, real-time capable, speaker diarization",
    keyPlaceholder: "Deepgram API key",
  },
  {
    id: "assemblyai",
    name: "AssemblyAI",
    description: "Speaker labels, summaries, sentiment analysis",
    keyPlaceholder: "AssemblyAI API key",
  },
];

export interface TranscriptionRequest {
  tool: TranscriptionTool;
  api_key: string;
  file_name: string;
}

export interface TranscriptionResult {
  tool: TranscriptionTool;
  tool_name: string;
  file_name: string;
  status: "success" | "failed";
  transcript: ParsedTranscriptData | null;
  error: string | null;
  duration_ms: number;
}

export interface DispatchRequest {
  meeting_id: string;
  prompt: string;
  api_key: string;
}

export interface DispatchResponse {
  meeting_id: string;
  session_url: string | null;
  status: "dispatched" | "failed";
  message: string;
  repo_debug?: string;
  repos_found?: string[];
}
