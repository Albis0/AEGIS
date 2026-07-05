# Getting Help with AEGIS

Thanks for using AEGIS! Here's where to go depending on what you need.

## Something is broken

- **Easiest:** use the in-app form — **Settings → About → Report a bug**. You can attach a screenshot, and it works even offline (the report is sent when you're back online).
- Or open a [GitHub issue](https://github.com/Albis0/AEGIS/issues/new/choose). Whatever details you can share help, but don't stress about filling every field.

## Security problem

Please email instead of opening a public issue — see [SECURITY.md](SECURITY.md). Any format is fine.

## Questions & ideas

- Check the [README](README.md) first — install steps, shortcuts, provider setup and troubleshooting live there.
- For "how does X work / could AEGIS do Y" — open a [feature request / discussion issue](https://github.com/Albis0/AEGIS/issues/new/choose).

## Common quick fixes

| Symptom | Try this |
|---|---|
| SmartScreen warning on install | Expected — the exe isn't code-signed (free hobby project). **More info → Run anyway**, or [verify the download](SECURITY.md#unsigned-releases--how-to-verify-a-download). |
| Trial mode fails right after a long break | The free backend was asleep; wait ~30 s and try again (AEGIS retries automatically). |
| Kokoro (offline TTS) missing | Select it under **Settings → Voice** — the voice model downloads once (~900 MB), then works offline. |
| App opens as a blank/odd window in dev | Unset `ELECTRON_RUN_AS_NODE` in your shell before `bun run dev`. |

AEGIS is a one-person hobby project — responses can take a few days, but every report and idea genuinely helps. 💙
