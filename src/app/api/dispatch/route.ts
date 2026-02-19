import { NextResponse } from "next/server";

const ORG_ID = "org-d65e6cf722f44acbb7a75870f36593ca";

const ORG_REPOS = [
  "arthurkkp-cog/angular-ngrx-nx-realworld",
  "arthurkkp-cog/angular_project_solution",
  "arthurkkp-cog/angular-realworld-example-app",
  "arthurkkp-cog/armeria",
  "arthurkkp-cog/bank-client",
  "arthurkkp-cog/bank-server",
  "arthurkkp-cog/Building-streaming-ETL-Data-pipeline",
  "arthurkkp-cog/centraldogma",
  "arthurkkp-cog/cert-manager",
  "arthurkkp-cog/chromium",
  "arthurkkp-cog/claude-code",
  "arthurkkp-cog/cli",
  "arthurkkp-cog/Cobol-Projects",
  "arthurkkp-cog/codex",
  "arthurkkp-cog/Express_CRUD",
  "arthurkkp-cog/fake-theta",
  "arthurkkp-cog/gateway-api",
  "arthurkkp-cog/graphql-kotlin",
  "arthurkkp-cog/grpc",
  "arthurkkp-cog/incubator-gluten",
  "arthurkkp-cog/liff-cli",
  "arthurkkp-cog/magentaA11y",
  "arthurkkp-cog/meter-data-pipeline-demo",
  "arthurkkp-cog/node-express-realworld-example-app",
  "arthurkkp-cog/obpm-active-waiting-demo",
  "arthurkkp-cog/openai-agents-python",
  "arthurkkp-cog/opencv",
  "arthurkkp-cog/opentitan",
  "arthurkkp-cog/react-redux-realworld-example-app",
  "arthurkkp-cog/SONiC",
  "arthurkkp-cog/sonic-buildimage",
  "arthurkkp-cog/sonic-sairedis",
  "arthurkkp-cog/sonic-swss",
  "arthurkkp-cog/spring-boot-realworld-example-app",
  "arthurkkp-cog/sql-support-bot",
  "arthurkkp-cog/subtle-fi",
  "arthurkkp-cog/swarm",
  "arthurkkp-cog/terraform-provider-databricks",
  "arthurkkp-cog/theta-ble-client",
  "arthurkkp-cog/theta-client",
  "arthurkkp-cog/venice",
  "arthurkkp-cog/vue-realworld-example-app",
];

interface DispatchBody {
  meeting_id: string;
  prompt: string;
  api_key: string;
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

    const reposSection = `\n\n---\n\n## Available Repositories\n\nYou have access to the following repositories in the org. Reference any of these as needed:\n${ORG_REPOS.map((r) => `- ${r}`).join("\n")}`;
    const fullPrompt = body.prompt + reposSection;

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
      })
    );

    return NextResponse.json({
      meeting_id: body.meeting_id,
      session_url: sessionUrl,
      status: "dispatched",
      message: "Successfully dispatched to Devin.",
    });
  } catch (err) {
    console.error("Dispatch error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
