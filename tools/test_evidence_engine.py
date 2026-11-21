"""
Unit tests for evidence_engine.py — run with: python3 -I tools/test_evidence_engine.py
No pytest dependency on purpose (this repo is a static site, no package.json
Python deps); plain asserts with a tiny runner.
"""

from evidence_engine import assess_originators, gate_outcome, mechanical_confidence, GateOutcome, Confidence


def src(id_, o, r):
    return {"id": id_, "o": o, "r": r}


def run(name, fn):
    try:
        fn()
        print(f"PASS  {name}")
    except AssertionError as e:
        print(f"FAIL  {name}: {e}")
        raise


def test_zero_sources_is_empty():
    a = assess_originators([])
    assert gate_outcome(a) == GateOutcome.EMPTY


def test_all_grade_c_is_empty():
    sources = [src("S1", "OrgA", "C"), src("S2", "OrgB", "C")]
    a = assess_originators(sources)
    assert gate_outcome(a) == GateOutcome.EMPTY, "Grade C must never qualify, however many there are"


def test_single_source_is_single_source():
    a = assess_originators([src("S1", "OrgA", "A")])
    assert gate_outcome(a) == GateOutcome.SINGLE_SOURCE


def test_two_citations_one_shared_originator():
    sources = [src("S1", "OrgA", "A"), src("S2", "OrgA", "B")]
    a = assess_originators(sources)
    assert gate_outcome(a) == GateOutcome.ONE_ORIGINATOR, "same originator cited twice must not read as two"


def test_two_distinct_originators_is_eligible():
    sources = [src("S1", "OrgA", "B"), src("S2", "OrgB", "B")]
    a = assess_originators(sources)
    assert gate_outcome(a) == GateOutcome.ELIGIBLE


def test_grade_c_excluded_from_otherwise_eligible_pair():
    sources = [src("S1", "OrgA", "B"), src("S2", "OrgB", "B"), src("S3", "OrgC", "C")]
    a = assess_originators(sources)
    assert gate_outcome(a) == GateOutcome.ELIGIBLE
    assert a.excluded_grade_c == ["S3"]


def test_confidence_not_declared_when_not_eligible():
    sources = [src("S1", "OrgA", "A")]
    a = assess_originators(sources)
    gate = gate_outcome(a)
    assert mechanical_confidence(a, gate, False) == Confidence.NOT_DECLARED


def test_confidence_low_two_b_grade():
    sources = [src("S1", "OrgA", "B"), src("S2", "OrgB", "B")]
    a = assess_originators(sources)
    gate = gate_outcome(a)
    assert gate == GateOutcome.ELIGIBLE
    assert mechanical_confidence(a, gate, False) == Confidence.LOW


def test_confidence_moderate_two_originators_one_a():
    sources = [src("S1", "OrgA", "A"), src("S2", "OrgB", "B")]
    a = assess_originators(sources)
    gate = gate_outcome(a)
    assert mechanical_confidence(a, gate, False) == Confidence.MODERATE


def test_confidence_high_three_plus_with_a():
    sources = [src("S1", "OrgA", "A"), src("S2", "OrgB", "B"), src("S3", "OrgC", "B")]
    a = assess_originators(sources)
    gate = gate_outcome(a)
    assert mechanical_confidence(a, gate, False) == Confidence.HIGH


def test_contradiction_caps_at_low_even_with_high_pattern():
    sources = [src("S1", "OrgA", "A"), src("S2", "OrgB", "B"), src("S3", "OrgC", "B")]
    a = assess_originators(sources)
    gate = gate_outcome(a)
    assert mechanical_confidence(a, gate, True) == Confidence.LOW


def test_originator_table_lookup_normalizes_codes():
    table = {"UN": "United Nations"}
    sources = [src("S1", "UN", "A"), src("S2", "UN", "B")]
    a = assess_originators(sources, originators_table=table)
    assert gate_outcome(a) == GateOutcome.ONE_ORIGINATOR


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for t in tests:
        run(t.__name__, t)
    print(f"\n{len(tests)} tests passed.")
