#!/usr/bin/env python3
"""Generate docs/figures/er_diagram.svg from the schema in supabase/schema.sql.

Run from the repository root:

    python scripts/build_er_diagram.py

The layout is hand-placed (seven boxes, three rows) so the result is stable in
git — no Graphviz or browser required, only the Python standard library.
"""

from __future__ import annotations

from pathlib import Path

from svg_kit import (
    INK_SOFT,
    LAKE_600,
    SAND_300,
    SAND_600,
    SAND_700,
    canvas,
    entity,
    line,
    many,
    one,
    rect,
    text,
)

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "docs" / "figures" / "er_diagram.svg"

WIDTH = 1440
HEIGHT = 1040
BOX_W = 340

COL1, COL2, COL3 = 40, 550, 1060
ROW1, ROW2, ROW3 = 100, 396, 716

TABLES = {
    "users": (
        COL1,
        ROW1,
        [
            ("id", "uuid", "PK"),
            ("email", "text", None),
            ("full_name", "text", None),
            ("phone", "text", None),
            ("role", "user_role", None),
            ("password_hash", "text", None),
            ("is_active", "boolean", None),
            ("created_at", "timestamptz", None),
            ("last_login_at", "timestamptz", None),
        ],
    ),
    "advisories": (
        COL2,
        ROW1,
        [
            ("id", "uuid", "PK"),
            ("author_id", "uuid", "FK"),
            ("title", "text", None),
            ("slug", "text", None),
            ("severity", "advisory_severity", None),
            ("excerpt", "text", None),
            ("content", "text", None),
            ("is_active_banner", "boolean", None),
            ("published_at", "timestamptz", None),
        ],
    ),
    "subscribers": (
        COL3,
        ROW1,
        [
            ("id", "uuid", "PK"),
            ("email", "text", None),
            ("status", "subscriber_status", None),
            ("topics", "text[]", None),
            ("subscribed_at", "timestamptz", None),
        ],
    ),
    "categories": (
        COL1,
        ROW2,
        [
            ("id", "uuid", "PK"),
            ("name", "text", None),
            ("slug", "text", None),
            ("description", "text", None),
            ("sort_order", "integer", None),
        ],
    ),
    "species": (
        COL2,
        ROW2,
        [
            ("id", "uuid", "PK"),
            ("category_id", "uuid", "FK"),
            ("common_name", "text", None),
            ("local_name", "text", None),
            ("scientific_name", "text", None),
            ("conservation_status", "conservation_status", None),
            ("seasonality", "seasonality", None),
            ("habitat", "text", None),
            ("slug", "text", None),
        ],
    ),
    "tours": (
        COL3,
        ROW2,
        [
            ("id", "uuid", "PK"),
            ("title", "text", None),
            ("slug", "text", None),
            ("category", "text", None),
            ("duration", "text", None),
            ("departure", "text", None),
            ("rate_per_person", "numeric(10,2)", None),
            ("max_capacity", "integer", None),
            ("difficulty", "tour_difficulty", None),
            ("inclusions", "text[]", None),
            ("is_active", "boolean", None),
        ],
    ),
    "tour_inquiries": (
        COL2,
        ROW3,
        [
            ("id", "uuid", "PK"),
            ("reference_code", "text", None),
            ("tour_id", "uuid", "FK"),
            ("user_id", "uuid", "FK"),
            ("full_name", "text", None),
            ("email", "text", None),
            ("target_date", "date", None),
            ("party_size", "integer", None),
            ("status", "inquiry_status", None),
        ],
    ),
}


def relation_label(x, y, value, anchor="middle"):
    """Label with a paper-coloured chip so it stays legible over a connector."""
    width = len(value) * 5.6 + 12
    left = x - width / 2 if anchor == "middle" else x - 6
    return (
        rect(left, y - 9, width, 14, fill="#fbfaf6", rx=4)
        + text(x, y, value, size=10, fill=SAND_700, anchor=anchor, family="FONT_SANS")
    )


def build() -> str:
    body = []

    # --- title block -------------------------------------------------------
    body.append(
        text(40, 46, "Entity Relationship Diagram", size=22, fill="#0c1a17", weight="600")
    )
    body.append(
        text(
            40,
            68,
            "Naujan Lake Eco-Tourism & Wildlife Information Management System · "
            "7 tables · PostgreSQL 15 (Supabase)",
            size=11.5,
            fill=SAND_600,
        )
    )
    body.append(line(40, 80, WIDTH - 40, 80, stroke=SAND_300, sw=1))

    # --- connectors (drawn first so boxes sit on top) ----------------------
    # users 1—N advisories
    body.append(line(380, 166, 550, 166, stroke=LAKE_600, sw=1.6))
    body.append(one(380, 166, "left"))
    body.append(many(550, 166, "right"))
    body.append(relation_label(465, 158, "authors"))

    # categories 1—N species
    body.append(line(380, 463, 550, 463, stroke=LAKE_600, sw=1.6))
    body.append(one(380, 463, "left"))
    body.append(many(550, 463, "right"))
    body.append(relation_label(465, 455, "groups"))

    # users 1—N tour_inquiries (routed through the gutter)
    body.append(
        f'<polyline points="380,300 470,300 470,827 550,827" fill="none" '
        f'stroke="{LAKE_600}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>'
    )
    body.append(one(380, 300, "left"))
    body.append(many(550, 827, "right"))
    body.append(relation_label(482, 560, "files", anchor="start"))

    # tours 1—N tour_inquiries (routed down the right gutter)
    body.append(
        f'<polyline points="1060,486 980,486 980,805 890,805" fill="none" '
        f'stroke="{LAKE_600}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>'
    )
    body.append(one(1060, 486, "right"))
    body.append(many(890, 805, "left"))
    body.append(relation_label(992, 660, "books", anchor="start"))

    # --- entities ----------------------------------------------------------
    for name, (x, y, rows) in TABLES.items():
        markup, _height = entity(x, y, BOX_W, name, rows)
        body.append(markup)

    # --- legend ------------------------------------------------------------
    legend_y = 990
    body.append(line(40, legend_y - 26, WIDTH - 40, legend_y - 26, stroke=SAND_300, sw=1))
    body.append(
        text(40, legend_y, "LEGEND", size=9.5, fill=SAND_600, weight="700", letter_spacing="1.4")
    )

    body.append(rect(120, legend_y - 11, 22, 13, fill="#f8ecc9", rx=3))
    body.append(text(131, legend_y - 1.5, "PK", size=8, fill="#723e19", anchor="middle", weight="700", family="ui-monospace"))
    body.append(text(150, legend_y, "primary key", size=10.5, fill=INK_SOFT))

    body.append(rect(250, legend_y - 11, 22, 13, fill="#d6ebe9", rx=3))
    body.append(text(261, legend_y - 1.5, "FK", size=8, fill="#205757", anchor="middle", weight="700", family="ui-monospace"))
    body.append(text(280, legend_y, "foreign key", size=10.5, fill=INK_SOFT))

    body.append(line(380, legend_y - 5, 410, legend_y - 5, stroke=LAKE_600, sw=1.6))
    body.append(many(410, legend_y - 5, "right", spread=6, depth=10))
    body.append(text(424, legend_y, "one to many", size=10.5, fill=INK_SOFT))

    body.append(
        text(
            WIDTH - 40,
            legend_y,
            "Generated by scripts/build_er_diagram.py",
            size=10,
            fill=SAND_600,
            anchor="end",
        )
    )

    return canvas(
        WIDTH,
        HEIGHT,
        "\n".join(body),
        "Entity Relationship Diagram — Naujan Lake Visitor Hub",
        "Seven-table relational schema: users, categories, species, tours, tour_inquiries, "
        "advisories and subscribers.",
    )


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(build(), encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
