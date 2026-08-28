## What this changes

<!-- One or two sentences. What behaviour is different after this PR? -->

## Why

<!-- The reasoning, not the diff. What problem does this solve? -->

## Checks

- [ ] `cargo test` passes
- [ ] `cargo clippy --all-targets` is clean
- [ ] New behaviour has a test that fails without the change

## Invariants

Tick any this PR touches, and say how it stays intact
(see [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md)):

- [ ] The model never sees more than 12 tools
- [ ] Conversational messages get no tools
- [ ] Barge-in does not start the next utterance
- [ ] Everything counts against the context budget
- [ ] Destructive tools require approval

<!-- If this adds a tool: did the selection eval stay at 100%? -->
