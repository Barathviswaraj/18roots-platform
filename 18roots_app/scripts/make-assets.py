"""Draws the app icon, splash, favicon and notification icon.

Run from the app folder after `npm install` (it uses the Cormorant Garamond
font from node_modules):  python3 scripts/make-assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FONT = ROOT / "node_modules/@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf"

CREAM = (246, 241, 233, 255)
SAGE = (110, 140, 114, 255)
SAGE_DARK = (76, 105, 85, 255)


def bezier(p0, p1, p2, p3, steps=40):
    for i in range(steps + 1):
        t = i / steps
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t**2, t**3
        yield (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


def leaf(draw, x, y, size, fill, vein=None):
    """The leaf from the in-app logo (a 24-unit path), placed at x, y."""
    s = size / 24
    to = lambda px, py: (x + px * s, y + py * s)
    points = list(bezier(to(4, 20), to(6, 11), to(12, 6), to(21, 4))) + list(bezier(to(21, 4), to(19, 13), to(13, 18), to(4, 20)))
    draw.polygon(points, fill=fill)
    if vein:
        draw.line([to(5, 19), to(17, 8)], fill=vein, width=max(2, int(size / 28)))


def logo(size, background, number_color, leaf_color, word=True):
    image = Image.new("RGBA", (size, size), background)
    draw = ImageDraw.Draw(image)
    number_font = ImageFont.truetype(str(FONT), int(size * 0.5))
    word_font = ImageFont.truetype(str(FONT), int(size * 0.115))

    box = draw.textbbox((0, 0), "18", font=number_font)
    width, height = box[2] - box[0], box[3] - box[1]
    total = height + (int(size * 0.16) if word else 0)
    x = (size - width) / 2 - box[0] - size * 0.03
    y = (size - total) / 2 - box[1]
    draw.text((x, y), "18", font=number_font, fill=number_color)
    leaf(draw, x + box[2] - size * 0.04, y + box[1] - size * 0.02, size * 0.2, leaf_color, vein=background if background[3] else CREAM)

    if word:
        letters = "ROOTS"
        spacing = size * 0.03
        widths = [draw.textbbox((0, 0), char, font=word_font)[2] for char in letters]
        line = sum(widths) + spacing * (len(letters) - 1)
        cursor = (size - line) / 2
        top = y + box[3] + size * 0.035
        for char, char_width in zip(letters, widths):
            draw.text((cursor, top), char, font=word_font, fill=number_color)
            cursor += char_width + spacing
    return image


def main():
    ASSETS.mkdir(exist_ok=True)
    logo(1024, CREAM, SAGE_DARK, SAGE).save(ASSETS / "icon.png")

    # Android adaptive icons crop to a circle or squircle: keep the mark in the middle 60%.
    foreground = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mark = logo(620, (0, 0, 0, 0), SAGE_DARK, SAGE)
    foreground.alpha_composite(mark, (202, 202))
    foreground.save(ASSETS / "adaptive-icon.png")

    logo(512, (0, 0, 0, 0), SAGE_DARK, SAGE).save(ASSETS / "splash-icon.png")
    logo(192, CREAM, SAGE_DARK, SAGE, word=False).resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png")

    # Android notification icons must be white on transparent.
    note = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    leaf(ImageDraw.Draw(note), 8, 8, 80, (255, 255, 255, 255))
    note.save(ASSETS / "notification-icon.png")
    print("wrote", ", ".join(sorted(p.name for p in ASSETS.glob("*.png"))))


if __name__ == "__main__":
    main()
