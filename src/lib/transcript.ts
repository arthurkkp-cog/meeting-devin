export interface TranscriptSegment {
  speaker: string | null;
  start: string | null;
  end: string | null;
  text: string;
}

export interface ParsedTranscript {
  source_format: string;
  segments: TranscriptSegment[];
  raw_text: string;
}

const TRANSCRIPT_EXTENSIONS = ["srt", "vtt", "txt", "json"];

export function isTranscriptFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return TRANSCRIPT_EXTENSIONS.includes(ext);
}

export function parseTranscript(
  name: string,
  content: string
): ParsedTranscript {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  switch (ext) {
    case "srt":
      return parseSrt(content);
    case "vtt":
      return parseVtt(content);
    case "json":
      return parseJson(content);
    case "txt":
    default:
      return parsePlainText(content);
  }
}

function parseSrt(content: string): ParsedTranscript {
  const blocks = content.trim().split(/\n\n+/);
  const segments: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const timeLine = lines[1];
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );

    const textLines = lines.slice(2).join(" ");
    const speakerMatch = textLines.match(/^<([^>]+)>\s*(.*)/);

    segments.push({
      speaker: speakerMatch ? speakerMatch[1] : null,
      start: timeMatch ? timeMatch[1].replace(",", ".") : null,
      end: timeMatch ? timeMatch[2].replace(",", ".") : null,
      text: speakerMatch ? speakerMatch[2] : textLines,
    });
  }

  return {
    source_format: "srt",
    segments,
    raw_text: segments.map((s) => s.text).join("\n"),
  };
}

function parseVtt(content: string): ParsedTranscript {
  const lines = content.trim().split("\n");
  const segments: TranscriptSegment[] = [];

  let i = 0;
  if (lines[0]?.startsWith("WEBVTT")) {
    i = 1;
    while (i < lines.length && lines[i].trim() !== "") i++;
    i++;
  }

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    if (/^\d+$/.test(lines[i].trim())) i++;
    if (i >= lines.length) break;

    const timeLine = lines[i];
    const timeMatch = timeLine.match(
      /([\d:.]+)\s*-->\s*([\d:.]+)/
    );

    if (!timeMatch) {
      i++;
      continue;
    }

    i++;
    const textParts: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      textParts.push(lines[i].trim());
      i++;
    }

    const text = textParts.join(" ");
    const speakerMatch = text.match(/^<v\s+([^>]+)>(.*)/);

    segments.push({
      speaker: speakerMatch ? speakerMatch[1] : null,
      start: timeMatch[1],
      end: timeMatch[2],
      text: speakerMatch ? speakerMatch[2] : text,
    });
  }

  return {
    source_format: "vtt",
    segments,
    raw_text: segments.map((s) => s.text).join("\n"),
  };
}

function parseJson(content: string): ParsedTranscript {
  try {
    const data = JSON.parse(content);

    if (data.segments && Array.isArray(data.segments)) {
      const segments: TranscriptSegment[] = data.segments.map(
        (s: Record<string, unknown>) => ({
          speaker: (s.speaker as string) ?? null,
          start: s.start_ms
            ? formatMs(s.start_ms as number)
            : s.start
              ? String(s.start)
              : null,
          end: s.end_ms
            ? formatMs(s.end_ms as number)
            : s.end
              ? String(s.end)
              : null,
          text: String(s.text ?? ""),
        })
      );

      return {
        source_format: "json",
        segments,
        raw_text: segments.map((s) => s.text).join("\n"),
      };
    }

    return {
      source_format: "json",
      segments: [{ speaker: null, start: null, end: null, text: JSON.stringify(data, null, 2) }],
      raw_text: JSON.stringify(data, null, 2),
    };
  } catch {
    return parsePlainText(content);
  }
}

function parsePlainText(content: string): ParsedTranscript {
  return {
    source_format: "txt",
    segments: [{ speaker: null, start: null, end: null, text: content.trim() }],
    raw_text: content.trim(),
  };
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
