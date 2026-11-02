# RupayKg Golden Transaction Acceptance Gate — 2026

## Purpose

This document defines the minimum evidence required before RupayKg claims an end-to-end Urban or Rural transaction is operationally proven.

## Canonical lifecycle

Real activity → authorized geography → measurement → evidence → approved verification → Guardian MRV → HCS provenance → eligibility decision → credential/registry authorization → transfer/retirement → settlement authorization → settlement/reconciliation → reporting.

## Non-inference rule

No downstream state may be inferred merely because an upstream state succeeded.

In particular:

- Guardian VERIFIED does not mean government verification.
- HCS consensus does not itself mean registry eligibility.
- Registry eligibility does not mean credential issuance.
- Credential issuance does not mean transfer or retirement.
- Retirement does not mean settlement.
- Platform records do not constitute statutory government issuance.

## Urban acceptance

A real authorized organization must demonstrate one transaction with an authorized ULB/Ward geography and real field activity. The transaction must preserve organization and geography authorization at every mutation boundary.

## Rural acceptance

A real authorized organization must demonstrate one transaction with an authorized Block/Gram Panchayat/Village geography and a real biomass activity. If aggregation is used, source identity and geography authorization must remain traceable.

## Required evidence

Each accepted transaction must have persisted authoritative records for the relevant lifecycle stages. Missing, rejected, unauthorized, or unavailable stages must remain visibly blocked; synthetic production records are prohibited.

## External dependency gate

If Guardian or Hedera production credentials/configuration are unavailable, the transaction may be exercised through the failure path but must not be represented as VERIFIED or CONSENSUS_CONFIRMED.

## Release rule

The Golden Operating Path is production-accepted only when both an Urban and Rural real transaction satisfy the lifecycle and non-inference rules, and CI plus the canonical Render deployment are healthy.
