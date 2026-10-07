---
name: setup
description: Check and prepare the environment for StaticStripes (Node.js 22+, FFmpeg/ffprobe, the staticstripes CLI). Use before the first render in a session, when a staticstripes command fails with "ffmpeg not found" or "command not found", or when the user asks to set up StaticStripes.
---

# StaticStripes setup

StaticStripes shells out to the system `ffmpeg` and `ffprobe`. This plugin does **not** bundle or silently install
any binaries. Your job is to check what's there, report what's missing, and install only after the user agrees.

## 1. Check the environment

Run these and collect the results (don't stop at the first failure):

```bash
node --version        # need v22.0.0 or newer
npm --version         # need 10+
ffmpeg -version | head -1
ffprobe -version | head -1
staticstripes --version 2>/dev/null || npx --no-install @gannochenko/staticstripes --version 2>/dev/null || echo "staticstripes: not installed"
```

Summarize for the user as a short checklist: ✅ / ❌ per item, with the version found.

If everything is ✅, say so in one line and continue with the user's task.

## 2. If something is missing — ask first, then install

Never install anything without an explicit "yes" from the user. Propose the exact command for their OS
(`uname -s`; on Linux check `/etc/os-release`), explain it in one line, and wait.

| Missing | macOS | Debian/Ubuntu | Fedora | Windows |
|---|---|---|---|---|
| FFmpeg + ffprobe | `brew install ffmpeg` | `sudo apt-get install -y ffmpeg` | `sudo dnf install -y ffmpeg` | `winget install --id Gyan.FFmpeg -e` |
| Node.js 22+ | `brew install node@22` | via [nodejs.org](https://nodejs.org) or `nvm install 22` | `nvm install 22` | `winget install OpenJS.NodeJS.LTS` |
| staticstripes CLI | `npm install -g @gannochenko/staticstripes` | same | same | same |

Notes to mention when relevant:

- Installing the CLI from npm also pulls in **Puppeteer**, which downloads a headless Chromium (~150 MB) into
  `~/.cache/puppeteer`. It is only used to render `<app>` fragments.
- If the user doesn't want a global install, use `npx @gannochenko/staticstripes <command>` instead of
  `staticstripes <command>` everywhere.
- If `brew`/`apt`/`winget` itself is missing or the command needs `sudo` in a sandbox without it, don't try
  workarounds (no `curl | sh`, no downloading static builds from random mirrors). Point the user to
  https://ffmpeg.org/download.html and stop.

After installing, re-run step 1 to confirm.

## 3. Optional: hardware encoding

If the project's `<ffmpeg>` presets use `h264_nvenc` / `h264_videotoolbox` / `h264_qsv`, check the encoder is
available:

```bash
ffmpeg -hide_banner -encoders | grep -E "nvenc|videotoolbox|qsv"
```

If it isn't, suggest a `libx264` preset instead of failing mid-render.
