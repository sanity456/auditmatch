"""Direct-mode coverage for AuditMatch state, evidence, policies, and selection."""

import json
import re


URL_REPORT = "https://github.com/cinder-security/audits/blob/main/seaglass-bridge.md"
URL_PROFILE = "https://cindersec.example.com/.well-known/auditor.json"
URL_COUNTER = "https://security.example.net/disclosures/cinder-seaglass-conflict"
PROMPT = "Assess whether one security auditor fits one project audit brief"
VALIDITY = 30 * 24 * 60 * 60


def _open_brief(contract, direct_vm, project):
    direct_vm.sender = project
    brief_id = contract.create_brief(
        "BRIDGE-V2",
        "SeaGlass Protocol",
        "Cross-chain bridge v2 security audit",
        "Review the Solidity bridge, validator quorum, relayer paths, upgrade controls, and invariant tests before the v2 mainnet release.",
        "Evidence must be public and current. The auditor must disclose conflicts, show relevant bridge work, and be able to begin within the stated review window.",
        VALIDITY,
    )
    contract.add_criterion(
        brief_id,
        "SOLIDITY",
        "Public evidence shows recent hands-on Solidity smart contract security work.",
        True,
    )
    contract.add_criterion(
        brief_id,
        "BRIDGES",
        "Public evidence shows prior review of bridge, messaging, or validator-quorum risk.",
        True,
    )
    contract.add_criterion(
        brief_id,
        "REPORTS",
        "At least one public report demonstrates clear findings and remediation verification.",
        True,
    )
    contract.add_criterion(
        brief_id,
        "INDEPENDENCE",
        "The disclosure and public evidence reveal no material conflict with SeaGlass Protocol.",
        True,
    )
    contract.open_brief(brief_id)
    return brief_id


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
    assessment_id = contract.assess_application(application_id)
    direct_vm.warp("2026-09-26T12:00:01Z")

    result = contract.evaluate_policy_view(application_id, _policy(), assessment_id)
    assert result["satisfied"] is False
    assert "ASSESSMENT_EXPIRED" in result["failure_reasons"]
    assert "ASSESSMENT_TOO_OLD" in result["failure_reasons"]
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
