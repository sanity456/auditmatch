"""Direct-mode coverage for AuditMatch state, evidence, policies, and selection."""

from datetime import datetime, timezone
import json
import re


URL_REPORT = "https://github.com/cinder-security/audits/blob/main/seaglass-bridge.md"
URL_PROFILE = "https://cindersec.example.com/.well-known/auditor.json"
URL_COUNTER = "https://security.example.net/disclosures/cinder-seaglass-conflict"
PROMPT = "Assess whether one security auditor fits one project audit brief"
VALIDITY = 30 * 24 * 60 * 60
EXPIRY_REGRESSION_ISSUED_AT = "2026-08-27T12:00:00Z"


def _iso_from_unix(value: int) -> str:
    return (
        datetime.fromtimestamp(value, tz=timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _brief_criteria():
    return [
        {
            "key": "SOLIDITY",
            "text": "Public evidence shows recent hands-on Solidity smart contract security work.",
            "required": True,
        },
        {
            "key": "BRIDGES",
            "text": "Public evidence shows prior review of bridge, messaging, or validator-quorum risk.",
            "required": True,
        },
        {
            "key": "REPORTS",
            "text": "At least one public report demonstrates clear findings and remediation verification.",
            "required": True,
        },
        {
            "key": "INDEPENDENCE",
            "text": "The disclosure and public evidence reveal no material conflict with SeaGlass Protocol.",
            "required": True,
        },
    ]


def _open_brief(contract, direct_vm, project):
    direct_vm.sender = project
    return contract.create_brief_with_criteria(
        "BRIDGE-V2",
        "SeaGlass Protocol",
        "Cross-chain bridge v2 security audit",
        "Review the Solidity bridge, validator quorum, relayer paths, upgrade controls, and invariant tests before the v2 mainnet release.",
        "Evidence must be public and current. The auditor must disclose conflicts, show relevant bridge work, and be able to begin within the stated review window.",
        VALIDITY,
        json.dumps(_brief_criteria()),
    )


def _apply(contract, direct_vm, auditor, brief_id):
    direct_vm.sender = auditor
    return contract.submit_application(
        brief_id,
        "Cinder Security",
        "Independent smart contract security team focused on Solidity bridges, cross-chain messaging, and invariant-driven review.",
        "No investment, employment, token allocation, or prior paid relationship with SeaGlass Protocol is disclosed.",
        json.dumps([URL_REPORT, URL_PROFILE]),
    )


def _mock_assessment(direct_vm, codes="MMMM", include_counter=False):
    direct_vm.mock_web(
        re.escape(URL_REPORT),
        {
            "status": 200,
            "body": "Cinder Security public audit report: Solidity bridge review, validator quorum finding, remediation verified in commit 8af3.",
        },
    )
    direct_vm.mock_web(
        re.escape(URL_PROFILE),
        {
            "status": 200,
            "body": "Cinder Security specializes in Solidity and cross-chain systems. Availability: September review window. Conflicts: none with SeaGlass.",
        },
    )
    if include_counter:
        direct_vm.mock_web(
            re.escape(URL_COUNTER),
            {
                "status": 200,
                "body": "Disclosure record: a Cinder partner holds a paid advisory role at SeaGlass Protocol.",
            },
        )
    direct_vm.mock_llm(
        rf".*{re.escape(PROMPT)}.*",
        json.dumps({"criterion_codes": codes}),
    )


def _policy(**overrides):
    value = {
        "accepted_verdicts": ["STRONG_MATCH"],
        "minimum_confidence_bps": 8500,
        "minimum_signals": 2,
        "maximum_age_seconds": VALIDITY,
        "require_latest": True,
    }
    value.update(overrides)
    return json.dumps(value)


def test_atomic_publish_opens_brief_with_ordered_frozen_criteria(
    contract, direct_vm, direct_alice
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    brief = contract.get_brief(brief_id)
    assert brief["state"] == "OPEN"
    assert brief["criterion_count"] == 4
    assert contract.get_brief_count() == 1
    assert [contract.get_criterion(brief_id, index)["criterion_key"] for index in range(4)] == [
        "SOLIDITY",
        "BRIDGES",
        "REPORTS",
        "INDEPENDENCE",
    ]
    with direct_vm.expect_revert("criteria_locked"):
        contract.add_criterion(
            brief_id,
            "LATE",
            "A criterion cannot be appended after the atomic publish has opened the brief.",
            True,
        )


def test_atomic_publish_rejects_bad_criteria_without_partial_state(
    contract, direct_vm, direct_alice
):
    direct_vm.sender = direct_alice
    base = [
        "ATOMIC-FAIL",
        "Atomic Failure Test",
        "Atomic publication validation exercise",
        "This test confirms malformed atomic publication inputs never leave a partial draft record on-chain.",
        "No payment or engagement exists; the attempted record is exclusively a deterministic validation test.",
        VALIDITY,
    ]
    cases = [
        ("not-json", "invalid_criteria_json"),
        (json.dumps(_brief_criteria()[:1]), "invalid_criterion_count"),
        (
            json.dumps([_brief_criteria()[0], {**_brief_criteria()[1], "key": "SOLIDITY"}]),
            "criterion_exists",
        ),
        (
            json.dumps([_brief_criteria()[0], {**_brief_criteria()[1], "required": "yes"}]),
            "invalid_criterion",
        ),
    ]
    for criteria_json, reason in cases:
        with direct_vm.expect_revert(reason):
            contract.create_brief_with_criteria(*base, criteria_json)
        assert contract.get_brief_count() == 0


def test_legacy_draft_flow_remains_available(contract, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    brief_id = contract.create_brief(
        "LEGACY-V1",
        "Legacy Compatibility",
        "Legacy draft workflow compatibility check",
        "This test preserves support for integrations that still create a draft before adding frozen criteria.",
        "No payment or engagement exists; this is a deterministic compatibility test for existing clients.",
        VALIDITY,
    )
    for criterion in _brief_criteria()[:2]:
        contract.add_criterion(
            brief_id,
            criterion["key"],
            criterion["text"],
            criterion["required"],
        )
    contract.open_brief(brief_id)
    assert contract.get_brief(brief_id)["state"] == "OPEN"
    assert contract.get_brief(brief_id)["criterion_count"] == 2


def test_strong_match_can_be_selected_with_deterministic_policy(
    contract, direct_vm, direct_alice, direct_bob
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    application_id = _apply(contract, direct_vm, direct_bob, brief_id)
    _mock_assessment(direct_vm)
    assessment_id = contract.assess_application(application_id)

    assessment = contract.get_assessment(assessment_id)
    assert assessment["verdict"] == "STRONG_MATCH"
    assert assessment["criterion_codes"] == "MMMM"
    assert assessment["confidence_bps"] == 9000
    assert assessment["independent_signal_count"] == 2
    assert assessment["status"] == "ACTIVE"
    assert contract.evaluate_policy_view(application_id, _policy(), assessment_id) == {
        "satisfied": True,
        "failure_reasons": [],
        "assessment_id": assessment_id,
        "verdict": "STRONG_MATCH",
    }

    direct_vm.sender = direct_alice
    selection_id = contract.select_auditor(application_id, _policy(), assessment_id)
    selection = contract.get_selection(selection_id)
    assert selection["auditor_wallet"] == str(direct_bob).lower()
    assert contract.get_brief(brief_id)["state"] == "MATCHED"
    assert contract.get_application(application_id)["state"] == "SELECTED"


def test_potential_match_fails_strong_only_selection_policy(
    contract, direct_vm, direct_alice, direct_bob
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    application_id = _apply(contract, direct_vm, direct_bob, brief_id)
    _mock_assessment(direct_vm, "MPMM")
    assessment_id = contract.assess_application(application_id)

    assert contract.get_assessment(assessment_id)["verdict"] == "POTENTIAL_MATCH"
    result = contract.evaluate_policy_view(application_id, _policy(), assessment_id)
    assert result["satisfied"] is False
    assert result["failure_reasons"] == ["VERDICT_NOT_ACCEPTED"]
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("selection_policy_not_satisfied"):
        contract.select_auditor(application_id, _policy(), assessment_id)


def test_recheck_preserves_history_and_supersedes_old_assessment(
    contract, direct_vm, direct_alice, direct_bob
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    application_id = _apply(contract, direct_vm, direct_bob, brief_id)
    _mock_assessment(direct_vm, "MPMM")
    first_id = contract.assess_application(application_id)

    direct_vm.clear_mocks()
    direct_vm.warp("2026-09-02T12:00:00Z")
    _mock_assessment(direct_vm, "MMMM")
    second_id = contract.recheck_application(application_id)

    assert first_id != second_id
    assert contract.get_assessment(first_id)["status"] == "SUPERSEDED"
    assert contract.get_assessment(second_id)["status"] == "ACTIVE"
    old_result = contract.evaluate_policy_view(application_id, _policy(), first_id)
    assert "ASSESSMENT_NOT_ACTIVE" in old_result["failure_reasons"]
    assert "ASSESSMENT_NOT_LATEST" in old_result["failure_reasons"]
    assert contract.get_assessment_count() == 2


def test_contest_fetches_counter_evidence_and_replaces_assessment(
    contract, direct_vm, direct_alice, direct_bob
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    application_id = _apply(contract, direct_vm, direct_bob, brief_id)
    _mock_assessment(direct_vm)
    first_id = contract.assess_application(application_id)

    direct_vm.sender = direct_alice
    contest_id = contract.contest_assessment(
        first_id,
        "A public disclosure appears to contradict the auditor's no-conflict statement for this engagement.",
        json.dumps([URL_COUNTER]),
    )
    assert contract.get_assessment(first_id)["status"] == "CONTESTED"

    direct_vm.clear_mocks()
    _mock_assessment(direct_vm, "MMMN", include_counter=True)
    replacement_id = contract.resolve_contest(contest_id)
    replacement = contract.get_assessment(replacement_id)
    assert contract.get_assessment(first_id)["status"] == "SUPERSEDED"
    assert replacement["verdict"] == "NO_MATCH"
    assert replacement["appeal_of"] == first_id
    assert replacement["independent_signal_count"] == 3
    assert contract.get_contest(contest_id)["replacement_assessment_id"] == replacement_id


def test_expired_assessment_fails_without_mutating_history(
    contract, direct_vm, direct_alice, direct_bob
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    application_id = _apply(contract, direct_vm, direct_bob, brief_id)
    _mock_assessment(direct_vm)

    # Set issuance immediately before the assessment, then derive all expiry
    # expectations from the timestamp the contract actually persisted.
    direct_vm.warp(EXPIRY_REGRESSION_ISSUED_AT)
    assessment_id = contract.assess_application(application_id)
    assessment = contract.get_assessment(assessment_id)
    issued_at_unix = int(assessment["issued_at_unix"])
    expected_expiry_unix = issued_at_unix + VALIDITY
    assert int(assessment["expires_at_unix"]) == expected_expiry_unix

    effective_chain_time_unix = expected_expiry_unix + 1
    effective_chain_time = _iso_from_unix(effective_chain_time_unix)
    direct_vm.warp(effective_chain_time)

    result = contract.evaluate_policy_view(application_id, _policy(), assessment_id)
    print(
        "EXPIRY_REGRESSION_EVIDENCE="
        + json.dumps(
            {
                "issued_at": _iso_from_unix(issued_at_unix),
                "issued_at_unix": issued_at_unix,
                "expected_expiry": _iso_from_unix(expected_expiry_unix),
                "expected_expiry_unix": expected_expiry_unix,
                "effective_chain_time": effective_chain_time,
                "effective_chain_time_unix": effective_chain_time_unix,
                "policy": json.loads(_policy()),
                "result": result,
                "history_status_after_view": contract.get_assessment(assessment_id)[
                    "status"
                ],
            },
            sort_keys=True,
        )
    )
    assert result == {
        "satisfied": False,
        "failure_reasons": ["ASSESSMENT_EXPIRED", "ASSESSMENT_TOO_OLD"],
        "assessment_id": assessment_id,
        "verdict": "STRONG_MATCH",
    }
    assert contract.get_assessment(assessment_id)["status"] == "ACTIVE"


def test_project_cannot_apply_and_auditor_cannot_apply_twice(
    contract, direct_vm, direct_alice, direct_bob
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("project_cannot_self_apply"):
        contract.submit_application(
            brief_id,
            "SeaGlass Internal",
            "Internal security contributors should not be able to apply as an independent auditor for their own project brief.",
            "The applicant is the project owner and therefore cannot be independent for this workflow.",
            json.dumps([URL_REPORT, URL_PROFILE]),
        )
    _apply(contract, direct_vm, direct_bob, brief_id)
    with direct_vm.expect_revert("auditor_already_applied"):
        _apply(contract, direct_vm, direct_bob, brief_id)


def test_sources_require_distinct_public_https_domains(
    contract, direct_vm, direct_alice, direct_bob
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("independent_domains_required"):
        contract.submit_application(
            brief_id,
            "Cinder Security",
            "Independent Solidity security team with experience reviewing cross-chain messaging and upgrade controls.",
            "No financial or employment relationship with the project is disclosed for this proposed engagement.",
            json.dumps(
                [
                    "https://github.com/cinder-security/report-one",
                    "https://github.com/cinder-security/report-two",
                ]
            ),
        )
    with direct_vm.expect_revert("invalid_source_url"):
        contract.submit_application(
            brief_id,
            "Cinder Security",
            "Independent Solidity security team with experience reviewing cross-chain messaging and upgrade controls.",
            "No financial or employment relationship with the project is disclosed for this proposed engagement.",
            json.dumps(["https://evidence.internal/profile", URL_REPORT]),
        )


def test_only_project_owner_can_select(
    contract, direct_vm, direct_alice, direct_bob, direct_charlie
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    application_id = _apply(contract, direct_vm, direct_bob, brief_id)
    _mock_assessment(direct_vm)
    assessment_id = contract.assess_application(application_id)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("only_project_owner"):
        contract.select_auditor(application_id, _policy(), assessment_id)


def test_bad_model_or_http_response_writes_no_assessment(
    contract, direct_vm, direct_alice, direct_bob
):
    brief_id = _open_brief(contract, direct_vm, direct_alice)
    application_id = _apply(contract, direct_vm, direct_bob, brief_id)
    _mock_assessment(direct_vm, "MMM")
    with direct_vm.expect_revert("invalid_criterion_codes"):
        contract.assess_application(application_id)
    assert contract.get_assessment_count() == 0

    direct_vm.clear_mocks()
    direct_vm.mock_web(re.escape(URL_REPORT), {"status": 404, "body": "missing"})
    with direct_vm.expect_revert("[EXTERNAL] source_http_404"):
        contract.assess_application(application_id)
    assert contract.get_assessment_count() == 0
