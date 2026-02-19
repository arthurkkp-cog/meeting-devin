import { NextResponse } from "next/server";

const ORG_ID = "org-d65e6cf722f44acbb7a75870f36593ca";

interface DispatchBody {
  meeting_id: string;
  prompt: string;
  api_key: string;
}

interface GitPermission {
  repo_path?: string;
  group_prefix?: string;
  repo_url?: string;
  group_prefix_url?: string;
}

async function fetchOrgRepos(apiToken: string): Promise<string[]> {
  const repos: string[] = [];

  try {
    const permsRes = await fetch(
      `https://api.devin.ai/v3beta1/organizations/${ORG_ID}/git-providers/permissions`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    );

    if (permsRes.ok) {
      const permsData = await permsRes.json();
      const permissions: GitPermission[] =
        permsData.permissions ?? permsData.data ?? (Array.isArray(permsData) ? permsData : []);
      for (const p of permissions) {
        if (p.repo_path) repos.push(p.repo_url ?? p.repo_path);
        else if (p.group_prefix)
          repos.push(`${p.group_prefix_url ?? p.group_prefix} (group)`);
      }
      if (repos.length > 0) return repos;
    }
  } catch {
    // v3 endpoint not available, try v2
  }

  try {
    const v2Res = await fetch(
      `https://api.devin.ai/v2/enterprise/organizations/${ORG_ID}/permissions?limit=200`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    );

    if (v2Res.ok) {
      const v2Data = await v2Res.json();
      const permissions: GitPermission[] =
        v2Data.permissions ?? v2Data.data ?? (Array.isArray(v2Data) ? v2Data : []);
      for (const p of permissions) {
        if (p.repo_path) repos.push(p.repo_url ?? p.repo_path);
        else if (p.group_prefix)
          repos.push(`${p.group_prefix_url ?? p.group_prefix} (group)`);
      }
    }
  } catch {
    // v2 also not available
  }

  return repos;
}

export async function POST(request: Request) {
  try {
    const body: DispatchBody = await request.json();

    if (!body.meeting_id || !body.prompt?.trim()) {
      return NextResponse.json(
        { message: "meeting_id and prompt are required" },
        { status: 400 }
      );
    }

    const apiToken = body.api_key?.trim() || process.env.DEVIN_API_TOKEN;
    if (!apiToken) {
      return NextResponse.json(
        {
          meeting_id: body.meeting_id,
          session_url: null,
          status: "failed",
          message:
            "No API key provided. Enter your Devin API key or set DEVIN_API_TOKEN as an environment variable.",
        },
        { status: 400 }
      );
    }

    const repos = await fetchOrgRepos(apiToken);

    let fullPrompt = body.prompt;
    if (repos.length > 0) {
      const reposSection = `\n\n---\n\n## Available Repositories\n\nYou have access to the following repositories in the org. Reference any of these as needed:\n${repos.map((r) => `- ${r}`).join("\n")}`;
      fullPrompt += reposSection;
    }

    const res = await fetch(
      `https://api.devin.ai/v3beta1/organizations/${ORG_ID}/sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        JSON.stringify({
          event: "devin_dispatch_error",
          meeting_id: body.meeting_id,
          status: res.status,
          body: errBody,
        })
      );
      return NextResponse.json(
        {
          meeting_id: body.meeting_id,
          session_url: null,
          status: "failed",
          message: `Devin API returned ${res.status}: ${errBody}`,
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    const sessionUrl: string = data.url ?? null;

    console.log(
      JSON.stringify({
        event: "devin_dispatch_success",
        meeting_id: body.meeting_id,
        session_url: sessionUrl,
        repos_count: repos.length,
      })
    );

    return NextResponse.json({
      meeting_id: body.meeting_id,
      session_url: sessionUrl,
      status: "dispatched",
      message: `Successfully dispatched to Devin.${repos.length > 0 ? ` (${repos.length} repos included)` : ""}`,
    });
  } catch (err) {
    console.error("Dispatch error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
