# tools/

Supporting scripts for applying the MASTER PROMPT v2 methodology to the live
desks. Nothing here is wired into the public pages yet — see
`AUDIT-2026-11-21.md` at the repo root for why.

- `evidence_engine.py` — pure functions implementing the Evidence Gate (§4)
  and the mechanical confidence rule (§4), plus the originator-counting step
  §1/§3 describe ("count originators, not documents or outlets"). No file
  I/O. Unit tests in `test_evidence_engine.py`.
- `evidence_audit.py` — read-only script that runs the engine against
  `cadre7/desk.json` and `cadre509/desk509.json` and reports every place its
  computed gate/confidence differs from what the desk has on record. Changes
  nothing. Run it with `python3 evidence_audit.py` from this directory.
- `test_evidence_engine.py` — plain-assert unit tests, no pytest dependency.
  Run with `python3 test_evidence_engine.py`.

**Before wiring any of this into `cadre7/index.html` or `cadre509/index.html`
rendering:** read the "Headline finding" at the top of `AUDIT-2026-11-21.md`.
The short version: the engine currently overcounts originators because
neither desk file records, per citation, whether that source *asserts* the
cell's specific claim or is cited as context, as an out-of-period mention, or
as a documented negative result (searched, not found). That is an editorial
distinction, not something to infer here. Add it to the schema first.
