import { NextRequest } from "next/server";

import { ADK_APP_NAME, ADK_BASE_URL } from "@/lib/adk-config";

export const runtime = "nodejs";

function parseAdkErrorBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "Request failed";
  try {
    const j = JSON.parse(trimmed) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail) && j.detail[0] && typeof (j.detail[0] as { msg?: string }).msg === "string") {
      return (j.detail[0] as { msg: string }).msg;
    }
  } catch {
    /* plain text */
  }
  return trimmed;
}

export async function POST(req: NextRequest) {
  let body: {
    userId?: string;
    sessionId?: string;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = body.userId;
  const sessionId = body.sessionId;
  const message = body.message;

  if (!userId || !sessionId || !message?.trim()) {
    return new Response(
      JSON.stringify({
        error: "userId, sessionId, and message are required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let adkRes: Response;
  try {
    adkRes = await fetch(`${ADK_BASE_URL}/run_sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: ADK_APP_NAME,
        user_id: userId,
        session_id: sessionId,
        streaming: true,
        new_message: {
          role: "user",
          parts: [{ text: message.trim() }],
        },
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        error: `Cannot reach ADK at ${ADK_BASE_URL}. Start the API (e.g. ./run_local.sh).`,
        detail: msg,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!adkRes.ok) {
    const text = await adkRes.text();
    const errorMessage = parseAdkErrorBody(text);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: adkRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const streamBody = adkRes.body;
  if (!streamBody) {
    return new Response(
      JSON.stringify({ error: "ADK returned an empty body for streaming." }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(streamBody, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
