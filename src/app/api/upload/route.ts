import { NextResponse } from "next/server";

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "mkv"];

function classifyFile(name: string, mime: string): "video" | "document" {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXTENSIONS.includes(ext) || mime.startsWith("video/")) {
    return "video";
  }
  return "document";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const rawFiles = formData.getAll("files");
    const rawLinks = formData.getAll("links");

    const files = rawFiles.filter((f): f is File => f instanceof File);
    const links = rawLinks
      .map((l) => (typeof l === "string" ? l.trim() : ""))
      .filter(Boolean);

    if (files.length === 0 && links.length === 0) {
      return NextResponse.json(
        { message: "No files or links provided" },
        { status: 400 }
      );
    }

    const meetingId = crypto.randomUUID();

    const filesSummary = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: classifyFile(f.name, f.type),
      mime: f.type,
    }));

    console.log(
      JSON.stringify({
        event: "meeting_upload",
        meeting_id: meetingId,
        file_count: files.length,
        link_count: links.length,
        files: filesSummary,
        links,
      })
    );

    return NextResponse.json(
      {
        meeting_id: meetingId,
        status: "uploaded",
        file_count: files.length,
        link_count: links.length,
        files: filesSummary,
        links,
        message: `Received ${files.length} file(s) and ${links.length} link(s). Ready for review.`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
