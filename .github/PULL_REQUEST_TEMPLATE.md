# What & why

<!-- One or two sentences: what changes, and what problem it solves. -->

## Checklist

- [ ] `bun run test` is green (and I added/updated tests for the behavior I changed)
- [ ] Type-check passes for both projects (`tsc -p tsconfig.electron.json` / `-p tsconfig.json --noEmit`)
- [ ] `bun run lint` is clean
- [ ] If I touched tools: `bun run test:trio` passes (schema ↔ executor sync; number-ish params stay `string`)
- [ ] If I added a tool domain: added roots to `TOOL_GROUPS` and a row to `TOOL_ROUTING` (prompts.ts), not to a prompt blob
- [ ] No secrets in the diff (pre-commit hook enabled: `git config core.hooksPath scripts/githooks`)
- [ ] I read the invariants in [ARCHITECTURE.md](../blob/main/ARCHITECTURE.md)
