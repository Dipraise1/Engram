#!/usr/bin/env python3
"""Generate the black-and-white Engram pitch deck PDF."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "engram-pitch-deck.md"
OUTPUT = ROOT / "engram-pitch-deck.pdf"

PAGE_WIDTH = 960
PAGE_HEIGHT = 540
MARGIN_X = 70
TOP_Y = 465
BODY_WIDTH = PAGE_WIDTH - (MARGIN_X * 2)
BLACK = colors.black
WHITE = colors.white


def wrap_text(text: str, font: str, size: int, max_width: int) -> list[str]:
    """Wrap text for ReportLab using actual font metrics."""
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]

    for word in words[1:]:
        candidate = f"{current} {word}"
        if stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word

    lines.append(current)
    return lines


def parse_slides(markdown: str) -> list[dict[str, object]]:
    slides: list[dict[str, object]] = []
    for raw_slide in markdown.split("\n---\n"):
        title = ""
        subtitle = ""
        body: list[tuple[str, str]] = []

        for line in raw_slide.strip().splitlines():
            stripped = line.strip()
            if not stripped:
                body.append(("space", ""))
            elif stripped.startswith("# "):
                title = stripped[2:].strip()
            elif stripped.startswith("## "):
                subtitle = stripped[3:].strip()
            elif stripped.startswith("- "):
                body.append(("bullet", stripped[2:].strip()))
            else:
                body.append(("paragraph", stripped))

        if title or subtitle or body:
            slides.append({"title": title, "subtitle": subtitle, "body": body})

    return slides


def body_size(body: list[tuple[str, str]]) -> int:
    total_chars = sum(len(text) for kind, text in body if kind != "space")
    bullets = sum(1 for kind, _ in body if kind == "bullet")
    if total_chars > 950 or bullets > 8:
        return 13
    if total_chars > 760 or bullets > 6:
        return 14
    return 15


def draw_header(pdf: canvas.Canvas, slide_num: int, slide_count: int) -> None:
    pdf.setStrokeColor(BLACK)
    pdf.setLineWidth(1.2)
    pdf.line(MARGIN_X, 505, PAGE_WIDTH - MARGIN_X, 505)
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(BLACK)
    pdf.drawString(MARGIN_X, 515, "ENGRAM")
    pdf.drawRightString(PAGE_WIDTH - MARGIN_X, 515, f"{slide_num}/{slide_count}")


def draw_slide(pdf: canvas.Canvas, slide: dict[str, object], slide_num: int, slide_count: int) -> None:
    pdf.setFillColor(WHITE)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, slide_num, slide_count)

    title = str(slide["title"])
    subtitle = str(slide["subtitle"])
    body = list(slide["body"])  # type: ignore[arg-type]
    is_title_slide = slide_num == 1

    if is_title_slide:
        pdf.setFont("Helvetica-Bold", 46)
        pdf.setFillColor(BLACK)
        pdf.drawString(MARGIN_X, 405, title.upper())
        pdf.setLineWidth(3)
        pdf.line(MARGIN_X, 385, PAGE_WIDTH - MARGIN_X, 385)
        pdf.setFont("Helvetica", 22)
        pdf.drawString(MARGIN_X, 350, subtitle)
        y = 290
        size = 15
    else:
        pdf.setFont("Helvetica-Bold", 30)
        for idx, line in enumerate(wrap_text(title, "Helvetica-Bold", 30, BODY_WIDTH)):
            pdf.drawString(MARGIN_X, TOP_Y - (idx * 34), line)

        y = TOP_Y - 48
        if subtitle:
            pdf.setFont("Helvetica", 16)
            for line in wrap_text(subtitle, "Helvetica", 16, BODY_WIDTH):
                pdf.drawString(MARGIN_X, y, line)
                y -= 21
            pdf.setLineWidth(1)
            pdf.line(MARGIN_X, y - 4, PAGE_WIDTH - MARGIN_X, y - 4)
            y -= 26
        size = body_size(body)

    line_height = int(size * 1.45)
    pdf.setFont("Helvetica", size)

    for kind, text in body:
        if y < 55:
            break
        if kind == "space":
            y -= line_height // 2
            continue

        if kind == "bullet":
            bullet_x = MARGIN_X
            text_x = MARGIN_X + 20
            max_width = BODY_WIDTH - 20
            wrapped = wrap_text(text, "Helvetica", size, max_width)
            pdf.setFont("Helvetica-Bold", size)
            pdf.drawString(bullet_x, y, "-")
            pdf.setFont("Helvetica", size)
            pdf.drawString(text_x, y, wrapped[0])
            for continuation in wrapped[1:]:
                y -= line_height
                if y < 55:
                    break
                pdf.drawString(text_x, y, continuation)
            y -= line_height + 3
        else:
            for wrapped_line in wrap_text(text, "Helvetica", size, BODY_WIDTH):
                pdf.drawString(MARGIN_X, y, wrapped_line)
                y -= line_height
            y -= 4

    pdf.setLineWidth(0.8)
    pdf.line(MARGIN_X, 35, PAGE_WIDTH - MARGIN_X, 35)


def main() -> None:
    slides = parse_slides(SOURCE.read_text(encoding="utf-8"))
    pdf = canvas.Canvas(str(OUTPUT), pagesize=landscape((PAGE_WIDTH, PAGE_HEIGHT)))
    pdf.setTitle("Engram Pitch Deck")
    pdf.setAuthor("Engram")

    for idx, slide in enumerate(slides, start=1):
        draw_slide(pdf, slide, idx, len(slides))
        pdf.showPage()

    pdf.save()
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
