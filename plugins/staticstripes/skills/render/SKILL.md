---
name: render
description: Render a StaticStripes project to video. Use when the user asks to render, generate or export a staticstripes video, or runs /staticstripes:render.
argument-hint: "[output-name] [--option preset] [-p project-dir]"
---

# Render a StaticStripes project

Arguments: `$ARGUMENTS`

1. **Locate the project.** Use `-p` from the arguments if given, otherwise the current directory. Confirm
   `project.html` exists there; if not, search one level down and ask which project to use.
2. **Check the environment** once per session with the `setup` skill (FFmpeg, ffprobe, CLI). Don't repeat
   the check if it already passed.
3. **Pick the output.** Read the `<outputs>` block of `project.html`.
   - Output name given in arguments → use it (fail with the list of valid names if it doesn't exist).
   - No name and several outputs → ask which one, or offer to render all.
4. **Pick the preset.** Read the `<ffmpeg>` block. If the user asked for a quick/preview render and a fast
   preset exists (e.g. `preview`, `ultrafast`), pass `--option <name>`. Never invent a preset name that isn't
   defined in the file.
5. **Render:**

   ```bash
   staticstripes generate -p <project-dir> [-o <output>] [--option <preset>]
   ```

   Rendering can take minutes — run it in the background if your environment supports that and report progress.
6. **On failure**, re-run once with `--debug` to get the FFmpeg command and the timeline, then diagnose using
   the `staticstripes` skill (timing overlaps, missing assets, unknown CSS properties, unavailable encoders).
7. **Report** the output file path(s) from `data-path`, their size and duration
   (`ffprobe -v error -show_entries format=duration -of csv=p=0 <file>`).
