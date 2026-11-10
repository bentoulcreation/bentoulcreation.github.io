# -*- coding: utf-8 -*-
"""Génère 4 cartes de partage Open Graph 1200x630 dans image/."""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
OUT = "image"
os.makedirs(OUT, exist_ok=True)
BD = "C:/Windows/Fonts/arialbd.ttf"
RG = "C:/Windows/Fonts/arial.ttf"

def F(p, s): return ImageFont.truetype(p, s)
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def stop_color(stops, t):
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]; p1, c1 = stops[i + 1]
        if p0 <= t <= p1:
            lt = (t - p0) / (p1 - p0) if p1 > p0 else 0
            return lerp(c0, c1, lt)
    return stops[-1][1]

def gradient(stops):
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=stop_color(stops, y / (H - 1)) + (255,))
    return img

def glow(base, cx, cy, r, color, alpha=110, blur=90):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))

def grid(base, color=(255, 255, 255), alpha=14, step=44):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x in range(0, W, step):
        d.line([(x, 0), (x, H)], fill=color + (alpha,), width=1)
    for y in range(0, H, step):
        d.line([(0, y), (W, y)], fill=color + (alpha,), width=1)
    base.alpha_composite(layer)

def bokeh(base, color, alpha=70):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    pts = [(980, 120, 26), (1080, 240, 16), (900, 470, 20), (1120, 430, 30), (820, 180, 12), (1040, 520, 14)]
    for x, y, r in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=color + (alpha,))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(6)))

def shadow_text(d, xy, text, f, fill=(255, 255, 255), anchor=None):
    d.text(xy, text, font=f, fill=fill, anchor=anchor)

def wrap(d, text, f, maxw):
    lines, cur = [], ""
    for w in text.split():
        test = (cur + " " + w).strip()
        if d.textlength(test, font=f) <= maxw or not cur:
            cur = test
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def pill(base, x, y, text, f, fg=(255, 255, 255)):
    d = ImageDraw.Draw(base)
    tw = d.textlength(text, font=f)
    th = f.size + 4
    box = [x, y, x + tw + 32, y + th + 18]
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle(box, radius=(th + 18) // 2, fill=(255, 255, 255, 46), outline=(255, 255, 255, 110), width=1)
    base.alpha_composite(layer)
    d = ImageDraw.Draw(base)
    d.text((x + 16, y + 8), text, font=f, fill=fg)
    return th + 18

def device_shadow(base, box, r=18):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([box[0] + 6, box[1] + 12, box[2] + 6, box[3] + 12], radius=r, fill=(0, 0, 0, 110))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(12)))

# ---------- Icônes ----------
def icon_home(base):
    d = ImageDraw.Draw(base)
    cx, cy = 905, 300
    glow(base, cx, cy, 210, (56, 189, 248), 90, 70)
    d = ImageDraw.Draw(base)
    # laptop
    scr = [cx - 165, cy - 105, cx + 70, cy + 45]
    device_shadow(base, scr); d = ImageDraw.Draw(base)
    d.rounded_rectangle(scr, radius=14, fill=(9, 22, 66), outline=(120, 200, 255), width=3)
    d.rounded_rectangle([scr[0] + 12, scr[1] + 12, scr[2] - 12, scr[3] - 12], radius=8, fill=(20, 60, 150))
    d.polygon([(cx - 70, cy - 55), (cx - 70, cy + 5), (cx - 25, cy - 25)], fill=(255, 255, 255))
    d.polygon([(cx - 165, cy + 45), (cx + 70, cy + 45), (cx + 95, cy + 70), (cx - 190, cy + 70)], fill=(150, 190, 240))
    # phone
    ph = [cx + 95, cy - 55, cx + 180, cy + 120]
    device_shadow(base, ph, 16); d = ImageDraw.Draw(base)
    d.rounded_rectangle(ph, radius=16, fill=(9, 22, 66), outline=(120, 200, 255), width=3)
    d.rounded_rectangle([ph[0] + 9, ph[1] + 16, ph[2] - 9, ph[3] - 16], radius=8, fill=(37, 99, 235))
    d.rounded_rectangle([cx + 122, cy - 47, cx + 152, cy - 42], radius=3, fill=(120, 200, 255))
    d.text((cx + 112, cy + 20), "</>", font=F(BD, 30), fill=(255, 255, 255))
    # sparks
    for sx, sy in [(cx - 200, cy - 130), (cx + 200, cy - 90), (cx + 150, cy + 160)]:
        d.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], fill=(180, 230, 255))

def icon_services(base):
    d = ImageDraw.Draw(base)
    cx, cy = 905, 300
    glow(base, cx, cy, 200, (245, 158, 11), 80, 70)
    d = ImageDraw.Draw(base)
    # back doc
    d.rounded_rectangle([cx - 120, cy - 130, cx + 70, cy + 120], radius=14, fill=(214, 226, 244))
    # front doc
    box = [cx - 150, cy - 110, cx + 60, cy + 140]
    device_shadow(base, box); d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=14, fill=(248, 250, 255))
    d.rounded_rectangle([cx - 128, cy - 86, cx - 40, cy - 66], radius=6, fill=(37, 99, 235))
    for i, yy in enumerate([cy - 40, cy - 6, cy + 28]):
        d.rounded_rectangle([cx - 128, yy, cx - 112, yy + 16], radius=4, fill=(245, 158, 11) if i == 1 else (148, 163, 184))
        d.line([(cx - 100, yy + 8), (cx + 30, yy + 8)], fill=(203, 213, 225), width=6)
        if i == 1:
            d.line([(cx - 126, yy + 8), (cx - 121, yy + 13), (cx - 113, yy + 3)], fill=(255, 255, 255), width=3)
    d.rounded_rectangle([cx - 128, cy + 66, cx - 20, cy + 98], radius=8, fill=(37, 99, 235))
    d.text((cx - 116, cy + 72), "Envoyer", font=F(BD, 18), fill=(255, 255, 255))
    # chat bubble
    bb = [cx + 70, cy - 150, cx + 210, cy - 70]
    d.rounded_rectangle(bb, radius=16, fill=(22, 163, 74))
    d.polygon([(cx + 95, cy - 72), (cx + 120, cy - 72), (cx + 98, cy - 50)], fill=(22, 163, 74))
    for yy in [cy - 128, cy - 108, cy - 88]:
        d.line([(cx + 88, yy), (cx + 192, yy)], fill=(255, 255, 255), width=5)

def icon_bentoul(base):
    d = ImageDraw.Draw(base)
    cx, cy = 905, 320
    glow(base, cx, cy - 120, 170, (34, 211, 238), 120, 60)
    d = ImageDraw.Draw(base)
    # lightbulb
    bx, by = cx, cy - 130
    d.ellipse([bx - 62, by - 62, bx + 62, by + 62], fill=(255, 244, 214), outline=(255, 255, 255), width=3)
    d.arc([bx - 40, by - 40, bx + 40, by + 40], 200, 340, fill=(245, 158, 11), width=5)
    d.line([(bx - 14, by + 10), (bx, by + 30), (bx + 14, by + 10)], fill=(245, 158, 11), width=5)
    d.rounded_rectangle([bx - 26, by + 58, bx + 26, by + 82], radius=6, fill=(148, 163, 184))
    d.rounded_rectangle([bx - 20, by + 82, bx + 20, by + 96], radius=5, fill=(100, 116, 139))
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        x1, y1 = bx + math.cos(a) * 78, by + math.sin(a) * 78
        x2, y2 = bx + math.cos(a) * 96, by + math.sin(a) * 96
        d.line([(x1, y1), (x2, y2)], fill=(180, 240, 255), width=4)
    # keyboard
    kb = [cx - 175, cy + 30, cx + 60, cy + 130]
    device_shadow(base, kb); d = ImageDraw.Draw(base)
    d.rounded_rectangle(kb, radius=12, fill=(9, 22, 66), outline=(120, 200, 255), width=3)
    for r in range(3):
        for c in range(7):
            kx = cx - 160 + c * 31; ky = cy + 44 + r * 28
            d.rounded_rectangle([kx, ky, kx + 24, ky + 20], radius=4, fill=(37, 99, 235) if (r + c) % 3 else (56, 189, 248))
    # phone
    ph = [cx + 80, cy + 20, cx + 165, cy + 150]
    device_shadow(base, ph, 16); d = ImageDraw.Draw(base)
    d.rounded_rectangle(ph, radius=16, fill=(9, 22, 66), outline=(120, 200, 255), width=3)
    d.rounded_rectangle([ph[0] + 9, ph[1] + 16, ph[2] - 9, ph[3] - 16], radius=8, fill=(34, 211, 238))

def heart(d, cx, cy, s, color):
    d.polygon([(cx, cy + s * 0.9), (cx - s, cy - s * 0.1), (cx - s * 0.5, cy - s * 0.8),
               (cx, cy - s * 0.35), (cx + s * 0.5, cy - s * 0.8), (cx + s, cy - s * 0.1)], fill=color)
    d.ellipse([cx - s, cy - s * 0.95, cx, cy + s * 0.05], fill=color)
    d.ellipse([cx, cy - s * 0.95, cx + s, cy + s * 0.05], fill=color)

def icon_benamoura(base):
    d = ImageDraw.Draw(base)
    cx, cy = 905, 320
    glow(base, cx, cy - 60, 200, (247, 178, 103), 100, 70)
    d = ImageDraw.Draw(base)
    # open book
    bk = [cx - 165, cy - 20, cx + 120, cy + 140]
    device_shadow(base, bk); d = ImageDraw.Draw(base)
    d.polygon([(cx - 160, cy - 10), (cx - 20, cy - 40), (cx - 20, cy + 120), (cx - 160, cy + 140)], fill=(255, 248, 240))
    d.polygon([(cx + 120, cy - 10), (cx - 20, cy - 40), (cx - 20, cy + 120), (cx + 120, cy + 140)], fill=(255, 236, 224))
    d.line([(cx - 20, cy - 40), (cx - 20, cy + 120)], fill=(214, 51, 108), width=4)
    for i in range(4):
        yy = cy + 10 + i * 26
        d.line([(cx - 140, yy - i * 3), (cx - 40, yy - 12 - i * 3)], fill=(226, 190, 175), width=4)
        d.line([(cx + 0, yy - 12 - i * 3), (cx + 100, yy - i * 3)], fill=(226, 190, 175), width=4)
    # heart rising
    heart(d, cx - 20, cy - 110, 52, (214, 51, 108))
    heart(d, cx - 20, cy - 110, 30, (255, 120, 160))
    # chat bubbles
    d.rounded_rectangle([cx + 90, cy - 150, cx + 215, cy - 88], radius=16, fill=(255, 255, 255))
    d.polygon([(cx + 110, cy - 90), (cx + 135, cy - 90), (cx + 112, cy - 66)], fill=(255, 255, 255))
    heart(d, cx + 152, cy - 120, 16, (214, 51, 108))
    d.rounded_rectangle([cx - 215, cy - 150, cx - 105, cy - 96], radius=14, fill=(255, 255, 255, 230))
    for yy in [cy - 132, cy - 116]:
        d.line([(cx - 198, yy), (cx - 122, yy)], fill=(214, 51, 108), width=4)

CARDS = [
    dict(name="home", stops=[(0, (11, 31, 107)), (0.55, (37, 99, 235)), (1, (56, 189, 248))],
         glowc=(56, 189, 248), title="BENTOUL CREATION", sub="Apprenez l'informatique à domicile",
         tag="PC • Android • Astuces", icon=icon_home, texture="grid"),
    dict(name="services", stops=[(0, (11, 31, 107)), (0.6, (37, 99, 235)), (1, (29, 78, 216))],
         glowc=(245, 158, 11), title="CRÉATION FORMULAIRE", sub="Formulaires personnalisés • Business & École",
         tag="Séminaire • Commande • Rendez-vous", icon=icon_services, texture="grid"),
    dict(name="bentoul", stops=[(0, (7, 26, 77)), (0.55, (37, 99, 235)), (1, (34, 211, 238))],
         glowc=(34, 211, 238), title="BENTOUL", sub="Astuces informatique PC & Android",
         tag="Bien utiliser vos appareils", icon=icon_bentoul, texture="grid"),
    dict(name="benamoura", stops=[(0, (59, 13, 63)), (0.55, (214, 51, 108)), (1, (247, 178, 103))],
         glowc=(247, 178, 103), title="BENAMOURA", sub="Histoires & SMS en série",
         tag="Grandir en paix & en conscience", icon=icon_benamoura, texture="bokeh"),
]

def build(c):
    img = gradient(c["stops"])
    glow(img, 250, 90, 260, c["glowc"], 70, 110)
    glow(img, 1050, 560, 300, c["glowc"], 60, 120)
    if c["texture"] == "grid":
        grid(img)
    else:
        bokeh(img, (255, 220, 235), 60)
    c["icon"](img)
    # voile dégradé gauche pour lisibilité du texte
    veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)
    for x in range(0, 720):
        a = int(70 * (1 - x / 720))
        vd.line([(x, 0), (x, H)], fill=(4, 12, 40, a))
    img.alpha_composite(veil)
    d = ImageDraw.Draw(img)
    # titre
    tf = F(BD, 66)
    lines = wrap(d, c["title"], tf, 600)
    while len(lines) > 2 and tf.size > 40:
        tf = F(BD, tf.size - 6); lines = wrap(d, c["title"], tf, 600)
    y = 188
    d.rounded_rectangle([80, y - 26, 132, y - 18], radius=4, fill=c["glowc"] + (255,))
    for ln in lines:
        shadow_text(d, (80, y), ln, tf)
        y += tf.size + 10
    # sous-titre
    sf = F(RG, 28)
    y += 12
    for ln in wrap(d, c["sub"], sf, 580):
        shadow_text(d, (82, y), ln, sf, fill=(233, 240, 255))
        y += 38
    # pill
    y += 16
    pill(img, 80, y, c["tag"], F(BD, 20))
    # coin marque
    d.text((W - 80, H - 46), "bentoulcreation", font=F(RG, 18), fill=(255, 255, 255, 150), anchor="rm")
    img.convert("RGB").save(os.path.join(OUT, c["name"] + ".jpg"), quality=90, optimize=True)
    print("OK", c["name"], os.path.getsize(os.path.join(OUT, c["name"] + ".jpg")), "bytes")

for c in CARDS:
    build(c)
print("done")