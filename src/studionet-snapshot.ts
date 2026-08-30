import type {Brief} from "./types";

export const STUDIONET_SNAPSHOT_VERIFIED_AT = "2026-08-30T13:37:38.164Z";

const OWNER = "0x5aab9538b717de9f3380f86f00b698c79041bea7";
const AUDITOR = "0x7271c1592429f9152a2142b0b225fce033d511d3";
const BRIEF_ID = `${OWNER}:VAULT-Q4`;
const APPLICATION_ID = `${BRIEF_ID}:APP:${AUDITOR}`;
const ASSESSMENT_ID = `${APPLICATION_ID}:ASSESS:1`;

const VERIFIED_BRIEFS: Brief[] = [
  {
    id: BRIEF_ID,
    key: "VAULT-Q4",
    projectOwner: OWNER,
    projectName: "Meridian Treasury",
    title: "Multi-signature treasury vault review",
    auditScope:
      "Review signer rotation, transaction batching, emergency controls, upgrade permissions, and invariant coverage before treasury migration.",
    engagementTerms:
      "Three-week review window with a public final report and one remediation pass. Conflicts and prior protocol relationships must be disclosed.",
    state: "MATCHED",
    validityDays: 30,
    criteria: [
      {key: "SOLIDITY", text: "Recent Solidity audit work is publicly evidenced.", required: true},
      {key: "ACCESS", text: "Prior review of multisig, access control, or treasury systems.", required: true},
      {key: "REPORT", text: "A public report demonstrates actionable findings and remediation follow-up.", required: true},
      {key: "CONFLICT", text: "No material conflict with Meridian Treasury is evident.", required: true},
    ],
    applications: [
      {
        id: APPLICATION_ID,
        briefId: BRIEF_ID,
        auditorWallet: AUDITOR,
        auditorName: "E2E TEST ONLY - Reference Applicant",
        profileSummary:
          "Release-verification applicant controlled by the test operator. This wallet does not claim authorship of, employment by, or affiliation with the cited projects; the sources are public reference material used only to exercise AuditMatch evidence and policy plumbing.",
        conflictDisclosure:
          "E2E TEST ONLY. No real engagement or procurement relationship exists. The operator asserts no affiliation with Meridian Treasury or the cited projects, and this statement is not independent proof of absence of conflicts.",
        evidenceUrls: [
          "https://raw.githubusercontent.com/crytic/slither/master/README.md",
          "https://docs.soliditylang.org/en/latest/security-considerations.html",
        ],
        state: "SELECTED",
        assessment: {
          id: ASSESSMENT_ID,
          verdict: "INDETERMINATE",
          status: "ACTIVE",
          confidenceBps: 6000,
          signalCount: 2,
          criterionCodes: "UUUU",
          reasonCodes: ["REQUIRED_FIT_EVIDENCE_UNCLEAR", "MULTI_SOURCE_EVIDENCE"],
          evidenceUrls: [
            "https://raw.githubusercontent.com/crytic/slither/master/README.md",
            "https://docs.soliditylang.org/en/latest/security-considerations.html",
          ],
          issuedAtUnix: 1_788_089_508,
          expiresAtUnix: 1_790_681_508,
        },
      },
    ],
    selectedApplicationId: APPLICATION_ID,
    selectedAssessmentId: ASSESSMENT_ID,
    selectedAuditorWallet: AUDITOR,
  },
  {
    id: "0x711a82731dd421c1f821a9da99c6c04080f3a4bf:ATOMIC-20260830100549-16C7F4BF",
    key: "ATOMIC-20260830100549-16C7F4BF",
    projectOwner: "0x711a82731dd421c1f821a9da99c6c04080f3a4bf",
    projectName: "E2E TEST ONLY - AuditMatch 16C7F4BF",
    title: "E2E TEST ONLY - atomic publication verification",
    auditScope:
      "This non-production exercise verifies that one StudioNet transaction creates an open brief and freezes every submitted criterion.",
    engagementTerms:
      "No payment, token transfer, procurement, identity claim, auditor qualification, or real engagement is created by this test record.",
    state: "OPEN",
    validityDays: 14,
    criteria: [
      {key: "ATOMIC_COUNT", text: "The brief and all required criteria are committed through exactly one contract transaction.", required: true},
      {key: "ORDER_PRESERVED", text: "The frozen criterion order returned by the contract matches the submitted JSON order.", required: true},
      {key: "NO_PAYMENT", text: "The test transaction carries zero value and creates no payment or procurement relationship.", required: true},
      {key: "TEST_ONLY", text: "The permanent record is explicitly limited to AuditMatch release verification on StudioNet.", required: true},
    ],
    applications: [],
    selectedApplicationId: "",
    selectedAssessmentId: "",
    selectedAuditorWallet: "",
  },
];

export function buildVerifiedStudioNetSnapshot(): Brief[] {
  return VERIFIED_BRIEFS.map((brief) => ({
    ...brief,
    criteria: brief.criteria.map((criterion) => ({...criterion})),
    applications: brief.applications.map((application) => ({
      ...application,
      evidenceUrls: [...application.evidenceUrls],
      assessment: application.assessment
        ? {
            ...application.assessment,
            reasonCodes: [...application.assessment.reasonCodes],
            evidenceUrls: [...application.assessment.evidenceUrls],
          }
        : undefined,
    })),
  }));
}
