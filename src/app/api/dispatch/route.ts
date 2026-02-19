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

interface GitConnectionItem {
  git_connection_id?: string;
  git_provider_type?: string;
  host?: string;
  name?: string;
}

interface GitConnectionsResponse {
  items: GitConnectionItem[];
  end_cursor?: string | null;
  has_next_page?: boolean;
  total?: number | null;
}

interface RepoFetchResult {
  repos: string[];
  debug: string;
}

async function fetchConnections(apiToken: string): Promise<Map<string, string>> {
  const hostMap = new Map<string, string>();
  try {
    const res = await fetch(
      "https://api.devin.ai/v3beta1/enterprise/git-providers/connections?first=200",
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    if (res.ok) {
      const data: GitConnectionsResponse = await res.json();
      for (const conn of data.items ?? []) {
        if (conn.git_connection_id && conn.host) {
          hostMap.set(conn.git_connection_id, conn.host.replace(/\/$/, ""));
        }
      }
    }
  } catch {
    // connections fetch failed, will fall back to no host prefix
  }
  return hostMap;
}

async function fetchOrgRepos(apiToken: string): Promise<RepoFetchResult> {
  const repos: string[] = [];
  const debugLines: string[] = [];

  const hostMap = await fetchConnections(apiToken);
  debugLines.push(`Connections found: ${hostMap.size} (${[...hostMap.entries()].map(([id, h]) => `${id.slice(-8)}=${h}`).join(", ")})`);

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

      debugLines.push(`Permissions status: ${res.status}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        debugLines.push(`Error: ${errText.slice(0, 300)}`);
        break;
      }

      const data: GitPermissionsResponse = await res.json();
      debugLines.push(`Permissions items: ${data.items?.length ?? 0}`);

      for (const item of data.items ?? []) {
        const host = (item.git_connection_id && hostMap.get(item.git_connection_id)) || "";
        if (item.repo_path) {
          repos.push(host ? `${host}/${item.repo_path}` : item.repo_path);
        } else if (item.group_prefix) {
          repos.push(host ? `${host}/${item.group_prefix}/* (all repos in group)` : `${item.group_prefix} (group)`);
        }
      }

      cursor = data.has_next_page ? (data.end_cursor ?? null) : null;
    } while (cursor);
  } catch (err) {
    debugLines.push(`Exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  debugLines.push(`Final repos: ${repos.length}`);
  return { repos, debug: debugLines.join(" | ") };
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

    const { repos, debug: repoDebug } = await fetchOrgRepos(apiToken);

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
      message: `Successfully dispatched to Devin.${repos.length > 0 ? ` (${repos.length} repos included)` : " (0 repos found)"}`,
      repo_debug: repoDebug,
      repos_found: repos,
    });
  } catch (err) {
    console.error("Dispatch error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
