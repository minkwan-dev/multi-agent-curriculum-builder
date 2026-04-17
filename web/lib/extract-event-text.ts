/** Best-effort text extraction from ADK SSE JSON (camelCase from Pydantic). */
export function extractEventText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  if (typeof p.error === "string") return "";
  const content = p.content as
    | { parts?: Array<{ text?: string }> }
    | undefined;
  if (!content?.parts?.length) return "";
  return content.parts.map((part) => part.text ?? "").join("");
}

export function isUserEvent(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const author = (payload as { author?: string }).author;
  return author === "user";
}
