export type Verdict =
  | "STRONG_MATCH"
  | "POTENTIAL_MATCH"
  | "NO_MATCH"
  | "INDETERMINATE";

export type AssessmentStatus = "ACTIVE" | "CONTESTED" | "SUPERSEDED" | "UNKNOWN";
export type BriefState = "DRAFT" | "OPEN" | "MATCHED";
export type ApplicationState =
  | "EVIDENCE_SUBMITTED"
  | "ASSESSED"
  | "CONTESTED"
  | "SELECTED";

export type CriterionCode = "M" | "P" | "N" | "U";

export type Criterion = {
  key: string;
  text: string;
  required: boolean;
};

export type Assessment = {
  id: string;
  verdict: Verdict;
  status: AssessmentStatus;
  confidenceBps: number;
  signalCount: number;
  criterionCodes: string;
  reasonCodes: string[];
  evidenceUrls: string[];
  issuedAtUnix: number;
  expiresAtUnix: number;
};

export type Application = {
  id: string;
  briefId: string;
  auditorWallet: string;
  auditorName: string;
  profileSummary: string;
  conflictDisclosure: string;
  evidenceUrls: string[];
  state: ApplicationState;
  assessment?: Assessment;
};

export type Brief = {
  id: string;
  key: string;
  projectOwner: string;
  projectName: string;
  title: string;
  auditScope: string;
  engagementTerms: string;
  state: BriefState;
  validityDays: number;
  criteria: Criterion[];
  applications: Application[];
  selectedApplicationId: string;
  selectedAssessmentId: string;
  selectedAuditorWallet: string;
};

export type Policy = {
  acceptedVerdicts: Verdict[];
  minimumConfidenceBps: number;
  minimumSignals: number;
  maximumAgeSeconds: number;
  requireLatest: boolean;
};

export type PolicyResult = {
  satisfied: boolean;
  failureReasons: string[];
  assessmentId: string;
  verdict: Verdict | "";
};

export type WalletState = {
  address: `0x${string}`;
};
