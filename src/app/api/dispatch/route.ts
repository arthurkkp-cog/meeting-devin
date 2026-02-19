import { NextResponse } from "next/server";

const ORG_ID = "org-d65e6cf722f44acbb7a75870f36593ca";

interface DispatchBody {
  meeting_id: string;
  prompt: string;
  api_key: string;
}

interface GitPermissionItem {
  git_connection_id?: string;
  git_permission_id?: string;
  group_prefix?: string;
  prefix_path?: string;
  repo_path?: string;
}

interface GitPermissionsResponse {
  items: GitPermissionItem[];
  end_cursor?: string | null;
  has_next_page?: boolean;
  total?: number | null;
}

async function fetchOrgRepos(apiToken: string): Promise<string[]> {
  const repos: string[] = [];
  let cursor: string | null = null;

  try {
    do {
      const url = new URL(
        `https://api.devin.ai/v3beta1/enterprise/organizations/${ORG_ID}/git-providers/permissions`
      );
      url.searchParams.set("first", "200");
      if (cursor) url.searchParams.set("after", cursor);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      if (!res.ok) {
        console.error(`Git permissions API returned ${res.status}: ${await res.text().catch(() => "")}`);
        break;
      }

      const data: GitPermissionsResponse = await res.json();
      for (const item of data.items ?? []) {
        if (item.repo_path) repos.push(item.repo_path);
        else if (item.group_prefix) repos.push(`${item.group_prefix} (group)`);
      }

      cursor = data.has_next_page ? (data.end_cursor ?? null) : null;
    } while (cursor);
  } catch (err) {
    console.error("Failed to fetch org repos:", err);
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
