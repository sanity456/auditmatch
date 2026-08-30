import type {Application, Brief, Policy, PolicyResult, Verdict} from "./types";

export const CODE_LABELS: Record<string, string> = {
  M: "Material match",
  P: "Partial support",
  N: "Mismatch / conflict",
  U: "Unclear",
};

export function briefStateLabel(state: Brief["state"], context: "list" | "detail" = "list"): string {
  return {
    DRAFT: {list: "Draft", detail: "Draft — not accepting applications"},
    OPEN: {list: "Open", detail: "Accepting applications"},
    MATCHED: {list: "Matched", detail: "Auditor selected"},
  }[state][context];
}

export function shortAddress(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatConfidence(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export function formatDate(unix: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(unix * 1000));
}

export function daysRemaining(
  expiresAtUnix: number,
  nowUnix = Math.floor(Date.now() / 1000),
): number {
  return Math.max(0, Math.ceil((expiresAtUnix - nowUnix) / 86_400));
}

export function criterionCode(application: Application | undefined, index: number): string {
  return application?.assessment?.criterionCodes[index] ?? "U";
}

export function findApplication(
  briefs: Brief[],
  applicationId: string,
): {brief: Brief; application: Application} | undefined {
  for (const brief of briefs) {
    const application = brief.applications.find((item) => item.id === applicationId);
    if (application) return {brief, application};
  }
  return undefined;
}

export function evaluateLocalPolicy(
  application: Application | undefined,
  policy: Policy,
  nowUnix = Math.floor(Date.now() / 1000),
): PolicyResult {
  if (!application) {
    return {
      satisfied: false,
      failureReasons: ["APPLICATION_NOT_FOUND"],
      assessmentId: "",
      verdict: "",
    };
  }
  const assessment = application.assessment;
  if (!assessment) {
    return {
      satisfied: false,
      failureReasons: ["ASSESSMENT_NOT_FOUND"],
      assessmentId: "",
      verdict: "",
    };
  }

  const failures: string[] = [];
  if (assessment.status !== "ACTIVE") failures.push("ASSESSMENT_NOT_ACTIVE");
  if (!policy.acceptedVerdicts.includes(assessment.verdict)) failures.push("VERDICT_NOT_ACCEPTED");
  if (assessment.confidenceBps < policy.minimumConfidenceBps) {
    failures.push("CONFIDENCE_BELOW_POLICY");
  }
  if (assessment.signalCount < policy.minimumSignals) failures.push("SIGNAL_COUNT_BELOW_POLICY");
  if (nowUnix > assessment.expiresAtUnix) failures.push("ASSESSMENT_EXPIRED");
  if (nowUnix - assessment.issuedAtUnix > policy.maximumAgeSeconds) {
    failures.push("ASSESSMENT_TOO_OLD");
  }

  return {
    satisfied: failures.length === 0,
    failureReasons: failures,
    assessmentId: assessment.id,
    verdict: assessment.verdict,
  };
}

export function verdictLabel(verdict: Verdict | ""): string {
  return {
    STRONG_MATCH: "Strong match",
    POTENTIAL_MATCH: "Potential match",
    NO_MATCH: "No match",
    INDETERMINATE: "Indeterminate",
    "": "Awaiting assessment",
  }[verdict];
}

export function policyToContractJson(policy: Policy): string {
  return JSON.stringify({
    accepted_verdicts: policy.acceptedVerdicts,
    minimum_confidence_bps: policy.minimumConfidenceBps,
    minimum_signals: policy.minimumSignals,
    maximum_age_seconds: policy.maximumAgeSeconds,
    require_latest: policy.requireLatest,
  });
}
