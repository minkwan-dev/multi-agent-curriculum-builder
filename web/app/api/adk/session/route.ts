import { NextRequest, NextResponse } from "next/server";

import { ADK_APP_NAME, ADK_BASE_URL } from "@/lib/adk-config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { userId?: string; sessionId?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const userId =
    typeof body.userId === "string" && body.userId.length > 0
      ? body.userId
      : "web-user";

  const url = `${ADK_BASE_URL}/apps/${encodeURIComponent(ADK_APP_NAME)}/users/${encodeURIComponent(userId)}/sessions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        body.sessionId ? { sessionId: body.sessionId } : {},
      ),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Cannot reach ADK at ${ADK_BASE_URL}. Start the API (e.g. ./run_local.sh) and check ADK_BASE_URL.`,
        detail: msg,
      },
      { status: 503 },
    );
  }

  const raw = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      { error: raw || res.statusText || `HTTP ${res.status}` },
      { status: res.status },
    );
  }

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json(
      { error: "ADK returned non-JSON when creating a session.", raw: raw.slice(0, 500) },
      { status: 502 },
    );
  }

  const session = parsed as { id?: string };
  const id = session?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Session response missing id.", parsed },
      { status: 502 },
    );
  }

  return NextResponse.json({
    sessionId: id,
    userId,
    appName: ADK_APP_NAME,
  });
}
