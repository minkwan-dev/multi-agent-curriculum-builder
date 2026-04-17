"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  extractEventText,
  isUserEvent,
} from "@/lib/extract-event-text";
import {
  authorToStepIndex,
  PIPELINE_STEPS,
} from "@/lib/map-agent-step";

const STORAGE_USER = "curriculum_adk_user_id";
const STORAGE_SESSION = "curriculum_adk_session_id";

const SERVICE_NAME = "Vite";

type ChatMessage = { role: "user" | "assistant"; text: string };

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function ensureSession(userId: string): Promise<string> {
  const res = await fetch("/api/adk/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Could not create session.",
    );
  }
  const data = (await res.json()) as { sessionId: string };
  return data.sessionId;
}

function isSessionNotFoundMessage(message: string): boolean {
  return /session not found/i.test(message);
}

async function* parseSseJson(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((l) => l.trimEnd())
        .find((l) => l.startsWith("data: "));
      if (!line) continue;
      const jsonStr = line.slice("data: ".length).trim();
      if (!jsonStr) continue;
      try {
        yield JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        /* skip non-JSON */
      }
    }
  }
}

const SUGGESTIONS = [
  "4-week Python intro for beginners with weekly milestones",
  "8-week React + TypeScript bootcamp syllabus with projects",
  "Data analyst learning path from SQL to storytelling",
];

function stepVisualState(
  i: number,
  activeStep: number | null,
  sending: boolean,
): "idle" | "active" | "done" | "todo" {
  if (activeStep === null) return "idle";
  if (sending) {
    if (i < activeStep) return "done";
    if (i === activeStep) return "active";
    return "todo";
  }
  if (i <= activeStep) return "done";
  return "todo";
}

function AgentPipelineRail({
  sending,
  activeStep,
}: {
  sending: boolean;
  activeStep: number | null;
}) {
  const idx = activeStep ?? -1;
  const currentLabel =
    activeStep !== null ? PIPELINE_STEPS[activeStep].title : null;

  /** Connector before step `i` is complete once we have reached that step or beyond. */
  const segmentBeforeStepDone = (i: number) => idx >= i;

  return (
    <div className="rounded-2xl border border-[#D9E8DD] bg-[#FAFCFA] px-3 py-4 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A8F84]">
          Live pipeline
        </p>
        {sending && currentLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F3EB] px-2.5 py-0.5 text-[11px] font-medium text-[#3D6B4F]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6A9F78] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6A9F78]" />
            </span>
            Now · {currentLabel}
          </span>
        )}
        {!sending && activeStep !== null && (
          <span className="text-[11px] font-medium text-[#5C6B62]">
            Finished through · {PIPELINE_STEPS[activeStep].title}
          </span>
        )}
      </div>

      {/*
        One flex row: [step column][connector][step column]…
        Each step column stacks circle + labels so text always centers under its circle.
        Columns use flex-[2] vs connectors flex-[1] so lines stay thinner than step bands.
      */}
      <div className="flex w-full min-w-0 items-start">
        {PIPELINE_STEPS.map((step, i) => {
          const vis = stepVisualState(i, activeStep, sending);

          return (
            <Fragment key={step.id}>
              {i > 0 && (
                <div
                  className={`mt-[15px] h-1 min-h-[4px] min-w-[10px] flex-[1_1_0%] shrink rounded-full transition-colors ${
                    segmentBeforeStepDone(i) ? "bg-[#6A9F78]" : "bg-[#D9E8DD]"
                  }`}
                  aria-hidden
                />
              )}
              <div className="flex min-w-0 flex-[2_1_0%] basis-0 flex-col items-center gap-2 px-0.5 sm:px-1">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all sm:h-9 sm:w-9 sm:text-xs ${
                    vis === "idle"
                      ? "bg-[#D9E8DD] text-[#7A8F84]"
                      : vis === "active"
                        ? "scale-105 bg-[#6A9F78] text-white shadow-[0_0_0_4px_rgba(106,159,120,0.28)]"
                        : vis === "done"
                          ? "bg-[#6A9F78] text-white"
                          : "bg-white text-[#7A8F84] ring-2 ring-[#D9E8DD]"
                  }`}
                >
                  {vis === "done" ? (
                    <svg
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="w-full min-w-0 text-center">
                  <p
                    className={`text-[10px] font-semibold leading-tight sm:text-[11px] ${
                      vis === "active" ? "text-[#1E2B22]" : "text-[#5C6B62]"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-[9px] leading-snug text-[#7A8F84] sm:text-[10px]">
                    {step.caption}
                  </p>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[10px] leading-snug text-[#7A8F84] sm:text-[11px]">
        Steps follow ADK event authors:{" "}
        <span className="font-mono text-[10px] text-[#5C6B62]">researcher</span>{" "}
        → <span className="font-mono text-[10px] text-[#5C6B62]">judge</span> →{" "}
        <span className="font-mono text-[10px] text-[#5C6B62]">
          escalation_checker
        </span>{" "}
        →{" "}
        <span className="font-mono text-[10px] text-[#5C6B62]">
          content_builder
        </span>
        . If the loop repeats, the highlight moves back to Research.
      </p>
    </div>
  );
}

export function CurriculumStudio() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [pipelineActiveStep, setPipelineActiveStep] = useState<number | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let uid = localStorage.getItem(STORAGE_USER);
        if (!uid) {
          uid = randomId();
          localStorage.setItem(STORAGE_USER, uid);
        }
        let sid = localStorage.getItem(STORAGE_SESSION);
        if (!sid) {
          sid = await ensureSession(uid);
          localStorage.setItem(STORAGE_SESSION, sid);
        }
        if (!cancelled) {
          setUserId(uid);
          setSessionId(sid);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : "Initialization failed.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const canSend = useMemo(
    () => ready && !!userId && !!sessionId && input.trim().length > 0 && !sending,
    [ready, userId, sessionId, input, sending],
  );

  const sendMessage = useCallback(async () => {
    if (!userId || !sessionId || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setStreamError(null);
    setPipelineActiveStep(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);

    let assistantText = "";

    setMessages((m) => [...m, { role: "assistant", text: "" }]);

    try {
      const postRun = (sid: string) =>
        fetch("/api/adk/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            sessionId: sid,
            message: text,
          }),
        });

      let res = await postRun(sessionId);

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const firstMsg =
          typeof errBody.error === "string"
            ? errBody.error
            : res.statusText || "Request failed";
        if (
          res.status === 404 &&
          isSessionNotFoundMessage(firstMsg) &&
          userId
        ) {
          localStorage.removeItem(STORAGE_SESSION);
          const newSid = await ensureSession(userId);
          localStorage.setItem(STORAGE_SESSION, newSid);
          setSessionId(newSid);
          res = await postRun(newSid);
        }
        if (!res.ok) {
          const errBody2 = await res.json().catch(() => ({}));
          throw new Error(
            typeof errBody2.error === "string"
              ? errBody2.error
              : firstMsg,
          );
        }
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Could not read response stream.");

      for await (const ev of parseSseJson(reader)) {
        if (typeof ev.error === "string") {
          throw new Error(ev.error);
        }
        const author = typeof ev.author === "string" ? ev.author : undefined;
        const stepIdx = authorToStepIndex(author);
        if (stepIdx !== null) {
          setPipelineActiveStep(stepIdx);
        }
        if (isUserEvent(ev)) continue;
        const piece = extractEventText(ev);
        if (!piece) continue;
        assistantText = piece;
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { role: "assistant", text: assistantText };
          }
          return next;
        });
      }

      if (!assistantText.trim()) {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.text.trim()) {
            next[next.length - 1] = {
              role: "assistant",
              text: "No text in the response. Check the ADK server logs.",
            };
          }
          return next;
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setStreamError(msg);
      setMessages((m) => {
        if (m.length === 0) return m;
        const next = [...m];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.text) {
          next.pop();
        }
        return next;
      });
    } finally {
      setSending(false);
    }
  }, [userId, sessionId, input, sending]);

  const newChat = useCallback(async () => {
    if (!userId) return;
    setStreamError(null);
    setMessages([]);
    setPipelineActiveStep(null);
    try {
      const sid = await ensureSession(userId);
      localStorage.setItem(STORAGE_SESSION, sid);
      setSessionId(sid);
    } catch (e) {
      setInitError(e instanceof Error ? e.message : "Could not start a new session.");
    }
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#F3F8F4] text-[#1E2B22]">
      <header className="sticky top-0 z-20 border-b border-[#D9E8DD] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-[1.65rem] font-extrabold leading-tight tracking-tight text-[#1E2B22] sm:text-[1.85rem]">
            {SERVICE_NAME}
          </p>
          <button
            type="button"
            onClick={newChat}
            disabled={!ready}
            className="rounded-xl border border-[#D9E8DD] bg-white px-4 py-2 text-sm font-semibold text-[#1E2B22] shadow-sm transition hover:bg-[#F3F8F4] disabled:opacity-50"
          >
            New chat
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
        <section className="mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[#E8F5EE] via-white to-[#F0F6F2] p-8 shadow-sm ring-1 ring-[#D9E8DD]/80 sm:p-10">
          <p className="mb-3 inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#3D6B4F] ring-1 ring-[#C5E1CD]">
            Google ADK · orchestrator
          </p>
          <h1 className="text-balance text-[2rem] font-extrabold leading-tight tracking-tight text-[#1E2B22] sm:text-[2.5rem]">
            From one brief
            <span className="text-[#5C8F6E]">, a full curriculum draft</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-relaxed text-[#5C6B62]">
            Remote agents gather sources, a judge checks quality, a gate decides
            whether to iterate, then the builder turns it into a structured
            course. Run{" "}
            <code className="rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-mono text-[#2A3D32] ring-1 ring-[#D9E8DD]">
              ./run_local.sh
            </code>{" "}
            so the API is available at{" "}
            <code className="rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-mono text-[#2A3D32] ring-1 ring-[#D9E8DD]">
              127.0.0.1:8000
            </code>
            .
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { t: "Research", d: "Search & notes" },
              { t: "Review", d: "Pass / revise" },
              { t: "Build", d: "Codelab-style outline" },
            ].map((x) => (
              <li
                key={x.t}
                className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-[#D9E8DD]"
              >
                <p className="text-sm font-bold text-[#1E2B22]">{x.t}</p>
                <p className="mt-1 text-xs text-[#7A8F84]">{x.d}</p>
              </li>
            ))}
          </ul>
        </section>

        {initError && (
          <div
            className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {initError}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-[#D9E8DD]">
          <div className="border-b border-[#EDF5EF] px-4 py-4 sm:px-6">
            <h2 className="text-sm font-bold text-[#1E2B22]">Conversation</h2>
            <p className="text-xs text-[#7A8F84]">
              {ready && sessionId
                ? `Session · ${sessionId.slice(0, 8)}…`
                : "Connecting…"}
            </p>
          </div>

          <div className="border-b border-[#EDF5EF] px-4 pb-4 pt-2 sm:px-6 sm:pt-3">
            <AgentPipelineRail
              sending={sending}
              activeStep={pipelineActiveStep}
            />
          </div>

          <div
            ref={scrollRef}
            className="max-h-[min(520px,70vh)] space-y-4 overflow-y-auto px-4 py-6 sm:px-6"
          >
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-medium text-[#5C6B62]">
                  What curriculum do you want to design?
                </p>
                <p className="mt-1 text-xs text-[#7A8F84]">
                  Tap an example to fill the box.
                </p>
                <div className="mt-6 flex max-w-lg flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="rounded-2xl border border-[#D9E8DD] bg-[#F7FBF8] px-4 py-3 text-left text-sm text-[#2A3D32] transition hover:border-[#6A9F78]/45 hover:bg-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={`${i}-${msg.role}`}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    msg.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-[#6A9F78] px-4 py-3 text-[15px] leading-relaxed text-white shadow-sm"
                      : "max-w-[92%] rounded-2xl rounded-bl-md bg-[#EDF5EF] px-4 py-3 text-[15px] leading-relaxed text-[#1E2B22]"
                  }
                >
                  {msg.text ? (
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  ) : sending && msg.role === "assistant" ? (
                    <div className="flex items-center gap-2 text-sm text-[#7A8F84]">
                      <span className="inline-flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6A9F78] [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6A9F78] [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6A9F78]" />
                      </span>
                      Generating…
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {streamError && (
            <div className="border-t border-[#EDF5EF] px-4 py-2 text-sm text-red-600 sm:px-6">
              {streamError}
            </div>
          )}

          <div className="border-t border-[#EDF5EF] p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="msg" className="sr-only">
                  Message
                </label>
                <textarea
                  id="msg"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="e.g. 6-week ML intro for non-majors with labs"
                  disabled={!ready || sending}
                  className="w-full resize-none rounded-2xl border border-[#D9E8DD] bg-[#F7FBF8] px-4 py-3 text-[15px] text-[#1E2B22] placeholder:text-[#9CA8A0] outline-none ring-0 transition focus:border-[#6A9F78] focus:bg-white focus:shadow-[0_0_0_3px_rgba(106,159,120,0.2)] disabled:opacity-60"
                />
                <p className="mt-2 text-xs text-[#7A8F84]">
                  Enter to send · Shift+Enter for newline
                </p>
              </div>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!canSend}
                className="shrink-0 rounded-2xl bg-[#6A9F78] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#558963] disabled:cursor-not-allowed disabled:bg-[#B5D4BF]"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
