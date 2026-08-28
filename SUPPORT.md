# Support

## Getting started

The [README](README.md) covers installation, the first API key, and the full
command list. Most first-run problems are one of these:

**"no API key" on startup** — enter one with `/key groq gsk_...`. Groq has a
free tier and powers both chat and speech recognition. Get a key at
[console.groq.com](https://console.groq.com).

**Windows SmartScreen warning** — expected and permanent. The binary is
deliberately unsigned; [SECURITY.md](SECURITY.md) explains how to verify a
download instead.

**Voice does nothing** — speech recognition needs a Groq key even if you use
a different provider for chat. Press `Ctrl+M` to cycle voice modes; the
indicator left of the input line shows the current one.

**The assistant answers in the wrong language** — `/ayar dil en` (or `tr`,
`de`, `fr`, `es`).

## Something is broken

1. Press `F1` and note the version, provider and model.
2. Check `%APPDATA%\vavis\data\logs\` — the daily log usually names the cause.
   A `cokme.log` file only exists if the app crashed.
3. Open a [bug report](https://github.com/Albis0/Vavis/issues/new/choose).

Include the log output. Keys never appear in logs, but glance before pasting.

## Asking a question

Use [Discussions](https://github.com/Albis0/Vavis/discussions) rather than an
issue. Issues are for defects and concrete feature requests.

## Reporting a security problem

By email, not publicly — see [SECURITY.md](SECURITY.md).

## Response times

This is a one-person hobby project. Expect a reply within a few days;
occasional delays happen. Security reports get looked at first.

## What is out of scope

- **Platforms other than Windows.** The app links Win32 APIs directly
  (DPAPI, screen capture, media keys) with no cross-platform stand-in.
- **Provider account problems.** Billing, rate limits and key issues belong
  to Groq, Anthropic, OpenAI and the rest.
- **"Make it do X" without detail.** Describe the problem you are hitting;
  that usually leads somewhere better than a proposed solution.
