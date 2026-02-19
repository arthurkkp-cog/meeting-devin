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
}
