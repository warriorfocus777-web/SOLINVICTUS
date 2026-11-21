"""
Evidence engine for Sol Invictus — implements MASTER PROMPT v2 §2.K, §3, §4.

Pure functions only. This module does not read or write any desk file itself;
`evidence_audit.py` does that and calls into this module. Kept separate so the
rules can be unit-tested in isolation from file I/O and from any one desk's
JSON shape.

Deliberate scope limit (see AUDIT report, "Known limitation"): independence is
judged from each source's free-text `o` (originator) field, or from an
`originators` lookup table when the desk file provides one (Cadre 509 does;
Cadre 7 does not yet). Neither is a full provenance chain (DIRECT / RELAY /
DERIVED / SECONDARY / UNRESOLVED per §3) — this engine cannot yet detect two
differently-worded originators that are actually the same relay chain. That
is reported as a finding, not silently patched over.
"""

from dataclasses import dataclass, field
from enum import Enum


class Grade(str, Enum):
    A = "A"
    B = "B"
    C = "C"  # never counted toward the gate — §3


class GateOutcome(str, Enum):
    EMPTY = "EMPTY"
    SINGLE_SOURCE = "SINGLE-SOURCE / NOT ADJUDICABLE"
    ONE_ORIGINATOR = "ONE ORIGINATOR"
    INDEPENDENCE_UNRESOLVED = "INDEPENDENCE UNRESOLVED"
    ELIGIBLE = "ELIGIBLE FOR ADJUDICATION"


class Confidence(str, Enum):
    NOT_DECLARED = "NOT DECLARED"
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


@dataclass
class OriginatorAssessment:
    qualifying_originators: list  # distinct originator keys, Grade C excluded
    qualifying_citation_count: int  # count BEFORE dedup — needed to tell a
                                     # true single source from several
                                     # citations sharing one originator (§4
                                     # "Shared originator -> ONE ORIGINATOR")
    grades_present: set
    excluded_grade_c: list        # source ids excluded because Grade C
    unresolved_sources: list      # source ids with no resolvable originator


def originator_key(source: dict, originators_table: dict | None) -> str | None:
    """
    Resolve the independence key for one source.
    Prefers an explicit originator-table lookup (Cadre 509 style: source['o']
    is a short code into a shared dict); falls back to the raw `o` string
    (Cadre 7 style — no normalization across differently-worded mentions of
    the same org, which is exactly the gap flagged in the audit).
    """
    code = source.get("o")
    if code is None:
        return None
    if originators_table is not None and code in originators_table:
        return code  # the code itself is already the normalized key
    return code.strip()


def assess_originators(
    cited_sources: list[dict], originators_table: dict | None = None
) -> OriginatorAssessment:
    qualifying_keys = []
    grades_present = set()
    excluded_c = []
    unresolved = []

    for s in cited_sources:
        grade = (s.get("r") or "").upper()
        if grade == Grade.C.value:
            excluded_c.append(s.get("id"))
            continue
        key = originator_key(s, originators_table)
        if not key:
            unresolved.append(s.get("id"))
            continue
        qualifying_keys.append(key)
        if grade in (Grade.A.value, Grade.B.value):
            grades_present.add(grade)

    distinct = sorted(set(qualifying_keys))
    return OriginatorAssessment(
        qualifying_originators=distinct,
        qualifying_citation_count=len(qualifying_keys),
        grades_present=grades_present,
        excluded_grade_c=excluded_c,
        unresolved_sources=unresolved,
    )


def gate_outcome(assessment: OriginatorAssessment) -> GateOutcome:
    """
    §4 Evidence Gate. No bypasses.

    Known limitation (see AUDIT report): a source this engine cannot trace to
    an originator (`unresolved_sources`) is excluded from the count, exactly
    like Grade C — it is reported, never silently dropped — but this engine
    never *returns* INDEPENDENCE_UNRESOLVED on its own. Detecting that two
    already-distinctly-keyed originators are secretly the same relay chain
    needs the full provenance chain (§3 DIRECT/RELAY/DERIVED/SECONDARY),
    which neither desk file currently records. INDEPENDENCE UNRESOLVED stays
    a state the desk sets by hand until that field exists.
    """
    n_distinct = len(assessment.qualifying_originators)

    if n_distinct == 0:
        return GateOutcome.EMPTY

    if n_distinct == 1:
        if assessment.qualifying_citation_count > 1:
            # several citations, all tracing to the same originator
            return GateOutcome.ONE_ORIGINATOR
        return GateOutcome.SINGLE_SOURCE

    # n_distinct >= 2 qualifying, distinctly-keyed originators
    return GateOutcome.ELIGIBLE


def mechanical_confidence(
    assessment: OriginatorAssessment,
    gate: GateOutcome,
    has_material_contradiction: bool,
) -> Confidence:
    """
    §4 confidence rule — computed from evidence pattern only, never from the
    desired conclusion. This is advisory: see AUDIT "Known limitation #2".
    """
    if gate != GateOutcome.ELIGIBLE:
        return Confidence.NOT_DECLARED
    if has_material_contradiction:
        return Confidence.LOW

    n = len(assessment.qualifying_originators)
    has_a = Grade.A.value in assessment.grades_present
    only_b = assessment.grades_present == {Grade.B.value}

    if n >= 3 and has_a:
        return Confidence.HIGH
    if n >= 2 and has_a:
        return Confidence.MODERATE
    if n >= 2 and only_b:
        return Confidence.LOW
    return Confidence.LOW
