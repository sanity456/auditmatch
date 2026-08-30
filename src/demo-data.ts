import type {Brief} from "./types";

const PROJECT = "0x4A0d870e55e0d6E6f226Dc44dA96D3B25b2a1047";
const CINDER = "0x86F0b9B539415c71E62754f58Ba42D4Dfe4D8c12";
const NORTHSTAR = "0xA8A7A6b7A8025DF81CF0DabFc0cDdB13021E2456";
const HEXLOOM = "0xF113AaF1632f47A436E68A41E7C1A57527a2F048";

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
            "Independent security team focused on Solidity bridges, cross-chain messaging, and invariant-driven review.",
          conflictDisclosure:
            "No investment, employment, token allocation, or prior paid relationship with SeaGlass Protocol.",
          evidenceUrls: [
            "https://github.com/cinder-security/audits",
            "https://cindersec.example.com/research/bridge-invariants",
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
              "https://github.com/cinder-security/audits",
              "https://cindersec.example.com/research/bridge-invariants",
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
            "Protocol review collective with strong Solidity coverage and public DeFi reports.",
          conflictDisclosure:
            "Previously reviewed one SeaGlass dependency; no direct financial relationship disclosed.",
          evidenceUrls: [
            "https://github.com/northstar-labs/public-reports",
            "https://northstar.example.org/capabilities",
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
              "https://github.com/northstar-labs/public-reports",
              "https://northstar.example.org/capabilities",
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
            "Small research collective specializing in cross-chain state machines and formal invariant design.",
          conflictDisclosure:
            "No prior engagement or financial relationship with SeaGlass Protocol is disclosed.",
          evidenceUrls: [
            "https://github.com/hexloom-research/reports",
            "https://hexloom.example.net/work",
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
