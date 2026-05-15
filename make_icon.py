from PIL import Image, ImageDraw, ImageFilter

SIZE = 512
SCALE = 4  # supersample for crisp edges
W = SIZE * SCALE


def rounded_rect_mask(size, rects, radius):
    """rects: list of (x0,y0,x1,y1). Returns L mask with rects filled white."""
    img = Image.new("L", size, 0)
    d = ImageDraw.Draw(img)
    for r in rects:
        d.rounded_rectangle(r, radius=radius, fill=255)
    return img


def build_dumbbell(canvas_size, stroke):
    """Build outlined dumbbell as L mask on canvas of given size."""
    # Coordinates designed at base 512 then scaled
    s = canvas_size / 512

    def sc(*v):
        return tuple(int(round(x * s)) for x in v)

    # Outer shapes (union forms the outer silhouette)
    weight_l = sc(96, 146, 200, 366)    # left weight block
    weight_r = sc(312, 146, 416, 366)   # right weight block
    handle   = sc(140, 226, 372, 286)   # connecting bar (overlaps weights)

    rects_outer = [weight_l, weight_r, handle]
    radius_outer = int(round(26 * s))

    outer = rounded_rect_mask((canvas_size, canvas_size), rects_outer, radius_outer)

    # Inner = outer eroded by stroke width (morphological erosion via MinFilter)
    # MinFilter(2k+1) erodes by k pixels per side
    inner = outer
    remaining = stroke
    while remaining > 0:
        step = min(remaining, 10)  # MinFilter max kernel ~21
        size_k = 2 * step + 1
        inner = inner.filter(ImageFilter.MinFilter(size_k))
        remaining -= step

    from PIL import ImageChops
    outline = ImageChops.subtract(outer, inner)
    return outline


def make_icon(size, maskable=False):
    # Supersample
    big = size * SCALE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background: black rounded square (matches koulu style)
    # iOS-style corner radius ~22% of side
    if maskable:
        # For maskable, fill the whole bleed area (safe zone is inner 80%)
        draw.rectangle((0, 0, big, big), fill=(0, 0, 0, 255))
    else:
        radius = int(big * 0.22)
        draw.rounded_rectangle((0, 0, big, big), radius=radius, fill=(0, 0, 0, 255))

    # Dumbbell mask
    if maskable:
        # Shrink dumbbell so it sits inside safe zone (80%)
        inner_size = int(big * 0.78)
        offset = (big - inner_size) // 2
        stroke = int(round(20 * (inner_size / 512)))
        dumb_mask = build_dumbbell(inner_size, stroke)
        full_mask = Image.new("L", (big, big), 0)
        full_mask.paste(dumb_mask, (offset, offset))
    else:
        stroke = int(round(20 * (big / 512)))
        full_mask = build_dumbbell(big, stroke)

    # Paint white through mask
    white = Image.new("RGBA", (big, big), (255, 255, 255, 255))
    img.paste(white, (0, 0), full_mask)

    # Downsample
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    import os
    out_dir = os.path.dirname(os.path.abspath(__file__))

    icon512 = make_icon(512)
    icon512.save(os.path.join(out_dir, "icon-512.png"))

    icon192 = make_icon(192)
    icon192.save(os.path.join(out_dir, "icon-192.png"))

    icon_maskable = make_icon(512, maskable=True)
    icon_maskable.save(os.path.join(out_dir, "icon-512-maskable.png"))

    apple = make_icon(180)
    apple.save(os.path.join(out_dir, "apple-touch-icon.png"))

    print("Icons generated.")
