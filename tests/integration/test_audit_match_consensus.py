"""Five-validator AuditMatch evidence assessment and selection on GLSim."""

from __future__ import annotations

import json
from pathlib import Path

from gltest import create_accounts, get_contract_factory, get_default_account, get_validator_factory
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus
from gltest.utils import extract_contract_address


URL_REPORT = "https://github.com/cinder-security/audits/blob/main/seaglass-bridge.md"
URL_PROFILE = "https://cindersec.example.com/.well-known/auditor.json"
PROMPT = "Assess whether one security auditor fits one project audit brief"
VALIDITY = 30 * 24 * 60 * 60


def _context():
    validators = get_validator_factory().batch_create_mock_validators(
        5,
        mock_llm_response={
            "nondet_exec_prompt": {
                PROMPT: json.dumps({"criterion_codes": "MMMM"})
            }
        },
        mock_web_response={
            "nondet_web_request": {
                URL_REPORT: {
                    "status": 200,
                    "body": "Cinder Security public Solidity bridge audit with validator quorum finding and verified remediation.",
                },
                URL_PROFILE: {
                    "status": 200,
                    "body": "Cinder Security specializes in Solidity bridges and reports no conflict with SeaGlass Protocol.",
                },
            }
        },
    )
    return {
        "validators": [validator.to_dict() for validator in validators],
        "genvm_datetime": "2026-08-26T12:00:00Z",
    }


def _ok(call, context=None):
    kwargs = {"wait_transaction_status": TransactionStatus.FINALIZED}
    if context is not None:
        kwargs["transaction_context"] = context
    receipt = call.transact(**kwargs)
    assert tx_execution_succeeded(receipt), json.dumps(receipt, default=str)


def test_five_validators_assess_and_project_selects_auditor():
    contract_path = Path(__file__).resolve().parents[2] / "contracts" / "audit_match.py"
    project_account = get_default_account()
    auditor_account = create_accounts(1)[0]
    factory = get_contract_factory(contract_file_path=contract_path)
    deployed = factory.deploy_contract_tx(
        args=[1],
        account=project_account,
        wait_transaction_status=TransactionStatus.FINALIZED,
    )
    assert tx_execution_succeeded(deployed), json.dumps(deployed, default=str)
    address = extract_contract_address(deployed)
    project = factory.build_contract(address, account=project_account)
    auditor = factory.build_contract(address, account=auditor_account)

    brief_id = f"{str(project_account.address).lower()}:BRIDGE-V2"
    _ok(
        project.create_brief_with_criteria(
            args=[
                "BRIDGE-V2",
                "SeaGlass Protocol",
                "Cross-chain bridge v2 security audit",
                "Review the Solidity bridge, validator quorum, relayer paths, upgrade controls, and invariant tests before the v2 mainnet release.",
                "Evidence must be public and current. The auditor must disclose conflicts, show relevant bridge work, and be available for the review window.",
                VALIDITY,
                json.dumps(
                    [
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
                ),
            ]
        )
    )
    brief = project.get_brief(args=[brief_id]).call()
    assert brief["state"] == "OPEN"
    assert brief["criterion_count"] == 4

    auditor_wallet = str(auditor_account.address).lower()
    application_id = f"{brief_id}:APP:{auditor_wallet}"
    _ok(
        auditor.submit_application(
            args=[
                brief_id,
                "Cinder Security",
                "Independent smart contract security team focused on Solidity bridges, cross-chain messaging, and invariant-driven review.",
                "No investment, employment, token allocation, or prior paid relationship with SeaGlass Protocol is disclosed.",
                json.dumps([URL_REPORT, URL_PROFILE]),
            ]
        )
    )
    _ok(project.assess_application(args=[application_id]), _context())

    assessment_id = f"{application_id}:ASSESS:1"
    assessment = project.get_assessment(args=[assessment_id]).call()
    assert assessment["verdict"] == "STRONG_MATCH"
    assert assessment["criterion_codes"] == "MMMM"
    assert assessment["confidence_bps"] == 9000
    assert assessment["independent_signal_count"] == 2
    assert assessment["status"] == "ACTIVE"

    policy = json.dumps(
        {
            "accepted_verdicts": ["STRONG_MATCH"],
            "minimum_confidence_bps": 8500,
            "minimum_signals": 2,
            "maximum_age_seconds": VALIDITY,
            "require_latest": True,
        }
    )
    result = project.evaluate_policy_view(
        args=[application_id, policy, assessment_id]
    ).call()
    assert result["satisfied"] is True
    _ok(project.select_auditor(args=[application_id, policy, assessment_id]))

    brief = project.get_brief(args=[brief_id]).call()
    assert brief["state"] == "MATCHED"
    assert brief["selected_auditor_wallet"] == auditor_wallet
    selection = project.get_selection(args=[brief["selection_id"]]).call()
    assert selection["assessment_id"] == assessment_id
    assert selection["state"] == "CONFIRMED"
