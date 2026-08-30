import type {Brief} from "./types";

const PROJECT = "0x4A0d870e55e0d6E6f226Dc44dA96D3B25b2a1047";
const CINDER = "0x86F0b9B539415c71E62754f58Ba42D4Dfe4D8c12";
const NORTHSTAR = "0xA8A7A6b7A8025DF81CF0DabFc0cDdB13021E2456";
const HEXLOOM = "0xF113AaF1632f47A436E68A41E7C1A57527a2F048";
const SLITHER_REFERENCE = "https://raw.githubusercontent.com/crytic/slither/master/README.md";
const SOLIDITY_REFERENCE = "https://docs.soliditylang.org/en/latest/security-considerations.html";
const ETHEREUM_REFERENCE = "https://ethereum.org/en/developers/docs/smart-contracts/security/";
const OWASP_REFERENCE = "https://owasp.org/www-project-smart-contract-top-10/";

export function buildDemoBriefs(nowUnix = Math.floor(Date.now() / 1000)): Brief[] {
  const briefId = `${PROJECT.toLowerCase()}:BRIDGE-V2`;
  const criteria = [
    {
      key: "SOLIDITY",
      text: "Recent hands-on Solidity smart contract security work.",
      required: true,
    },
    {
      key: "BRIDGES",
      text: "Prior review of bridge, messaging, or validator-quorum risk.",
      required: true,
    },
    {
      key: "REPORTS",
      text: "A public report with clear findings and remediation verification.",
      required: true,
    },
    {
      key: "INDEPENDENCE",
      text: "No material conflict with SeaGlass Protocol.",
      required: true,
    },
  ];

  return [
    {
      id: briefId,
      key: "BRIDGE-V2",
      projectOwner: PROJECT,
      projectName: "SeaGlass Protocol",
      title: "Cross-chain bridge v2 security audit",
      auditScope:
        "Review the Solidity bridge, validator quorum, relayer paths, upgrade controls, and invariant tests before the v2 mainnet release.",
      engagementTerms:
        "Four-week review window · public evidence required · conflict disclosure mandatory · remediation review included.",
      state: "OPEN",
      validityDays: 30,
      criteria,
      selectedApplicationId: "",
      selectedAssessmentId: "",
      selectedAuditorWallet: "",
      applications: [
        {
          id: `${briefId}:APP:${CINDER.toLowerCase()}`,
          briefId,
          auditorWallet: CINDER,
          auditorName: "Cinder Security",
          profileSummary:
            "Fictional Preview applicant used to demonstrate a positive match. The cited links are public security references, not proof of this sample team's identity, work, or endorsement.",
          conflictDisclosure:
            "Sample disclosure only: no real team, engagement, investment, employment, token allocation, or procurement relationship is represented.",
          evidenceUrls: [
            SLITHER_REFERENCE,
            SOLIDITY_REFERENCE,
          ],
          state: "ASSESSED",
          assessment: {
            id: `${briefId}:APP:${CINDER.toLowerCase()}:ASSESS:1`,
            verdict: "STRONG_MATCH",
            status: "ACTIVE",
            confidenceBps: 9000,
            signalCount: 2,
            criterionCodes: "MMMM",
            reasonCodes: ["ALL_REQUIRED_FIT_CRITERIA_MET", "MULTI_SOURCE_EVIDENCE"],
            evidenceUrls: [
              SLITHER_REFERENCE,
              SOLIDITY_REFERENCE,
            ],
            issuedAtUnix: nowUnix - 2 * 86_400,
            expiresAtUnix: nowUnix + 28 * 86_400,
          },
        },
        {
          id: `${briefId}:APP:${NORTHSTAR.toLowerCase()}`,
          briefId,
          auditorWallet: NORTHSTAR,
          auditorName: "Northstar Labs",
          profileSummary:
            "Fictional Preview applicant used to demonstrate a partial match. Public educational references stand in for evidence; they do not establish identity, authorship, or qualifications.",
          conflictDisclosure:
            "Sample disclosure only: the fictional applicant reports a prior dependency review; no real-world relationship or conflict claim is made.",
          evidenceUrls: [
            ETHEREUM_REFERENCE,
            OWASP_REFERENCE,
          ],
          state: "ASSESSED",
          assessment: {
            id: `${briefId}:APP:${NORTHSTAR.toLowerCase()}:ASSESS:1`,
            verdict: "POTENTIAL_MATCH",
            status: "ACTIVE",
            confidenceBps: 8625,
            signalCount: 2,
            criterionCodes: "MPMM",
            reasonCodes: ["PARTIAL_REQUIRED_FIT_SUPPORT", "MULTI_SOURCE_EVIDENCE"],
            evidenceUrls: [
              ETHEREUM_REFERENCE,
              OWASP_REFERENCE,
            ],
            issuedAtUnix: nowUnix - 86_400,
            expiresAtUnix: nowUnix + 29 * 86_400,
          },
        },
        {
          id: `${briefId}:APP:${HEXLOOM.toLowerCase()}`,
          briefId,
          auditorWallet: HEXLOOM,
          auditorName: "Hexloom Research",
          profileSummary:
            "Fictional Preview applicant waiting for a simulated assessment. The public references exercise the interface and are not attributed to this sample identity.",
          conflictDisclosure:
            "Sample disclosure only: no real applicant, engagement, affiliation, or financial relationship is represented.",
          evidenceUrls: [
            SLITHER_REFERENCE,
            OWASP_REFERENCE,
          ],
          state: "EVIDENCE_SUBMITTED",
        },
      ],
    },
    {
      id: `${PROJECT.toLowerCase()}:ZK-PROVER`,
      key: "ZK-PROVER",
      projectOwner: PROJECT,
      projectName: "Lattice Rollup",
      title: "ZK prover and circuit constraint review",
      auditScope:
        "Review circuit constraints, witness generation, recursion assumptions, and prover integration for the production release.",
      engagementTerms:
        "Three-week review · Circom and Rust evidence preferred · responsible disclosure terms frozen in the brief.",
      state: "OPEN",
      validityDays: 21,
      criteria: [
        {key: "CIRCUITS", text: "Public zero-knowledge circuit review experience.", required: true},
        {key: "RUST", text: "Rust prover integration experience.", required: true},
        {key: "DISCLOSURE", text: "No material project conflict.", required: true},
      ],
      selectedApplicationId: "",
      selectedAssessmentId: "",
      selectedAuditorWallet: "",
      applications: [],
    },
  ];
}
