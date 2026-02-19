import { NextResponse } from "next/server";
import type {
  ParsedTranscriptData,
  TranscriptionTool,
} from "../../../lib/types";

const VALID_TOOLS: TranscriptionTool[] = ["whisper", "deepgram", "assemblyai"];

const TOOL_NAMES: Record<TranscriptionTool, string> = {
  whisper: "OpenAI Whisper",
  deepgram: "Deepgram",
  assemblyai: "AssemblyAI",
};

async function transcribeWithWhisper(
  file: File,
  apiKey: string
): Promise<ParsedTranscriptData> {
  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Whisper API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const segments = (data.segments ?? []).map(
    (s: { start: number; end: number; text: string }) => ({
      speaker: null,
      start: formatTimestamp(s.start),
      end: formatTimestamp(s.end),
      text: s.text.trim(),
    })
  );

  return {
    source_format: "whisper",
    segments,
    raw_text: data.text ?? "",
  };
}

async function transcribeWithDeepgram(
  file: File,
  apiKey: string
): Promise<ParsedTranscriptData> {
  const buffer = await file.arrayBuffer();

  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&diarize=true&utterances=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": file.type || "audio/wav",
      },
      body: buffer,
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Deepgram API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const utterances = data.results?.utterances ?? [];
  const segments = utterances.map(
    (u: { speaker: number; start: number; end: number; transcript: string }) => ({
      speaker: u.speaker !== undefined ? `Speaker ${u.speaker}` : null,
      start: formatTimestamp(u.start),
      end: formatTimestamp(u.end),
      text: u.transcript,
    })
  );

  const rawText =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

  return {
    source_format: "deepgram",
    segments,
    raw_text: rawText,
  };
}

async function transcribeWithAssemblyAI(
  file: File,
  apiKey: string
): Promise<ParsedTranscriptData> {
  const buffer = await file.arrayBuffer();

  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { Authorization: apiKey },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`AssemblyAI upload ${uploadRes.status}: ${errText}`);
  }

  const uploadData = await uploadRes.json();
  const audioUrl: string = uploadData.upload_url;

  const transcriptRes = await fetch(
    "https://api.assemblyai.com/v2/transcript",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speaker_labels: true,
      }),
    }
  );

  if (!transcriptRes.ok) {
    const errText = await transcriptRes.text().catch(() => "");
    throw new Error(
      `AssemblyAI transcript ${transcriptRes.status}: ${errText}`
    );
  }

  const transcriptData = await transcriptRes.json();
  const transcriptId: string = transcriptData.id;

  let result = transcriptData;
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    if (result.status === "completed" || result.status === "error") break;

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const pollRes = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { Authorization: apiKey } }
    );

    if (!pollRes.ok) {
      throw new Error(`AssemblyAI poll failed: ${pollRes.status}`);
    }

    result = await pollRes.json();
  }

  if (result.status === "error") {
    throw new Error(`AssemblyAI transcription failed: ${result.error}`);
  }

  if (result.status !== "completed") {
    throw new Error("AssemblyAI transcription timed out");
  }

  const utterances = result.utterances ?? [];
  const segments = utterances.map(
    (u: { speaker: string; start: number; end: number; text: string }) => ({
      speaker: u.speaker ?? null,
      start: formatTimestamp(u.start / 1000),
      end: formatTimestamp(u.end / 1000),
      text: u.text,
    })
  );

  return {
    source_format: "assemblyai",
    segments,
    raw_text: result.text ?? "",
  };
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const tool = formData.get("tool") as string | null;
    const apiKey = formData.get("api_key") as string | null;

    if (!file || !tool || !apiKey?.trim()) {
      return NextResponse.json(
        { message: "file, tool, and api_key are required" },
        { status: 400 }
      );
    }

    if (!VALID_TOOLS.includes(tool as TranscriptionTool)) {
      return NextResponse.json(
        { message: `Invalid tool: ${tool}. Must be one of: ${VALID_TOOLS.join(", ")}` },
        { status: 400 }
      );
    }

    const toolId = tool as TranscriptionTool;
    const startTime = Date.now();

    let transcript: ParsedTranscriptData;

    switch (toolId) {
      case "whisper":
        transcript = await transcribeWithWhisper(file, apiKey);
        break;
      case "deepgram":
        transcript = await transcribeWithDeepgram(file, apiKey);
        break;
      case "assemblyai":
        transcript = await transcribeWithAssemblyAI(file, apiKey);
        break;
    }

    const durationMs = Date.now() - startTime;

    console.log(
      JSON.stringify({
        event: "transcription_success",
        tool: toolId,
        file_name: file.name,
        segments: transcript.segments.length,
        duration_ms: durationMs,
      })
    );

    return NextResponse.json({
      tool: toolId,
      tool_name: TOOL_NAMES[toolId],
      file_name: file.name,
      status: "success",
      transcript,
      error: null,
      duration_ms: durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("Transcription error:", err);

    return NextResponse.json(
      {
        tool: null,
        tool_name: null,
        file_name: null,
        status: "failed",
        transcript: null,
        error: message,
        duration_ms: 0,
      },
      { status: 502 }
    );
  }
}
