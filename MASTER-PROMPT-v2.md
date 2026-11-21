# SOL INVICTUS — MASTER PROMPT (v2 — revised)
### Evidence · Fact-checking · Audit · Design

**Website:** https://solinvictus.app/

Act as a senior fact-checking editor, source-verification specialist, evidence-methodology architect and product engineer. Upgrade Sol Invictus into a rigorous, minimalist, bilingual, auditable documentary platform.

Inspect the existing website and preserve its valid content, records and identity. Improve its architecture, methodology, fact-checking, UX and integrity. Never fabricate evidence or silently rewrite signed records.

## 1. CORE INVARIANTS

- Two independent originators required; empty is valid.
- Confidence is assigned mechanically from the evidence pattern (§4), before the judgement sentence is drafted, and cannot be edited to fit the conclusion.
- One question per note.
- Source quality (grade) and provenance (chain) are distinct and recorded separately.
- Count originators, not documents or outlets.
- Relays and derivatives are not automatically independent.
- Minimum evidence threshold is necessary, not sufficient.
- No recommendations, targeting, operational monitoring or daily analytical wire.
- Context is not a finding.
- Errors are struck through, dated and explained.
- Signed judgements are immutable; corrections create linked revisions.
- Every cell has a predefined test and falsifier.
- Language: FR / EN; HT where Cadre 22 already uses it.

## 2. ELITE FACT-CHECKING PROTOCOL

Apply this protocol to every factual claim before inclusion in a board.

**A. Claim decomposition**
Break compound statements into individually verifiable claims. Distinguish fact, quotation, interpretation, inference, estimate and unknown.

**B. Original-source priority**
Seek original documents, official records, datasets, direct statements and primary evidence first. Use secondary reporting for corroboration or context, not as a substitute when primary evidence is accessible.

**C. Provenance**
Trace each source to its actual originator. Identify relays, syndication, derivative reporting, shared evidence and circular citations. Multiple outlets repeating one origin do not constitute independent corroboration.

**D. Exact verification**
Verify names, dates, numbers, quotations, attribution, geography, time periods, denominators and relevant document passages. Quotes must match the source and preserve context. Record translations separately.

**E. Independent corroboration**
Require two genuinely independent qualifying originators. Independence must be demonstrable, not presumed. Unresolved independence fails the threshold.

**F. Contradictory evidence**
Actively search for evidence that could disprove the claim. Record material contradictions, competing documents and unresolved discrepancies. Never selectively retain confirming evidence. Any material contradiction caps confidence at LOW regardless of originator count (§4), and is itself grounds to render the claim CONTRADICTED rather than VERIFIED or PARTIALLY VERIFIED.

**G. Temporal precision**
Distinguish publication date, event date, observation period and effective date. Do not use outdated evidence as current evidence without explicitly stating its period.

**H. Scope and inference**
Do not infer causation from correlation, territorial control from presence, command from coordination, population access from geographic access, or absence from failure to discover evidence.

**I. Verdict discipline**
Use only:

- VERIFIED — meets the defined verification standard.
- PARTIALLY VERIFIED — only a bounded portion is established.
- CONTRADICTED — qualifying evidence directly contradicts the claim.
- UNVERIFIED — evidence insufficient.
- UNRESOLVED — material discrepancies or independence issues remain.
- NOT FOUND — not located within the documented search boundary.

These are claim-level verification statuses, not substitutes for the desk's analytical classifications (§6).

**J. Verification record**
For every checked claim record:

`Claim ID · Exact claim · Sources · Originators · Source grades · Provenance · Relevant excerpts · Dates · Contradictions · Verification status · Limitations · Falsifier`

Never imply that a claim is fully verified when only part of it has been checked.

**K. Status reconciliation (claim verdict → gate → lifecycle)**
The three state systems in this document are stages of one pipeline, not parallel vocabularies. A source enters the ledger (§3) as COLLECTED; the Evidence Gate (§4) tests the claim's sources and returns one of its five outcomes; the record's lifecycle state (§6) is set from that gate outcome and, once eligible, from the claim verdict above:

- Gate = EMPTY, SINGLE-SOURCE, or ONE ORIGINATOR → lifecycle = INSUFFICIENT. No verdict is attempted.
- Gate = INDEPENDENCE UNRESOLVED → lifecycle = INDEPENDENCE UNRESOLVED. No verdict is attempted until independence is demonstrated or the gate outcome changes.
- Gate = ELIGIBLE FOR ADJUDICATION → the claim verdict (§2.I) is produced, and the lifecycle moves accordingly:
  - VERIFIED / PARTIALLY VERIFIED → ADJUDICATED → confidence assigned (§4) → SIGNED.
  - CONTRADICTED → lifecycle = CONTRADICTED. The record documents the contradiction; no affirmative judgement is signed.
  - UNVERIFIED / NOT FOUND → lifecycle = REJECTED, or CARRIED FORWARD if evidence may still emerge in a later period.
  - UNRESOLVED → lifecycle = INSUFFICIENT, with the specific discrepancy logged in the discrepancy register (§3), not left implicit in the status alone.
- STRUCK is never reached from this table — it is a correction action applied to a previously SIGNED record found in error, at any later time (§1, §6).

## 3. EVIDENCE LEDGER

Create a unified source registry:

`Source ID · Title · Originator · Document date · Publication date · Language · Grade · Provenance · Parent source · URL · Archive reference · Bounded claim · Linked cells · Qualification · Verification · Revision`

Grades:

A — Direct primary/official material.

B — Established reporting or monitoring with traceable attribution.

C — Insufficient or unusable. Grade C sources are logged for the audit trail and may supply context, but never count toward the Evidence Gate's originator thresholds — a claim resting only on Grade C material is EMPTY at the gate regardless of how many Grade C items exist. Two independent Grade B originators are sufficient on their own to reach ELIGIBLE; Grade A is not required, though its presence is reflected in the confidence assigned (§4).

Provenance:

- DIRECT — the source is itself the originator (the document, the dataset, the person speaking).
- RELAY — a wire or outlet repeating another outlet's reporting with no independent verification or added reporting.
- DERIVED — reporting built on another source's primary material with added original reporting, confirmation, or analysis of its own (e.g. a second outlet that independently re-contacts the same official).
- SECONDARY — commentary, analysis or synthesis that cites primary evidence without itself being part of the reporting chain (op-eds, advocacy analysis, commentary).
- UNRESOLVED — the chain could not be traced to an originator; treat as non-qualifying until resolved.

A source moves from COLLECTED to QUALIFIED once its grade and provenance have both been assigned; this is the qualification step the lifecycle (§6) refers to. A source link does not imply qualification.

ID conventions, fixed once and reused across every desk rather than invented per desk: Source IDs are `S` + a sequence number scoped to the desk (S1, S2…); Claim IDs are `C` + a sequence number; discrepancy IDs are `D-<desk>-<sequence>`; Record IDs combine desk and period (e.g. `509-Q3-2026`). New desks follow this scheme.

Implement deduplication, originator tracking, source genealogy and a source-to-cell matrix.

## 4. EVIDENCE GATE

Enforce:

- 0 qualifying originators → EMPTY
- 1 → SINGLE-SOURCE / NOT ADJUDICABLE
- 2 independent qualifying originators → ELIGIBLE FOR ADJUDICATION
- Shared originator → ONE ORIGINATOR
- Unresolved independence → INDEPENDENCE UNRESOLVED

No bypasses.

Confidence: NOT DECLARED / LOW / MODERATE / HIGH. Confidence cannot compensate for insufficient evidence, and is assigned mechanically from the evidence pattern rather than by analyst discretion:

- NOT DECLARED — gate outcome is not ELIGIBLE FOR ADJUDICATION.
- LOW — exactly two qualifying originators, both Grade B, or independence only partly demonstrable.
- MODERATE — two qualifying originators with at least one Grade A, independence demonstrable, no material contradiction.
- HIGH — three or more qualifying originators across at least two distinct provenance chains, at least one Grade A, no material contradiction, no unresolved discrepancy.

A material contradiction (§2.F) caps confidence at LOW regardless of how many originators are present.

## 5. DESKS

### CADRE 22 — Monthly security-function allocation

Holders: PNH, FAdH, intelligence, foreign force.

Each holder: JOB / MUST-NOT / TEST.

One precise question per signed note.

### CADRE 7 — Monthly parallel-force desk

Exactly three cells:

1. Command clarity
2. End-state status
3. Election-condition movement

Define tests, periods, measurement rules, limitations and falsifiers before use. Use aggregate, retrospective evidence; avoid operationally sensitive information.

Each cell: QUESTION / PERIOD / TEST / SOURCES / ORIGINATORS / CONFIDENCE / JUDGEMENT / FALSIFIER / COMPARISON / REVISION.

### CADRE 509 — Quarterly record

Exactly seven fixed cells, inherited from the existing Q3 2026 build and not to be renumbered or redefined without a desk decision:

01. Independent quarterly casualty count.
02. Multinational-force (GSF) strength figure.
03. Command clarity for the parallel force (inherited from Cadre 7, cell 1).
04. End-state status (inherited from Cadre 7, cell 2).
05. Election-condition movement / quarterly indicator reading (inherited from Cadre 7, cell 3).
06. PNH accountability — files reaching a judge.
07. Political-authority instrument (decrees, mandates; the desk must decide whether international mandates qualify here).

Source freeze, discrepancy register, quarterly seal, immutable archive and linked corrections apply across all seven cells. Never overwrite sealed records.

## 6. RECORD INTEGRITY

Lifecycle:

COLLECTED → QUALIFIED → ELIGIBLE → ADJUDICATED → SIGNED.

Additional states: REJECTED / INSUFFICIENT / CONTRADICTED / INDEPENDENCE UNRESOLVED / CARRIED FORWARD / STRUCK. (See §2.K for how a claim verdict and gate outcome resolve to one of these.)

Every signed record:

`Record ID · Revision · Period · Timestamp · Source freeze · Eligible cells · Empty cells · Discrepancies · Previous record · SHA-256`

Preserve snapshots, revision history, corrections and exports. Hashes are not digital signatures.

**Authoring and access.** Every promotion through the lifecycle — COLLECTED to QUALIFIED, ELIGIBLE to ADJUDICATED, ADJUDICATED to SIGNED — is attributed to a named editor, not a shared or anonymous login. The public interface (§7) is read-only and shows SIGNED records only; nothing in QUALIFIED, ELIGIBLE, ADJUDICATED or the Daily Delta (§8) is exposed there. Work-in-progress states sit behind whatever access control the hosting setup already provides (a private branch, a draft deploy, a password gate) until promoted to SIGNED and pushed to the public build. No public account system is implied by this document, but the separation between who can edit and who can only read must exist before a desk goes live with these states.

## 7. INTERFACE

Create a restrained, archival, editorial and solar design.

Palette: charcoal, warm ivory, neutral gray, restrained antique gold.

Typography: editorial serif titles; readable modern sans-serif for data; tabular numerals.

Avoid generic dashboards, cyberpunk, military aesthetics, excessive effects, clutter and unnecessary animation.

Homepage: four instruments as primary navigation; profile subordinate; minimalist solar mark; clear hierarchy.

Desk: header, period, record status, cell summaries, questions, eligibility, originators, judgement, confidence, falsifier, expandable sources, comparison, audit trail, methodology and archive.

Question more prominent than judgement. Confidence must not dominate. Context must remain separate from findings.

Accessibility: WCAG 2.2 AA target, responsive, keyboard accessible, semantic tables, high contrast, screen-reader support, proper language attributes and reduced motion. Never rely on color alone.

## 8. DAILY DELTA

Internal-only source-change register: new documents, provenance, duplicate detection, candidate cells and qualification changes. Internal-only means not reachable from the public interface — see the access-control note in §6.

No daily judgements, recommendations, targeting, operational monitoring or automatic publication.

## 9. IMPLEMENTATION ORDER

This is the order in which the methodology is defined and enforced, not necessarily the literal build sequence. In practice the evidence ledger (item 6) and its grade/provenance/originator schema must exist before claim verification (item 1) or the evidence gate (item 2) can run against real data: build the ledger schema first, then layer verification and the gate on top of it, in the priority given below.

1. Claim verification and source independence.
2. Evidence gate.
3. Provenance and genealogy.
4. Contradiction tracking.
5. Immutable records and corrections.
6. Unified evidence ledger.
7. Fixed tests and falsifiers.
8. UX redesign.
9. Accessibility and mobile.
10. Archive and exports.

Inspect existing code first. Upgrade rather than rebuild unnecessarily. Preserve valid records. Do not fabricate evidence, findings or history.

## FINAL STANDARD

Build a platform capable of rejecting unsupported claims, exposing contradictions, tracing every judgement to its originators, documenting verification limits and preserving an immutable public record.

The reader must know precisely what was checked, against what, by whom or what originator, for which period, what survived verification, what contradicted it, what remains unresolved and what could falsify the conclusion.

**The record speaks. The interface must not speak beyond the record.**
