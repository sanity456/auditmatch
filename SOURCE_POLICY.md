# Public source policy

AuditMatch accepts 2–4 ASCII `https://` URLs per application and requires at least two distinct hostnames. A contest may add up to two counter-evidence URLs, with a six-source combined cap.

The contract rejects fragments, credentials in URLs, explicit ports, numeric-only hosts, local/private-style suffixes, duplicate URLs, non-UTF-8 responses, empty responses, responses over 100 KB, and non-200 HTTP responses. Validators retain at most 12 KB of decoded text from each accepted response for the assessment prompt.

The source filter reduces obvious SSRF-style inputs but is not a complete network egress policy. Production validator infrastructure must also enforce DNS resolution and private-address protections outside the contract.

Good sources include public audit reports, repositories, contest profiles, research posts, responsible-disclosure records, and auditor-controlled `.well-known` manifests. A self-authored profile is a claim and should be paired with independent work evidence.

Never submit secrets, private scopes, customer data, embargoed vulnerabilities, personal identifiers, or material covered by an NDA. On-chain text and citations are public and persistent.
