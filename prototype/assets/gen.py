"""Generates the Immune RTS prototype SVG assets.

Every map sprite uses a 64x64 viewBox centred on (32,32) so sprites share one scale.
UI icons use a 48x48 viewBox. Glows are radial gradients (no SVG filters), so the
files rasterise identically in Safari and Chrome and can be cached to offscreen canvases.
Gradient ids are prefixed per asset so several SVGs can be inlined in one document.
"""
import json, math, os, random, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"

# ---- palette (fluorescence microscopy: one hue per faction on black) ----
P = {
    "void": "#04050A",       # background
    "cell": "#3FE6FF",       # friendly immune cells (cyan)
    "cellHi": "#C8FAFF",
    "germ": "#FF3DCB",       # bacteria (magenta)
    "germHi": "#FFC4EF",
    "toxin": "#B45CFF",      # bacterial toxin burst (violet)
    "pollen": "#C9F25C",     # harmless invader (chartreuse)
    "pollenHi": "#F1FFC9",
    "antibody": "#FFD23F",   # antibodies (gold)
    "kill": "#FF7A3D",       # inflammatory / Kill stance (orange)
    "repair": "#5CFFA1",     # healing / Repair stance (green)
    "tissue": "#2B3A8C",     # healthy host tissue (dim indigo, like a DAPI stain)
    "tissueHi": "#5468E0",
    "damage": "#FF3B4E",     # host damage (red)
    "blood": "#C2334F",      # blood vessel walls
    "lymph": "#2FB89A",      # lymph vessel walls
    "ui": "#DDE6F5",         # neutral UI ink
    "uiDim": "#6E7B96",
}
ALERT = {"quiet": "#7F8FB0", "watch": "#FFD23F", "inflamed": "#FF7A3D", "max": "#FF3B4E"}

ASSETS = {}   # name -> dict(svg=..., kind=..., size=..., radius=..., note=...)


def svg(vb, body, defs=""):
    d = f"<defs>{defs}</defs>" if defs else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb} {vb}" '
            f'width="{vb}" height="{vb}">{d}{body}</svg>')


def halo(gid, color, a0=0.55, a1=0.16, mid=0.42):
    return (f'<radialGradient id="{gid}"><stop offset="0" stop-color="{color}" stop-opacity="{a0}"/>'
            f'<stop offset="{mid}" stop-color="{color}" stop-opacity="{a1}"/>'
            f'<stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient>')


def body_grad(gid, inner, outer, a0=0.6, a1=0.2, cx=0.42, cy=0.38):
    return (f'<radialGradient id="{gid}" cx="{cx}" cy="{cy}" r="0.7">'
            f'<stop offset="0" stop-color="{inner}" stop-opacity="{a0}"/>'
            f'<stop offset="1" stop-color="{outer}" stop-opacity="{a1}"/></radialGradient>')


def f(x):
    return f"{x:.2f}".rstrip("0").rstrip(".")


def smooth_closed(pts):
    """Catmull-Rom through pts -> closed cubic bezier path."""
    n = len(pts)
    d = f"M{f(pts[0][0])} {f(pts[0][1])}"
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}"
    return d + "Z"


def blob(cx, cy, rfun, n=36):
    return smooth_closed([(cx + rfun(t) * math.cos(t), cy + rfun(t) * math.sin(t))
                          for t in [2 * math.pi * i / n for i in range(n)]])


def add(name, kind, s, size, radius=None, note="", box=None, anchor=None):
    ASSETS[name] = {"svg": s, "kind": kind, "size": size, "radius": radius, "note": note}
    if box:
        ASSETS[name]["box"] = box        # [w, h] when the viewBox is not square
    if anchor:
        ASSETS[name]["anchor"] = anchor  # [x, y] in viewBox units: the point to place on the object's position


def svg2(w, h, body, defs=""):
    d = f"<defs>{defs}</defs>" if defs else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="{w}" height="{h}">{d}{body}</svg>')


# ======================= FRIENDLY CELLS =======================

def neutrophil_parts(pfx):
    defs = halo(f"{pfx}-h", P["cell"], 0.5, 0.14) + body_grad(f"{pfx}-b", "#9FF4FF", P["cell"], 0.5, 0.18)
    lobes = [(26.5, 30), (34.5, 27.5), (34, 36)]
    conn = (f'<path d="M26.5 30Q30 27 34.5 27.5M34.5 27.5Q36.5 32 34 36" fill="none" '
            f'stroke="{P["cellHi"]}" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>')
    nuc = "".join(f'<circle cx="{x}" cy="{y}" r="3.7" fill="{P["cellHi"]}"/>' for x, y in lobes)
    return defs, conn + nuc


defs, nuc = neutrophil_parts("neu")
add("neutrophil", "unit", svg(64,
    f'<circle cx="32" cy="32" r="26" fill="url(#neu-h)"/>'
    f'<circle cx="32" cy="32" r="13" fill="url(#neu-b)" stroke="#7FF0FF" stroke-width="1.6"/>' + nuc, defs),
    64, 13, "Neutrophil, Eat stance (default). Small, fast swarm cell; the three-lobed nucleus is its tell.")

# Trap: the neutrophil ruptures and throws a DNA net. Body fades, strands radiate.
random.seed(7)
strands, knots = [], []
spokes = 9
ring_r = [11, 19, 27]
ang = [2 * math.pi * i / spokes + random.uniform(-.18, .18) for i in range(spokes)]
pts = {}
for i, a in enumerate(ang):
    for j, r in enumerate(ring_r):
        rr = r + random.uniform(-2, 2)
        pts[(i, j)] = (32 + rr * math.cos(a), 32 + rr * math.sin(a))
for i in range(spokes):
    p = [(32, 32)] + [pts[(i, j)] for j in range(3)]
    strands.append("M" + "L".join(f"{f(x)} {f(y)}" for x, y in p))
    for j in range(3):
        a, b = pts[(i, j)], pts[((i + 1) % spokes, j)]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        # sag toward the centre so it reads as a slack net
        mx, my = 32 + (mx - 32) * .88, 32 + (my - 32) * .88
        strands.append(f"M{f(a[0])} {f(a[1])}Q{f(mx)} {f(my)} {f(b[0])} {f(b[1])}")
        knots.append(f'<circle cx="{f(a[0])}" cy="{f(a[1])}" r="1.1"/>')
net_paths = (f'<path d="{"".join(strands)}" fill="none" stroke="{P["cellHi"]}" stroke-width=".9" '
             f'stroke-linecap="round" opacity=".75"/><g fill="{P["cellHi"]}" opacity=".9">{"".join(knots)}</g>')
add("net", "effect", svg(64,
    f'<circle cx="32" cy="32" r="30" fill="url(#net-h)"/>' + net_paths,
    halo("net-h", P["cell"], 0.28, 0.1, .5)),
    64, 28, "DNA net left by a Trap neutrophil. Pins bacteria; tint the sector toward damage while it lasts.")

defs, nuc = neutrophil_parts("neut")
add("neutrophil-trap", "unit", svg(64,
    f'<circle cx="32" cy="32" r="30" fill="url(#neut-h)"/>' + net_paths.replace('opacity=".75"', 'opacity=".55"') +
    f'<circle cx="32" cy="32" r="12" fill="url(#neut-b)" stroke="#7FF0FF" stroke-width="1.3" '
    f'stroke-dasharray="3.2 2.4" opacity=".9"/>' + nuc, defs),
    64, 13, "Neutrophil casting a net (Trap stance, one-way). Broken rim plus strands: it dies doing this.")


def macrophage(name, core, note):
    pfx = name[:3] + name[-3:]
    random.seed(3)
    ph = [random.uniform(0, 6.28) for _ in range(3)]

    def r(t):
        base = 20 + 1.6 * math.sin(3 * t + ph[0]) + 1.2 * math.sin(5 * t + ph[1])
        # three pseudopods
        for c in (0.4, 2.5, 4.4):
            dt = math.atan2(math.sin(t - c), math.cos(t - c))
            base += 6.5 * math.exp(-(dt / 0.28) ** 2)
        return base
    path = blob(32, 32, r, 48)
    defs = (halo(f"{pfx}-h", P["cell"], 0.42, 0.12, .5) +
            body_grad(f"{pfx}-b", "#9FF4FF", P["cell"], 0.32, 0.16) +
            halo(f"{pfx}-c", core, 0.85, 0.35, .55))
    nucleus = ('<path d="M24.5 30.5C24 25.5 30 23.5 34 25.5C38 27.5 41 26 40.5 31C40 35.5 35.5 38.5 31.5 37'
               'C29.5 36.3 30.5 33.5 28.5 33.6C26.5 33.7 24.8 33.5 24.5 30.5Z" '
               f'fill="{core}" opacity=".9"/>')
    vac = "".join(f'<circle cx="{x}" cy="{y}" r="{rr}" fill="none" stroke="{P["cellHi"]}" stroke-width=".9" opacity=".6"/>'
                  for x, y, rr in ((20, 40, 2.6), (43, 39, 2.1), (37, 18, 1.8), (21, 22, 1.5)))
    add(name, "unit", svg(64,
        f'<circle cx="32" cy="32" r="32" fill="url(#{pfx}-h)"/>'
        f'<path d="{path}" fill="url(#{pfx}-b)" stroke="#7FF0FF" stroke-width="1.6" stroke-linejoin="round"/>'
        f'<circle cx="32" cy="31" r="13" fill="url(#{pfx}-c)"/>' + vac + nucleus, defs),
        64, 22, note)


macrophage("macrophage-kill", P["kill"],
           "Macrophage, Kill stance. Big, slow tank. Orange core = inflammatory (adds Host Damage).")
macrophage("macrophage-repair", P["repair"],
           "Macrophage, Repair stance. Same body, green core = healing tissue and calming the sector.")

# ======================= ENEMIES =======================

def rod(x, y, w, h, pfx, fill_id, stroke):
    return (f'<rect x="{f(x - w / 2)}" y="{f(y - h / 2)}" width="{w}" height="{h}" rx="{h / 2}" '
            f'fill="url(#{fill_id})" stroke="{stroke}" stroke-width="1.5"/>')


def nucleoid(x, y, w):
    return (f'<path d="M{f(x - w * .3)} {y}q{f(w * .1)} -2.4 {f(w * .2)} 0t{f(w * .2)} 0t{f(w * .2)} 0" fill="none" '
            f'stroke="{P["germHi"]}" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>')


def bact_defs(pfx):
    return (halo(f"{pfx}-h", P["germ"], 0.55, 0.15, .4) +
            body_grad(f"{pfx}-b", "#FF9BE5", P["germ"], 0.6, 0.28))


add("bacterium", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="24" ry="17" fill="url(#bac-h)"/>' +
    rod(32, 32, 24, 12, "bac", "bac-b", "#FF7FDD") + nucleoid(32, 32, 24), bact_defs("bac")),
    64, 9, "Bacterium (rod). Faces +x; rotate to heading. Rod silhouette keeps it distinct from round friendly cells.")

add("bacterium-dividing", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="28" ry="17" fill="url(#bad-h)"/>' +
    rod(23.5, 32, 18, 12, "bad", "bad-b", "#FF7FDD") + rod(40.5, 32, 18, 12, "bad", "bad-b", "#FF7FDD") +
    f'<line x1="32" y1="27" x2="32" y2="37" stroke="{P["germHi"]}" stroke-width="2" stroke-linecap="round"/>' +
    nucleoid(23.5, 32, 16) + nucleoid(40.5, 32, 16), bact_defs("bad")),
    64, 12, "Bacterium mid-division. Swap in for the last moments before a doubling so growth is visible.")

ys = ""
for a in range(-165, 195, 30):
    t = math.radians(a)
    # point on the rod outline (approx ellipse 13x7.5), tiny Y pointing outward
    px, py = 32 + 13 * math.cos(t), 32 + 7 * math.sin(t)
    ys += (f'<g transform="translate({f(px)} {f(py)}) rotate({a + 90})">'
           f'<path d="M0 0V-2M0 -2L-1.4 -3.6M0 -2L1.4 -3.6" fill="none" stroke="{P["antibody"]}" '
           f'stroke-width="1" stroke-linecap="round"/></g>')
add("bacterium-opsonized", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="26" ry="20" fill="url(#bao-h)"/>' +
    rod(32, 32, 24, 12, "bao", "bao-b", "#FF7FDD") + nucleoid(32, 32, 24) + ys,
    bact_defs("bao") + halo("bao-h", P["antibody"], 0.35, 0.12, .45)),
    64, 9, "Bacterium coated in antibodies (Opsonize). Gold tags = macrophages eat it faster.")

pores = "".join(f'<circle cx="{x}" cy="{y}" r="2.2" fill="{P["void"]}" stroke="{P["kill"]}" stroke-width="1.2"/>'
                for x, y in ((26, 30.5), (34.5, 34), (39, 29.5)))
add("bacterium-complement", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="24" ry="17" fill="url(#bam-h)"/>' +
    rod(32, 32, 24, 12, "bam", "bam-b", "#FF7FDD") + pores,
    bact_defs("bam") + halo("bam-h", P["kill"], 0.4, 0.12, .45)),
    64, 9, "Bacterium being holed by complement. Orange-rimmed pores; the orange is the inflammation it costs.")

# toxin burst: a jagged violet shockwave, scale it up over ~0.4s and fade
spikes = 22
tp = []
for i in range(spikes * 2):
    t = math.pi * i / spikes
    rr = 27 if i % 2 == 0 else 21.5
    tp.append((32 + rr * math.cos(t), 32 + rr * math.sin(t)))
star = "M" + "L".join(f"{f(x)} {f(y)}" for x, y in tp) + "Z"
add("toxin-burst", "effect", svg(64,
    f'<circle cx="32" cy="32" r="31" fill="url(#tox-h)"/>'
    f'<path d="{star}" fill="none" stroke="{P["toxin"]}" stroke-width="1.4" stroke-linejoin="round" opacity=".9"/>'
    f'<circle cx="32" cy="32" r="17" fill="none" stroke="{P["toxin"]}" stroke-width="2.4" opacity=".55"/>',
    f'<radialGradient id="tox-h"><stop offset=".3" stop-color="{P["toxin"]}" stop-opacity="0"/>'
    f'<stop offset=".75" stop-color="{P["toxin"]}" stop-opacity=".35"/>'
    f'<stop offset="1" stop-color="{P["toxin"]}" stop-opacity="0"/></radialGradient>'),
    64, 30, "Toxin burst (area damage). Draw at the blast radius, grow from 40% to 100% and fade out.")

# pollen: big spiky grain, the 'harmless' invader of the restraint scenario
sp = []
n = 20
for i in range(n * 2):
    t = math.pi * i / n
    rr = 22 if i % 2 == 0 else 17.5
    sp.append((32 + rr * math.cos(t), 32 + rr * math.sin(t)))
spk = smooth_closed(sp) if False else "M" + "L".join(f"{f(x)} {f(y)}" for x, y in sp) + "Z"
dots = ""
random.seed(11)
for i in range(26):
    rr = 13 * math.sqrt(random.random())
    t = random.uniform(0, 6.283)
    dots += f'<circle cx="{f(32 + rr * math.cos(t))}" cy="{f(32 + rr * math.sin(t))}" r="1.1"/>'
add("pollen", "enemy", svg(64,
    f'<circle cx="32" cy="32" r="31" fill="url(#pol-h)"/>'
    f'<path d="{spk}" fill="url(#pol-b)" stroke="{P["pollen"]}" stroke-width="1.3" stroke-linejoin="round"/>'
    f'<g fill="{P["pollenHi"]}" opacity=".7">{dots}</g>',
    halo("pol-h", P["pollen"], 0.4, 0.12, .55) + body_grad("pol-b", "#E8FF9E", P["pollen"], 0.45, 0.2)),
    64, 18, "Pollen grain (Pollen scenario). Harmless, so it gets its own hue and a calm spiky silhouette, not magenta.")

# ======================= FIELDS =======================

def ab_y(x, y, s=1, rot=0, w=2.2):
    return (f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})">'
            f'<path d="M0 6V0M0 0L-5 -5.5M0 0L5 -5.5" fill="none" stroke="{P["antibody"]}" '
            f'stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/></g>')


add("antibody", "particle", svg(16,
    f'<circle cx="8" cy="8" r="8" fill="url(#abd-h)"/>' + ab_y(8, 8.4, .62, 0, 2.6),
    halo("abd-h", P["antibody"], 0.45, 0.12, .4)),
    16, 2, "Antibody particle (16px box). Draw at 3-6px, hundreds at once: random spin, slow drift, short fade. Spawn rate follows the antibody field.")

add("antibody-cloud", "field", svg(64,
    f'<circle cx="32" cy="32" r="32" fill="url(#abc-h)"/>',
    halo("abc-h", P["antibody"], 0.22, 0.08, .5)),
    64, 30, "Faint gold haze under dense antibody particles. One stamp per field cell, alpha = density, additive.")

# ======================= TISSUE & SECTORS =======================

def tissue_tile(name, fill, stroke, nuc, broken=False, note=""):
    random.seed(21)
    T, g = 128, 4
    cells = ""
    for i in range(g):
        for j in range(g):
            cx = (i + .5 + (.5 if j % 2 else 0)) * T / g + random.uniform(-3, 3)
            cy = (j + .5) * T / g + random.uniform(-3, 3)
            rx, ry = random.uniform(12.5, 14.5), random.uniform(11.5, 13.5)
            rot = random.uniform(0, 180)
            dead = broken and random.random() < .35
            for ox in (-T, 0, T):
                for oy in (-T, 0, T):
                    x, y = cx + ox, cy + oy
                    if -16 < x < T + 16 and -16 < y < T + 16:
                        dash = ' stroke-dasharray="5 3"' if dead else ""
                        cells += (f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}" '
                                  f'transform="rotate({f(rot)} {f(x)} {f(y)})" fill="{fill}" stroke="{stroke}" '
                                  f'stroke-width="1.2"{dash}/>')
                        if not dead:
                            cells += f'<circle cx="{f(x + 1)}" cy="{f(y - 1)}" r="4.2" fill="{nuc}"/>'
                        else:
                            cells += (f'<circle cx="{f(x - 2)}" cy="{f(y)}" r="1.4" fill="{nuc}"/>'
                                      f'<circle cx="{f(x + 3)}" cy="{f(y + 2)}" r="1" fill="{nuc}"/>')
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {T} {T}" width="{T}" height="{T}">'
         f'<rect width="{T}" height="{T}" fill="{P["void"]}"/>{cells}</svg>')
    add(name, "tile", s, T, None, note)


tissue_tile("tissue", "#090D22", "#161E48", "#1F2A66",
            note="Healthy tissue, seamless 128px tile. Sits under everything; keep it dim.")
tissue_tile("tissue-damaged", "#1E0A12", "#5A1A2A", "#7A2236", broken=True,
            note="Damaged tissue tile. Cross-fade over 'tissue' by the sector's Host Damage share.")


def vessel(name, wall, cellc, note, valves=False):
    W, H = 128, 64
    random.seed(9 if valves else 4)
    lining = ""
    for k in range(4):
        x = k * 32 + 16
        for y in (10.5, 53.5):
            lining += (f'<ellipse cx="{x}" cy="{y}" rx="13" ry="3" fill="{wall}" opacity=".35"/>'
                       f'<ellipse cx="{x + 2}" cy="{y}" rx="3" ry="1.4" fill="{wall}" opacity=".8"/>')
    walls = (f'<path d="M0 6H{W}M0 58H{W}" stroke="{wall}" stroke-width="2" opacity=".9"/>'
             f'<path d="M0 15H{W}M0 49H{W}" stroke="{wall}" stroke-width="1" opacity=".45"/>')
    flow = ""
    if valves:
        for x in (32, 96):  # chevron valves pointing downstream (+x)
            flow += (f'<path d="M{x - 6} 16L{x + 6} 32L{x - 6} 48" fill="none" stroke="{wall}" '
                     f'stroke-width="1.6" stroke-linejoin="round" opacity=".75"/>')
    else:
        for x, y in ((14, 26), (44, 38), (70, 24), (100, 36), (122, 28)):  # drifting red cells
            flow += (f'<ellipse cx="{x}" cy="{y}" rx="6" ry="4" fill="none" stroke="{cellc}" stroke-width="1.6" opacity=".45"/>')
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
         f'<rect width="{W}" height="{H}" fill="{P["void"]}"/>'
         f'<rect y="15" width="{W}" height="34" fill="{wall}" opacity=".07"/>{lining}{walls}{flow}</svg>')
    add(name, "tile", s, W, None, note)


vessel("vessel-blood", P["blood"], "#E0566F",
       "Blood vessel strip, tiles horizontally (128x64). Edge of the blood-entry sector; new cells emerge from it.")
vessel("vessel-lymph", P["lymph"], P["lymph"],
       "Lymph vessel strip, tiles horizontally (128x64). Chevron valves point the way out.", valves=True)

random.seed(13)
cut = [(0, 26)]
x = 0
while x < 116:
    x += random.uniform(7, 12)
    cut.append((x, 32 + random.uniform(-7, 7)))
cut.append((128, 34))
top = "L".join(f"{f(a)} {f(b - 4 - random.uniform(0, 3))}" for a, b in cut)
bot = "L".join(f"{f(a)} {f(b + 4 + random.uniform(0, 3))}" for a, b in reversed(cut))
gash = f"M{top}L{bot}Z"
add("wound", "tile", (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64" width="128" height="64">'
    f'<defs><linearGradient id="wnd-g" x1="0" y1="0" x2="0" y2="1">'
    f'<stop offset="0" stop-color="{P["damage"]}" stop-opacity="0"/>'
    f'<stop offset=".5" stop-color="{P["damage"]}" stop-opacity=".28"/>'
    f'<stop offset="1" stop-color="{P["damage"]}" stop-opacity="0"/></linearGradient></defs>'
    f'<rect width="128" height="64" fill="url(#wnd-g)"/>'
    f'<path d="{gash}" fill="{P["void"]}" stroke="{P["damage"]}" stroke-width="1.4" stroke-linejoin="round" opacity=".95"/>'
    f'</svg>'), 128, None,
    "Wound gash overlay (transparent background, 128x64). Lay across the wound sector where bacteria pour in.")

# ======================= UI ICONS (48 viewBox) =======================

def icon(name, body, note, defs=""):
    add(name, "icon", svg(48, body, defs), 48, None, note)


def stroke(d, c, w=2.6, extra=""):
    return (f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" '
            f'stroke-linejoin="round"{extra}/>')


levels = ["quiet", "watch", "inflamed", "max"]
for li, lv in enumerate(levels):
    c = ALERT[lv]
    bars = ""
    for b in range(4):
        h = 8 + b * 7
        x = 9 + b * 8.5
        on = b <= li
        bars += (f'<rect x="{x}" y="{40 - h}" width="6" height="{h}" rx="2" '
                 + (f'fill="{c}"/>' if on else f'fill="none" stroke="{P["uiDim"]}" stroke-width="1.2" opacity=".6"/>'))
    glow = f'<circle cx="24" cy="26" r="22" fill="url(#al{li}-h)"/>' if li >= 2 else ""
    icon(f"alert-{lv}", glow + bars,
         f"Sector alert: {lv.capitalize()}. Bars = level, colour ramps toward inflammation.",
         halo(f"al{li}-h", c, .35, .1, .5) if li >= 2 else "")

icon("fever",
     f'<circle cx="24" cy="24" r="23" fill="url(#fev-h)"/>' +
     stroke("M20 30V10a4 4 0 0 1 8 0v20", P["ui"], 2.4) +
     f'<circle cx="24" cy="35" r="7" fill="{P["kill"]}"/><rect x="22" y="16" width="4" height="18" rx="2" fill="{P["kill"]}"/>' +
     stroke("M31 13h4M31 19h3M31 25h4", P["uiDim"], 1.8),
     "Fever (body-wide ability). Slows bacterial growth, costs Host Damage, has a cooldown.",
     halo("fev-h", P["kill"], .3, .08, .5))

icon("stance-eat",
     f'<path d="M24 8a16 16 0 1 0 13.9 8L24 24Z" fill="{P["cell"]}" fill-opacity=".3" stroke="{P["cell"]}" stroke-width="2.4" stroke-linejoin="round"/>'
     f'<rect x="31" y="9" width="9" height="5" rx="2.5" transform="rotate(30 35.5 11.5)" fill="{P["germ"]}"/>',
     "Neutrophil stance: Eat (default). Engulf bacteria one at a time.")
_lat = ""
for k in range(-3, 4):  # sagging diamond lattice, like a cast net
    o = k * 9
    _lat += f"M{6 + o} 8Q{15 + o} 26 {24 + o} 42M{42 + o} 8Q{33 + o} 26 {24 + o} 42"
icon("stance-trap",
     f'<clipPath id="stp-c"><circle cx="24" cy="25" r="17"/></clipPath>'
     f'<g clip-path="url(#stp-c)">' + stroke(_lat, P["cellHi"], 1.6) + '</g>' +
     f'<circle cx="24" cy="25" r="17" fill="none" stroke="{P["cell"]}" stroke-width="2" stroke-dasharray="4 3"/>'
     f'<rect x="19" y="21" width="10" height="5" rx="2.5" fill="{P["germ"]}"/>',
    "Neutrophil stance: Trap (one-way). Cells die casting nets that pin bacteria but damage tissue.")
icon("stance-kill",
     f'<circle cx="24" cy="24" r="22" fill="url(#skl-h)"/>' +
     stroke("M24 6v9M24 33v9M6 24h9M33 24h9", P["kill"], 2.6) +
     f'<circle cx="24" cy="24" r="10" fill="none" stroke="{P["kill"]}" stroke-width="2.4"/>'
     f'<circle cx="24" cy="24" r="3.2" fill="{P["kill"]}"/>',
     "Macrophage stance: Kill. Fights hard, adds inflammation.", halo("skl-h", P["kill"], .25, .08, .5))
icon("stance-repair",
     f'<circle cx="24" cy="24" r="22" fill="url(#srp-h)"/>'
     f'<path d="M19 8h10v11h11v10H29v11H19V29H8V19h11Z" fill="{P["repair"]}" fill-opacity=".25" stroke="{P["repair"]}" stroke-width="2.2" stroke-linejoin="round"/>',
     "Macrophage stance: Repair. Heals tissue and calms the sector.", halo("srp-h", P["repair"], .25, .08, .5))

icon("marrow",
     stroke("M15 12a5 5 0 1 0-4 7l18 18a5 5 0 1 0 7-4l-18-18a5 5 0 0 0-3-3Z", P["ui"], 2.2) +
     f'<circle cx="21" cy="21" r="2.4" fill="{P["cell"]}"/><circle cx="27" cy="27" r="2.4" fill="{P["cell"]}"/>',
     "Bone marrow (production mix). Pair with the neutrophil and macrophage sprites at each end of the slider.")

icon("meter-pathogen",
     f'<circle cx="24" cy="24" r="22" fill="url(#mpt-h)"/>'
     f'<rect x="7" y="17" width="20" height="10" rx="5" fill="{P["germ"]}" opacity=".85"/>'
     f'<rect x="22" y="25" width="20" height="10" rx="5" fill="{P["germ"]}" opacity=".55"/>'
     f'<rect x="15" y="8" width="16" height="8" rx="4" fill="{P["germ"]}" opacity=".4"/>',
     "Pathogen Load meter icon. Fill the bar in the bacteria magenta.", halo("mpt-h", P["germ"], .3, .08, .5))
icon("meter-host",
     f'<circle cx="24" cy="24" r="22" fill="url(#mht-h)"/>'
     f'<path d="M24 6l15 8.5v17L24 40 9 31.5v-17Z" fill="{P["damage"]}" fill-opacity=".18" stroke="{P["damage"]}" stroke-width="2.2" stroke-linejoin="round"/>' +
     stroke("M24 10l-3 9 6 4-4 8 2 6", P["damage"], 2),
     "Host Damage meter icon (cracked tissue cell). Fill the bar in damage red.", halo("mht-h", P["damage"], .3, .08, .5))

icon("lymph-node",
     f'<path d="M14 10C24 4 40 10 40 24S28 44 18 40 4 30 9 22C11 19 16 22 18 19S9 13 14 10Z" fill="{P["lymph"]}" fill-opacity=".18" '
     f'stroke="{P["lymph"]}" stroke-width="2.2" stroke-linejoin="round"/>' +
     "".join(f'<circle cx="{x}" cy="{y}" r="2.6" fill="{P["antibody"]}"/>' for x, y in ((27, 16), (32, 25), (26, 32), (20, 26))),
     "Lymph node / sample bar. Fills as macrophages eat bacteria; full = antibody choice.")

icon("choice-opsonize",
     f'<circle cx="24" cy="24" r="23" fill="url(#cop-h)"/>'
     f'<rect x="11" y="18" width="26" height="12" rx="6" fill="{P["germ"]}" opacity=".7"/>' +
     "".join(ab_y(x, y, .75, r, 2.4) for x, y, r in ((14, 13, -35), (24, 11, 0), (34, 13, 35), (17, 36, 205), (31, 36, 155))),
     "Adaptive choice: Opsonize. Macrophages eat tagged bacteria faster, with no extra inflammation.",
     halo("cop-h", P["antibody"], .3, .08, .5))
icon("choice-complement",
     f'<circle cx="24" cy="24" r="23" fill="url(#ccm-h)"/>'
     f'<rect x="8" y="17" width="32" height="14" rx="7" fill="{P["germ"]}" opacity=".7"/>' +
     "".join(f'<circle cx="{x}" cy="{y}" r="3.3" fill="{P["void"]}" stroke="{P["kill"]}" stroke-width="1.8"/>'
             for x, y in ((16, 24), (24, 22.5), (32, 25))),
     "Adaptive choice: Complement. Punches holes in bacteria directly; adds inflammation.",
     halo("ccm-h", P["kill"], .32, .08, .5))

icon("sector-blood",
     stroke("M4 14H44M4 34H44", P["blood"], 2.4) +
     "".join(f'<ellipse cx="{x}" cy="24" rx="5" ry="3.4" fill="none" stroke="#E0566F" stroke-width="2"/>' for x in (12, 24, 36)),
     "Sector label: blood entry. Reinforcements arrive here.")
icon("sector-wound",
     f'<path d="M5 21L13 25L19 19L26 27L32 21L38 26L43 22L44 27L38 31L32 26L26 32L19 25L13 30L4 26Z" '
     f'fill="{P["damage"]}" fill-opacity=".3" stroke="{P["damage"]}" stroke-width="1.8" stroke-linejoin="round"/>'
     f'<rect x="20" y="10" width="9" height="5" rx="2.5" fill="{P["germ"]}"/><rect x="28" y="35" width="9" height="5" rx="2.5" fill="{P["germ"]}"/>',
     "Sector label: wound. Where the infection starts.")
icon("sector-lymph",
     stroke("M4 14H44M4 34H44", P["lymph"], 2.4) + stroke("M13 18l7 6-7 6M27 18l7 6-7 6", P["lymph"], 2.2),
     "Sector label: lymph exit. Samples leave here for the lymph node.")

# scenario badges
icon("scenario-papercut",
     f'<rect x="7" y="9" width="34" height="30" rx="2" fill="{P["ui"]}" fill-opacity=".08" stroke="{P["ui"]}" stroke-width="1.8"/>' +
     stroke("M11 30L37 18", P["damage"], 2.4) +
     "".join(f'<rect x="{x}" y="{y}" width="7" height="4" rx="2" fill="{P["germ"]}"/>' for x, y in ((14, 31), (28, 26), (31, 13))),
     "Scenario: Papercut (rout). Clear the infection.")
icon("scenario-pollen",
     f'<g transform="translate(-8 -8) scale(1)">' + ASSETS["pollen"]["svg"].split("</defs>")[1].replace("</svg>", "")
     .replace("url(#pol-h)", "none").replace("url(#pol-b)", P["pollen"] + '" fill-opacity=".3') + "</g>",
     "Scenario: Pollen (restraint). Harmless invader; win by not hurting the host.")


# ======================= V2: SIMPLER ARCADE PROTOTYPE =======================
# Everything above stays for the v1 build. These are the extra pieces the v2 design doc needs.

# --- shots: neutrophils fire gold antibody tracers. Faces +x, head at the anchor. ---
def tracer(name, tail_w, head_r, halo_r, core, note, extra=""):
    gid = name.replace("-", "")
    defs = (f'<linearGradient id="{gid}-t" x1="0" y1="0" x2="1" y2="0">'
            f'<stop offset="0" stop-color="{P["antibody"]}" stop-opacity="0"/>'
            f'<stop offset=".6" stop-color="{P["antibody"]}" stop-opacity=".45"/>'
            f'<stop offset="1" stop-color="{core}" stop-opacity="1"/></linearGradient>'
            + halo(f"{gid}-h", P["antibody"], .75, .25, .45))
    y0, y1 = 8 - tail_w / 2, 8 + tail_w / 2
    body = (f'<circle cx="54" cy="8" r="{halo_r}" fill="url(#{gid}-h)"/>'
            f'<path d="M3 8L54 {f(y0)}V{f(y1)}Z" fill="url(#{gid}-t)"/>' + extra +
            f'<circle cx="54" cy="8" r="{head_r}" fill="{core}"/>')
    add(name, "projectile", svg2(64, 16, body, defs), 64, head_r, note, box=[64, 16], anchor=[54, 8])


tracer("shot", 2.6, 2.2, 6, "#FFF3B8",
       "Neutrophil shot: a gold antibody tracer (64x16). Faces +x, head at the anchor. About 14px long on a phone.")
tracer("shot-tuned", 5, 3.4, 8, "#FFFFFF",
       "Tuned shot from inside a Support ring: thicker, white-hot, with a piercing tip. Draw ~1.4x the plain shot.",
       extra=f'<path d="M48 3.5L61 8L48 12.5" fill="none" stroke="#FFFFFF" stroke-width="1.4" '
             f'stroke-linejoin="round" opacity=".9"/><path d="M10 8H52" stroke="#FFFFFF" stroke-width="1" opacity=".55"/>')

# --- hits and kills ---
rays = ""
for i in range(8):
    a = i * math.pi / 4
    L = 14 if i % 2 == 0 else 8
    rays += f"M{f(16 + 3 * math.cos(a))} {f(16 + 3 * math.sin(a))}L{f(16 + L * math.cos(a))} {f(16 + L * math.sin(a))}"
add("hit-spark", "effect", svg(32,
    f'<circle cx="16" cy="16" r="15" fill="url(#hsp-h)"/>' +
    stroke(rays, "#FFFFFF", 1.6) + f'<circle cx="16" cy="16" r="3.2" fill="#FFFFFF"/>',
    halo("hsp-h", P["antibody"], .7, .2, .4)),
    32, 14, "Hit spark. Flash for ~80 ms where a shot lands; also the ricochet when a plain shot bounces off armor.")

add("kill-shard", "particle", svg(16,
    f'<circle cx="8" cy="8" r="8" fill="url(#ksh-h)"/>'
    f'<path d="M4 10.5L9.5 3.5L12.5 11Z" fill="{P["germ"]}" stroke="{P["germHi"]}" stroke-width=".8" stroke-linejoin="round"/>',
    halo("ksh-h", P["germ"], .5, .12, .4)),
    16, 4, "Kill fragment (16px). On a kill, throw 4-6 outward with random spin and fade over ~0.4 s.")

add("bacterium-hit", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="24" ry="17" fill="url(#bhh-h)"/>'
    f'<rect x="20" y="26" width="24" height="12" rx="6" fill="#FFFFFF" stroke="{P["germHi"]}" stroke-width="1.5"/>',
    halo("bhh-h", "#FFFFFF", .6, .15, .4)),
    64, 9, "Bacterium flashed white on a hit. Swap in for ~80 ms and nudge it back along the shot.")

# --- armored bacterium: magenta rod inside a thick plated ring ---
def armored(name, dividing, note):
    pfx = "arm" + ("d" if dividing else "")
    defs = bact_defs(pfx) + (f'<radialGradient id="{pfx}-r"><stop offset=".6" stop-color="{P["germ"]}" stop-opacity="0"/>'
                             f'<stop offset="1" stop-color="{P["germ"]}" stop-opacity=".28"/></radialGradient>')
    if dividing:
        shell = '<ellipse cx="32" cy="32" rx="25" ry="16"'
        inner = (rod(24, 32, 14, 9, pfx, f"{pfx}-b", "#FF7FDD") + rod(40, 32, 14, 9, pfx, f"{pfx}-b", "#FF7FDD") +
                 f'<line x1="32" y1="28" x2="32" y2="36" stroke="{P["germHi"]}" stroke-width="1.8" stroke-linecap="round"/>')
        hal = '<ellipse cx="32" cy="32" rx="31" ry="23" fill="url(#armd-h)"/>'
    else:
        shell = '<circle cx="32" cy="32" r="17"'
        inner = rod(32, 32, 18, 9, pfx, f"{pfx}-b", "#FF7FDD") + nucleoid(32, 32, 16)
        hal = '<circle cx="32" cy="32" r="29" fill="url(#arm-h)"/>'
    plates = (f'{shell} fill="url(#{pfx}-r)" stroke="#C42596" stroke-width="5" stroke-dasharray="6.2 1.6"/>'
              f'{shell} fill="none" stroke="{P["germHi"]}" stroke-width=".9" opacity=".8"/>')
    add(name, "enemy", svg(64, hal + plates + inner, defs), 64, 19 if not dividing else 22, note)


armored("bacterium-armored", False,
        "Armored bacterium: the rod inside a thick plated ring. Plain shots bounce off; tuned shots and Offense macrophages kill it.")
armored("bacterium-armored-dividing", True,
        "Armored bacterium mid-division (every 20 s). The shell stretches around both halves.")

# --- macrophage modes (v2 names; same art as v1's Kill/Repair) ---
macrophage("macrophage-offense", P["kill"],
           "Macrophage on Offense (v2). Orange core: swallows the nearest bacterium, one every 2 s.")
macrophage("macrophage-support", P["repair"],
           "Macrophage on Support (v2). Green core: stays put; pair with support-ring under it.")

add("support-ring", "field", svg(128,
    f'<circle cx="64" cy="64" r="62" fill="url(#sup-f)"/>'
    f'<circle cx="64" cy="64" r="60" fill="none" stroke="{P["repair"]}" stroke-width="1.6" opacity=".75"/>'
    f'<circle cx="64" cy="64" r="56" fill="none" stroke="{P["repair"]}" stroke-width=".8" stroke-dasharray="2 6" opacity=".55"/>',
    f'<radialGradient id="sup-f"><stop offset=".55" stop-color="{P["repair"]}" stop-opacity=".02"/>'
    f'<stop offset=".9" stop-color="{P["repair"]}" stop-opacity=".16"/>'
    f'<stop offset="1" stop-color="{P["repair"]}" stop-opacity="0"/></radialGradient>'),
    128, 60, "Support macrophage's ring (128 box, edge at 60). Width on screen = ring radius x 128/60. "
             "Pulse gently: scale 0.97-1.03 and alpha 0.7-1 over ~1.6 s.")

add("speed-trail", "effect", svg2(48, 16,
    f'<path d="M2 8L36 3V13Z" fill="url(#spd-t)"/>'
    f'<path d="M8 4.5L33 3.2M8 11.5L33 12.8" stroke="{P["cellHi"]}" stroke-width=".8" opacity=".45"/>',
    f'<linearGradient id="spd-t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{P["cell"]}" stop-opacity="0"/>'
    f'<stop offset="1" stop-color="{P["cell"]}" stop-opacity=".55"/></linearGradient>'),
    48, None, "Speed trail behind a boosted neutrophil (48x16). Faces +x; put the anchor on the neutrophil's centre, "
              "rotate to its heading, draw before the cell. Height ~ the cell's body diameter.",
    box=[48, 16], anchor=[36, 8])

# --- toxin burst in the Wound zone: 2 s red warning, then a violet shockwave ---
add("wound-flash", "effect", svg(128,
    f'<rect width="128" height="128" fill="url(#wfl-g)"/>',
    f'<radialGradient id="wfl-g" r=".72"><stop offset="0" stop-color="{P["damage"]}" stop-opacity=".55"/>'
    f'<stop offset=".6" stop-color="{P["damage"]}" stop-opacity=".2"/>'
    f'<stop offset="1" stop-color="{P["damage"]}" stop-opacity="0"/></radialGradient>'),
    128, None, "Toxin warning: stretch over the Wound zone and blink it (about 3 Hz) for the 2 s before a burst.")

add("toxin-shockwave", "effect", svg(256,
    f'<circle cx="128" cy="128" r="126" fill="url(#tsw-g)"/>'
    f'<circle cx="128" cy="128" r="118" fill="none" stroke="{P["toxin"]}" stroke-width="7" opacity=".85"/>'
    f'<circle cx="128" cy="128" r="114" fill="none" stroke="#F2E2FF" stroke-width="1.6" opacity=".9"/>',
    f'<radialGradient id="tsw-g"><stop offset=".45" stop-color="{P["toxin"]}" stop-opacity="0"/>'
    f'<stop offset=".88" stop-color="{P["toxin"]}" stop-opacity=".3"/>'
    f'<stop offset="1" stop-color="{P["toxin"]}" stop-opacity="0"/></radialGradient>'),
    256, 118, "Toxin shockwave (256 box, front at 118). Grow from the wound until it covers the zone in ~0.5 s, "
              "fade out, shake the screen lightly. Kills your cells it passes.")

# --- level progress bar markers and zone/HUD icons ---
def marker(name, body, note, defs=""):
    add(name, "marker", svg(24, body, defs), 24, None, note)


marker("marker-wave", f'<circle cx="12" cy="12" r="11" fill="url(#mkw-h)"/>'
       f'<circle cx="12" cy="12" r="5.5" fill="{P["germ"]}" stroke="{P["germHi"]}" stroke-width="1"/>',
       "Progress bar: a wave of bacteria still to come.", halo("mkw-h", P["germ"], .5, .12, .45))
marker("marker-wave-armored", f'<circle cx="12" cy="12" r="11" fill="url(#mka-h)"/>'
       f'<circle cx="12" cy="12" r="6.5" fill="none" stroke="#C42596" stroke-width="3" stroke-dasharray="3.4 1"/>'
       f'<circle cx="12" cy="12" r="3" fill="{P["germ"]}"/>',
       "Progress bar: a wave of armored bacteria.", halo("mka-h", P["germ"], .5, .12, .45))
marker("marker-wave-final", f'<circle cx="12" cy="12" r="12" fill="url(#mkf-h)"/>'
       f'<circle cx="12" cy="12" r="8" fill="none" stroke="{P["germHi"]}" stroke-width="1.4"/>'
       f'<circle cx="12" cy="12" r="5.5" fill="{P["germ"]}"/>',
       "Progress bar: the final wave (bigger, ringed).", halo("mkf-h", P["germ"], .6, .16, .45))
marker("marker-toxin", f'<circle cx="12" cy="12" r="11" fill="url(#mkt-h)"/>'
       f'<path d="M12 4.5L19.5 12L12 19.5L4.5 12Z" fill="{P["toxin"]}" stroke="#F2E2FF" stroke-width="1" stroke-linejoin="round"/>',
       "Progress bar: a toxin burst in the Wound (diamond).", halo("mkt-h", P["toxin"], .5, .12, .45))

icon("mode-offense",
     f'<circle cx="24" cy="24" r="22" fill="url(#mof-h)"/>'
     f'<path d="M37 15A15 15 0 1 0 37 33L27 24Z" fill="{P["kill"]}" fill-opacity=".22" stroke="{P["kill"]}" '
     f'stroke-width="2.4" stroke-linejoin="round"/>'
     f'<rect x="12" y="21" width="12" height="6" rx="3" fill="{P["germ"]}"/>',
     "Zone chip: Offense. Macrophages here swallow bacteria.", halo("mof-h", P["kill"], .28, .08, .5))
icon("mode-support",
     f'<circle cx="24" cy="24" r="22" fill="url(#msp-h)"/>'
     f'<circle cx="24" cy="24" r="17" fill="none" stroke="{P["repair"]}" stroke-width="2.2"/>' +
     stroke("M15 18l6 6-6 6M24 18l6 6-6 6", P["cell"], 2.4),
     "Zone chip: Support. Neutrophils in the ring move faster and fire tuned shots.", halo("msp-h", P["repair"], .28, .08, .5))
icon("sector-tissue",
     "".join(f'<ellipse cx="{x}" cy="{y}" rx="8" ry="7" fill="#0B1029" stroke="{P["tissueHi"]}" stroke-width="1.6"/>'
             f'<circle cx="{x}" cy="{y}" r="2.6" fill="{P["tissueHi"]}"/>' for x, y in ((14, 17), (31, 15), (22, 31), (38, 31))),
     "Zone label: Tissue (the middle zone).")
icon("pause", f'<rect x="14" y="11" width="7" height="26" rx="2.5" fill="{P["ui"]}"/>'
              f'<rect x="27" y="11" width="7" height="26" rx="2.5" fill="{P["ui"]}"/>', "Pause button.")
_star = "M24 5L29.4 17.6L43 18.6L32.6 27.4L35.8 40.8L24 33.6L12.2 40.8L15.4 27.4L5 18.6L18.6 17.6Z"
icon("star", f'<circle cx="24" cy="24" r="22" fill="url(#str-h)"/>'
             f'<path d="{_star}" fill="{P["antibody"]}" stroke="#FFF3B8" stroke-width="1.2" stroke-linejoin="round"/>',
     "Win star (earned).", halo("str-h", P["antibody"], .35, .1, .5))
icon("star-empty", f'<path d="{_star}" fill="none" stroke="{P["uiDim"]}" stroke-width="1.8" stroke-linejoin="round"/>',
     "Win star (not earned).")


# ======================= V2 ROUND 2: BODY OUTPUT AND FATIGUE =======================
FAT = {"fine": ALERT["quiet"], "tired": P["antibody"], "feverish": P["kill"], "exhausted": P["damage"]}

icon("fatigue-fine",
     f'<path d="M24 39C14 32 7 26 7 18.5A8.5 8.5 0 0 1 24 14A8.5 8.5 0 0 1 41 18.5C41 26 34 32 24 39Z" '
     f'fill="{FAT["fine"]}" fill-opacity=".18" stroke="{FAT["fine"]}" stroke-width="2.4" stroke-linejoin="round"/>' +
     stroke("M10 25H17L20 19L25 30L28 25H38", FAT["fine"], 2),
     "Fatigue tier: Fine. The body is keeping up.")
icon("fatigue-tired",
     f'<circle cx="24" cy="24" r="22" fill="url(#ftt-h)"/>'
     f'<path d="M14 7H34M14 41H34" stroke="{FAT["tired"]}" stroke-width="2.6" stroke-linecap="round"/>'
     f'<path d="M16 8C16 17 32 18 32 24S16 31 16 40H32C32 31 16 30 16 24S32 17 32 8Z" fill="none" '
     f'stroke="{FAT["tired"]}" stroke-width="2.2" stroke-linejoin="round"/>'
     f'<path d="M19.5 37.5Q24 31 28.5 37.5Z" fill="{FAT["tired"]}"/><path d="M20.5 13H27.5Q24 18.5 20.5 13Z" fill="{FAT["tired"]}" opacity=".7"/>',
     "Fatigue tier: Tired (hourglass). Every cell moves slower.", halo("ftt-h", FAT["tired"], .28, .08, .5))
icon("fatigue-feverish",
     f'<circle cx="24" cy="24" r="23" fill="url(#ffv-h)"/>' +
     stroke("M17 30V10a4 4 0 0 1 8 0v20", P["ui"], 2.4) +
     f'<circle cx="21" cy="35" r="7" fill="{FAT["feverish"]}"/><rect x="19" y="13" width="4" height="21" rx="2" fill="{FAT["feverish"]}"/>' +
     stroke("M31 12q3 3 0 6t0 6M37 10q3 3 0 6t0 6", FAT["feverish"], 2),
     "Fatigue tier: Feverish (thermometer with heat). Shots spray and neutrophils die sooner.",
     halo("ffv-h", FAT["feverish"], .32, .09, .5))
icon("fatigue-exhausted",
     f'<circle cx="24" cy="24" r="23" fill="url(#fex-h)"/>'
     f'<rect x="6" y="15" width="32" height="18" rx="4" fill="{FAT["exhausted"]}" fill-opacity=".14" stroke="{FAT["exhausted"]}" stroke-width="2.4"/>'
     f'<rect x="38.5" y="20" width="4" height="8" rx="1.5" fill="{FAT["exhausted"]}"/>'
     f'<rect x="10" y="19" width="4" height="10" rx="1.2" fill="{FAT["exhausted"]}"/>' +
     stroke("M22 18L19 24.5H25L22 31", "#FFE1E5", 2),
     "Fatigue tier: Exhausted (empty battery). The marrow drops to half speed and Support rings shrink.",
     halo("fex-h", FAT["exhausted"], .35, .1, .5))
icon("body-output",
     f'<circle cx="24" cy="24" r="22" fill="url(#bop-h)"/>' +
     stroke("M8 34A17 17 0 0 1 40 34", P["uiDim"], 3) +
     stroke("M8 34A17 17 0 0 1 27.5 17.5", P["cell"], 3) +
     stroke("M33.4 22.4A17 17 0 0 1 40 34", P["kill"], 3) +
     stroke("M24 34L33 20", P["ui"], 2.4) + f'<circle cx="24" cy="34" r="3.2" fill="{P["ui"]}"/>',
     "Body output (gauge). Cyan is what the body can sustain; past the orange mark fatigue builds.",
     halo("bop-h", P["cell"], .22, .06, .5))


# ======================= ANTIGEN ROSTER (notes/antigen-roster.md) =======================
# One trait per antigen, readable at a glance. Staph is the existing `bacterium`.
P.update({"virus": "#D9B6FF", "virusHi": "#F4EAFF", "slime": "#A9CF3C", "wax": "#F3E3B5", "plum": "#5A1E4A"})


def inner(name):
    """An asset's drawing without its outer <svg> tag, for nesting inside another file."""
    s = ASSETS[name]["svg"]
    return s[s.index(">") + 1:s.rindex("</svg>")]


# --- 2. MRSA: today's armored ring, but hazard-striped. Only tuned shots kill it.
def mrsa_svg():
    pfx = "mrs"
    defs = bact_defs(pfx) + (f'<radialGradient id="{pfx}-r"><stop offset=".6" stop-color="{P["germ"]}" stop-opacity="0"/>'
                             f'<stop offset="1" stop-color="{P["germ"]}" stop-opacity=".3"/></radialGradient>')
    ring = (f'<circle cx="32" cy="32" r="17" fill="url(#{pfx}-r)" stroke="#C42596" stroke-width="5.5"/>'
            f'<circle cx="32" cy="32" r="17" fill="none" stroke="{P["antibody"]}" stroke-width="5.5" '
            f'stroke-dasharray="4.45 4.45" transform="rotate(-45 32 32)"/>'
            f'<circle cx="32" cy="32" r="20" fill="none" stroke="{P["germHi"]}" stroke-width=".9" opacity=".8"/>'
            f'<circle cx="32" cy="32" r="14" fill="none" stroke="{P["germHi"]}" stroke-width=".7" opacity=".6"/>')
    return svg(64, f'<circle cx="32" cy="32" r="30" fill="url(#{pfx}-h)"/>' + ring +
               rod(32, 32, 16, 8, pfx, f"{pfx}-b", "#FF7FDD") + nucleoid(32, 32, 14), defs)


add("mrsa", "enemy", mrsa_svg(), 64, 20,
    "MRSA (the tank): armored ring with gold hazard stripes. Only tuned shots kill it; macrophages spit it out. Draw like bacterium-armored (~24 at full scale).")

# --- 3. Influenza: tiny pale spiky sphere, swarms. One hit kills.
sp = ""
for i in range(12):
    a = i * math.pi / 6
    x0, y0, x1, y1 = 32 + 7.5 * math.cos(a), 32 + 7.5 * math.sin(a), 32 + 11.5 * math.cos(a), 32 + 11.5 * math.sin(a)
    sp += f'<line x1="{f(x0)}" y1="{f(y0)}" x2="{f(x1)}" y2="{f(y1)}"/><circle cx="{f(x1)}" cy="{f(y1)}" r="1.3"/>'
add("flu", "enemy", svg(64,
    f'<circle cx="32" cy="32" r="18" fill="url(#flu-h)"/>'
    f'<g stroke="{P["virus"]}" stroke-width="1.5" fill="{P["virusHi"]}">{sp}</g>'
    f'<circle cx="32" cy="32" r="7.5" fill="url(#flu-b)" stroke="{P["virusHi"]}" stroke-width="1.4"/>',
    halo("flu-h", P["virus"], .55, .15, .45) + body_grad("flu-b", P["virusHi"], P["virus"], .7, .3)),
    64, 8, "Influenza (zerglings): tiny pale-lilac spiky sphere. One hit kills; comes 40+ at once. Draw small (~11 at full scale) so a swarm reads as a school.")

# --- 4. Pseudomonas: green-slimed rod with a flagellum; grows a biofilm dome.
add("pseudomonas", "enemy", svg(64,
    f'<ellipse cx="30" cy="32" rx="26" ry="17" fill="url(#psd-h)"/>' +
    stroke("M20 32C15 27 12 37 7 32S1 27 -2 31", P["slime"], 1.4) +
    f'<rect x="20" y="26" width="24" height="12" rx="6" fill="url(#psd-b)" stroke="#FF7FDD" stroke-width="1.5"/>'
    f'<circle cx="27" cy="31" r="1.6" fill="{P["slime"]}"/><circle cx="33" cy="34" r="1.3" fill="{P["slime"]}"/>'
    f'<circle cx="38" cy="30.5" r="1.5" fill="{P["slime"]}"/>',
    halo("psd-h", P["slime"], .45, .13, .45) + body_grad("psd-b", "#D8F27A", P["slime"], .65, .3)),
    64, 9, "Pseudomonas (the builder): magenta rod filled with green slime, trailing a flagellum. Faces +x. Stops and grows a biofilm dome.")

random.seed(17)
bubbles = "".join(f'<circle cx="{f(64 + rr * math.cos(t))}" cy="{f(64 + rr * .62 * math.sin(t))}" r="{f(random.uniform(1.5, 4))}" '
                  f'fill="none" stroke="{P["slime"]}" stroke-width=".9" opacity=".55"/>'
                  for rr, t in ((random.uniform(10, 50), random.uniform(0, 6.28)) for _ in range(16)))
add("biofilm-dome", "field", svg(128,
    f'<ellipse cx="64" cy="64" rx="60" ry="38" fill="url(#bfd-g)"/>'
    f'<ellipse cx="64" cy="64" rx="60" ry="38" fill="none" stroke="{P["slime"]}" stroke-width="2" opacity=".85"/>'
    f'<path d="M22 50Q40 30 70 30" fill="none" stroke="#E9FFB0" stroke-width="2" stroke-linecap="round" opacity=".55"/>' + bubbles,
    f'<radialGradient id="bfd-g" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="{P["slime"]}" stop-opacity=".08"/>'
    f'<stop offset=".75" stop-color="{P["slime"]}" stop-opacity=".2"/><stop offset="1" stop-color="{P["slime"]}" stop-opacity=".38"/></radialGradient>'),
    128, 60, "Biofilm dome (128 box, rim at 60 x 38). Translucent slime bubble over the zone floor; bacteria under it are shot-immune. "
             "Shrink it (or lower alpha) as Offense macrophages chew it.")

# --- 5. Tuberculosis: thick rod in a waxy coat. Infects the macrophage that swallows it.
add("tb", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="27" ry="18" fill="url(#tbc-h)"/>'
    f'<rect x="14" y="23" width="36" height="18" rx="9" fill="{P["wax"]}" fill-opacity=".12" stroke="{P["wax"]}" stroke-width="2.6"/>'
    f'<rect x="17.5" y="26.5" width="29" height="11" rx="5.5" fill="url(#tbc-b)" stroke="#FF7FDD" stroke-width="1.4"/>' +
    nucleoid(32, 32, 26) +
    f'<path d="M19 24.5Q32 21.5 45 24.5" fill="none" stroke="#FFFBEA" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>',
    halo("tbc-h", P["wax"], .3, .1, .45) + body_grad("tbc-b", "#FF9BE5", P["germ"], .6, .3)),
    64, 13, "Tuberculosis (the trojan horse): thick rod in a cream waxy coat. Slow, 12 hits. Draw ~1.3x a plain bacterium.")

# Infected macrophage: the macrophage turns magenta with TB rods inside.
random.seed(3)
_ph = [random.uniform(0, 6.28) for _ in range(3)]


def _mr(t):
    base = 20 + 1.6 * math.sin(3 * t + _ph[0]) + 1.2 * math.sin(5 * t + _ph[1])
    for c in (0.4, 2.5, 4.4):
        dt = math.atan2(math.sin(t - c), math.cos(t - c))
        base += 6.5 * math.exp(-(dt / 0.28) ** 2)
    return base


_rods = "".join(f'<rect x="{x - 5}" y="{y - 2.5}" width="10" height="5" rx="2.5" transform="rotate({r} {x} {y})" '
                f'fill="{P["germ"]}" stroke="{P["wax"]}" stroke-width=".9"/>'
                for x, y, r in ((24, 36, 20), (36, 24, -30), (40, 37, 70), (27, 25, 110)))
add("macrophage-infected", "unit", svg(64,
    f'<circle cx="32" cy="32" r="32" fill="url(#mif-h)"/>'
    f'<path d="{blob(32, 32, _mr, 48)}" fill="url(#mif-b)" stroke="#FF7FDD" stroke-width="1.6" stroke-linejoin="round"/>'
    f'<circle cx="32" cy="31" r="7" fill="{P["plum"]}" stroke="{P["germHi"]}" stroke-width="1"/>' + _rods,
    halo("mif-h", P["germ"], .45, .14, .5) + body_grad("mif-b", "#FF9BE5", P["germ"], .32, .18)),
    64, 22, "Macrophage infected by TB: same body, flipped to magenta with TB rods inside. Spits out new TB until neutrophils kill it.")

# --- 6. Clostridium spores: inert hard pods that hatch together.
def pod(cx, cy, cracked):
    shell = (f'<ellipse cx="{cx}" cy="{cy}" rx="11" ry="15" fill="url(#spo-b)" stroke="#9A8FB0" stroke-width="3"/>'
             f'<ellipse cx="{cx}" cy="{cy}" rx="11" ry="15" fill="none" stroke="{P["germHi"]}" stroke-width=".8" opacity=".7"/>')
    dots = "".join(f'<circle cx="{cx + dx}" cy="{cy + dy}" r="1.1" fill="#C8BFD8"/>' for dx, dy in ((-4, -7), (3, -4), (-2, 2), (4, 6), (-4, 9), (1, 11)))
    if not cracked:
        return shell + dots
    return (shell + dots +
            f'<path d="M{cx - 9} {cy - 3}L{cx - 3} {cy + 1}L{cx + 1} {cy - 5}L{cx + 5} {cy}L{cx + 10} {cy - 2}" fill="none" '
            f'stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round"/>'
            f'<circle cx="{cx}" cy="{cy - 2}" r="6" fill="url(#sph-f)"/>')


add("spore", "enemy", svg(64,
    f'<circle cx="32" cy="32" r="22" fill="url(#spo-h)"/>' + pod(32, 32, False),
    halo("spo-h", "#B8AECF", .5, .12, .5) + body_grad("spo-b", "#5E4D6E", "#2B2236", .9, .9)),
    64, 13, "Clostridium spore (the time bomb): a dull, hard, speckled pod. Inert and unhurtable; glows faintly so it's visible.")
rays = ""
for i in range(10):
    a = i * math.pi / 5 + .2
    rays += f"M{f(32 + 17 * math.cos(a))} {f(30 + 17 * math.sin(a))}L{f(32 + 26 * math.cos(a))} {f(30 + 26 * math.sin(a))}"
add("spore-hatch", "effect", svg(64,
    f'<circle cx="32" cy="30" r="31" fill="url(#sph-h)"/>' + stroke(rays, "#FFFFFF", 1.6) + pod(32, 32, True),
    halo("sph-h", P["germ"], .6, .2, .45) + body_grad("spo-b", "#5E4D6E", "#2B2236", .9, .9) +
    halo("sph-f", "#FFFFFF", 1, .5, .5)),
    64, 15, "Spore hatching: the pod cracks with a white flash. Show for ~0.3 s, then spawn bacteria.")

# --- 7. Toxic-shock Staph: normal rod with an orange pulse. Doubles fatigue gain while alive.
add("staph-toxic", "enemy", svg(64,
    f'<circle cx="32" cy="32" r="29" fill="url(#stx-p)"/>'
    f'<circle cx="32" cy="32" r="19" fill="none" stroke="{P["kill"]}" stroke-width="1.4" stroke-dasharray="2 3" opacity=".9"/>' +
    rod(32, 32, 24, 12, "stx", "stx-b", "#FF7FDD") +
    f'<path d="M27 32h10" stroke="{P["kill"]}" stroke-width="2.2" stroke-linecap="round"/>',
    f'<radialGradient id="stx-p"><stop offset=".25" stop-color="{P["kill"]}" stop-opacity="0"/>'
    f'<stop offset=".62" stop-color="{P["kill"]}" stop-opacity=".45"/><stop offset="1" stop-color="{P["kill"]}" stop-opacity="0"/></radialGradient>' +
    body_grad("stx-b", "#FF9BE5", P["germ"], .6, .28)),
    64, 9, "Toxic-shock Staph (the drain): a plain rod wrapped in an orange pulse (the fatigue colour). Pulse its alpha ~1 Hz.")

# --- 8. Strep chains: round beads linked in a line.
def bead(x, y, link_l, link_r, pfx):
    s = ""
    if link_l:
        s += f'<line x1="{x - 9}" y1="{y}" x2="{x - 5}" y2="{y}" stroke="{P["germHi"]}" stroke-width="2" stroke-linecap="round"/>'
    if link_r:
        s += f'<line x1="{x + 5}" y1="{y}" x2="{x + 9}" y2="{y}" stroke="{P["germHi"]}" stroke-width="2" stroke-linecap="round"/>'
    return s + (f'<circle cx="{x}" cy="{y}" r="6.5" fill="url(#{pfx}-b)" stroke="#FF7FDD" stroke-width="1.4"/>'
                f'<circle cx="{x - 1.8}" cy="{y - 1.8}" r="1.6" fill="{P["germHi"]}" opacity=".8"/>')


add("strep-link", "enemy", svg(64,
    f'<circle cx="32" cy="32" r="16" fill="url(#stl-h)"/>' + bead(32, 32, True, True, "stl"), bact_defs("stl")),
    64, 7, "Strep chain link (one bead, with link stubs both sides). Place links ~18 units apart along the chain's path and "
           "rotate each to the path. Draw ~0.8x a plain bacterium.")
_ch = ""
for i in range(6):
    x = 9 + i * 9.2
    y = 32 + 6 * math.sin(i * 1.1)
    _ch += bead(x, y, i > 0, i < 5, "stc").replace('r="6.5"', 'r="4.4"').replace('r="1.6"', 'r="1.1"')
add("strep-chain", "enemy", svg(64, f'<ellipse cx="32" cy="32" rx="31" ry="16" fill="url(#stc-h)"/>' + _ch, bact_defs("stc")),
    64, 28, "Strep chain (6 beads, wriggling). For icons, markers and previews; in play, build chains from strep-link.")

# --- 9. Herpes: lilac virion; infected neutrophils carry a faint purple flicker.
hexp = "M" + "L".join(f"{f(32 + 8 * math.cos(math.pi / 3 * i + math.pi / 6))} {f(32 + 8 * math.sin(math.pi / 3 * i + math.pi / 6))}" for i in range(6)) + "Z"
add("herpes", "enemy", svg(64,
    f'<circle cx="32" cy="32" r="18" fill="url(#hrp-h)"/>'
    f'<circle cx="32" cy="32" r="11.5" fill="none" stroke="{P["virus"]}" stroke-width="1.6" stroke-dasharray="2.2 1.4"/>'
    f'<path d="{hexp}" fill="url(#hrp-b)" stroke="{P["virusHi"]}" stroke-width="1.4" stroke-linejoin="round"/>'
    f'<circle cx="32" cy="32" r="2.6" fill="{P["virusHi"]}"/>',
    halo("hrp-h", P["virus"], .55, .15, .45) + body_grad("hrp-b", P["virusHi"], P["virus"], .6, .3)),
    64, 11, "Herpes particle: a lilac hexagonal capsid in a dotted envelope. 8 burst out of each infected neutrophil.")

defs, nuc = neutrophil_parts("nif")
add("neutrophil-infected", "unit", svg(64,
    f'<circle cx="32" cy="32" r="26" fill="url(#nif-h)"/>'
    f'<circle cx="32" cy="32" r="16" fill="url(#nif-p)"/>'
    f'<circle cx="32" cy="32" r="13" fill="url(#nif-b)" stroke="#7FF0FF" stroke-width="1.6"/>' + nuc +
    f'<path d="{hexp}" transform="translate(9.6 9.6) scale(.7)" fill="{P["virus"]}" opacity=".85"/>',
    defs + halo("nif-p", P["virus"], .6, .25, .55)),
    64, 13, "Neutrophil carrying herpes: looks normal except a faint lilac glow and a capsid inside. Flicker this sprite with "
            "the plain neutrophil every ~0.3 s so a sharp-eyed player can spot it.")

# --- 10. Tapeworm: the boss. Head + segments, chained by code. Broken segments become small fast worms.
add("tapeworm-head", "enemy", svg(64,
    f'<circle cx="32" cy="32" r="31" fill="url(#twh-h)"/>'
    f'<path d="M6 32C6 18 18 12 32 12S58 20 58 32 46 52 32 52 6 46 6 32Z" fill="url(#twh-b)" stroke="{P["germ"]}" stroke-width="2"/>' +
    "".join(f'<circle cx="{x}" cy="{y}" r="5.2" fill="{P["plum"]}" stroke="{P["germHi"]}" stroke-width="1.4"/>'
            f'<circle cx="{x}" cy="{y}" r="2" fill="#16070F"/>' for x, y in ((24, 24), (24, 40), (40, 24), (40, 40))) +
    "".join(f'<path d="M{f(32 + 6 * math.cos(a))} {f(32 + 6 * math.sin(a))}L{f(32 + 11 * math.cos(a + .25))} {f(32 + 11 * math.sin(a + .25))}" '
            f'stroke="{P["wax"]}" stroke-width="1.4" stroke-linecap="round"/>' for a in [i * math.pi / 4 for i in range(8)]) +
    f'<circle cx="32" cy="32" r="4.5" fill="{P["germ"]}"/>',
    halo("twh-h", P["germ"], .5, .15, .5) + body_grad("twh-b", "#B0408F", P["plum"], .9, .9)),
    64, 26, "Tapeworm head (scolex): four suckers and a hook crown. The only enemy bigger than a macrophage: draw ~1.6x a macrophage. Faces +x.")
add("tapeworm-segment", "enemy", svg2(48, 40,
    f'<rect x="1" y="1" width="46" height="38" rx="9" fill="url(#tws-h)"/>'
    f'<rect x="5" y="4" width="38" height="32" rx="7" fill="url(#tws-b)" stroke="{P["germ"]}" stroke-width="2"/>'
    f'<path d="M9 7V33M39 7V33" stroke="{P["germHi"]}" stroke-width="1" opacity=".5"/>'
    f'<circle cx="24" cy="20" r="4" fill="none" stroke="{P["germHi"]}" stroke-width="1.4"/>'
    f'<circle cx="24" cy="20" r="1.5" fill="{P["germHi"]}"/>',
    halo("tws-h", P["germ"], .4, .12, .5) + body_grad("tws-b", "#8A2C70", P["plum"], .9, .9)),
    48, 19, "Tapeworm segment (48x40). Chain them behind the head along its path, overlapping a little, each rotated to the path. "
            "Flash with hit-spark; when one breaks off, swap it for tapeworm-small.", box=[48, 40], anchor=[24, 20])
add("tapeworm-small", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="26" ry="14" fill="url(#twm-h)"/>' +
    "".join(f'<rect x="{x}" y="26" width="12" height="12" rx="4" fill="url(#twm-b)" stroke="{P["germ"]}" stroke-width="1.4"/>'
            for x in (12, 23, 34)) +
    f'<circle cx="51" cy="32" r="6" fill="url(#twm-b)" stroke="{P["germ"]}" stroke-width="1.4"/><circle cx="52" cy="30" r="1.4" fill="{P["germHi"]}"/>',
    halo("twm-h", P["germ"], .45, .14, .5) + body_grad("twm-b", "#B0408F", P["plum"], .9, .9)),
    64, 12, "Small fast worm, made when a tapeworm segment breaks off. Faces +x.")

# --- New friendly units
defs, nuc = neutrophil_parts("nnt")
_net_small = net_paths.replace('stroke-width=".9"', 'stroke-width="1.1"').replace('opacity=".75"', 'opacity=".9"')
add("neutrophil-net", "unit", svg(64,
    f'<circle cx="32" cy="32" r="26" fill="url(#nnt-h)"/>'
    f'<clipPath id="nnt-c"><circle cx="32" cy="32" r="13"/></clipPath>'
    f'<circle cx="32" cy="32" r="13" fill="url(#nnt-b)"/>'
    f'<g clip-path="url(#nnt-c)" transform="translate(32 32) scale(.62) translate(-32 -32)">{_net_small}</g>'
    f'<circle cx="32" cy="32" r="13" fill="none" stroke="{P["cellHi"]}" stroke-width="2.2"/>'
    f'<circle cx="32" cy="32" r="17" fill="none" stroke="{P["cell"]}" stroke-width="1" stroke-dasharray="2 2.6" opacity=".8"/>',
    defs),
    64, 13, "Net neutrophil (marrow option), on its run to the thickest crowd: a neutrophil packed with net strands and a dashed outer shell. "
            "When it bursts, show neutrophil-trap briefly, then leave net.")

defs = (halo("nkc-h", P["cell"], .45, .13, .45) + body_grad("nkc-b", "#9FF4FF", P["cell"], .45, .18))
gran = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFFFFF" opacity=".95"/>'
               for x, y, r in ((38, 25, 1.9), (42, 31, 1.6), (39, 38, 1.8), (34, 42, 1.4), (44, 37, 1.2), (35, 21, 1.2)))
spikes = ""
for i in range(8):
    a = i * math.pi / 4 + math.pi / 8
    spikes += f"M{f(32 + 18 * math.cos(a))} {f(32 + 18 * math.sin(a))}L{f(32 + 22.5 * math.cos(a))} {f(32 + 22.5 * math.sin(a))}"
add("nk-cell", "unit", svg(64,
    f'<circle cx="32" cy="32" r="29" fill="url(#nkc-h)"/>' + stroke(spikes, P["cell"], 1.8) +
    f'<circle cx="32" cy="32" r="16" fill="url(#nkc-b)" stroke="#7FF0FF" stroke-width="1.8"/>'
    f'<path d="M20 32C20 24 27 21 31 24C34 26 33 30 31 32C29 35 31 39 28 41C23 43 20 38 20 32Z" fill="{P["cellHi"]}"/>' + gran,
    defs),
    64, 16, "NK cell (marrow option): a mid-size cyan cell with a crown of short spikes, one big nucleus and white granules. "
            "Slow; ignores normal bacteria and pops infected or hidden cells. Draw ~1.25x a neutrophil.")

# --- Progress-bar markers: the antigen's own sprite in a small ringed badge, so the bar previews what's coming.
for name, col, scale in (("mrsa", P["antibody"], 1.4), ("flu", P["virus"], 2.0), ("pseudomonas", P["slime"], 1.5),
                         ("tb", P["wax"], 1.3), ("spore", "#9A8FB0", 1.5), ("staph-toxic", P["kill"], 1.4),
                         ("strep-chain", P["germ"], 1.2), ("herpes", P["virus"], 1.7), ("tapeworm-head", P["germ"], 1.1)):
    key = name.replace("-chain", "").replace("-head", "")
    s = 24 * scale
    off = 12 - s / 2
    marker(f"marker-{key}",
           f'<circle cx="12" cy="12" r="11" fill="#04050A" stroke="{col}" stroke-width="1.4"/>'
           f'<clipPath id="mk{key}-c"><circle cx="12" cy="12" r="10"/></clipPath>'
           f'<g clip-path="url(#mk{key}-c)"><svg x="{f(off)}" y="{f(off)}" width="{f(s)}" height="{f(s)}" viewBox="0 0 64 64">{inner(name)}</svg></g>',
           f"Progress bar: a wave with {key} in it (the antigen in a ringed badge). Use as kind '{key}' in ART.drawProgress.")

# Suggested body radius in prototype/v2 world units (before its 0.62 UNIT_SCALE), so sizes stay in proportion:
# world size of the box = 64 * worldR / meta.radius (for the 48x40 segment use 48 * worldR / meta.radius).
for _n, _r in {"mrsa": 9.5, "flu": 3, "pseudomonas": 5.5, "tb": 7.5, "spore": 6, "spore-hatch": 7, "staph-toxic": 5.5,
               "strep-link": 4, "strep-chain": 14, "herpes": 3.5, "neutrophil-infected": 8, "macrophage-infected": 15,
               "tapeworm-head": 24, "tapeworm-segment": 15, "tapeworm-small": 6, "neutrophil-net": 8, "nk-cell": 10,
               "biofilm-dome": 60}.items():
    ASSETS[_n]["worldR"] = _r

# ======================= CYTOKINE STORM (notes/antigen-roster.md, settled 2026-10-07) =======================
STORM, STORM2 = P["damage"], P["germ"]   # red into magenta: the storm hits everyone


def storm_burst(pfx, c1, c2, core, n=11):
    pts = []
    for i in range(n * 2):
        a = math.pi * i / n - math.pi / 2
        rr = 21 if i % 2 == 0 else 13.5
        pts.append((24 + rr * math.cos(a), 24 + rr * math.sin(a)))
    star = "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts) + "Z"
    swirl = "M24 24m-7 0a7 7 0 1 1 7 7a4 4 0 1 1 -3 -5"
    return (f'<circle cx="24" cy="24" r="23" fill="url(#{pfx}-h)"/>'
            f'<path d="{star}" fill="{c1}" fill-opacity=".25" stroke="{c1}" stroke-width="1.8" stroke-linejoin="round"/>' +
            stroke(swirl, c2, 2.6) + f'<circle cx="24" cy="24" r="2.6" fill="{core}"/>')


icon("storm", storm_burst("stm", STORM, STORM2, "#FFFFFF"),
     "Cytokine storm button. Hold to preview the cost on the fatigue meter (ghost bar), release to fire.",
     halo("stm-h", STORM, .45, .12, .5))
icon("storm-lethal",
     storm_burst("stl2", "#7A1020", STORM, "#FFE1E5") +
     f'<circle cx="24" cy="24" r="21.5" fill="none" stroke="{STORM}" stroke-width="2" stroke-dasharray="3 2.5"/>' +
     stroke("M6 31H15L18 27L21 35L24 31H42", "#FFE1E5", 1.8),
     "Storm button while held when the storm would kill you (ghost bar reaches 100 before the afterburn ends): darker, with a flatline.",
     halo("stl2-h", STORM, .55, .16, .5))
icon("storm-afterburn",
     f'<circle cx="24" cy="24" r="22" fill="url(#sab-h)"/>'
     f'<path d="M24 6C27 14 35 17 35 28A11 11 0 0 1 13 28C13 22 17 19 18 14C20 18 22 19 23 18C22 13 22 10 24 6Z" '
     f'fill="{STORM}" fill-opacity=".25" stroke="{STORM}" stroke-width="2.2" stroke-linejoin="round"/>'
     f'<path d="M24 22C26 26 29 27 29 31A5 5 0 0 1 19 31C19 28 21 27 22 25Z" fill="{STORM2}"/>',
     "Afterburn (8 s after a storm): fatigue keeps climbing. Show beside the countdown.", halo("sab-h", STORM, .4, .1, .5))

# effect sprites
spk = []
for i in range(36):
    a = math.pi * i / 18
    rr = 120 if i % 2 == 0 else 109 + (i * 7 % 5)
    spk.append((128 + rr * math.cos(a), 128 + rr * math.sin(a)))
add("storm-wave", "effect", svg(256,
    f'<circle cx="128" cy="128" r="127" fill="url(#swv-g)"/>'
    f'<path d="{"M" + "L".join(f"{f(x)} {f(y)}" for x, y in spk) + "Z"}" fill="none" stroke="{STORM}" stroke-width="4" '
    f'stroke-linejoin="round" opacity=".9"/>'
    f'<circle cx="128" cy="128" r="112" fill="none" stroke="#FFE1EE" stroke-width="2" opacity=".85"/>'
    f'<circle cx="128" cy="128" r="104" fill="none" stroke="{STORM2}" stroke-width="3" opacity=".6"/>',
    f'<radialGradient id="swv-g"><stop offset=".5" stop-color="{STORM2}" stop-opacity="0"/>'
    f'<stop offset=".86" stop-color="{STORM}" stop-opacity=".4"/><stop offset="1" stop-color="{STORM}" stop-opacity="0"/></radialGradient>'),
    256, 120, "Storm shockwave (256 box, front at 120). ART.drawStorm rolls it across the screen during the 1 s wind-up.")
add("storm-shard", "particle", svg(16,
    f'<circle cx="8" cy="8" r="8" fill="url(#ssh-h)"/>'
    f'<path d="M3 9L8 2.5L13 9L8 13.5Z" fill="{STORM}" stroke="#FFE1EE" stroke-width=".8" stroke-linejoin="round"/>',
    halo("ssh-h", STORM2, .6, .15, .4)),
    16, 4, "Storm shard. On the hit, throw a handful from every antigen and neutrophil the storm kills (red-magenta, not the bacteria's plain magenta).")

# loss-screen emblem: a heart whose trace goes flat
add("organ-failure", "emblem", svg(128,
    f'<circle cx="64" cy="64" r="62" fill="url(#ofl-h)"/>'
    f'<path d="M64 104C38 86 18 70 18 48A23 23 0 0 1 64 36A23 23 0 0 1 110 48C110 70 90 86 64 104Z" fill="#2A0710" '
    f'stroke="{STORM}" stroke-width="3.5" stroke-linejoin="round"/>'
    f'<path d="M64 36L58 52L68 60L60 76L66 88" fill="none" stroke="#04050A" stroke-width="5" stroke-linejoin="round"/>'
    f'<path d="M64 36L58 52L68 60L60 76L66 88" fill="none" stroke="{STORM2}" stroke-width="1.6" stroke-linejoin="round" opacity=".8"/>' +
    stroke("M8 66H34L40 54L46 76L52 66H120", "#FFE1E5", 2.6) +
    f'<circle cx="120" cy="66" r="3" fill="#FFE1E5"/>',
    halo("ofl-h", STORM, .45, .12, .55)),
    128, None, "Loss screen emblem for \"Cytokine storm: organ failure\": a cracked heart and a heartbeat trace that runs flat.")


# ======================= ORGAN HEALTH (notes/organ-fatigue-brainstorm.md, Sandbox build spec 2026-10-07) =======================
# Liver and kidneys sit in the vessel strip at the Lymph-node end. Host organs, so not cyan (that is immune cells):
# healthy = soft repair green, strained = dimmer green with a hairline crack, damaged = amber with cracks,
# failing = red, failed = grey and dark. Five states = 4 health bars down to 0.
P.update({"amber": "#FFB23F", "dead": "#5D6478", "jaundice": "#E2D34A"})
ORGAN_STATES = (  # name, stroke, fill-inner, halo alpha, crack count
    ("healthy", P["repair"], "#B9FFD6", .32, 0),
    ("strained", P["repair"], "#8FE0B4", .2, 1),
    ("damaged", P["amber"], "#FFE0A6", .3, 2),
    ("failing", P["damage"], "#FFB0B8", .42, 4),
    ("failed", P["dead"], "#2A2F3C", 0, 4),
)


def organ_layers(pfx, shape, cracks, state):
    _, col, hi, ha, nc = state
    dead = ha == 0
    defs = body_grad(f"{pfx}-b", hi, col, .55 if not dead else .9, .2 if not dead else .85, .4, .35)
    out = ""
    if ha:
        defs += halo(f"{pfx}-h", col, ha, ha / 3.2, .5)
        out += f'<ellipse cx="32" cy="24" rx="32" ry="24" fill="url(#{pfx}-h)"/>'
    out += shape(f"url(#{pfx}-b)", col, 2.2)
    for d in cracks[:nc]:
        out += (f'<path d="{d}" fill="none" stroke="#04050A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="miter"/>'
                f'<path d="{d}" fill="none" stroke="{col if not dead else "#8A92A8"}" stroke-width=".8" '
                f'stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>')
    return out, defs


# --- Liver: a wedge, big lobe on the left tapering right, falciform line, small gallbladder underneath.
LIVER = smooth_closed([(5, 17), (12, 9), (26, 6.5), (40, 7.5), (52, 10), (60, 13), (58.5, 17.5), (48, 24),
                       (36, 31), (25, 38), (15, 40.5), (8, 35), (4.5, 26)])


def liver_shape(fill, col, w):
    return (f'<path d="{LIVER}" fill="{fill}" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>'
            f'<path d="M33 8C31 15 31 21 28 30" fill="none" stroke="{col}" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>'
            f'<ellipse cx="21" cy="38.5" rx="4.2" ry="2.8" fill="{P["slime"]}" fill-opacity=".35" stroke="{P["slime"]}" '
            f'stroke-width="1" opacity=".75"/>'
            + "".join(f'<circle cx="{x}" cy="{y}" r="1.1" fill="{col}" opacity=".5"/>'
                      for x, y in ((14, 18), (20, 26), (24, 15), (42, 15), (13, 30), (38, 22))))


LIVER_CRACKS = ("M20 7.5L19 12L22.5 15L20 19.5L23 23M22.5 15L26.5 16.5", "M48 23.5L46 19L49 16L46.5 12.5L48.5 10.5",
                "M5 24L9.5 25L11.5 29L15.5 30M11.5 29L10.5 33", "M30 33.5L32 28.5L29.5 25L33 20L31.5 16")

# --- Kidneys: two beans facing each other, ureters running down out of the box edge.
def bean(cx, side):
    pts = []
    for i in range(28):
        t = 2 * math.pi * i / 28
        x, y = cx + 9.5 * math.cos(t), 21 + 14.5 * math.sin(t)
        if math.cos(t) * side > 0:   # pinch the inner side: the hilum notch
            x -= side * 6 * math.exp(-((y - 22) / 5.5) ** 2) * math.cos(t) ** 2
        pts.append((x, y))
    return smooth_closed(pts)


KID_L, KID_R = bean(19, 1), bean(45, -1)


def kidney_shape(fill, col, w):
    s = ""
    for k, cx, sd in ((KID_L, 19, 1), (KID_R, 45, -1)):
        hx = cx + sd * 5
        s += (f'<path d="M{hx} 23C{hx + sd * 4} 30 {32 - sd * 3} 38 {32 - sd * 2.5} 48" fill="none" stroke="{col}" '
              f'stroke-width="1.4" stroke-linecap="round" opacity=".7"/>'
              f'<path d="{k}" fill="{fill}" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>'
              f'<path d="M{cx - sd * 4} 11C{cx - sd * 7} 18 {cx - sd * 7} 26 {cx - sd * 4} 32" fill="none" stroke="{col}" '
              f'stroke-width="1" stroke-dasharray="1.6 2" opacity=".65"/>'
              f'<path d="M{hx - sd * 1.5} 19.5Q{hx - sd * 4} 22 {hx - sd * 1.5} 25.5" fill="none" stroke="{col}" '
              f'stroke-width="1.6" stroke-linecap="round" opacity=".85"/>')
    return s


KID_CRACKS = ("M10.5 13L14 15L13 18.5L16.5 20.5M14 15L16.5 12.5", "M54 27L50.5 26L51.5 22.5L48 21",
              "M14.5 34.5L16.5 31L14 28.5L15.5 25.5", "M47 7L46.5 10.5L49.5 13L48.5 16")

# --- Heart: a stylised anatomical heart (not the HUD's emoji heart): apex down-left, aorta arch and pulmonary trunk on top.
HEART = smooth_closed([(12.5, 23), (16.5, 15.5), (24, 13), (32, 14.5), (40, 12.5), (47.5, 16), (50.5, 24.5), (47, 33),
                       (39, 40), (29.5, 45), (22, 44.5), (15, 37.5), (12, 30)])


def tube(d, col, w=5.2):
    """A vessel stub: a glowing outline with a dark core."""
    return stroke(d, col, w) + stroke(d, "#04050A", w - 2.6, ' opacity=".75"')


def heart_shape(fill, col, w):
    return (tube("M35 15C35 7 40 3.5 45 4C49.5 4.5 51 8 50 12.5", col) + tube("M19.5 15V5", col, 4.4) +
            tube("M28.5 14.5C28 10 25.5 7.5 22.5 6.5", col, 4) +
            f'<path d="{HEART}" fill="{fill}" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>'
            f'<path d="M38 14C35 22 31.5 32 25 44" fill="none" stroke="{col}" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>'
            f'<path d="M17 21Q14.5 26 16.5 31" fill="none" stroke="{col}" stroke-width="1" stroke-dasharray="1.6 2" opacity=".6"/>')


HEART_CRACKS = ("M25 13.5L26.5 18L24 21.5L26.5 26", "M50.5 25L46.5 26.5L47.5 30.5L44 32.5",
                "M13 31L17 32L16.5 36.5L19.5 38.5", "M44 14L44 18.5L41 21.5")

# --- Lungs: two lobes either side of the trachea and bronchi, alveoli speckled inside.
_lung_l = [(17, 7), (22, 9.5), (25.5, 16), (26.5, 26), (27.5, 38), (22.5, 42.5), (12, 42.5), (6.5, 36), (6.5, 24), (10, 13)]
LUNG_L, LUNG_R = smooth_closed(_lung_l), smooth_closed([(64 - x, y) for x, y in _lung_l])


def lungs_shape(fill, col, w):
    alv = "".join(f'<circle cx="{x}" cy="{y}" r="1.1" fill="{col}" opacity=".5"/>' for x0, y in
                  ((13, 18), (18, 24), (12, 30), (19, 35), (15, 38)) for x in (x0, 64 - x0))
    return (f'<path d="{LUNG_L}" fill="{fill}" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>'
            f'<path d="{LUNG_R}" fill="{fill}" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>' + alv +
            stroke("M32 1V15M32 15Q28 17 23 22M32 15Q36 17 41 22M24.5 20.5L19 27M39.5 20.5L45 27", col, 1.8))


LUNG_CRACKS = ("M7 22L11 23.5L10 27.5L13.5 29", "M57 31L53 30L54 26.5L51 25",
               "M17 42.5L18.5 38L16 35L18 31.5", "M45 8L44.5 12L47.5 14.5L46.5 18")

# --- Spleen: a curved fist with notches along the top edge and the hilum underneath; white-pulp dots inside
# (it is the body's immune filter, so its dots are the immune cyan while it is alive).
SPLEEN = smooth_closed([(9, 24), (13, 15), (20, 10), (24, 11.5), (28, 8), (37, 7.5), (41, 10), (45, 9), (52, 13),
                        (57, 20), (55.5, 28), (49, 33), (40, 37.5), (29, 40), (19, 39), (11.5, 33)])


def spleen_shape(fill, col, w):
    dead = col == P["dead"]
    pulp = "".join(f'<circle cx="{x}" cy="{y}" r="1.4" fill="{col if dead else P["cellHi"]}" opacity="{.45 if dead else .6}"/>'
                   for x, y in ((18, 22), (25, 17), (33, 14), (42, 15), (48, 21), (24, 29), (34, 24), (41, 28), (30, 33)))
    return (f'<path d="{SPLEEN}" fill="{fill}" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>' + pulp +
            stroke("M22 36Q32 33 43 31", col, 1.2, ' opacity=".7"') +
            stroke("M30 34.5L29 41M36 33L36.5 40", col, 1.4, ' opacity=".7"'))


SPLEEN_CRACKS = ("M28 8L29 13L26.5 16.5L29 20.5", "M57 21L52.5 22L53.5 26L50.5 27.5",
                 "M12 32L16 31L17.5 35", "M45 9L44 13L47 15.5L45.5 19")

# --- Brain: side view, cerebrum with folds, cerebellum tucked under the back, brainstem running down.
BRAIN = smooth_closed([(6, 27), (8, 17), (16, 9.5), (28, 5.5), (41, 6), (52, 11), (58, 19), (58, 26), (53, 31),
                       (44, 33), (34, 33.5), (24, 34), (14, 33.5)])


def brain_shape(fill, col, w):
    folds = ("M14 16C17 13 21 15 20 19S24 24 27 21", "M30 9C29 13 33 15 32 19S35 25 38 23", "M44 10C42 14 46 16 45 20",
             "M50 17C48 20 52 23 50 27", "M11 26C15 24 18 28 22 26S28 28 30 28", "M36 28C39 25 43 28 47 25")
    return (tube("M41 33C41 38 42 42 43 47", col, 4.6) +
            f'<ellipse cx="49" cy="36" rx="8" ry="5.5" fill="{fill}" stroke="{col}" stroke-width="{w * .8}"/>' +
            stroke("M43 36H55M44.5 39H53.5", col, .9, ' opacity=".6"') +
            f'<path d="{BRAIN}" fill="{fill}" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>' +
            "".join(stroke(d, col, 1.2, ' opacity=".7"') for d in folds))


BRAIN_CRACKS = ("M16 9.5L17.5 14L15 17.5L18 21", "M58 22L53.5 22.5L54.5 26.5L51 28.5",
                "M8 30L12 29L13.5 33", "M41 6L40 11L43 13.5L41.5 17.5")

STATE_NOTE = {
    "healthy": "Healthy (4 bars): a soft green glow.",
    "strained": "Strained (3 bars): dimmer green with one hairline crack.",
    "damaged": "Damaged (2 bars): amber, with cracks.",
    "failing": "Failing (1 bar): red and more cracked. Flicker it (alpha .55 to 1, a few times a second).",
    "failed": "Failed (0): grey and dark, no glow.",
}
STATE_CODE = {"healthy": "he", "strained": "st", "damaged": "da", "failing": "fg", "failed": "fd"}
ORGANS = (("liver", liver_shape, LIVER_CRACKS, "Liver"), ("kidneys", kidney_shape, KID_CRACKS, "Kidney pair"),
          ("heart", heart_shape, HEART_CRACKS, "Heart (the organ, not the fatigue meter)"),
          ("lungs", lungs_shape, LUNG_CRACKS, "Lungs"), ("spleen", spleen_shape, SPLEEN_CRACKS, "Spleen"),
          ("brain", brain_shape, BRAIN_CRACKS, "Brain"))
for organ, shape, cracks, word in ORGANS:
    for st in ORGAN_STATES:
        name = f"{organ}-{st[0]}"
        body, defs = organ_layers(organ[:3] + STATE_CODE[st[0]], shape, cracks, st)
        add(name, "organ", svg2(64, 48, body, defs), 64, 27,
            f"{word}, {STATE_NOTE[st[0]]} Sits in the vessel strip at the Lymph-node end; 64x48 box, centred.",
            box=[64, 48], anchor=[32, 24])

# --- Leak splat: an antigen hitting the vessel wall / its organ. Red burst with droplets, white core.
_spl = blob(32, 32, lambda t: 13 + 3.2 * math.sin(5 * t + .6) + 1.8 * math.sin(9 * t), 40)
_drops = "".join(f'<circle cx="{f(32 + d * math.cos(a))}" cy="{f(32 + d * math.sin(a))}" r="{r}" fill="{P["damage"]}"/>'
                 for a, d, r in ((.3, 22, 2.4), (1.4, 24, 1.6), (2.2, 21, 2), (3.3, 25, 1.4), (4.1, 22, 2.2), (5.2, 24, 1.7), (5.8, 20, 1.2)))
add("leak-splat", "effect", svg(64,
    f'<circle cx="32" cy="32" r="31" fill="url(#lks-h)"/>'
    f'<path d="{_spl}" fill="{P["damage"]}" fill-opacity=".4" stroke="{P["damage"]}" stroke-width="2" stroke-linejoin="round"/>'
    + _drops + f'<circle cx="32" cy="32" r="5.5" fill="url(#lks-c)"/>',
    halo("lks-h", P["damage"], .5, .14, .45) +
    f'<radialGradient id="lks-c"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFE1E5" stop-opacity="0"/></radialGradient>'),
    64, 16, "Leak splat: an antigen reached the vessel. Pop it on the organ it hit (scale 0.6 to 1.2 over ~0.3 s, then fade) with the organ flash and the \"-12%\".")

# --- Hepatitis: a virus (lilac family) like flu but distinct: a smooth double shell with short knobs
# instead of flu's stalked spikes, and a jaundice-yellow core. One hit kills; fast swarms of 6.
_knobs = "".join(f'<circle cx="{f(32 + 10.6 * math.cos(a))}" cy="{f(32 + 10.6 * math.sin(a))}" r="1.5"/>'
                 for a in [i * math.pi / 8 for i in range(16)])
add("hepatitis", "enemy", svg(64,
    f'<circle cx="32" cy="32" r="17" fill="url(#hep-h)"/>'
    f'<circle cx="32" cy="32" r="9.2" fill="url(#hep-b)" stroke="{P["virus"]}" stroke-width="1.6"/>'
    f'<g fill="{P["virusHi"]}">{_knobs}</g>'
    f'<circle cx="32" cy="32" r="5" fill="{P["jaundice"]}" stroke="#FFF6B0" stroke-width="1"/>'
    f'<circle cx="30.4" cy="30.4" r="1.5" fill="#FFFBE0"/>',
    halo("hep-h", P["jaundice"], .45, .14, .45) + body_grad("hep-b", P["virusHi"], P["virus"], .45, .2)),
    64, 11, "Hepatitis (virus, liver leaker): a lilac shell with short knobs around a jaundice-yellow core. Flu's cousin, but rounder and yellow-hearted. "
            "Fast swarms of 6, one hit kills, heads for the vessel to hurt the liver.")

# --- E. coli: a longer magenta rod with wavy flagella all round and violet LPS speckles (endotoxin when shot).
def ecoli_flagella(x0, x1):
    s = ""
    for (x, y, dx, dy) in ((x0 + 3, 26.5, -1, -1), (x0 + 3, 37.5, -1, 1), (x1 - 3, 26.5, 1, -1), (x1 - 3, 37.5, 1, 1),
                           ((x0 + x1) / 2, 26, 0, -1), ((x0 + x1) / 2, 38, 0, 1)):
        ex, ey = x + dx * 7 + (2 if dx == 0 else 0), y + dy * 8
        mx, my = (x + ex) / 2, (y + ey) / 2
        s += f"M{f(x)} {f(y)}Q{f(mx + 3.5)} {f(my - (2 if dy < 0 else -2))} {f(mx)} {f(my)}T{f(ex)} {f(ey)}"
    return s


def lps(x0, x1):
    return "".join(f'<circle cx="{f(x)}" cy="{y}" r=".95" fill="{P["toxin"]}"/>'
                   for i, x in enumerate([x0 + 4 + k * (x1 - x0 - 8) / 5 for k in range(6)]) for y in ((26.6 if i % 2 else 37.4),))


add("e-coli", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="28" ry="18" fill="url(#eco-h)"/>' +
    stroke(ecoli_flagella(16, 48), "#FF7FDD", .9, ' opacity=".75"') +
    rod(32, 32, 32, 11, "eco", "eco-b", "#FF7FDD") + nucleoid(27, 32, 14) + nucleoid(37, 32, 14) + lps(16, 48),
    bact_defs("eco")),
    64, 11, "E. coli (bacterium, kidney leaker): a long magenta rod with wavy flagella and violet speckles (the endotoxin it dumps when shot). "
            "Takes 2 hits; swallowing it is the clean answer. Faces +x; rotate to heading.")
add("e-coli-dividing", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="30" ry="18" fill="url(#ecd-h)"/>' +
    stroke(ecoli_flagella(12, 52), "#FF7FDD", .9, ' opacity=".75"') +
    rod(22, 32, 20, 11, "ecd", "ecd-b", "#FF7FDD") + rod(42, 32, 20, 11, "ecd", "ecd-b", "#FF7FDD") +
    f'<line x1="32" y1="26" x2="32" y2="38" stroke="{P["germHi"]}" stroke-width="2.2" stroke-linecap="round"/>' +
    nucleoid(22, 32, 14) + nucleoid(42, 32, 14) + lps(12, 52),
    bact_defs("ecd")),
    64, 12, "E. coli about to divide (every 20 s): pinched in two with a bright seam. Blink between this and e-coli for the last ~1 s before the split.")

# --- Rabies (brain leaker): the bullet-shaped virus. Lilac like the other viruses, but a bullet with cross-bands
# (its coiled insides) and a fringe of knobs. Rounded nose faces +x.
def rabies_body(x0, x1, pfx, ghost=False):
    d = f"M{x0} 26.5H{x1 - 5.5}A5.5 5.5 0 0 1 {x1 - 5.5} 37.5H{x0}Z"
    knobs = "".join(f'<circle cx="{f(x)}" cy="{y}" r="1.15"/>' for x in [x0 + 1.5 + i * 3 for i in range(int((x1 - x0 - 4) / 3))]
                    for y in (24.2, 39.8))
    knobs += "".join(f'<circle cx="{f(x1 - 5.5 + 7.8 * math.cos(a))}" cy="{f(32 + 7.8 * math.sin(a))}" r="1.15"/>'
                     for a in (-1.1, -.55, 0, .55, 1.1))
    bands = "".join(f'<line x1="{f(x)}" y1="28" x2="{f(x)}" y2="36"/>' for x in [x0 + 2.5 + i * 2.6 for i in range(int((x1 - x0 - 6) / 2.6))])
    op = ' opacity=".55"' if ghost else ""
    return (f'<g{op}><g fill="{P["virusHi"]}">{knobs}</g>'
            f'<path d="{d}" fill="url(#{pfx}-b)" stroke="{P["virusHi"]}" stroke-width="1.4" stroke-linejoin="round"/>'
            f'<g stroke="{P["virus"]}" stroke-width="1" stroke-linecap="round" opacity=".9">{bands}</g></g>')


add("rabies", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="22" ry="15" fill="url(#rab-h)"/>' + rabies_body(18, 47, "rab"),
    halo("rab-h", P["virus"], .5, .14, .45) + body_grad("rab-b", P["virusHi"], P["virus"], .65, .3)),
    64, 11, "Rabies (virus, brain leaker): a lilac bullet with cross-bands and a fringe of knobs. "
            "Unlike flu's spiky ball, herpes' hexagon and hepatitis' yellow core. Rounded nose faces +x; rotate to heading.")
add("rabies-budding", "enemy", svg(64,
    f'<ellipse cx="32" cy="32" rx="28" ry="15" fill="url(#rbb-h)"/>' + rabies_body(5, 27, "rbb", ghost=True) +
    rabies_body(30, 59, "rbb") +
    f'<line x1="28.5" y1="26" x2="28.5" y2="38" stroke="{P["virusHi"]}" stroke-width="2.2" stroke-linecap="round"/>',
    halo("rbb-h", P["virus"], .5, .14, .45) + body_grad("rbb-b", P["virusHi"], P["virus"], .65, .3)),
    64, 13, "Rabies reproducing: a fainter new bullet budding off its tail, with a bright seam. "
            "Blink between this and rabies for the last ~1 s before the copy splits off.")

for name, col, scale in (("hepatitis", P["jaundice"], 1.6), ("e-coli", P["germ"], 1.15), ("rabies", P["virus"], 1.25)):
    s = 24 * scale
    off = 12 - s / 2
    marker(f"marker-{name}",
           f'<circle cx="12" cy="12" r="11" fill="#04050A" stroke="{col}" stroke-width="1.4"/>'
           f'<clipPath id="mk{name}-c"><circle cx="12" cy="12" r="10"/></clipPath>'
           f'<g clip-path="url(#mk{name}-c)"><svg x="{f(off)}" y="{f(off)}" width="{f(s)}" height="{f(s)}" viewBox="0 0 64 64">{inner(name)}</svg></g>',
           f"Progress bar: a wave with {name} in it. Use as kind '{name}' in ART.drawProgress.")

# Organs: worldR 19 makes them about 45 x 34 world units, so each fits the v2/v3 vessel strip (44 wide) side by side.
for _n, _r in {"hepatitis": 4, "rabies": 4.5, "rabies-budding": 5.3, "e-coli": 6.5, "e-coli-dividing": 7.3, "leak-splat": 10,
               **{f"{o}-{s[0]}": 19 for o, *_ in ORGANS for s in ORGAN_STATES}}.items():
    ASSETS[_n]["worldR"] = _r

# ---- write ----
os.makedirs(OUT, exist_ok=True)
for name, a in ASSETS.items():
    with open(os.path.join(OUT, name + ".svg"), "w") as fh:
        fh.write(a["svg"] + "\n")

meta = {k: {kk: vv for kk, vv in v.items() if kk != "svg"} for k, v in ASSETS.items()}
with open(os.path.join(OUT, "assets.js"), "w") as fh:
    fh.write("// Immune RTS prototype art. Generated; edit gen.py, not this file.\n")
    fh.write("// Usage: const img = await ART.load('neutrophil'); ctx.drawImage(img, x - s/2, y - s/2, s, s)\n")
    fh.write("// Map sprites share a 64x64 box centred on the cell; `radius` is the body radius in those units.\n")
    fh.write("// Non-square sprites (shots, trails) give meta.box [w,h] and meta.anchor [x,y]: put the anchor on the object and rotate to its heading.\n")
    fh.write("// Draw cells and fields with ctx.globalCompositeOperation = 'lighter' for the fluorescence look.\n")
    fh.write("const ART = {\n")
    fh.write("  palette: " + json.dumps(P) + ",\n")
    fh.write("  alert: " + json.dumps(ALERT) + ",\n")
    fh.write("  meta: " + json.dumps(meta, indent=None) + ",\n")
    fh.write("  svg: {\n")
    for name, a in ASSETS.items():
        fh.write(f"    {json.dumps(name)}: {json.dumps(a['svg'])},\n")
    fh.write("  },\n")
    fh.write("""  _img: {},
  ready: {},  // name -> loaded <img>, filled in as loads finish (the draw helpers below read it)
  // Resolves to an <img> you can drawImage(). Cached per name.
  load(name) {
    if (!this._img[name]) this._img[name] = new Promise((ok, err) => {
      const i = new Image();
      i.onload = () => { this.ready[name] = i; ok(i); }; i.onerror = err;
      i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(this.svg[name]);
    });
    return this._img[name];
  },
  loadAll() {
    return Promise.all(Object.keys(this.svg).map(n => this.load(n))).then(() => this);
  },
  // Pre-render a sprite to an offscreen canvas at a fixed pixel size (fast to blit hundreds of times).
  async sprite(name, px) {
    const img = await this.load(name), c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px * (window.devicePixelRatio || 1));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  },
  // ---- v2 HUD helpers (call after loadAll) ----
  // Lymph node infection timer: a ring that fills red clockwise from 12 o'clock.
  // frac 0..1; beating = bacteria inside the node (adds a double-thump heartbeat); t = seconds, for the pulse.
  drawTimer(ctx, x, y, r, frac, { beating = false, t = 0 } = {}) {
    const red = this.palette.damage, k = beating ? 1 + 0.08 * this._beat(t) : 1, R = r * k;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, r * 0.22);
    ctx.strokeStyle = 'rgba(255,59,78,0.18)';
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = 'rgba(255,59,78,0.45)';
    for (let i = 0; i < 12; i++) {           // tick marks every 1/12
      const a = i / 12 * Math.PI * 2 - Math.PI / 2, i0 = R - r * 0.42, i1 = R - r * 0.3;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * i0, y + Math.sin(a) * i0); ctx.lineTo(x + Math.cos(a) * i1, y + Math.sin(a) * i1); ctx.stroke();
    }
    if (frac > 0) {
      const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * Math.min(1, frac);
      ctx.strokeStyle = red; ctx.lineWidth = Math.max(3, r * 0.22);
      ctx.shadowColor = red; ctx.shadowBlur = r * (beating ? 0.9 : 0.5);
      ctx.beginPath(); ctx.arc(x, y, R, a0, a1); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = '#FFE1E5';
      ctx.beginPath(); ctx.arc(x + Math.cos(a1) * R, y + Math.sin(a1) * R, Math.max(1.5, r * 0.09), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  _beat(t) {  // lub-dub at ~70 bpm, 0..1
    const p = (t * 70 / 60) % 1, b = (c, w) => Math.exp(-(((p - c) / w) ** 2));
    return Math.max(b(0.05, 0.05), 0.6 * b(0.25, 0.05));
  },
  // Level progress bar. frac 0..1; events = [{at: 0..1, kind: 'wave'|'wave-armored'|'wave-final'|'toxin'}].
  // Events already passed dim out; the next one glows.
  drawProgress(ctx, x, y, w, h, frac, events = []) {
    ctx.save();
    const r = h / 2, f = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = 'rgba(221,230,245,0.08)'; ctx.strokeStyle = 'rgba(221,230,245,0.3)'; ctx.lineWidth = 1;
    this._pill(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke();
    if (f > 0) {
      const g = ctx.createLinearGradient(x, 0, x + w * f, 0);
      g.addColorStop(0, 'rgba(63,230,255,0.15)'); g.addColorStop(1, 'rgba(63,230,255,0.55)');
      ctx.fillStyle = g; this._pill(ctx, x, y, Math.max(h, w * f), h, r); ctx.fill();
      ctx.fillStyle = this.palette.cellHi; ctx.fillRect(x + w * f - 1, y - 2, 2, h + 4);
    }
    const next = events.filter(e => e.at > f).sort((a, b) => a.at - b.at)[0];
    for (const e of events) {
      const img = this.ready['marker-' + e.kind]; if (!img) continue;
      const s = h * (e.kind === 'wave-final' ? 2.6 : 2.1) * (e === next ? 1.15 : 1);
      ctx.globalAlpha = e.at <= f ? 0.25 : 1;
      ctx.drawImage(img, x + w * e.at - s / 2, y + h / 2 - s / 2, s, s);
    }
    ctx.restore();
  },
  // ---- v2 round 2: body output and fatigue ----
  fatigueColors: { fine: '#7F8FB0', tired: '#FFD23F', feverish: '#FF7A3D', exhausted: '#FF3B4E' },
  _fm: 0,
  // Fatigue meter as an inline SVG string for the DOM HUD: el.innerHTML = ART.fatigueMeterSVG(g.fatigue, CONFIG.fatigue).
  // Faint bands preview each tier; the fill takes the colour of the band it has reached; a bright edge marks "now".
  // Storm options: { ghost: 50, burn: 16 } while the storm button is held draws where fatigue would land:
  // a hatched bar for the instant cost, then a fading band for the afterburn's range. It turns red where it reaches 100.
  // { burning: true } during the afterburn outlines the meter in red.
  fatigueMeterSVG(fatigue, tiers = { tired: 35, feverish: 60, exhausted: 85 }, h = 10, opts = {}) {
    const id = 'fm' + (this._fm++ % 1000), c = this.fatigueColors, f = Math.max(0, Math.min(100, fatigue));
    const t1 = tiers.tired, t2 = tiers.feverish, t3 = tiers.exhausted, r = h / 2;
    const band = (a, b, col, op) => `<rect x="${a}" y="0" width="${b - a}" height="${h}" fill="${col}" fill-opacity="${op}"/>`;
    const tick = x => `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#04050A" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="Fatigue ${Math.round(f)} of 100">`
      + `<defs><clipPath id="${id}c"><rect width="100" height="${h}" rx="${r}" ry="${r}"/></clipPath>`
      + `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">`
      + `<stop offset="${t1 * .8 / 100}" stop-color="${c.fine}"/><stop offset="${t1 / 100}" stop-color="${c.tired}"/>`
      + `<stop offset="${t2 / 100}" stop-color="${c.feverish}"/><stop offset="${t3 / 100}" stop-color="${c.exhausted}"/></linearGradient></defs>`
      + `<g clip-path="url(#${id}c)">${band(0, t1, c.fine, .1)}${band(t1, t2, c.tired, .14)}${band(t2, t3, c.feverish, .17)}${band(t3, 100, c.exhausted, .22)}`
      + (f > 0.5 ? `<rect width="${f}" height="${h}" fill="url(#${id}g)"/><rect x="${Math.max(0, f - .8)}" width=".8" height="${h}" fill="#FFFFFF" fill-opacity=".9"/>` : '')
      + this._ghost(id, f, h, opts)
      + `${tick(t1)}${tick(t2)}${tick(t3)}</g>`
      + (opts.burning ? `<rect x=".5" y=".5" width="99" height="${h - 1}" rx="${r}" ry="${r}" fill="none" stroke="#FF3B4E" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : '')
      + `</svg>`;
  },
  _ghost(id, f, h, { ghost = 0, burn = 0 } = {}) {
    if (!ghost) return '';
    const g0 = Math.min(100, f + ghost), g1 = Math.min(100, f + ghost + burn), certain = f + ghost >= 100, gamble = f + ghost + burn >= 100;
    const col = certain ? '#FF3B4E' : '#FFFFFF', col2 = gamble ? '#FF3B4E' : '#FFFFFF';
    return `<defs><pattern id="${id}p" width="3" height="${h}" patternUnits="userSpaceOnUse" patternTransform="skewX(-35)">`
      + `<rect width="1.4" height="${h}" fill="${col}"/></pattern>`
      + `<pattern id="${id}q" width="3" height="${h}" patternUnits="userSpaceOnUse" patternTransform="skewX(-35)"><rect width="1.4" height="${h}" fill="${col2}"/></pattern>`
      + `<linearGradient id="${id}f" gradientUnits="userSpaceOnUse" x1="${g0}" x2="${Math.max(g1, g0 + .1)}" y1="0" y2="0">`
      + `<stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity=".15"/></linearGradient>`
      + `<mask id="${id}m"><rect x="${g0}" width="${g1 - g0}" height="${h}" fill="url(#${id}f)"/></mask></defs>`
      + `<rect x="${f}" width="${g0 - f}" height="${h}" fill="${col}" fill-opacity="${certain ? .3 : .16}"/>`
      + `<rect x="${f}" width="${g0 - f}" height="${h}" fill="url(#${id}p)" fill-opacity=".7"/>`
      + `<rect x="${g0}" width="${g1 - g0}" height="${h}" fill="url(#${id}q)" fill-opacity=".6" mask="url(#${id}m)"/>`
      + `<rect x="${g0 - .6}" width=".6" height="${h}" fill="${col}"/>`
      + (gamble ? `<rect x="99" width="1" height="${h}" fill="#FF3B4E"/>` : '');
  },
  // ---- cytokine storm ----
  // Full-screen storm effect in view space, drawn last with source-over.
  // phase 'windup' (1 s): red flush rises, the storm-wave rolls out from (ox, oy), the marrow side.
  // phase 'hit' (~0.4 s): magenta-white flash that fades. phase 'afterburn' (8 s): fast red edge pulse, easing as p -> 1.
  // p = 0..1 progress through the phase; t = seconds (for pulses).
  drawStorm(ctx, w, h, { phase, p = 0, t = 0, ox = w / 2, oy = h } = {}) {
    ctx.save();
    if (phase === 'windup') {
      ctx.fillStyle = `rgba(255,59,78,${0.32 * p})`; ctx.fillRect(0, 0, w, h);
      const img = this.ready['storm-wave'], R = p * Math.hypot(w, h);
      if (img && R > 1) { const s = R * 256 / 120; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - 0.4 * p; ctx.drawImage(img, ox - s / 2, oy - s / 2, s, s); }
    } else if (phase === 'hit') {
      const k = 1 - p, g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, `rgba(255,236,246,${0.9 * k})`); g.addColorStop(0.5, `rgba(255,61,203,${0.75 * k})`); g.addColorStop(1, `rgba(255,59,78,${0.85 * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    } else if (phase === 'afterburn') {
      const a = (0.22 + 0.16 * (0.5 + 0.5 * Math.sin(t * Math.PI * 4))) * (1 - 0.6 * p), d = Math.min(w, h) * 0.18;
      const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, `rgba(255,59,78,${a})`); g.addColorStop(0.5, `rgba(255,61,203,${a * 0.3})`); g.addColorStop(1, 'rgba(255,61,203,0)');
        ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
      };
      edge(0, 0, 0, d, 0, 0, w, d); edge(0, h, 0, h - d, 0, h - d, w, d); edge(0, 0, d, 0, 0, 0, d, h); edge(w, 0, w - d, 0, w - d, 0, d, h);
    }
    ctx.restore();
  },
  // Collapse when fatigue hits 100 during a storm. p = 0..1 over ~2 s, then show the loss screen with the organ-failure emblem.
  // A red flash, then the field drains dark while the edges beat slower and stop.
  drawCollapse(ctx, w, h, p) {
    ctx.save();
    const flash = Math.max(0, 1 - p / 0.15);
    ctx.fillStyle = `rgba(4,5,10,${Math.min(0.82, p * 1.1)})`; ctx.fillRect(0, 0, w, h);
    if (flash > 0) { ctx.fillStyle = `rgba(255,59,78,${0.6 * flash})`; ctx.fillRect(0, 0, w, h); }
    const beats = [0.25, 0.5, 0.8], beat = beats.reduce((m, b) => Math.max(m, Math.exp(-(((p - b) / 0.04) ** 2))), 0) * (1 - p * 0.6);
    if (beat > 0.01) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.65);
      g.addColorStop(0, 'rgba(255,59,78,0)'); g.addColorStop(1, `rgba(255,59,78,${0.55 * beat})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  },
  // Background for the Body output slider track: cool up to the sustainable point, heating past it.
  // restFrac = where the rest multiplier sits on the slider (0..1), e.g. log(rest/min)/log(max/min).
  outputTrackCSS(restFrac) {
    const p = Math.round(restFrac * 100);
    return `linear-gradient(90deg, rgba(63,230,255,.15) 0%, rgba(63,230,255,.45) ${p}%, #FFD23F ${p}%, #FF7A3D ${Math.round(p + (100 - p) * .5)}%, #FF3B4E 100%)`;
  },
  // Screen-edge glow for Feverish (tier 2) and Exhausted (tier 3). Call last, in view space, with source-over.
  // Feverish: warm orange edges that breathe. Exhausted: thicker red edges with a slow, tired heartbeat and a slight dim.
  drawFatigueEdge(ctx, w, h, tier, t) {
    if (tier < 2) return;
    const ex = tier >= 3, base = Math.min(w, h), d = base * (ex ? 0.2 : 0.16);
    const rgb = ex ? '255,59,78' : '255,122,61';
    const a = ex ? 0.24 + 0.18 * this._beat(t * 50 / 70) : 0.20 + 0.08 * Math.sin(t * Math.PI);
    ctx.save();
    if (ex) { ctx.fillStyle = 'rgba(4,5,10,0.1)'; ctx.fillRect(0, 0, w, h); }
    const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
    };
    edge(0, 0, 0, d, 0, 0, w, d); edge(0, h, 0, h - d, 0, h - d, w, d);
    edge(0, 0, d, 0, 0, 0, d, h); edge(w, 0, w - d, 0, w - d, 0, d, h);
    ctx.restore();
  },
  _pill(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  },
};
if (typeof module !== 'undefined') module.exports = ART;
""")
print(len(ASSETS), "assets ->", OUT)
