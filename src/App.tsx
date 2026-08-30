import {useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode} from "react";

import {HAS_LIVE_DEPLOYMENT} from "./config";
import {buildDemoBriefs} from "./demo-data";
import {
  CODE_LABELS,
  briefStateLabel,
  criterionCode,
  daysRemaining,
  evaluateLocalPolicy,
  findApplication,
  formatConfidence,
  formatDate,
  shortAddress,
  verdictLabel,
} from "./model";
import {
  STUDIONET_EXPLORER_URL,
  activityCopy,
  awaitingSignature,
  canChangeDataMode,
  policyAcceptsException,
  requiresSelectionAcknowledgement,
  transactionFailed,
  transactionFinalized,
  transactionSubmitted,
  walletRole,
  type AppActivity,
  type TransactionActivity,
  type WalletRole,
} from "./release-state";
import type {
  Application,
  Assessment,
  Brief,
  Criterion,
  Policy,
  PolicyResult,
  Verdict,
  WalletState,
} from "./types";

type Page = "marketplace" | "post" | "policy" | "expansion";
type Mode = "preview" | "live";

type NewBriefDraft = {
  key: string;
  projectName: string;
  title: string;
  auditScope: string;
  engagementTerms: string;
  validityDays: number;
  criteria: Criterion[];
};

type ApplicationDraft = {
  auditorName: string;
  profileSummary: string;
  conflictDisclosure: string;
  evidenceUrls: string[];
};

const PREVIEW_PROJECT = "0x4A0d870e55e0d6E6f226Dc44dA96D3B25b2a1047";
const PREVIEW_AUDITOR = "0xD3fA8d28f91C5420E48F4716308F8597A36b11C9";

const DEFAULT_POLICY: Policy = {
  acceptedVerdicts: ["STRONG_MATCH"],
  minimumConfidenceBps: 8500,
  minimumSignals: 2,
  maximumAgeSeconds: 30 * 86_400,
  requireLatest: true,
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

function Icon({name, size = 18}: {name: string; size?: number}) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    shield: <path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6l-7-3Z" />,
    link: <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />,
    wallet: <path d="M4 7h15a2 2 0 0 1 2 2v9H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13v4m-2 5h2" />,
    refresh: <path d="M20 7v5h-5M4 17v-5h5m9.5-4.5A8 8 0 0 0 5.3 6M5.5 16.5A8 8 0 0 0 18.7 18" />,
    spark: <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Zm7 11 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function verdictTone(verdict: Verdict | "") {
  if (verdict === "STRONG_MATCH") return "positive";
  if (verdict === "POTENTIAL_MATCH") return "caution";
  if (verdict === "NO_MATCH") return "negative";
  return "neutral";
}

function StatusPill({children, tone = "neutral"}: {children: ReactNode; tone?: string}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function EmptyState({title, copy}: {title: string; copy: string}) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name="shield" size={24} /></div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function NetworkDiagram() {
  return (
    <div className="network-diagram" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="core-node"><BrandMark /></div>
      {["source", "validator", "validator", "policy", "validator"].map((kind, index) => (
        <span key={`${kind}-${index}`} className={`diagram-node node-${index + 1}`}>
          {kind === "validator" ? "V" : kind === "source" ? "↗" : "✓"}
        </span>
      ))}
      <span className="diagram-caption caption-one">live evidence</span>
      <span className="diagram-caption caption-two">5× replay</span>
      <span className="diagram-caption caption-three">policy read</span>
    </div>
  );
}

function Header({
  page,
  mode,
  wallet,
  role,
  activity,
  onNavigate,
  onMode,
  onConnect,
}: {
  page: Page;
  mode: Mode;
  wallet?: WalletState;
  role: WalletRole;
  activity: AppActivity;
  onNavigate: (page: Page) => void;
  onMode: (mode: Mode) => void;
  onConnect: () => void;
}) {
  const busy = activity !== "idle";
  const modeChangeDisabled = !canChangeDataMode(activity);
  const nav: Array<{id: Page; label: string}> = [
    {id: "marketplace", label: "Matches"},
    {id: "post", label: "Post a brief"},
    {id: "policy", label: "Policy lab"},
    {id: "expansion", label: "Roadmap"},
  ];
  return (
    <header className="site-header">
      <button className="brand" type="button" aria-label="AuditMatch home" onClick={() => onNavigate("marketplace")}>
        <BrandMark />
        <span>AuditMatch</span>
      </button>
      <nav aria-label="Primary navigation">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={page === item.id ? "active" : ""}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <div className="mode-toggle" role="group" aria-label="Data mode">
          <button
            type="button"
            className={mode === "preview" ? "active" : ""}
            disabled={modeChangeDisabled}
            onClick={() => onMode("preview")}
          >
            Preview
          </button>
          <button
            type="button"
            className={mode === "live" ? "active" : ""}
            disabled={modeChangeDisabled}
            onClick={() => onMode("live")}
          >
            StudioNet
          </button>
        </div>
        {mode === "live" ? (
          <button
            className="wallet-button"
            type="button"
            aria-label={wallet ? `Connected wallet ${shortAddress(wallet.address)}. ${role}` : "Connect MetaMask"}
            disabled={busy}
            onClick={onConnect}
          >
            <Icon name="wallet" />
            {activity === "connecting-wallet" ? (
              <span>Connecting…</span>
            ) : wallet ? (
              <span className="wallet-identity">
                <strong>{shortAddress(wallet.address)}</strong>
                <small>{role}</small>
              </span>
            ) : "Connect MetaMask"}
          </button>
        ) : (
          <span className="preview-chip"><span /> No chain writes</span>
        )}
      </div>
    </header>
  );
}

function LiveActivityBar({activity}: {activity: AppActivity}) {
  if (activity === "idle") return null;
  return (
    <div className="live-activity" role="status" aria-live="polite">
      <span />
      {activityCopy(activity)}
    </div>
  );
}

function TransactionTracker({
  transaction,
  onDismiss,
}: {
  transaction?: TransactionActivity;
  onDismiss: () => void;
}) {
  if (!transaction) return null;
  const statusCopy = {
    AWAITING_SIGNATURE: "Confirm in MetaMask",
    FINALIZING: "Submitted · waiting for StudioNet finality",
    FINALIZED: "Finalized · execution succeeded",
    FAILED: "Transaction not completed",
  }[transaction.status];
  return (
    <aside className={`transaction-tracker transaction-${transaction.status.toLowerCase()}`} role="status" aria-live="polite">
      <span className="transaction-pulse" />
      <div>
        <strong>{transaction.action}</strong>
        <small>{statusCopy}</small>
        {transaction.error && <p>{transaction.error}</p>}
      </div>
      {transaction.hash && (
        <a href={`${STUDIONET_EXPLORER_URL}/tx/${transaction.hash}`} target="_blank" rel="noreferrer">
          {shortAddress(transaction.hash, 10, 8)} <Icon name="arrow" size={14} />
        </a>
      )}
      {(transaction.status === "FINALIZED" || transaction.status === "FAILED") && (
        <button type="button" aria-label="Dismiss transaction status" onClick={onDismiss}><Icon name="close" size={15} /></button>
      )}
    </aside>
  );
}

function Hero({onOpenDemo, onPost}: {onOpenDemo: () => void; onPost: () => void}) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span /> GenLayer-native auditor discovery</div>
        <h1>Evidence before <em>introductions.</em></h1>
        <p>
          Match a security brief with auditors whose public work, specialization,
          availability claims, and conflict disclosures survive independent validator replay.
        </p>
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={onOpenDemo}>
            Run a sample match <Icon name="arrow" />
          </button>
          <button className="button button-ghost" type="button" onClick={onPost}>
            Post an audit brief
          </button>
        </div>
        <div className="hero-proof">
          <span><Icon name="check" /> Live HTTPS evidence</span>
          <span><Icon name="check" /> Independent replay</span>
          <span><Icon name="check" /> Expiring assessments</span>
        </div>
      </div>
      <div className="hero-visual">
        <NetworkDiagram />
        <div className="floating-card validator-card">
          <span className="pulse" />
          <div><strong>5 validators</strong><small>same criterion vector</small></div>
          <b>MMMM</b>
        </div>
        <div className="floating-card policy-card">
          <small>Deterministic read</small>
          <strong><Icon name="check" /> Satisfied</strong>
        </div>
      </div>
    </section>
  );
}

function OverviewStats({briefs}: {briefs: Brief[]}) {
  const applications = briefs.flatMap((brief) => brief.applications);
  const assessed = applications.filter((application) => application.assessment);
  const avg = assessed.length
    ? Math.round(assessed.reduce((sum, item) => sum + (item.assessment?.confidenceBps ?? 0), 0) / assessed.length)
    : 0;
  return (
    <div className="stats-row" role="region" aria-label="Registry summary">
      <div><strong>{briefs.filter((brief) => brief.state === "OPEN").length}</strong><span>open briefs</span></div>
      <div><strong>{applications.length}</strong><span>auditor applications</span></div>
      <div><strong>{assessed.length}</strong><span>consensus assessments</span></div>
      <div><strong>{avg ? formatConfidence(avg) : "—"}</strong><span>avg. decisiveness</span></div>
    </div>
  );
}

function BriefSelector({
  briefs,
  selectedId,
  onSelect,
}: {
  briefs: Brief[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="brief-list" aria-label="Audit briefs">
      <div className="section-kicker"><span>01</span> Open registry</div>
      {briefs.map((brief) => (
        <button
          type="button"
          key={brief.id}
          className={`brief-list-item ${brief.id === selectedId ? "selected" : ""}`}
          onClick={() => onSelect(brief.id)}
        >
          <span className="brief-list-top">
            <b>{brief.projectName}</b>
            <StatusPill tone={brief.state === "MATCHED" ? "positive" : "neutral"}>
              {briefStateLabel(brief.state)}
            </StatusPill>
          </span>
          <strong>{brief.title}</strong>
          <span className="brief-list-meta">
            {brief.criteria.length} criteria · {brief.applications.length} candidates
          </span>
        </button>
      ))}
    </aside>
  );
}

function CandidateList({
  applications,
  selectedId,
  onSelect,
  onApply,
  canApply,
}: {
  applications: Application[];
  selectedId: string;
  onSelect: (id: string) => void;
  onApply: () => void;
  canApply: boolean;
}) {
  return (
    <aside className="candidate-list">
      <div className="candidate-list-heading">
        <div><span>Candidates</span><strong>{applications.length.toString().padStart(2, "0")}</strong></div>
      </div>
      {applications.length === 0 ? (
        <p className="candidate-empty">No applications yet.{canApply ? " The evidence window is open." : ""}</p>
      ) : (
        applications.map((application, index) => (
          <button
            key={application.id}
            type="button"
            className={`candidate-item ${selectedId === application.id ? "selected" : ""}`}
            onClick={() => onSelect(application.id)}
          >
            <span className="candidate-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="candidate-name">
              <strong>{application.auditorName}</strong>
              <small>{application.assessment ? verdictLabel(application.assessment.verdict) : "Awaiting consensus"}</small>
            </span>
            <span className="candidate-score">
              {application.assessment ? formatConfidence(application.assessment.confidenceBps) : "—"}
            </span>
          </button>
        ))
      )}
      {canApply && (
        <button className="apply-link" type="button" onClick={onApply}>
          <Icon name="plus" /> Apply as an auditor
        </button>
      )}
    </aside>
  );
}

function AssessmentPanel({
  brief,
  application,
  activity,
  progress,
  onAssess,
  onRecheck,
  onPolicy,
}: {
  brief: Brief;
  application?: Application;
  activity: AppActivity;
  progress: string;
  onAssess: () => void;
  onRecheck: () => void;
  onPolicy: () => void;
}) {
  const busy = activity !== "idle";
  if (!application) {
    return <EmptyState title="Choose a candidate" copy="Select an auditor application to inspect its evidence and fit assessment." />;
  }
  const assessment = application.assessment;
  return (
    <article className="assessment-panel">
      <div className="assessment-header">
        <div className="auditor-avatar" aria-hidden="true">
          {application.auditorName.split(" ").map((part) => part[0]).join("").slice(0, 2)}
        </div>
        <div className="auditor-title">
          <span>Wallet-bound application</span>
          <h3>{application.auditorName}</h3>
          <code>{shortAddress(application.auditorWallet, 8, 6)}</code>
        </div>
        <StatusPill tone={verdictTone(assessment?.verdict ?? "")}>
          {assessment ? verdictLabel(assessment.verdict) : "Evidence submitted"}
        </StatusPill>
      </div>

      <p className="profile-summary">{application.profileSummary}</p>

      {!assessment ? (
        <div className="run-consensus-card">
          <div className="consensus-icon"><Icon name="spark" size={24} /></div>
          <div>
            <span className="section-kicker"><span>AI</span> Intelligent transaction</span>
            <h4>Evidence is ready for validator review.</h4>
            <p>
              Every validator will fetch {application.evidenceUrls.length} public sources and independently
              return the same ordered criterion vector.
            </p>
          </div>
          <button className="button button-primary" type="button" disabled={busy} onClick={onAssess}>
            {activity === "assessing" ? "Consensus running…" : "Run GenLayer match"}
            {activity !== "assessing" && <Icon name="arrow" />}
          </button>
          {progress && <div className="progress-line" aria-live="polite"><span /> {progress}</div>}
        </div>
      ) : (
        <>
          <div className="assessment-summary">
            <div
              className="score-ring"
              style={{background: `conic-gradient(var(--accent) ${assessment.confidenceBps * 0.036}deg, var(--line) 0deg)`}}
            >
              <div><strong>{formatConfidence(assessment.confidenceBps)}</strong><span>decisive</span></div>
            </div>
            <div className="summary-metric"><strong>{assessment.signalCount}</strong><span>independent source domains</span></div>
            <div className="summary-metric"><strong>{daysRemaining(assessment.expiresAtUnix)}d</strong><span>until assessment expiry</span></div>
            <div className="summary-metric"><strong>{assessment.criterionCodes}</strong><span>consensus criterion vector</span></div>
          </div>

          <div className="criteria-results">
            <div className="subsection-title">
              <span>Frozen fit criteria</span>
              <small>Issued {formatDate(assessment.issuedAtUnix)}</small>
            </div>
            {brief.criteria.map((criterion, index) => {
              const code = criterionCode(application, index);
              return (
                <div className="criterion-result" key={criterion.key}>
                  <span className={`code code-${code.toLowerCase()}`}>{code}</span>
                  <div><strong>{criterion.key}</strong><p>{criterion.text}</p></div>
                  <span className="criterion-label">{CODE_LABELS[code]}</span>
                </div>
              );
            })}
          </div>

          <div className="disclosure-box">
            <span><Icon name="shield" /> Conflict disclosure</span>
            <p>{application.conflictDisclosure}</p>
          </div>

          <div className="evidence-section">
            <div className="subsection-title"><span>Cited public evidence</span><small>Fetched live at assessment</small></div>
            <div className="evidence-links">
              {application.evidenceUrls.map((url) => (
                <a href={url} target="_blank" rel="noreferrer" key={url}>
                  <Icon name="link" />
                  <span>{new URL(url).hostname}</span>
                  <small>{url.replace(/^https:\/\//, "").slice(0, 54)}</small>
                </a>
              ))}
            </div>
          </div>

          <div className="assessment-actions">
            <button className="button button-primary" type="button" onClick={onPolicy}>
              Test selection policy <Icon name="arrow" />
            </button>
            <button className="button button-ghost" type="button" disabled={busy} onClick={onRecheck}>
              <Icon name="refresh" /> {activity === "rechecking" ? "Rechecking…" : "Recheck sources"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function Marketplace({
  briefs,
  selectedBriefId,
  selectedApplicationId,
  activity,
  progress,
  onBrief,
  onApplication,
  onAssess,
  onRecheck,
  onPolicy,
  onApply,
  onPost,
}: {
  briefs: Brief[];
  selectedBriefId: string;
  selectedApplicationId: string;
  activity: AppActivity;
  progress: string;
  onBrief: (id: string) => void;
  onApplication: (id: string) => void;
  onAssess: () => void;
  onRecheck: () => void;
  onPolicy: () => void;
  onApply: () => void;
  onPost: () => void;
}) {
  const brief = briefs.find((item) => item.id === selectedBriefId) ?? briefs[0];
  const application = brief?.applications.find((item) => item.id === selectedApplicationId)
    ?? brief?.applications[0];
  const openDemo = () => {
    if (!briefs[0]) return;
    onBrief(briefs[0].id);
    const pending = briefs[0].applications.find((item) => !item.assessment);
    onApplication(pending?.id ?? briefs[0].applications[0]?.id ?? "");
    document.getElementById("registry")?.scrollIntoView({behavior: "smooth"});
  };

  return (
    <main>
      <Hero onOpenDemo={openDemo} onPost={onPost} />
      <OverviewStats briefs={briefs} />
      <section className="registry-section" id="registry" aria-labelledby="registry-title">
        <div className="section-heading">
          <div><span className="section-kicker"><span>Registry</span> Evidence-backed opportunities</span><h2 id="registry-title">Open security briefs</h2></div>
          <p>Criteria freeze before applications arrive. Assessments are purpose-specific, expiring, and replayed independently.</p>
        </div>
        {briefs.length === 0 ? (
          <EmptyState title="No live briefs yet" copy="Post the first brief or return to Preview mode to explore the complete workflow." />
        ) : (
          <div className="registry-grid">
            <BriefSelector briefs={briefs} selectedId={brief?.id ?? ""} onSelect={onBrief} />
            {brief && (
              <div className="brief-workspace">
                <header className="brief-header">
                  <div>
                    <div className="brief-project"><span>{brief.key}</span> {brief.projectName}</div>
                    <h2>{brief.title}</h2>
                  </div>
                  <StatusPill tone={brief.state === "MATCHED" ? "positive" : "neutral"}>
                    {briefStateLabel(brief.state, "detail")}
                  </StatusPill>
                </header>
                <div className="brief-facts">
                  <div><span>Scope</span><p>{brief.auditScope}</p></div>
                  <div><span>Terms</span><p>{brief.engagementTerms}</p></div>
                </div>
                {brief.state === "MATCHED" && (
                  <div className="matched-banner"><Icon name="check" /><div><strong>Selection recorded on-chain</strong><span>{shortAddress(brief.selectedAuditorWallet)} is bound to assessment {shortAddress(brief.selectedAssessmentId, 16, 8)}.</span></div></div>
                )}
                <div className="candidate-workspace">
                  <CandidateList
                    applications={brief.applications}
                    selectedId={application?.id ?? ""}
                    onSelect={onApplication}
                    onApply={onApply}
                    canApply={brief.state === "OPEN"}
                  />
                  <AssessmentPanel
                    brief={brief}
                    application={application}
                    activity={activity}
                    progress={progress}
                    onAssess={onAssess}
                    onRecheck={onRecheck}
                    onPolicy={onPolicy}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function PostBrief({activity, onSubmit}: {activity: AppActivity; onSubmit: (draft: NewBriefDraft) => void}) {
  const busy = activity !== "idle";
  const [draft, setDraft] = useState<NewBriefDraft>({
    key: "VAULT-Q4",
    projectName: "Meridian Treasury",
    title: "Multi-signature treasury vault review",
    auditScope:
      "Review signer rotation, transaction batching, emergency controls, upgrade permissions, and invariant coverage before treasury migration.",
    engagementTerms:
      "Three-week review window with a public final report and one remediation pass. Conflicts and prior protocol relationships must be disclosed.",
    validityDays: 30,
    criteria: [
      {key: "SOLIDITY", text: "Recent Solidity audit work is publicly evidenced.", required: true},
      {key: "ACCESS", text: "Prior review of multisig, access control, or treasury systems.", required: true},
      {key: "REPORT", text: "A public report demonstrates actionable findings and remediation follow-up.", required: true},
      {key: "CONFLICT", text: "No material conflict with Meridian Treasury is evident.", required: true},
    ],
  });

  const updateCriterion = (index: number, field: "key" | "text", value: string) => {
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((criterion, position) =>
        position === index ? {...criterion, [field]: value} : criterion,
      ),
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(draft);
  };

  return (
    <main className="page-shell post-page">
      <div className="page-intro">
        <span className="section-kicker"><span>New</span> Project workflow</span>
        <h1>Freeze the brief before the shortlist.</h1>
        <p>Define the fit criteria every validator will apply. Once opened, criteria cannot be edited or quietly tailored to a preferred candidate.</p>
      </div>
      <form className="brief-form" onSubmit={submit}>
        <div className="form-section">
          <div className="form-section-number">01</div>
          <div className="form-section-body">
            <div className="form-heading"><h2>Engagement</h2><p>Public, non-secret context only. On-chain text is permanent.</p></div>
            <div className="form-grid two">
              <label>Project name<input required minLength={2} maxLength={120} value={draft.projectName} onChange={(event) => setDraft({...draft, projectName: event.target.value})} /></label>
              <label>Brief key<input required pattern="[A-Za-z0-9_-]+" maxLength={56} value={draft.key} onChange={(event) => setDraft({...draft, key: event.target.value})} /></label>
            </div>
            <label>Audit title<input required minLength={5} maxLength={240} value={draft.title} onChange={(event) => setDraft({...draft, title: event.target.value})} /></label>
            <label>Technical scope<textarea required minLength={40} rows={5} value={draft.auditScope} onChange={(event) => setDraft({...draft, auditScope: event.target.value})} /></label>
            <label>Engagement terms<textarea required minLength={40} rows={4} value={draft.engagementTerms} onChange={(event) => setDraft({...draft, engagementTerms: event.target.value})} /></label>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-number">02</div>
          <div className="form-section-body">
            <div className="form-heading"><h2>Frozen fit criteria</h2><p>Use observable, purpose-specific requirements. Two to eight are supported.</p></div>
            <div className="criteria-editor">
              {draft.criteria.map((criterion, index) => (
                <div className="criterion-editor" key={index}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <label>Code<input required maxLength={56} value={criterion.key} onChange={(event) => updateCriterion(index, "key", event.target.value)} /></label>
                  <label>Evidence test<input required minLength={15} maxLength={1200} value={criterion.text} onChange={(event) => updateCriterion(index, "text", event.target.value)} /></label>
                  <b>Required</b>
                </div>
              ))}
            </div>
            {draft.criteria.length < 8 && (
              <button className="add-criterion" type="button" onClick={() => setDraft({...draft, criteria: [...draft.criteria, {key: `CRITERION_${draft.criteria.length + 1}`, text: "", required: true}]})}>
                <Icon name="plus" /> Add criterion
              </button>
            )}
          </div>
        </div>
        <div className="form-section final-section">
          <div className="form-section-number">03</div>
          <div className="form-section-body publish-row">
            <label>Assessment validity<select value={draft.validityDays} onChange={(event) => setDraft({...draft, validityDays: Number(event.target.value)})}><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></label>
            <div><span className="preview-chip"><span /> Atomic publish · one approval</span><p>One transaction creates the brief, freezes every criterion, and opens applications.</p></div>
            <button className="button button-primary" type="submit" disabled={busy}>{activity === "publishing-brief" ? "Publishing…" : "Publish atomically"}<Icon name="arrow" /></button>
          </div>
        </div>
      </form>
    </main>
  );
}

function PolicyLab({
  briefs,
  selectedApplicationId,
  policy,
  result,
  activity,
  onApplication,
  onPolicy,
  onEvaluate,
  onSelect,
}: {
  briefs: Brief[];
  selectedApplicationId: string;
  policy: Policy;
  result?: PolicyResult;
  activity: AppActivity;
  onApplication: (id: string) => void;
  onPolicy: (policy: Policy) => void;
  onEvaluate: () => void;
  onSelect: () => void;
}) {
  const busy = activity !== "idle";
  const candidates = briefs.flatMap((brief) => brief.applications.map((application) => ({brief, application})));
  const selected = candidates.find(({application}) => application.id === selectedApplicationId) ?? candidates[0];
  const selectedVerdict = selected?.application.assessment?.verdict;
  const exceptionRequired = requiresSelectionAcknowledgement(selectedVerdict, policy);
  const [exceptionAcknowledged, setExceptionAcknowledged] = useState(false);
  useEffect(() => {
    setExceptionAcknowledged(false);
  }, [selected?.application.id, selected?.application.assessment?.id, policy.acceptedVerdicts.join(",")]);
  const toggleVerdict = (verdict: Verdict) => {
    const includes = policy.acceptedVerdicts.includes(verdict);
    const next = includes
      ? policy.acceptedVerdicts.filter((item) => item !== verdict)
      : [...policy.acceptedVerdicts, verdict];
    if (next.length) onPolicy({...policy, acceptedVerdicts: next});
  };
  const failureLabel = (code: string) => code.toLowerCase().replaceAll("_", " ");
  return (
    <main className="page-shell policy-page">
      <div className="page-intro policy-intro">
        <span className="section-kicker"><span>Read</span> No LLM at query time</span>
        <h1>One deterministic gate for every integrator.</h1>
        <p>Marketplaces, DAOs, and escrow adapters can consume the same assessment without rebuilding the evidence judgment.</p>
      </div>
      <div className="policy-layout">
        <section className="policy-builder" aria-labelledby="policy-builder-title">
          <div className="form-heading"><h2 id="policy-builder-title">Selection policy</h2><p>Adjust the minimum bar, then evaluate the candidate’s latest assessment.</p></div>
          <label>Candidate<select value={selected?.application.id ?? ""} onChange={(event) => onApplication(event.target.value)}>{candidates.map(({brief, application}) => <option value={application.id} key={application.id}>{application.auditorName} — {brief.projectName}</option>)}</select></label>
          <fieldset>
            <legend>Accepted verdicts</legend>
            <div className="verdict-toggles">
              {(["STRONG_MATCH", "POTENTIAL_MATCH", "NO_MATCH", "INDETERMINATE"] as Verdict[]).map((verdict) => (
                <label key={verdict} className={policy.acceptedVerdicts.includes(verdict) ? "checked" : ""}>
                  <input type="checkbox" checked={policy.acceptedVerdicts.includes(verdict)} onChange={() => toggleVerdict(verdict)} />
                  {verdictLabel(verdict)}
                </label>
              ))}
            </div>
            {policyAcceptsException(policy) && (
              <div className="policy-warning" role="alert">
                <Icon name="shield" />
                <div>
                  <strong>Exception policy enabled</strong>
                  <p>Accepting an indeterminate or negative verdict tests workflow plumbing; it does not establish auditor fit or quality.</p>
                </div>
              </div>
            )}
          </fieldset>
          <label className="range-label"><span>Minimum decisiveness <b>{formatConfidence(policy.minimumConfidenceBps)}</b></span><input type="range" min="5000" max="9500" step="125" value={policy.minimumConfidenceBps} onChange={(event) => onPolicy({...policy, minimumConfidenceBps: Number(event.target.value)})} /></label>
          <div className="form-grid two">
            <label>Independent domains<select value={policy.minimumSignals} onChange={(event) => onPolicy({...policy, minimumSignals: Number(event.target.value)})}><option value={1}>1 minimum</option><option value={2}>2 minimum</option><option value={3}>3 minimum</option><option value={4}>4 minimum</option></select></label>
            <label>Maximum assessment age<select value={policy.maximumAgeSeconds / 86_400} onChange={(event) => onPolicy({...policy, maximumAgeSeconds: Number(event.target.value) * 86_400})}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label>
          </div>
          <label className="switch-label"><input type="checkbox" checked={policy.requireLatest} onChange={(event) => onPolicy({...policy, requireLatest: event.target.checked})} /><span /><div><strong>Require latest assessment</strong><small>Reject valid but superseded history.</small></div></label>
          <button className="button button-primary full" type="button" disabled={busy || !selected} onClick={onEvaluate}>{activity === "evaluating-policy" ? "Evaluating…" : "Evaluate policy"}<Icon name="arrow" /></button>
        </section>
        <section className="policy-output" aria-live="polite">
          <div className="code-card"><div><span>Deterministic contract read</span><b>VIEW</b></div><code>evaluate_policy_view(<br />&nbsp;&nbsp;application_id,<br />&nbsp;&nbsp;policy_json,<br />&nbsp;&nbsp;assessment_id<br />)</code><small>No web fetch. No model call. Same inputs, same result.</small></div>
          {!result ? (
            <EmptyState title="Ready to evaluate" copy="The result will list every failing condition rather than returning an opaque score." />
          ) : (
            <div className={`policy-result ${result.satisfied ? "passed" : "failed"}`}>
              <div className="result-icon"><Icon name={result.satisfied ? "check" : "close"} size={28} /></div>
              <span>{result.satisfied ? "Policy satisfied" : "Policy not satisfied"}</span>
              <h2>{result.satisfied ? (exceptionRequired ? "This assessment clears an exception gate." : "This assessment clears the gate.") : `${result.failureReasons.length} condition${result.failureReasons.length === 1 ? "" : "s"} failed.`}</h2>
              <p>{result.satisfied ? (exceptionRequired ? "Policy satisfaction confirms only that the configured exception rules passed—not auditor qualification." : "The project can record this auditor selection without another subjective query.") : "Tight policies fail explicitly and remain auditable."}</p>
              {result.failureReasons.length > 0 && <ul>{result.failureReasons.map((failure) => <li key={failure}>{failureLabel(failure)}</li>)}</ul>}
              {result.satisfied && exceptionRequired && selected?.brief.state === "OPEN" && (
                <label className="exception-acknowledgement">
                  <input type="checkbox" checked={exceptionAcknowledged} onChange={(event) => setExceptionAcknowledged(event.target.checked)} />
                  <span>I understand this records an inconclusive test or exception selection on-chain.</span>
                </label>
              )}
              {result.satisfied && selected?.brief.state === "OPEN" && (
                <button className="button button-primary full" type="button" disabled={busy || (exceptionRequired && !exceptionAcknowledged)} onClick={onSelect}>{activity === "recording-selection" ? "Recording…" : exceptionRequired ? "Record exception selection" : "Record auditor selection"} <Icon name="arrow" /></button>
              )}
              {result.satisfied && selected?.brief.state === "MATCHED" && <StatusPill tone="positive">Selection already recorded</StatusPill>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Expansion() {
  const phases = [
    {number: "01", title: "Evidence connectors", now: true, copy: "Structured adapters for GitHub reports, Code4rena, Sherlock, Immunefi, package registries, and auditor-controlled .well-known manifests.", outcome: "Faster, stronger signals"},
    {number: "02", title: "Private scope commitments", copy: "Commit hashes for confidential scopes, selective disclosure after engagement, and encrypted off-chain data rooms that keep secrets out of public state.", outcome: "Enterprise-ready briefs"},
    {number: "03", title: "Escrow adapters", copy: "A separate audited contract reads the selection policy and releases staged payments. AuditMatch stays non-custodial and composable.", outcome: "Selection → engagement"},
    {number: "04", title: "Appeal bonds", copy: "Economic bonds for contested conflicts or stale evidence, with escalation tiers and explicit slashing rules informed by real dispute data.", outcome: "Spam-resistant contests"},
    {number: "05", title: "Portable track record", copy: "Opt-in, purpose-scoped credentials for completed engagements and verified remediation—not a universal or permanent auditor score.", outcome: "Reusable reputation"},
    {number: "06", title: "Program operations", copy: "Private dashboards for foundations and security councils: time-to-shortlist, coverage gaps, assessment freshness, and vendor diversity.", outcome: "SaaS revenue layer"},
  ];
  return (
    <main className="page-shell expansion-page">
      <div className="page-intro">
        <span className="section-kicker"><span>Scale</span> Expansion route</span>
        <h1>From fit assessment to security procurement rail.</h1>
        <p>Expand where the trust boundary is clearest: better evidence first, operational tooling second, financial settlement only through separate audited adapters.</p>
      </div>
      <div className="roadmap-grid">
        {phases.map((phase) => (
          <article key={phase.number} className={phase.now ? "current" : ""}>
            <div className="roadmap-number">{phase.number}</div>
            <div className="roadmap-copy">{phase.now && <StatusPill tone="positive">Build next</StatusPill>}<h2>{phase.title}</h2><p>{phase.copy}</p><span>{phase.outcome} <Icon name="arrow" /></span></div>
          </article>
        ))}
      </div>
      <section className="business-route">
        <div><span className="section-kicker"><span>Route</span> Recommended sequence</span><h2>Connectors → operator analytics → conservative escrow pilot.</h2></div>
        <p>That order improves signal quality and creates revenue before AuditMatch takes on value-bearing settlement risk. Add appeal bonds only after observing real contest patterns.</p>
      </section>
    </main>
  );
}

function ApplicationDialog({
  brief,
  activity,
  onClose,
  onSubmit,
}: {
  brief: Brief;
  activity: AppActivity;
  onClose: () => void;
  onSubmit: (draft: ApplicationDraft) => void;
}) {
  const busy = activity !== "idle";
  const [draft, setDraft] = useState<ApplicationDraft>({
    auditorName: "Proofline Security",
    profileSummary: "Independent security researchers focused on Solidity protocol reviews, access-control design, and invariant testing.",
    conflictDisclosure: `No investment, employment, token allocation, or prior paid relationship with ${brief.projectName} is disclosed.`,
    evidenceUrls: ["https://github.com/proofline-security/reports", "https://proofline.example.org/auditor-profile"],
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(draft);
  };
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="application-dialog-title">
        <button className="dialog-close" type="button" aria-label="Close application" onClick={onClose}><Icon name="close" /></button>
        <span className="section-kicker"><span>Apply</span> {brief.projectName}</span>
        <h2 id="application-dialog-title">Bind public evidence to your wallet.</h2>
        <p>Submit only public information. Validators will fetch every URL live; a profile claim alone is not treated as proof.</p>
        <form onSubmit={submit}>
          <label>Auditor or team name<input required minLength={2} value={draft.auditorName} onChange={(event) => setDraft({...draft, auditorName: event.target.value})} /></label>
          <label>Fit summary<textarea required minLength={30} rows={4} value={draft.profileSummary} onChange={(event) => setDraft({...draft, profileSummary: event.target.value})} /></label>
          <label>Conflict disclosure<textarea required minLength={20} rows={3} value={draft.conflictDisclosure} onChange={(event) => setDraft({...draft, conflictDisclosure: event.target.value})} /></label>
          <div className="form-grid two">
            <label>Evidence URL 1<input required type="url" pattern="https://.*" value={draft.evidenceUrls[0]} onChange={(event) => setDraft({...draft, evidenceUrls: [event.target.value, draft.evidenceUrls[1]]})} /></label>
            <label>Evidence URL 2<input required type="url" pattern="https://.*" value={draft.evidenceUrls[1]} onChange={(event) => setDraft({...draft, evidenceUrls: [draft.evidenceUrls[0], event.target.value]})} /></label>
          </div>
          <button className="button button-primary full" type="submit" disabled={busy}>{activity === "submitting-application" ? "Submitting…" : "Submit evidence application"}<Icon name="arrow" /></button>
        </form>
      </section>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-brand"><BrandMark /><strong>AuditMatch</strong><span>Evidence-backed auditor fit on GenLayer.</span></div>
      <div className="footer-note"><span>Non-custodial</span><span>Public evidence only</span><span>History preserved</span></div>
      <small>Built for transparent security procurement. An assessment is not an audit certification.</small>
    </footer>
  );
}

export default function App() {
  const initialBriefs = useMemo(() => buildDemoBriefs(), []);
  const initialPending = initialBriefs[0]?.applications.find((item) => !item.assessment);
  const [page, setPage] = useState<Page>("marketplace");
  const [mode, setMode] = useState<Mode>("preview");
  const [briefs, setBriefs] = useState<Brief[]>(initialBriefs);
  const [selectedBriefId, setSelectedBriefId] = useState(initialBriefs[0]?.id ?? "");
  const [selectedApplicationId, setSelectedApplicationId] = useState(initialPending?.id ?? initialBriefs[0]?.applications[0]?.id ?? "");
  const [wallet, setWallet] = useState<WalletState>();
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [policyResult, setPolicyResult] = useState<PolicyResult>();
  const [activity, setActivity] = useState<AppActivity>("idle");
  const [transaction, setTransaction] = useState<TransactionActivity>();
  const [progress, setProgress] = useState("");
  const [toast, setToast] = useState("");
  const [showApply, setShowApply] = useState(false);
  const registryModeRequest = useRef(0);
  const pendingRegistryLoad = useRef<Promise<Brief[]> | undefined>(undefined);

  const selectedBrief = briefs.find((brief) => brief.id === selectedBriefId) ?? briefs[0];
  const selectedApplication = selectedBrief?.applications.find((item) => item.id === selectedApplicationId)
    ?? selectedBrief?.applications[0];
  const busy = activity !== "idle";
  const currentWalletRole = walletRole(wallet, selectedBrief);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (mode !== "live" || !wallet) return;
    let disposed = false;
    let unsubscribe: () => void = () => undefined;
    void import("./genlayer").then(({STUDIONET_CHAIN_ID, subscribeActiveWallet}) => {
      if (disposed) return;
      unsubscribe = subscribeActiveWallet({
        onAccountsChanged: (nextWallet) => {
          setWallet(nextWallet);
          setPolicyResult(undefined);
          setToast(nextWallet
            ? `MetaMask switched to ${shortAddress(nextWallet.address)}.`
            : "MetaMask disconnected from AuditMatch.");
        },
        onChainChanged: (chainId) => {
          if (chainId === STUDIONET_CHAIN_ID) return;
          setWallet(undefined);
          setPolicyResult(undefined);
          setToast("MetaMask left GenLayer StudioNet. Reconnect before sending a transaction.");
        },
      });
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [mode, wallet?.address]);

  const beginTransaction = (action: string) => setTransaction(awaitingSignature(action));
  const submittedTransaction = (hash: string) => {
    setTransaction((current) => transactionSubmitted(current, hash));
  };
  const finalizedTransaction = (hash: string) => {
    setTransaction((current) => transactionFinalized(current, hash));
  };
  const failedTransaction = (cause: unknown, fallback: string) => {
    const message = errorMessage(cause, fallback);
    setTransaction((current) => transactionFailed(current, message));
    return message;
  };

  const navigate = (next: Page) => {
    setPage(next);
    window.scrollTo({top: 0, behavior: "instant"});
  };

  const applyLiveRegistry = (registry: Brief[], preferredBrief = "", preferredApplication = "") => {
    setBriefs(registry);
    const briefId = preferredBrief || registry[0]?.id || "";
    setSelectedBriefId(briefId);
    const brief = registry.find((item) => item.id === briefId) ?? registry[0];
    setSelectedApplicationId(preferredApplication || brief?.applications[0]?.id || "");
  };

  const loadLiveRegistry = (): Promise<Brief[]> => {
    if (pendingRegistryLoad.current) return pendingRegistryLoad.current;
    const request = import("./genlayer").then(({loadRegistry}) => loadRegistry());
    pendingRegistryLoad.current = request;
    void request.then(
      () => {
        if (pendingRegistryLoad.current === request) pendingRegistryLoad.current = undefined;
      },
      () => {
        if (pendingRegistryLoad.current === request) pendingRegistryLoad.current = undefined;
      },
    );
    return request;
  };

  const refreshLive = async (preferredBrief = "", preferredApplication = "") => {
    applyLiveRegistry(await loadLiveRegistry(), preferredBrief, preferredApplication);
  };

  const changeMode = async (next: Mode) => {
    if (next === mode || !canChangeDataMode(activity)) return;
    if (next === "live" && !HAS_LIVE_DEPLOYMENT) {
      setToast("Deploy the contract and set VITE_AUDITMATCH_CONTRACT_ADDRESS to enable StudioNet mode.");
      return;
    }
    setPolicyResult(undefined);
    if (next === "preview") {
      registryModeRequest.current += 1;
      const demo = buildDemoBriefs();
      setBriefs(demo);
      setSelectedBriefId(demo[0]?.id ?? "");
      setSelectedApplicationId(demo[0]?.applications.find((item) => !item.assessment)?.id ?? demo[0]?.applications[0]?.id ?? "");
      setMode(next);
      if (activity === "loading-registry") setActivity("idle");
      return;
    }
    const requestId = registryModeRequest.current + 1;
    registryModeRequest.current = requestId;
    setMode(next);
    setBriefs([]);
    setSelectedBriefId("");
    setSelectedApplicationId("");
    setActivity("loading-registry");
    try {
      const registry = await loadLiveRegistry();
      if (registryModeRequest.current === requestId) applyLiveRegistry(registry);
    } catch (cause) {
      if (registryModeRequest.current === requestId) {
        setToast(errorMessage(cause, "Could not load StudioNet registry."));
      }
    } finally {
      if (registryModeRequest.current === requestId) setActivity("idle");
    }
  };

  const connect = async () => {
    setActivity("connecting-wallet");
    try {
      const {connectWallet} = await import("./genlayer");
      const connected = await connectWallet();
      setWallet(connected);
      setToast(`Connected ${shortAddress(connected.address)} to GenLayer StudioNet.`);
    } catch (cause) {
      setToast(errorMessage(cause, "Wallet connection failed."));
    } finally {
      setActivity("idle");
    }
  };

  const selectBrief = (id: string) => {
    setSelectedBriefId(id);
    const brief = briefs.find((item) => item.id === id);
    setSelectedApplicationId(brief?.applications[0]?.id ?? "");
    setPolicyResult(undefined);
  };

  const selectApplication = (id: string) => {
    setSelectedApplicationId(id);
    const found = findApplication(briefs, id);
    if (found) setSelectedBriefId(found.brief.id);
    setPolicyResult(undefined);
  };

  const requireWallet = (): WalletState | undefined => {
    if (wallet) return wallet;
    setToast("Connect the project or auditor wallet before sending a StudioNet transaction.");
    return undefined;
  };

  const assess = async () => {
    if (!selectedApplication || !selectedBrief) return;
    setActivity("assessing");
    setPolicyResult(undefined);
    try {
      if (mode === "preview") {
        for (const message of [
          `Fetching ${selectedApplication.evidenceUrls.length} public sources…`,
          "Validators independently assessing 4 frozen criteria…",
          "Criterion vectors agree: MMMM",
          "Issuing expiring fit assessment…",
        ]) {
          setProgress(message);
          await sleep(260);
        }
        const now = Math.floor(Date.now() / 1000);
        const assessment: Assessment = {
          id: `${selectedApplication.id}:ASSESS:1`,
          verdict: "STRONG_MATCH",
          status: "ACTIVE",
          confidenceBps: 9000,
          signalCount: 2,
          criterionCodes: "MMMM".slice(0, selectedBrief.criteria.length).padEnd(selectedBrief.criteria.length, "M"),
          reasonCodes: ["ALL_REQUIRED_FIT_CRITERIA_MET", "MULTI_SOURCE_EVIDENCE"],
          evidenceUrls: selectedApplication.evidenceUrls,
          issuedAtUnix: now,
          expiresAtUnix: now + selectedBrief.validityDays * 86_400,
        };
        setBriefs((current) => current.map((brief) => brief.id === selectedBrief.id ? {...brief, applications: brief.applications.map((application) => application.id === selectedApplication.id ? {...application, state: "ASSESSED", assessment} : application)} : brief));
        setToast("Consensus reached. A STRONG_MATCH assessment was issued.");
      } else {
        const activeWallet = requireWallet();
        if (!activeWallet) return;
        beginTransaction("GenLayer evidence assessment");
        setProgress("Waiting for validator consensus and finality…");
        const {assessApplicationLive} = await import("./genlayer");
        const hash = await assessApplicationLive(activeWallet, selectedApplication.id, (submittedHash) => submittedTransaction(submittedHash));
        finalizedTransaction(hash);
        await refreshLive(selectedBrief.id, selectedApplication.id);
        setToast("StudioNet finalized the fit assessment.");
      }
    } catch (cause) {
      setToast(mode === "live" ? failedTransaction(cause, "Assessment failed.") : errorMessage(cause, "Assessment failed."));
    } finally {
      setProgress("");
      setActivity("idle");
    }
  };

  const recheck = async () => {
    if (!selectedApplication?.assessment || !selectedBrief) return;
    setActivity("rechecking");
    try {
      if (mode === "preview") {
        setProgress("Refetching every cited source…");
        await sleep(500);
        const now = Math.floor(Date.now() / 1000);
        const nextVersion = Number(selectedApplication.assessment.id.match(/ASSESS:(\d+)$/)?.[1] ?? "1") + 1;
        const assessment = {...selectedApplication.assessment, id: `${selectedApplication.id}:ASSESS:${nextVersion}`, issuedAtUnix: now, expiresAtUnix: now + selectedBrief.validityDays * 86_400};
        setBriefs((current) => current.map((brief) => brief.id === selectedBrief.id ? {...brief, applications: brief.applications.map((application) => application.id === selectedApplication.id ? {...application, assessment} : application)} : brief));
        setToast("Sources rechecked. The previous assessment remains in history as superseded.");
      } else {
        const activeWallet = requireWallet();
        if (!activeWallet) return;
        beginTransaction("Evidence source recheck");
        const {recheckApplicationLive} = await import("./genlayer");
        const hash = await recheckApplicationLive(activeWallet, selectedApplication.id, (submittedHash) => submittedTransaction(submittedHash));
        finalizedTransaction(hash);
        await refreshLive(selectedBrief.id, selectedApplication.id);
        setToast("StudioNet finalized a fresh assessment.");
      }
    } catch (cause) {
      setToast(mode === "live" ? failedTransaction(cause, "Recheck failed.") : errorMessage(cause, "Recheck failed."));
    } finally {
      setProgress("");
      setActivity("idle");
    }
  };

  const evaluate = async () => {
    if (!selectedApplication) return;
    setActivity("evaluating-policy");
    try {
      const result = mode === "preview"
        ? evaluateLocalPolicy(selectedApplication, policy)
        : await (await import("./genlayer")).evaluatePolicyLive(
            selectedApplication.id,
            policy,
            selectedApplication.assessment?.id ?? "",
          );
      setPolicyResult(result);
      setToast(result.satisfied ? "Policy satisfied—selection is available." : "Policy returned explicit failure reasons.");
    } catch (cause) {
      setToast(errorMessage(cause, "Policy evaluation failed."));
    } finally {
      setActivity("idle");
    }
  };

  const recordSelection = async () => {
    if (!selectedApplication?.assessment || !selectedBrief) return;
    const result = mode === "preview"
      ? evaluateLocalPolicy(selectedApplication, policy)
      : policyResult;
    if (!result?.satisfied) {
      setToast("Run a satisfied selection policy first.");
      return;
    }
    setActivity("recording-selection");
    try {
      if (mode === "preview") {
        setBriefs((current) => current.map((brief) => brief.id === selectedBrief.id ? {
          ...brief,
          state: "MATCHED",
          selectedApplicationId: selectedApplication.id,
          selectedAssessmentId: selectedApplication.assessment!.id,
          selectedAuditorWallet: selectedApplication.auditorWallet,
          applications: brief.applications.map((application) => application.id === selectedApplication.id ? {...application, state: "SELECTED"} : application),
        } : brief));
        await sleep(250);
      } else {
        const activeWallet = requireWallet();
        if (!activeWallet) return;
        if (activeWallet.address.toLowerCase() !== selectedBrief.projectOwner.toLowerCase()) {
          setToast(`Switch MetaMask to the project owner ${shortAddress(selectedBrief.projectOwner)} before recording a selection.`);
          return;
        }
        beginTransaction("Auditor selection");
        const {selectAuditorLive} = await import("./genlayer");
        const hash = await selectAuditorLive(
          activeWallet,
          selectedApplication.id,
          policy,
          selectedApplication.assessment.id,
          (submittedHash) => submittedTransaction(submittedHash),
        );
        finalizedTransaction(hash);
        await refreshLive(selectedBrief.id, selectedApplication.id);
      }
      setToast(`Selection recorded: ${selectedApplication.auditorName}.`);
      navigate("marketplace");
    } catch (cause) {
      setToast(mode === "live" ? failedTransaction(cause, "Selection failed.") : errorMessage(cause, "Selection failed."));
    } finally {
      setActivity("idle");
    }
  };

  const postBrief = async (draft: NewBriefDraft) => {
    setActivity("publishing-brief");
    try {
      if (mode === "preview") {
        const id = `${PREVIEW_PROJECT.toLowerCase()}:${draft.key.trim().toUpperCase()}`;
        const brief: Brief = {
          id,
          key: draft.key.trim().toUpperCase(),
          projectOwner: PREVIEW_PROJECT,
          projectName: draft.projectName,
          title: draft.title,
          auditScope: draft.auditScope,
          engagementTerms: draft.engagementTerms,
          state: "OPEN",
          validityDays: draft.validityDays,
          criteria: draft.criteria,
          applications: [],
          selectedApplicationId: "",
          selectedAssessmentId: "",
          selectedAuditorWallet: "",
        };
        setBriefs((current) => [brief, ...current.filter((item) => item.id !== id)]);
        setSelectedBriefId(id);
        setSelectedApplicationId("");
      } else {
        const activeWallet = requireWallet();
        if (!activeWallet) return;
        beginTransaction("Atomic brief publication");
        const {createBriefLive} = await import("./genlayer");
        const {briefId, hash} = await createBriefLive(
          activeWallet,
          draft,
          setProgress,
          (submittedHash) => submittedTransaction(submittedHash),
        );
        finalizedTransaction(hash);
        await refreshLive(briefId);
      }
      setToast("Brief published. Its fit criteria are now frozen.");
      navigate("marketplace");
    } catch (cause) {
      setToast(mode === "live" ? failedTransaction(cause, "Brief publishing failed.") : errorMessage(cause, "Brief publishing failed."));
    } finally {
      setProgress("");
      setActivity("idle");
    }
  };

  const submitApplication = async (draft: ApplicationDraft) => {
    if (!selectedBrief) return;
    setActivity("submitting-application");
    try {
      if (mode === "preview") {
        const id = `${selectedBrief.id}:APP:${PREVIEW_AUDITOR.toLowerCase()}`;
        const application: Application = {
          id,
          briefId: selectedBrief.id,
          auditorWallet: PREVIEW_AUDITOR,
          auditorName: draft.auditorName,
          profileSummary: draft.profileSummary,
          conflictDisclosure: draft.conflictDisclosure,
          evidenceUrls: draft.evidenceUrls,
          state: "EVIDENCE_SUBMITTED",
        };
        setBriefs((current) => current.map((brief) => brief.id === selectedBrief.id ? {...brief, applications: [...brief.applications.filter((item) => item.id !== id), application]} : brief));
        setSelectedApplicationId(id);
      } else {
        const activeWallet = requireWallet();
        if (!activeWallet) return;
        if (activeWallet.address.toLowerCase() === selectedBrief.projectOwner.toLowerCase()) {
          setToast("The project owner cannot apply to their own brief. Switch MetaMask to an applicant wallet.");
          return;
        }
        beginTransaction("Evidence application");
        const {submitApplicationLive} = await import("./genlayer");
        const hash = await submitApplicationLive(
          activeWallet,
          selectedBrief.id,
          draft,
          (submittedHash) => submittedTransaction(submittedHash),
        );
        finalizedTransaction(hash);
        await refreshLive(selectedBrief.id);
      }
      setShowApply(false);
      setToast("Application submitted. Public evidence is ready for consensus review.");
    } catch (cause) {
      setToast(mode === "live" ? failedTransaction(cause, "Application failed.") : errorMessage(cause, "Application failed."));
    } finally {
      setActivity("idle");
    }
  };

  return (
    <div className="app">
      <Header page={page} mode={mode} wallet={wallet} role={currentWalletRole} activity={activity} onNavigate={navigate} onMode={changeMode} onConnect={connect} />
      {mode === "preview" && activity !== "loading-registry" && <div className="preview-banner"><strong>Interactive preview</strong><span>All actions below are simulated locally. No wallet prompt and no blockchain state change.</span></div>}
      {(mode === "live" || activity === "loading-registry") && <LiveActivityBar activity={activity} />}
      {page === "marketplace" && <Marketplace briefs={briefs} selectedBriefId={selectedBriefId} selectedApplicationId={selectedApplicationId} activity={activity} progress={progress} onBrief={selectBrief} onApplication={selectApplication} onAssess={assess} onRecheck={recheck} onPolicy={() => navigate("policy")} onApply={() => setShowApply(true)} onPost={() => navigate("post")} />}
      {page === "post" && <PostBrief activity={activity} onSubmit={postBrief} />}
      {page === "policy" && <PolicyLab briefs={briefs} selectedApplicationId={selectedApplicationId} policy={policy} result={policyResult} activity={activity} onApplication={selectApplication} onPolicy={(next) => {setPolicy(next); setPolicyResult(undefined);}} onEvaluate={evaluate} onSelect={recordSelection} />}
      {page === "expansion" && <Expansion />}
      <Footer />
      {showApply && selectedBrief && <ApplicationDialog brief={selectedBrief} activity={activity} onClose={() => setShowApply(false)} onSubmit={submitApplication} />}
      {mode === "live" && <TransactionTracker transaction={transaction} onDismiss={() => setTransaction(undefined)} />}
      {toast && <div className="toast" role="status"><Icon name="spark" /><span>{toast}</span><button type="button" aria-label="Dismiss notification" onClick={() => setToast("")}><Icon name="close" /></button></div>}
    </div>
  );
}
