"""Minimal SVG drawing helpers shared by the documentation diagram scripts.

No third-party dependencies — the diagrams are generated from plain strings so
they can be rebuilt in CI or on a machine without Graphviz installed.
"""

from __future__ import annotations

from xml.sax.saxutils import escape

FONT_SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"
FONT_MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"

INK = "#0c1a17"
INK_SOFT = "#384744"
SAND_50 = "#fbfaf6"
SAND_200 = "#eae4d6"
SAND_300 = "#d8ceba"
SAND_600 = "#8d7a61"
SAND_700 = "#6f5f4c"
LAKE_600 = "#276c6b"
LAKE_950 = "#08211f"
MOSS_600 = "#35722c"


def esc(value: str) -> str:
    return escape(str(value), {'"': "&quot;"})


def rect(x, y, w, h, fill, stroke="none", rx=10, sw=1.2, extra=""):
    return (
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
        f'rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'
    )


def rounded_top(x, y, w, h, r, fill):
    return (
        f'<path d="M {x:.1f} {y + r:.1f} A {r} {r} 0 0 1 {x + r:.1f} {y:.1f} '
        f'H {x + w - r:.1f} A {r} {r} 0 0 1 {x + w:.1f} {y + r:.1f} '
        f'V {y + h:.1f} H {x:.1f} Z" fill="{fill}"/>'
    )


def text(
    x,
    y,
    value,
    size=12,
    fill=INK,
    anchor="start",
    weight="400",
    family=FONT_SANS,
    opacity=None,
    letter_spacing=None,
):
    extra = f' opacity="{opacity}"' if opacity is not None else ""
    if letter_spacing:
        extra += f' letter-spacing="{letter_spacing}"'
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" '
        f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{extra}>'
        f"{esc(value)}</text>"
    )


def line(x1, y1, x2, y2, stroke=LAKE_600, sw=1.6, dash=None, cap="round"):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
        f'stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}"{extra}/>'
    )


def polyline(points, stroke=LAKE_600, sw=1.6, dash=None):
    path = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<polyline points="{path}" fill="none" stroke="{stroke}" '
        f'stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"{extra}/>'
    )


def _fan(x, y, direction, spread=8, depth=14, stroke=LAKE_600, sw=1.4):
    """Crow's-foot: three prongs meeting the entity edge at (x, y)."""
    if direction == "right":      # entity sits to the right
        start = (x - depth, y)
        ends = [(x, y - spread), (x, y), (x, y + spread)]
    elif direction == "left":     # entity sits to the left
        start = (x + depth, y)
        ends = [(x, y - spread), (x, y), (x, y + spread)]
    elif direction == "down":     # entity sits below
        start = (x, y - depth)
        ends = [(x - spread, y), (x, y), (x + spread, y)]
    else:                         # entity sits above
        start = (x, y + depth)
        ends = [(x - spread, y), (x, y), (x + spread, y)]

    return "".join(
        line(start[0], start[1], ex, ey, stroke=stroke, sw=sw) for ex, ey in ends
    )


def many(x, y, direction, **kwargs):
    return _fan(x, y, direction, **kwargs)


def one(x, y, direction, offset=16, half=6, stroke=LAKE_600, sw=1.4):
    """Single-cardinality tick set back from the entity edge."""
    if direction in ("right", "left"):
        tick_x = x - offset if direction == "right" else x + offset
        return line(tick_x, y - half, tick_x, y + half, stroke=stroke, sw=sw)
    tick_y = y - offset if direction == "down" else y + offset
    return line(x - half, tick_y, x + half, tick_y, stroke=stroke, sw=sw)


def entity(x, y, w, title, rows, header_h=34, row_h=22, pad=8):
    """Draw a table box. `rows` is a list of (name, type, key) tuples."""
    height = header_h + row_h * len(rows) + pad
    parts = [
        rect(x, y, w, height, fill="#ffffff", stroke=SAND_300, rx=10, sw=1.2),
        rounded_top(x, y, w, header_h, 10, LAKE_950),
        line(x, y + header_h, x + w, y + header_h, stroke=SAND_300, sw=1),
        text(x + 14, y + 22, title, size=13, fill=SAND_50, weight="600", family=FONT_MONO),
        text(
            x + w - 14,
            y + 22,
            f"{len(rows)} cols",
            size=9.5,
            fill="#aed9d6",
            anchor="end",
            family=FONT_MONO,
        ),
    ]

    for index, (name, kind, key) in enumerate(rows):
        row_y = y + header_h + index * row_h
        baseline = row_y + 15
        name_x = x + 14

        if index:
            parts.append(
                line(x + 1, row_y, x + w - 1, row_y, stroke="#f0ece2", sw=1)
            )

        if key:
            badge_fill = "#f8ecc9" if key == "PK" else "#d6ebe9"
            badge_ink = "#723e19" if key == "PK" else "#205757"
            parts.append(rect(x + 12, row_y + 5, 22, 13, fill=badge_fill, rx=3))
            parts.append(
                text(
                    x + 23,
                    row_y + 14.5,
                    key,
                    size=8,
                    fill=badge_ink,
                    anchor="middle",
                    weight="700",
                    family=FONT_MONO,
                )
            )
            name_x = x + 42

        parts.append(text(name_x, baseline, name, size=11.5, fill=INK, family=FONT_MONO))
        parts.append(
            text(
                x + w - 14,
                baseline,
                kind,
                size=10,
                fill=SAND_600,
                anchor="end",
                family=FONT_MONO,
            )
        )

    return "".join(parts), height


def canvas(width, height, body, title, subtitle):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-labelledby="diagram-title diagram-desc">
<title id="diagram-title">{esc(title)}</title>
<desc id="diagram-desc">{esc(subtitle)}</desc>
<rect width="{width}" height="{height}" fill="{SAND_50}"/>
{body}
</svg>
"""
