#!/usr/bin/env python3
"""
sort_takes.py - identify which script section each video take belongs to.

Two passes:

  PASS 1 (default)   transcribe the first N seconds of every video, match it
                     against the labelled script, and write a CSV to review.
  PASS 2 (--copy)    read that CSV back and copy files into per-section
                     folders. Dry-run unless you add --yes. Nothing is ever
                     moved or deleted - originals stay where they are.

Matching uses two signals: fuzzy text match against each script section, and
the order the files were shot in. Because the shoot ran roughly in script
order, a take that scores weakly on text alone is usually still pinned down
by its neighbours. Within each section the LAST take is marked KEEP and the
earlier ones ARCHIVE, which you can override in the CSV.

Between the passes you are expected to open the CSV, fix any wrong
matched_section or keep cells, and set the flag cell of anything you fixed
to OK.

Examples
--------
  # check the script file parses before doing anything slow
  python sort_takes.py --script script.txt --list-sections

  # pass 1 - transcribe and match
  python sort_takes.py --folder "C:\\Users\\me\\Downloads\\Shoot" --script script.txt

  # pass 2 - dry run, then for real
  python sort_takes.py --folder "...\\Shoot" --script script.txt --copy
  python sort_takes.py --folder "...\\Shoot" --script script.txt --copy --yes
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

VIDEO_EXTS = {".mov", ".mp4", ".m4v"}

CSV_FIELDS = [
    "filename",
    "shoot_index",
    "duration_sec",
    "matched_section",
    "confidence",
    "keep",
    "take_index",
    "first_line",
    "takes_in_clip",
    "fuzzy_section",
    "runner_up_section",
    "runner_up_confidence",
    "margin",
    "flag",
]

# Rows carrying these flags stop the copy pass until you look at them.
BLOCKING_FLAGS = {"LOW_CONFIDENCE", "AMBIGUOUS", "EMPTY_AUDIO", "NO_AUDIO", ""}

# ---------------------------------------------------------------- text utils

CONTRACTIONS = {
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
    "it's": "it is", "that's": "that is", "what's": "what is", "here's": "here is",
    "there's": "there is", "he's": "he is", "she's": "she is", "who's": "who is",
    "let's": "let us", "i've": "i have", "you've": "you have", "we've": "we have",
    "they've": "they have", "i'll": "i will", "you'll": "you will",
    "we'll": "we will", "they'll": "they will", "it'll": "it will",
    "i'd": "i would", "you'd": "you would", "we'd": "we would",
    "don't": "do not", "doesn't": "does not", "didn't": "did not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not",
    "weren't": "were not", "can't": "cannot", "couldn't": "could not",
    "won't": "will not", "wouldn't": "would not", "shouldn't": "should not",
    "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
    "ain't": "is not", "gonna": "going to", "wanna": "want to",
}
_CONTRACTION_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(CONTRACTIONS, key=len, reverse=True)) + r")\b"
)


def normalise(text: str) -> str:
    """Lowercase, expand contractions, strip punctuation, collapse whitespace.

    Script and transcript both go through this, so "you're" and "you are"
    score as identical rather than as a near miss.
    """
    t = text.lower().replace("\u2019", "'").replace("\u2018", "'")
    t = _CONTRACTION_RE.sub(lambda m: CONTRACTIONS[m.group(1)], t)
    t = re.sub(r"[^a-z0-9' ]+", " ", t)
    t = t.replace("'", "")
    return re.sub(r"\s+", " ", t).strip()


def head_words(text: str, n: int) -> str:
    return " ".join(text.split()[:n])


# ------------------------------------------------------------ fuzzy matching

def _load_scorers():
    """rapidfuzz if present, difflib otherwise (slower, slightly blunter)."""
    try:
        from rapidfuzz import fuzz  # type: ignore
        return fuzz.token_set_ratio, fuzz.partial_ratio
    except ImportError:
        import difflib

        def token_set_ratio(a: str, b: str) -> float:
            ta, tb = set(a.split()), set(b.split())
            if not ta or not tb:
                return 0.0
            inter = ta & tb
            base = " ".join(sorted(inter))
            best = 0.0
            for other in (" ".join(sorted(ta - inter)), " ".join(sorted(tb - inter))):
                cand = (base + " " + other).strip()
                best = max(best, difflib.SequenceMatcher(None, base, cand).ratio())
            both = difflib.SequenceMatcher(
                None, " ".join(sorted(ta)), " ".join(sorted(tb))).ratio()
            return max(best, both) * 100.0

        def partial_ratio(a: str, b: str) -> float:
            short, long_ = (a, b) if len(a) <= len(b) else (b, a)
            if not short:
                return 0.0
            best = 0.0
            for block in difflib.SequenceMatcher(None, short, long_).get_matching_blocks():
                start = max(0, block.b - block.a)
                window = long_[start:start + len(short)]
                best = max(best, difflib.SequenceMatcher(None, short, window).ratio())
            return best * 100.0

        return token_set_ratio, partial_ratio


TOKEN_SET_RATIO, PARTIAL_RATIO = _load_scorers()


def score_against(transcript_norm: str, section: dict, open_words: int) -> float:
    """Best of two views: opening line vs opening line, and transcript-in-section.

    The opening comparison is the strong signal, since every take starts by
    reading the line. The partial comparison rescues takes that open with a
    slate ("take two...") or a false start before the real line, and takes
    where a few words of the line were changed on the day.
    """
    t_head = head_words(transcript_norm, open_words)
    s_open = head_words(section["norm"], open_words)
    return max(
        TOKEN_SET_RATIO(t_head, s_open),
        PARTIAL_RATIO(transcript_norm, section["norm"]),
    )


def estimate_takes(transcript: str, probe_words: int = 6) -> int:
    """Rough count of how many times one clip restarts the same line."""
    t = normalise(transcript)
    probe = head_words(t, probe_words)
    if len(probe.split()) < probe_words:
        return 1
    count, start = 0, 0
    while (i := t.find(probe, start)) >= 0:
        count += 1
        start = i + len(probe)
    return max(1, count)


# ------------------------------------------------- order-aware assignment

def sequence_align(scores: list[list[float]], jump_penalty: float,
                   skip_penalty: float) -> list[int]:
    """Pick a section per file, preferring assignments that run in script order.

    The shoot ran roughly in script order, so section indices should mostly
    climb. This is a small dynamic program over (file, section) where each
    transition from the previous file's section costs:

      same section, or the next one   free   - consecutive takes of one line,
                                               or moving on to the next line
      skipping further forward        skip_penalty per section skipped, since
                                               every section did get shot
      going backwards                 jump_penalty - a pickup out of order

    Text score still dominates, so a genuine out-of-order pickup wins as long
    as it is clearly better on the words. It just has to earn it.
    """
    n = len(scores)
    m = len(scores[0]) if n else 0
    if not n or not m:
        return []

    def transition(prev_j: int, j: int) -> float:
        if j == prev_j or j == prev_j + 1:
            return 0.0
        if j > prev_j:
            return skip_penalty * (j - prev_j - 1)
        return jump_penalty

    best = list(scores[0])
    back: list[list[int]] = []
    for i in range(1, n):
        cur, bk = [], []
        for j in range(m):
            src = max(range(m), key=lambda p: best[p] - transition(p, j))
            cur.append(scores[i][j] + best[src] - transition(src, j))
            bk.append(src)
        best, _ = cur, back.append(bk)

    j = max(range(m), key=lambda k: best[k])
    path = [j]
    for i in range(n - 1, 0, -1):
        j = back[i - 1][j]
        path.append(j)
    path.reverse()
    return path


# ------------------------------------------------------------ script parsing

_LABEL_WORDS = (
    r"beat|ad\s*hook|hook|section|scene|part|segment|vsl|cta|intro|outro|"
    r"opener|close|closing|variant|angle|pitch|offer|proof|story"
)
# Matches the START of a heading label. Override with --header-regex.
DEFAULT_HEADER_RE = re.compile(r"^(?:%s)\b" % _LABEL_WORDS, re.IGNORECASE)

_DECOR_RE = re.compile(r"^(?:\#{1,6}|[-*+\u2022])\s*")
# First colon, or a SPACE-PADDED dash. Unpadded dashes are left alone so a
# label like "Ad Hook P1-H1" survives intact.
_SPLIT_RE = re.compile(r"\s+[\u2013\u2014-]\s+|:")


def looks_like_header(line: str, pattern: re.Pattern):
    """Return (label, inline_body) if this line is a section heading.

    A heading is a short line starting with a known label word that either
    carries a number or ends in a colon. Without those two guards a body line
    like "Part of the problem is more spend" gets swallowed as a heading.
    """
    raw = line.strip()
    if not raw:
        return None
    # strip markdown/bullet decoration: "## Beat 1", "**Ad Hook P1-H2**", "[Beat 3]"
    stripped = _DECOR_RE.sub("", raw).strip(" \t*_[]()")
    if not stripped:
        return None

    m = _SPLIT_RE.search(stripped)
    if m:
        label, rest = stripped[:m.start()].strip(), stripped[m.end():].strip()
    else:
        label, rest = stripped, ""

    if not pattern.match(label):
        return None
    if len(label) > 60 or len(label.split()) > 6:
        return None
    if not (any(c.isdigit() for c in label) or ":" in stripped):
        return None

    # A short tail with no sentence punctuation is a subtitle ("Beat 1: The
    # Cold Open"), not a spoken line, so it belongs in the label. A longer
    # tail is dialogue ("CTA: Book the teardown. It's free...").
    if rest and len(rest.split()) <= 6 and not re.search(r"[.!?]$", rest):
        label, rest = f"{label} - {rest}", ""

    return re.sub(r"\s+", " ", label), rest


def parse_script(path: Path, pattern: re.Pattern, body_words: int) -> list[dict]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    blocks: list[dict] = []
    current: dict | None = None
    for line in raw.splitlines():
        hit = looks_like_header(line, pattern)
        if hit:
            label, rest = hit
            current = {"label": label, "lines": [rest] if rest else []}
            blocks.append(current)
        elif current is not None and line.strip():
            current["lines"].append(line.strip())

    out: list[dict] = []
    seen: dict[str, int] = {}
    for block in blocks:
        body = " ".join(block["lines"]).strip()
        if not body:
            continue
        label = block["label"]
        if label in seen:                        # duplicate heading -> "Beat 3 (2)"
            seen[label] += 1
            label = f"{label} ({seen[label]})"
        else:
            seen[label] = 1
        out.append({
            "label": label,
            "text": body,
            # only the opening of a section can show up in a 20s clip
            "norm": head_words(normalise(body), body_words),
        })
    return out


# -------------------------------------------------------------- media probes

def ffprobe_duration(ffprobe: str, path: Path) -> float:
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, timeout=120,
        )
        return round(float(r.stdout.strip()), 2)
    except (ValueError, subprocess.SubprocessError):
        return 0.0


def extract_audio(ffmpeg: str, src: Path, dst: Path, seconds: int) -> bool:
    cmd = [
        ffmpeg, "-nostdin", "-v", "error", "-y",
        "-ss", "0", "-t", str(seconds), "-i", str(src),
        "-map", "0:a:0?", "-vn", "-ac", "1", "-ar", "16000",
        "-c:a", "pcm_s16le", str(dst),
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except subprocess.SubprocessError as exc:
        print(f"    ffmpeg failed: {exc}")
        return False
    if r.returncode != 0:
        tail = r.stderr.strip().splitlines()
        print(f"    ffmpeg: {tail[-1] if tail else 'failed'}")
        return False
    return dst.exists() and dst.stat().st_size > 1024


# ------------------------------------------------------------- transcription

class Transcriber:
    def __init__(self, model_size: str, device: str, prompt: str | None):
        try:
            from faster_whisper import WhisperModel  # type: ignore
        except ImportError:
            sys.exit("faster-whisper is not installed.\n"
                     "  pip install faster-whisper rapidfuzz")
        self.prompt = prompt or None
        order = ([("cuda", "float16"), ("cpu", "int8")] if device == "auto"
                 else [(device, "float16" if device == "cuda" else "int8"),
                       ("cpu", "int8")])
        last: Exception | None = None
        for dev, ctype in order:
            try:
                self.model = WhisperModel(model_size, device=dev, compute_type=ctype)
                print(f"whisper: model={model_size} device={dev} compute={ctype}\n")
                return
            except Exception as exc:                    # noqa: BLE001 - probing
                last = exc
        sys.exit(f"could not start faster-whisper: {last}")

    def transcribe(self, wav: Path) -> tuple[str, str]:
        segments, _info = self.model.transcribe(
            str(wav),
            language="en",
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
            initial_prompt=self.prompt,
        )
        texts = [seg.text.strip() for seg in segments if seg.text.strip()]
        return " ".join(texts), (texts[0] if texts else "")


# --------------------------------------------------------------------- cache

def cache_key(path: Path, clip_seconds: int, model: str) -> str:
    st = path.stat()
    return f"{path.name}|{st.st_size}|{int(st.st_mtime)}|{clip_seconds}|{model}"


def load_cache(p: Path) -> dict:
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


# -------------------------------------------------------------------- pass 1

def sanitise_folder(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", name).strip().rstrip(". ")
    return cleaned or "UNMATCHED"


def list_videos(folder: Path, order_by: str) -> list[Path]:
    vids = [p for p in folder.iterdir()
            if p.is_file() and p.suffix.lower() in VIDEO_EXTS]
    if order_by == "mtime":
        return sorted(vids, key=lambda p: (p.stat().st_mtime, p.name.lower()))
    return sorted(vids, key=lambda p: p.name.lower())


def pass_one(args, sections: list[dict]) -> int:
    folder = Path(args.folder)
    videos = list_videos(folder, args.order_by)
    if not videos:
        print(f"no {'/'.join(sorted(VIDEO_EXTS))} files in {folder}")
        return 1
    print(f"{len(videos)} video file(s), {len(sections)} script section(s)")
    print(f"shoot order: by {args.order_by}\n")

    cache_path = folder / ".sort_takes_cache.json"
    cache = load_cache(cache_path)
    transcriber: Transcriber | None = None
    tmpdir = Path(tempfile.mkdtemp(prefix="sort_takes_"))
    records: list[dict] = []
    transcripts: dict[str, str] = {}
    started = time.time()

    try:
        for i, video in enumerate(videos, 1):
            key = cache_key(video, args.clip_seconds, args.model)
            print(f"[{i}/{len(videos)}] {video.name}")
            if key in cache:
                entry = cache[key]
                full, first, duration = entry["full"], entry["first"], entry["duration"]
                print("    (cached)")
            else:
                duration = ffprobe_duration(args.ffprobe, video)
                wav = tmpdir / f"{video.stem}.wav"
                if not extract_audio(args.ffmpeg, video, wav, args.clip_seconds):
                    records.append({"path": video, "duration": duration, "full": "",
                                    "first": "", "flag": "NO_AUDIO"})
                    continue
                if transcriber is None:
                    transcriber = Transcriber(args.model, args.device, args.prompt)
                full, first = transcriber.transcribe(wav)
                wav.unlink(missing_ok=True)
                cache[key] = {"full": full, "first": first, "duration": duration}
                cache_path.write_text(json.dumps(cache, indent=1, ensure_ascii=False),
                                      encoding="utf-8")
            transcripts[video.name] = full
            records.append({"path": video, "duration": duration, "full": full,
                            "first": first, "flag": ""})
            print(f'    "{first[:72]}"')
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    # --- score every clip against every section -------------------------
    usable = [r for r in records if r["full"].strip()]
    matrix: list[list[float]] = []
    for r in usable:
        t = normalise(r["full"])
        matrix.append([score_against(t, s, args.open_words) for s in sections])

    # --- fold in the shoot order ----------------------------------------
    if args.no_order or not matrix:
        chosen = [max(range(len(sections)), key=lambda j: row[j]) for row in matrix]
    else:
        chosen = sequence_align(matrix, args.jump_penalty, args.skip_penalty)

    for r, row, pick in zip(usable, matrix, chosen):
        ranked = sorted(range(len(sections)), key=lambda j: row[j], reverse=True)
        fuzzy_best = ranked[0]
        runner = next((j for j in ranked if j != pick), None)
        r["section"] = sections[pick]["label"]
        r["confidence"] = round(row[pick], 1)
        r["fuzzy_section"] = sections[fuzzy_best]["label"]
        r["runner_up"] = sections[runner]["label"] if runner is not None else ""
        r["runner_up_conf"] = round(row[runner], 1) if runner is not None else 0.0
        r["margin"] = round(row[pick] - (row[runner] if runner is not None else 0.0), 1)
        r["takes_in_clip"] = estimate_takes(r["full"])
        if r["confidence"] < args.min_confidence:
            r["flag"] = "LOW_CONFIDENCE"
        elif pick != fuzzy_best:
            r["flag"] = "ORDER_FIX"        # order overruled the text match
        elif r["margin"] < args.min_margin:
            r["flag"] = "AMBIGUOUS"
        else:
            r["flag"] = "OK"

    for r in records:
        if not r.get("section"):
            r.setdefault("section", "")
            r.setdefault("confidence", 0.0)
            r.setdefault("fuzzy_section", "")
            r.setdefault("runner_up", "")
            r.setdefault("runner_up_conf", 0.0)
            r.setdefault("margin", 0.0)
            r.setdefault("takes_in_clip", "")
            if not r["flag"]:
                r["flag"] = "EMPTY_AUDIO"

    # --- number takes, and mark the last of each section as the keeper ---
    counters: dict[str, int] = {}
    for r in records:
        if r["section"]:
            counters[r["section"]] = counters.get(r["section"], 0) + 1
            r["take_index"] = counters[r["section"]]
        else:
            r["take_index"] = ""
    for r in records:
        if not r["section"]:
            r["keep"] = "SKIP"       # nothing usable here; excluded from the copy
        elif r["take_index"] == counters[r["section"]]:
            r["keep"] = "KEEP"       # last take of the section is the good one
        else:
            r["keep"] = "ARCHIVE"

    rows = [{
        "filename": r["path"].name,
        "shoot_index": i,
        "duration_sec": r["duration"],
        "matched_section": r["section"],
        "confidence": r["confidence"],
        "keep": r["keep"],
        "take_index": r["take_index"],
        "first_line": r["first"],
        "takes_in_clip": r["takes_in_clip"],
        "fuzzy_section": r["fuzzy_section"],
        "runner_up_section": r["runner_up"],
        "runner_up_confidence": r["runner_up_conf"],
        "margin": r["margin"],
        "flag": r["flag"],
    } for i, r in enumerate(records, 1)]

    out_csv = Path(args.csv)
    with out_csv.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    out_csv.with_suffix(".transcripts.json").write_text(
        json.dumps(transcripts, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"\nwrote {out_csv}  ({time.time() - started:.0f}s)")
    print(f"wrote {out_csv.with_suffix('.transcripts.json')}  (full transcripts)")
    summarise(rows, sections)
    print("\nNEXT: open the CSV and check it. Fix any wrong matched_section or")
    print("      keep cell, set the flag of anything you fixed to OK, then run")
    print("      --copy for a dry run and --copy --yes to do it.")
    return 0


def summarise(rows: list[dict], sections: list[dict]) -> None:
    order = {s["label"]: i for i, s in enumerate(sections)}
    counts: dict[str, int] = {}
    for r in rows:
        label = r["matched_section"] or "(unmatched)"
        counts[label] = counts.get(label, 0) + 1

    print("\n--- takes per section (KEEP = last one shot) ---")
    for s in sections:
        n = counts.get(s["label"], 0)
        keeper = next((r["filename"] for r in rows
                       if r["matched_section"] == s["label"] and r["keep"] == "KEEP"), "")
        note = "  <-- NO TAKES" if n == 0 else f"  keep: {keeper}"
        print(f"  {n:>3}  {s['label']}{note}")
    if counts.get("(unmatched)"):
        print(f"  {counts['(unmatched)']:>3}  (unmatched)")

    flags: dict[str, int] = {}
    for r in rows:
        flags[r["flag"]] = flags.get(r["flag"], 0) + 1
    print("--- flags ---")
    for flag, n in sorted(flags.items(), key=lambda x: -x[1]):
        note = "  (check these rows)" if flag in BLOCKING_FLAGS or flag == "ORDER_FIX" else ""
        print(f"  {n:>3}  {flag}{note}")

    # The shoot ran in order, so each section's takes should sit together.
    scattered = []
    for label in counts:
        idx = [r["shoot_index"] for r in rows if r["matched_section"] == label]
        if len(idx) > 1 and (max(idx) - min(idx) + 1) != len(idx):
            scattered.append(label)
    if scattered:
        print("--- shot out of order (takes not contiguous), worth a look ---")
        for label in sorted(scattered, key=lambda x: order.get(x, 999)):
            print(f"       {label}")

    multi = [r["filename"] for r in rows
             if isinstance(r["takes_in_clip"], int) and r["takes_in_clip"] > 1]
    if multi:
        print(f"--- {len(multi)} clip(s) contain several takes of one line: "
              f"{', '.join(multi[:6])}{' ...' if len(multi) > 6 else ''}")


# -------------------------------------------------------------------- pass 2

def pass_two(args) -> int:
    csv_path, folder = Path(args.csv), Path(args.folder)
    if not csv_path.exists():
        print(f"no CSV at {csv_path} - run pass 1 first")
        return 1
    with csv_path.open(newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        print("CSV is empty")
        return 1
    missing = [c for c in ("filename", "matched_section", "flag") if c not in rows[0]]
    if missing:
        print(f"CSV is missing column(s): {', '.join(missing)}")
        return 1
    has_keep = "keep" in rows[0]

    # ---- every check runs before a single byte is copied ----
    problems: list[str] = []
    plan: list[tuple[Path, str, bool, str]] = []
    seen: set[str] = set()
    total = skipped_rows = 0

    for n, row in enumerate(rows, 2):
        name = (row["filename"] or "").strip()
        section = (row["matched_section"] or "").strip()
        flag = (row["flag"] or "").strip().upper()
        keep = (row.get("keep") or "KEEP").strip().upper()
        if keep == "SKIP":
            skipped_rows += 1
            continue
        if not name:
            problems.append(f"row {n}: blank filename")
            continue
        if name in seen:
            problems.append(f"row {n}: {name} appears twice in the CSV")
        seen.add(name)
        src = folder / name
        if not src.exists():
            problems.append(f"row {n}: {name} is not in {folder}")
            continue
        if not section:
            problems.append(f"row {n}: {name} has no matched_section")
            continue
        if has_keep and keep not in ("KEEP", "ARCHIVE"):
            problems.append(f"row {n}: {name} has keep='{keep}', "
                            f"expected KEEP, ARCHIVE or SKIP")
            continue
        if flag in BLOCKING_FLAGS and not args.allow_flagged:
            problems.append(f"row {n}: {name} is flagged {flag or '(blank)'} - fix the "
                            f"row then set flag to OK, or pass --allow-flagged")
            continue
        is_keeper = (keep == "KEEP")
        if args.keepers_only and not is_keeper:
            continue
        total += src.stat().st_size
        plan.append((src, sanitise_folder(section), is_keeper, row.get("take_index", "")))

    dest_root = Path(args.dest) if args.dest else folder / "sorted"

    # one keeper per section, or say so
    keepers: dict[str, int] = {}
    per_section: dict[str, list[int]] = {}
    for src, section, is_keeper, _ in plan:
        per_section.setdefault(section, [0, 0])
        per_section[section][0 if is_keeper else 1] += 1
        if is_keeper:
            keepers[section] = keepers.get(section, 0) + 1
    for section in per_section:
        if keepers.get(section, 0) == 0:
            problems.append(f"section '{section}' has no KEEP row - mark one in the CSV")

    for src, section, is_keeper, _ in plan:
        dst = dest_root / section / (src.name if is_keeper
                                     else f"{args.archive_dir}/{src.name}")
        if dst.exists() and dst.stat().st_size != src.stat().st_size:
            problems.append(f"{dst} already exists at a different size")

    print(f"CSV          {csv_path}")
    print(f"source       {folder}")
    print(f"destination  {dest_root}")
    print(f"to copy      {len(plan)} of {len(rows)} row(s), {total / 1e9:.2f} GB\n")
    width = max((len(x) for x in per_section), default=10) + 1
    for section in sorted(per_section):
        k, a = per_section[section]
        tail = f", {a} to {args.archive_dir}/" if a else ""
        print(f"  {section + '/':<{width}}  {k} keep{tail}")
    if skipped_rows:
        print(f"\n  {skipped_rows} row(s) marked SKIP, not copied")

    ref = dest_root if dest_root.exists() else folder
    free = shutil.disk_usage(ref).free
    if total > free * 0.95:
        problems.append(f"not enough free space: need {total / 1e9:.1f} GB, "
                        f"{free / 1e9:.1f} GB free")

    if problems:
        print(f"\n{len(problems)} problem(s) - nothing copied:")
        for p in problems[:40]:
            print(f"  ! {p}")
        if len(problems) > 40:
            print(f"  ... and {len(problems) - 40} more")
        return 1
    if not plan:
        print("\nnothing to copy")
        return 1
    if keepers and max(keepers.values()) > 1:
        multi = [s for s, n in keepers.items() if n > 1]
        print(f"\nnote: more than one KEEP in: {', '.join(sorted(multi))}")
    if not has_keep:
        print("\nnote: CSV has no 'keep' column, treating every row as a keeper")

    if not args.yes:
        print("\nDRY RUN - all checks passed. Re-run with --yes to copy.")
        return 0

    print()
    copied = skipped = 0
    for src, section, is_keeper, take in plan:
        dst_dir = dest_root / section if is_keeper else dest_root / section / args.archive_dir
        dst_dir.mkdir(parents=True, exist_ok=True)
        name = src.name
        if args.rename_takes and str(take).strip().isdigit():
            name = f"take_{int(take):02d}_{src.name}"
        dst = dst_dir / name
        if dst.exists() and dst.stat().st_size == src.stat().st_size:
            skipped += 1
            continue
        shutil.copy2(src, dst)
        copied += 1
        print(f"  {dst.relative_to(dest_root)}")
    print(f"\ncopied {copied}, skipped {skipped} already there. "
          f"Originals in {folder} are untouched.")
    return 0


# ---------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(
        description="Identify which script section each video take belongs to.")
    ap.add_argument("--folder", help="folder of video files")
    ap.add_argument("--script", help="labelled script .txt")
    ap.add_argument("--csv", default="takes.csv", help="CSV path (default: takes.csv)")
    ap.add_argument("--copy", action="store_true", help="pass 2: copy files per the CSV")
    ap.add_argument("--yes", action="store_true", help="with --copy, actually copy")
    ap.add_argument("--dest", help="destination root (default: <folder>/sorted)")
    ap.add_argument("--archive-dir", default="archive",
                    help="subfolder for non-keeper takes (default: archive)")
    ap.add_argument("--keepers-only", action="store_true",
                    help="copy only the KEEP take of each section")
    ap.add_argument("--rename-takes", action="store_true",
                    help="prefix copies with take_01_ etc")
    ap.add_argument("--allow-flagged", action="store_true",
                    help="copy rows still flagged LOW_CONFIDENCE / AMBIGUOUS")
    ap.add_argument("--list-sections", action="store_true",
                    help="show how the script file parsed, then exit")
    ap.add_argument("--order-by", default="name", choices=["name", "mtime"],
                    help="what defines shoot order (default: name)")
    ap.add_argument("--no-order", action="store_true",
                    help="match on text alone, ignoring shoot order")
    ap.add_argument("--jump-penalty", type=float, default=25.0,
                    help="points charged for a take assigned out of script order")
    ap.add_argument("--skip-penalty", type=float, default=6.0,
                    help="points charged per script section skipped over")
    ap.add_argument("--clip-seconds", type=int, default=20)
    ap.add_argument("--model", default="small.en",
                    help="faster-whisper model (tiny.en/base.en/small.en/medium.en)")
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--prompt", help="vocabulary hint for whisper (brand/product names)")
    ap.add_argument("--min-confidence", type=float, default=60.0)
    ap.add_argument("--min-margin", type=float, default=8.0,
                    help="minimum lead over the runner-up section")
    ap.add_argument("--open-words", type=int, default=12,
                    help="words of the opening line used for matching")
    ap.add_argument("--body-words", type=int, default=60,
                    help="words of each section kept for matching")
    ap.add_argument("--header-regex", help="regex matching the START of a heading label")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    ap.add_argument("--ffprobe", default="ffprobe")
    args = ap.parse_args()

    if not args.script:
        ap.error("--script is required")
    script_path = Path(args.script)
    if not script_path.exists():
        print(f"no script file at {script_path}")
        return 1

    pattern = (re.compile(args.header_regex, re.IGNORECASE)
               if args.header_regex else DEFAULT_HEADER_RE)
    sections = parse_script(script_path, pattern, args.body_words)

    if args.list_sections:
        if not sections:
            print("no sections found - check the labels, or pass --header-regex")
            print("\nfirst 15 lines of the script file:")
            for line in script_path.read_text(
                    encoding="utf-8", errors="replace").splitlines()[:15]:
                print(f"  | {line}")
            return 1
        print(f"{len(sections)} section(s):\n")
        for s in sections:
            print(f"  {s['label']}")
            print(f"      {s['text'][:100]}{'...' if len(s['text']) > 100 else ''}")
        return 0

    if len(sections) < 2:
        print(f"only {len(sections)} section(s) parsed from {script_path}.")
        print("Run --list-sections to see what happened, and pass --header-regex "
              "if your labels are unusual.")
        return 1
    if not args.folder:
        ap.error("--folder is required")
    if not Path(args.folder).is_dir():
        print(f"no folder at {args.folder}")
        return 1

    if args.copy:
        return pass_two(args)

    for exe in (args.ffmpeg, args.ffprobe):
        if shutil.which(exe) is None and not Path(exe).exists():
            print(f"{exe} not found on PATH. Install ffmpeg, or pass --ffmpeg / "
                  f"--ffprobe with full paths.")
            return 1
    return pass_one(args, sections)


if __name__ == "__main__":
    sys.exit(main())
