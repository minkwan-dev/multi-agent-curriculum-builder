/** Maps ADK event `author` to a fixed pipeline step (orchestrator sub-agents). */
export const PIPELINE_STEPS = [
  {
    id: "researcher",
    title: "Research",
    caption: "Sources & notes",
  },
  {
    id: "judge",
    title: "Review",
    caption: "Quality check",
  },
  {
    id: "escalation_checker",
    title: "Gate",
    caption: "Pass or iterate",
  },
  {
    id: "content_builder",
    title: "Build",
    caption: "Curriculum draft",
  },
] as const;

export function authorToStepIndex(author: string | undefined): number | null {
  if (!author) return null;
  const idx = PIPELINE_STEPS.findIndex((s) => s.id === author);
  return idx >= 0 ? idx : null;
}
