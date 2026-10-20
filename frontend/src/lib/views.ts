/**
 * The workbench is a single route with switchable views rather than a set of
 * separate pages, because every view renders the same scan. The sidebar and
 * the command palette both drive this key.
 */
export type ViewKey = "assessment" | "findings" | "patch" | "log" | "history";

export const VIEW_ORDER: ViewKey[] = ["assessment", "findings", "patch", "log", "history"];

export const VIEW_LABELS: Record<ViewKey, string> = {
  assessment: "Assessment",
  findings: "Findings",
  patch: "Remediation",
  log: "Run log",
  history: "History",
};

export const VIEW_DESCRIPTIONS: Record<ViewKey, string> = {
  assessment: "Risk verdict, reasoning and the six-dimension risk vector",
  findings: "Every vulnerability the agent extracted, with evidence",
  patch: "The generated unified diff and the steps to apply it",
  log: "Timestamped trace of every stage the pipeline executed",
  history: "Scans run from this browser",
};
