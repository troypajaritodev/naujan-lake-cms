#!/usr/bin/env python3
"""Generate docs/figures/use_case_diagram.svg.

    python scripts/build_use_case_diagram.py

Two actors (visitor, park staff) around one system boundary. Standard-library
only, so the diagram can be rebuilt anywhere the docs are edited.
"""

from __future__ import annotations

from pathlib import Path

from svg_kit import (
    INK,
    INK_SOFT,
    LAKE_600,
    LAKE_950,
    SAND_300,
    SAND_600,
    SAND_700,
    canvas,
    line,
    rect,
    text,
)

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "docs" / "figures" / "use_case_diagram.svg"

WIDTH, HEIGHT = 1200, 880
BOX_X, BOX_Y, BOX_W, BOX_H = 300, 120, 600, 660

UC_RX, UC_RY = 116, 28
LEFT_CX, RIGHT_CX = 450, 750

VISITOR_UC = [
    (216, "Browse tour packages"),
    (298, "Read guidelines & zoning"),
    (380, "Register account"),
    (462, "Sign in"),
    (556, "Submit booking inquiry"),
    (646, "Manage profile"),
]

STAFF_UC = [
    (216, "Manage users & roles"),
    (298, "Triage inquiries"),
    (380, "View reports"),
    (462, "Publish advisories"),
    (556, "Manage tour packages"),
]

SIGN_IN_Y = 462
SUBMIT_Y = 556

VISITOR = (150, 380)
STAFF = (1050, 380)


def actor(x, y, label):
    parts = [
        f'<circle cx="{x}" cy="{y - 32}" r="12" fill="none" stroke="{LAKE_950}" stroke-width="1.8"/>',
        line(x, y - 20, x, y + 8, stroke=LAKE_950, sw=1.8),
        line(x - 17, y - 8, x + 17, y - 8, stroke=LAKE_950, sw=1.8),
        line(x, y + 8, x - 13, y + 32, stroke=LAKE_950, sw=1.8),
        line(x, y + 8, x + 13, y + 32, stroke=LAKE_950, sw=1.8),
        text(x, y + 54, label, size=12.5, fill=INK, anchor="middle", weight="600"),
    ]
    return "".join(parts)


def use_case(cx, cy, label, size=11):
    return (
        f'<ellipse cx="{cx}" cy="{cy}" rx="{UC_RX}" ry="{UC_RY}" '
        f'fill="#ffffff" stroke="{LAKE_600}" stroke-width="1.3"/>'
        + text(cx, cy + 4, label, size=size, fill=INK, anchor="middle")
    )


def build() -> str:
    body = []

    # --- title -------------------------------------------------------------
    body.append(text(40, 46, "Use Case Diagram", size=22, fill=INK, weight="600"))
    body.append(
        text(
            40,
            68,
            "Naujan Lake Visitor Hub · two roles (Requirement G) · solid line = association, "
            "dashed arrow = «include»",
            size=11.5,
            fill=SAND_600,
        )
    )
    body.append(line(40, 80, WIDTH - 40, 80, stroke=SAND_300, sw=1))

    # --- system boundary ---------------------------------------------------
    body.append(
        rect(BOX_X, BOX_Y, BOX_W, BOX_H, fill="#ffffff", stroke=SAND_300, rx=16, sw=1.3)
    )
    body.append(
        text(
            BOX_X + BOX_W / 2,
            BOX_Y + 30,
            "Naujan Lake Visitor Hub",
            size=13,
            fill=SAND_700,
            anchor="middle",
            weight="600",
            letter_spacing="1.2",
        )
    )
    body.append(
        text(
            BOX_X + BOX_W / 2,
            BOX_Y + 48,
            "web portal · admin CMS · Supabase",
            size=10,
            fill=SAND_600,
            anchor="middle",
        )
    )

    # --- associations ------------------------------------------------------
    vx, vy = VISITOR
    for cy, _label in VISITOR_UC:
        body.append(
            line(vx + 24, vy, LEFT_CX - UC_RX, cy, stroke=SAND_300, sw=1.2, cap="butt")
        )

    sx, sy = STAFF
    for cy, _label in STAFF_UC:
        body.append(
            line(sx - 24, sy, RIGHT_CX + UC_RX, cy, stroke=SAND_300, sw=1.2, cap="butt")
        )

    # --- «include»: submitting an inquiry requires a session ---------------
    start_y = SUBMIT_Y - UC_RY
    end_y = SIGN_IN_Y + UC_RY
    body.append(
        f'<path d="M 552 {start_y} Q 640 {(start_y + end_y) / 2:.0f} 552 {end_y}" '
        f'fill="none" stroke="{LAKE_600}" stroke-width="1.5" stroke-dasharray="5 4"/>'
    )
    body.append(
        f'<path d="M 552 {end_y - 2} L 546 {end_y + 8} L 558 {end_y + 8} Z" fill="{LAKE_600}"/>'
    )
    body.append(
        text(
            544,
            (start_y + end_y) / 2 + 4,
            "«include»",
            size=9,
            fill=LAKE_600,
            anchor="end",
            weight="600",
        )
    )

    # --- use cases ---------------------------------------------------------
    for cy, label in VISITOR_UC:
        body.append(use_case(LEFT_CX, cy, label))

    for cy, label in STAFF_UC:
        body.append(use_case(RIGHT_CX, cy, label))

    # --- actors ------------------------------------------------------------
    body.append(actor(*VISITOR, "Visitor"))
    body.append(actor(*STAFF, "Park staff"))

    body.append(
        text(
            VISITOR[0],
            VISITOR[1] + 74,
            "customer role",
            size=9.5,
            fill=SAND_600,
            anchor="middle",
        )
    )
    body.append(
        text(
            STAFF[0],
            STAFF[1] + 74,
            "administrator role",
            size=9.5,
            fill=SAND_600,
            anchor="middle",
        )
    )

    # --- footer ------------------------------------------------------------
    body.append(line(40, 820, WIDTH - 40, 820, stroke=SAND_300, sw=1))
    body.append(
        text(
            40,
            844,
            "Implemented in this build: browse packages, guidelines, register, sign in, submit inquiry, "
            "manage profile, manage users, triage inquiries, view reports.",
            size=10.5,
            fill=INK_SOFT,
        )
    )
    body.append(
        text(
            WIDTH - 40,
            844,
            "Generated by scripts/build_use_case_diagram.py",
            size=10,
            fill=SAND_600,
            anchor="end",
        )
    )

    return canvas(
        WIDTH,
        HEIGHT,
        "\n".join(body),
        "Use Case Diagram — Naujan Lake Visitor Hub",
        "Visitor and park staff actors with their use cases inside the system boundary.",
    )


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(build(), encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
