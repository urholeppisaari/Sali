"""Generate Sali_sovellus app icons from icons8-dumbbell-100.png.

Style: black rounded square background, white dumbbell (matches Koulu_sovellus).
"""
from PIL import Image
import os

SRC = "icons8-dumbbell-100.png"
HERE = os.path.dirname(os.path.abspath(__file__))


def make_icon(size, maskable=False):
    # Load source and convert to RGBA
    src = Image.open(os.path.join(HERE, SRC)).convert("RGBA")

    # Build a high-res canvas (supersample 2x for crisp downscale)
    scale = 2
    big = size * scale
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))

    # Background: black rounded square (or full bleed for maskable)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(canvas)
    if maskable:
        draw.rectangle((0, 0, big, big), fill=(0, 0, 0, 255))
        icon_area = int(big * 0.65)  # safe zone
    else:
        radius = int(big * 0.22)
        draw.rounded_rectangle((0, 0, big, big), radius=radius, fill=(0, 0, 0, 255))
        icon_area = int(big * 0.72)

    # Convert source to white silhouette using its alpha channel.
    # The source is a black dumbbell on transparent bg, so alpha = silhouette.
    # Resize source to icon_area while preserving aspect.
    src_resized = src.resize((icon_area, icon_area), Image.LANCZOS)
    alpha = src_resized.split()[-1]
    white = Image.new("RGBA", (icon_area, icon_area), (255, 255, 255, 255))
    white.putalpha(alpha)

    # Paste centered
    off = ((big - icon_area) // 2, (big - icon_area) // 2)
    canvas.alpha_composite(white, off)

    return canvas.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    make_icon(512).save(os.path.join(HERE, "icon-512.png"))
    make_icon(192).save(os.path.join(HERE, "icon-192.png"))
    make_icon(512, maskable=True).save(os.path.join(HERE, "icon-512-maskable.png"))
    make_icon(180).save(os.path.join(HERE, "apple-touch-icon.png"))
    print("Icons generated.")
