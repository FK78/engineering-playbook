#!/usr/bin/env python3
"""
Generate per-subsection MP3 audio files from Hugo markdown content.
Strips code blocks, HTML tags, and front matter before sending to OpenAI TTS.

Usage:
  export OPENAI_API_KEY=sk-...
  python3 scripts/generate-audio.py content/lessons/part0.md
  python3 scripts/generate-audio.py content/lessons/part0.md --section "HTTP Basics"
  python3 scripts/generate-audio.py --all
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Install openai: pip3 install openai")
    sys.exit(1)

VOICE = "marin"  # Recommended: marin, cedar. Others: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse
MODEL = "gpt-4o-mini-tts"  # gpt-4o-mini-tts (best), tts-1, or tts-1-hd
AUDIO_DIR = Path("static/audio")
AUDIO_FORMAT = "opus"
AUDIO_EXT = ".ogg"  # .ogg for browser compatibility with opus codec
INSTRUCTIONS = "Speak clearly at a moderate pace, like a knowledgeable teacher explaining concepts to a student. Use natural pauses between sentences."


def strip_front_matter(text: str) -> str:
    """Remove YAML front matter."""
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            return text[end + 3:].strip()
    return text


def strip_code_blocks(text: str) -> str:
    """Remove fenced code blocks."""
    return re.sub(r"```[\s\S]*?```", "", text)


def strip_html(text: str) -> str:
    """Remove HTML tags but keep their text content."""
    text = re.sub(r"<div[^>]*>", "", text)
    text = re.sub(r"</div>", "", text)
    text = re.sub(r"<span[^>]*>", "", text)
    text = re.sub(r"</span>", "", text)
    text = re.sub(r"</?strong>", "", text)
    text = re.sub(r"</?em>", "", text)
    text = re.sub(r"</?code>", "", text)
    text = re.sub(r"</?p>", "", text)
    text = re.sub(r"</?ul>", "", text)
    text = re.sub(r"</?ol>", "", text)
    text = re.sub(r"</?li>", "", text)
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"<details>[\s\S]*?</details>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text


def strip_markdown_formatting(text: str) -> str:
    """Remove markdown syntax but keep readable text."""
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)  # images
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)  # links
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)  # bold
    text = re.sub(r"\*(.+?)\*", r"\1", text)  # italic
    text = re.sub(r"`([^`]+)`", r"\1", text)  # inline code
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)  # headings
    # Convert table rows to readable text (keep cell content, drop pipes and dashes)
    text = re.sub(r"^\|[-:\s|]+\|$", "", text, flags=re.MULTILINE)  # separator rows
    text = re.sub(r"^\|(.+)\|$", lambda m: ", ".join(
        c.strip() for c in m.group(1).split("|") if c.strip()
    ), text, flags=re.MULTILINE)
    text = re.sub(r"^---+$", "", text, flags=re.MULTILINE)  # horizontal rules
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)  # blockquotes
    text = re.sub(r"{{<[^>]+>}}", "", text)  # Hugo shortcodes
    text = re.sub(r"{{%[^%]+%}}", "", text)  # Hugo shortcodes
    return text


def clean_for_speech(text: str) -> str:
    """Full cleaning pipeline."""
    text = strip_code_blocks(text)
    text = strip_html(text)
    text = strip_markdown_formatting(text)
    text = re.sub(r"\n{3,}", "\n\n", text)  # collapse blank lines
    text = re.sub(r"[ \t]+", " ", text)  # collapse spaces
    text = text.strip()
    return text


def split_sections(md_text: str) -> list[dict]:
    """Split markdown into h3-level subsections within h2 sections."""
    content = strip_front_matter(md_text)
    sections = []

    # First split by h2
    h2_parts = re.split(r"^## (.+)$", content, flags=re.MULTILINE)

    # Intro before first h2
    if h2_parts[0].strip():
        sections.append({"title": "Introduction", "parent": None, "content": h2_parts[0].strip()})

    for i in range(1, len(h2_parts), 2):
        h2_title = h2_parts[i].strip()
        h2_body = h2_parts[i + 1].strip() if i + 1 < len(h2_parts) else ""

        # Split this h2 body by h3
        h3_parts = re.split(r"^### (.+)$", h2_body, flags=re.MULTILINE)

        # Content before first h3 in this section
        intro = h3_parts[0].strip()
        if intro:
            sections.append({"title": h2_title, "parent": None, "content": intro})

        # Each h3 subsection
        for j in range(1, len(h3_parts), 2):
            h3_title = h3_parts[j].strip()
            h3_body = h3_parts[j + 1].strip() if j + 1 < len(h3_parts) else ""
            if h3_body:
                sections.append({
                    "title": h3_title,
                    "parent": h2_title,
                    "content": h3_body
                })

    return sections


def slugify(text: str) -> str:
    """Convert title to filename-safe slug."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "-", text)
    return text.strip("-")


def generate_audio(text: str, output_path: Path, client: OpenAI, voice: str = VOICE, model: str = MODEL) -> None:
    """Generate MP3 from text using OpenAI TTS."""
    MAX_CHARS = 4096

    if len(text) <= MAX_CHARS:
        response = client.audio.speech.create(model=model, voice=voice, input=text, response_format=AUDIO_FORMAT, instructions=INSTRUCTIONS)
        with open(output_path, "wb") as f:
            for chunk in response.iter_bytes():
                f.write(chunk)
    else:
        # Split into chunks at sentence boundaries
        chunks = []
        current = ""
        for sentence in re.split(r"(?<=[.!?])\s+", text):
            if len(current) + len(sentence) + 1 > MAX_CHARS:
                if current:
                    chunks.append(current)
                current = sentence
            else:
                current = f"{current} {sentence}".strip()
        if current:
            chunks.append(current)

        # Generate each chunk and concatenate
        temp_files = []
        for i, chunk in enumerate(chunks):
            temp_path = output_path.with_suffix(f".part{i}.ogg")
            response = client.audio.speech.create(model=model, voice=voice, input=chunk, response_format=AUDIO_FORMAT, instructions=INSTRUCTIONS)
            with open(temp_path, "wb") as f:
                for audio_chunk in response.iter_bytes():
                    f.write(audio_chunk)
            temp_files.append(temp_path)

        # Concatenate with ffmpeg if available, otherwise just use first chunk
        if len(temp_files) == 1:
            temp_files[0].rename(output_path)
        else:
            list_file = output_path.with_suffix(".txt")
            with open(list_file, "w") as f:
                for tf in temp_files:
                    f.write(f"file '{tf.name}'\n")
            os.system(f"cd {output_path.parent} && ffmpeg -y -f concat -safe 0 -i {list_file.name} -c copy {output_path.name} 2>/dev/null")
            list_file.unlink()
            for tf in temp_files:
                tf.unlink()


def process_file(md_path: Path, section_filter: str = None, voice: str = VOICE, model: str = MODEL) -> None:
    """Process a markdown file and generate audio for each section."""
    client = OpenAI()
    part_name = md_path.stem  # e.g., "part0"
    output_dir = AUDIO_DIR / part_name
    output_dir.mkdir(parents=True, exist_ok=True)

    content = md_path.read_text()
    sections = split_sections(content)

    # Generate manifest for the audio player
    manifest = []

    for section in sections:
        title = section["title"]

        if section_filter and section_filter.lower() not in title.lower():
            continue

        slug = slugify(f"{section.get('parent', '')}-{title}" if section.get("parent") else title)
        output_path = output_dir / f"{slug}{AUDIO_EXT}"

        cleaned = clean_for_speech(section["content"])
        if len(cleaned) < 50:
            print(f"  Skipping '{title}' (too short: {len(cleaned)} chars)")
            continue

        # Add section title as intro
        speech_text = f"{title}. {cleaned}"

        if output_path.exists() and not section_filter:
            print(f"  Skipping '{title}' (already exists)")
            manifest.append({"title": title, "parent": section.get("parent"), "file": f"{slug}{AUDIO_EXT}"})
            continue

        print(f"  Generating '{title}' ({len(speech_text)} chars)...")
        generate_audio(speech_text, output_path, client, voice, model)
        manifest.append({"title": title, "parent": section.get("parent"), "file": f"{slug}{AUDIO_EXT}"})

    # Save manifest
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  Manifest saved: {manifest_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate audio for Engineering Playbook")
    parser.add_argument("file", nargs="?", help="Markdown file to process")
    parser.add_argument("--section", help="Only generate for a specific section title")
    parser.add_argument("--all", action="store_true", help="Process all lesson files")
    parser.add_argument("--voice", default=VOICE, help=f"TTS voice (default: {VOICE})")
    parser.add_argument("--model", default=MODEL, help=f"TTS model (default: {MODEL})")
    args = parser.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable not set")
        sys.exit(1)

    voice = args.voice
    model = args.model

    if args.all:
        files = sorted(Path("content/lessons").glob("part*.md"))
    elif args.file:
        files = [Path(args.file)]
    else:
        parser.print_help()
        sys.exit(1)

    for f in files:
        print(f"\nProcessing {f.name}...")
        process_file(f, args.section, voice, model)

    print("\nDone!")


if __name__ == "__main__":
    main()
