/** Server-only ADK HTTP defaults (overridable via env). */
export const ADK_BASE_URL =
  process.env.ADK_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

export const ADK_APP_NAME = process.env.ADK_APP_NAME ?? "orchestrator";
