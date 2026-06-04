from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance
import math, random

BASE = Path(__file__).resolve().parents[1]
ROADS = BASE / 'assets/image2-clean/roads'
OUT = ROADS
TYPES = ['stone','dirt','grass','wood']
CAMERAS = ['isometric','topdown']
SHAPES = ['straight-x','straight-y','corner','cross']
COLORS = {
    'stone': {'base':(145,146,142), 'edge':(96,98,96), 'hi':(190,190,184), 'lo':(104,106,103)},
    'dirt':  {'base':(181,126,62),  'edge':(116,77,38),  'hi':(218,164,88),  'lo':(133,86,43)},
    'grass': {'base':(91,154,54),   'edge':(50,104,40),   'hi':(145,198,82),  'lo':(82,116,43), 'path':(187,133,67)},
    'wood':  {'base':(159,100,50),  'edge':(97,59,31),    'hi':(199,135,69),  'lo':(113,70,37)},
}
random.seed(7)

def rgba(size=(256,256)): return Image.new('RGBA', size, (0,0,0,0))

def draw_shadow(img, mask, offset=(0,4), blur=5, alpha=95):
    sh = Image.new('RGBA', img.size, (0,0,0,0))
    sm = mask.filter(ImageFilter.GaussianBlur(blur))
    sh.putalpha(sm.point(lambda p: min(alpha, int(p*.45))))
    img.alpha_composite(sh, offset)

def mask_topdown(shape):
    m=Image.new('L',(256,256),0); d=ImageDraw.Draw(m)
    w=78; c=128
    if shape in ('straight-x','cross'):
        d.rounded_rectangle((-8,c-w//2,264,c+w//2), radius=18, fill=255)
    if shape in ('straight-y','cross'):
        d.rounded_rectangle((c-w//2,-8,c+w//2,264), radius=18, fill=255)
    if shape=='corner':
        # right + bottom connector, with rounded inner turn
        d.rounded_rectangle((c-w//2,c-w//2,264,c+w//2), radius=18, fill=255)
        d.rounded_rectangle((c-w//2,c-w//2,c+w//2,264), radius=18, fill=255)
        cut=Image.new('L',(256,256),0); cd=ImageDraw.Draw(cut)
        cd.pieslice((c-w//2,c-w//2,c+w*2,c+w*2),180,270,fill=255)
        m=ImageChops.lighter(m, cut.filter(ImageFilter.GaussianBlur(1)))
    return m

def iso_poly(cx, cy, w, h):
    return [(cx,cy-h//2),(cx+w//2,cy),(cx,cy+h//2),(cx-w//2,cy)]

def mask_iso(shape):
    m=Image.new('L',(256,256),0); d=ImageDraw.Draw(m)
    # diamond-road coordinate: x axis NW-SE, y axis NE-SW visually on diamond grid.
    if shape in ('straight-x','cross'):
        d.polygon(iso_poly(128,128,238,86), fill=255)
    if shape in ('straight-y','cross'):
        d.polygon(iso_poly(128,128,86,238), fill=255)
    if shape=='corner':
        # right + bottom corner for diamond grid: compose east arm and south arm around center.
        d.polygon([(128,87),(242,128),(128,169),(128,128)], fill=255)   # east arm
        d.polygon([(128,128),(169,169),(128,242),(87,169)], fill=255)   # south arm
        d.polygon([(128,87),(169,128),(169,169),(128,202),(87,169),(87,128)], fill=255)
    return m.filter(ImageFilter.GaussianBlur(.2))

def noise_texture(style, size=(256,256)):
    c=COLORS[style]
    im=Image.new('RGBA',size,c['base']+(255,))
    px=im.load(); w,h=size
    for y in range(h):
        for x in range(w):
            n=random.randint(-18,18)
            if style=='grass': n=random.randint(-24,24)
            r=max(0,min(255,c['base'][0]+n)); g=max(0,min(255,c['base'][1]+n)); b=max(0,min(255,c['base'][2]+n))
            px[x,y]=(r,g,b,255)
    im=im.filter(ImageFilter.GaussianBlur(.6))
    return im

def apply_mask(texture, mask):
    tex=texture.copy(); tex.putalpha(mask); return tex

def outline(mask, color, width=3):
    dil=mask.filter(ImageFilter.MaxFilter(width*2+1))
    er=mask.filter(ImageFilter.MinFilter(width*2+1))
    edge=ImageChops.subtract(dil, er)
    im=Image.new('RGBA',mask.size,color+(0,)); im.putalpha(edge.point(lambda p:int(p*.75)))
    return im

def add_stone_details(im, mask, iso=False):
    d=ImageDraw.Draw(im)
    # cobble ellipses clipped inside mask
    for y in range(58,202,24):
        for x in range(34+(y//24%2)*11,225,24):
            if mask.getpixel((min(255,max(0,x)),min(255,max(0,y))))<100: continue
            d.ellipse((x-9,y-7,x+10,y+8), outline=COLORS['stone']['edge']+(105,), width=2)
            d.arc((x-9,y-7,x+10,y+8), 210, 330, fill=COLORS['stone']['hi']+(75,), width=1)

def add_dirt_details(im, mask):
    d=ImageDraw.Draw(im)
    for _ in range(95):
        x=random.randrange(6,250); y=random.randrange(6,250)
        if mask.getpixel((x,y))<90: continue
        col=random.choice([COLORS['dirt']['hi'], COLORS['dirt']['lo'], (92,68,42)])
        r=random.choice([1,1,2,3])
        d.ellipse((x-r,y-r,x+r,y+r), fill=col+(random.randrange(65,130),))

def add_grass_details(im, mask):
    c=COLORS['grass']
    d=ImageDraw.Draw(im)
    # dirt center over green verge, using smaller same shape mask
    center=mask.filter(ImageFilter.MinFilter(31))
    path=Image.new('RGBA',im.size,c['path']+(0,)); path.putalpha(center.point(lambda p:int(p*.92)))
    im.alpha_composite(path)
    for _ in range(130):
        x=random.randrange(4,252); y=random.randrange(4,252)
        if mask.getpixel((x,y))<70 or center.getpixel((x,y))>120: continue
        d.line((x,y,x+random.randrange(-2,3),y-random.randrange(2,6)), fill=random.choice([c['hi'],c['edge'],(118,178,65)])+(145,), width=1)
    add_dirt_details(im, center)

def add_wood_details(im, mask, iso=False):
    d=ImageDraw.Draw(im)
    c=COLORS['wood']
    # plank lines; direction differs by visual shape naturally enough for reusable pieces.
    for x in range(38,230,24):
        d.line((x,28,x,228), fill=c['edge']+(130,), width=2)
        d.line((x+3,30,x+3,226), fill=c['hi']+(65,), width=1)
    for y in range(64,210,56):
        d.line((22,y,234,y), fill=c['edge']+(110,), width=2)
    for _ in range(70):
        x=random.randrange(8,248); y=random.randrange(8,248)
        if mask.getpixel((x,y))<90: continue
        d.line((x,y,x+random.randrange(4,14),y+random.randrange(-2,3)), fill=c['lo']+(65,), width=1)

def make_asset(style, camera, shape):
    mask = mask_topdown(shape) if camera=='topdown' else mask_iso(shape)
    canvas=rgba(); draw_shadow(canvas, mask)
    # border underlay
    canvas.alpha_composite(outline(mask, COLORS[style]['edge'], width=3))
    tex=noise_texture(style)
    road=apply_mask(tex, mask.filter(ImageFilter.GaussianBlur(.4)))
    if style=='stone': add_stone_details(road, mask, camera=='isometric')
    elif style=='dirt': add_dirt_details(road, mask)
    elif style=='grass': add_grass_details(road, mask)
    elif style=='wood': add_wood_details(road, mask, camera=='isometric')
    # Clip all detail strokes back to the road silhouette; detail drawing must never create extra fragments outside the connector mask.
    road.putalpha(mask.filter(ImageFilter.GaussianBlur(.4)))
    # subtle top highlight
    hi=Image.new('RGBA',(256,256), COLORS[style]['hi']+(0,))
    grad=Image.new('L',(256,256),0)
    gp=grad.load()
    for y in range(256):
        a=max(0, int(44*(1-y/256)))
        for x in range(256): gp[x,y]=a
    hi.putalpha(ImageChops.multiply(mask, grad))
    road.alpha_composite(hi)
    canvas.alpha_composite(road)
    # final edge crisp
    canvas.alpha_composite(outline(mask, COLORS[style]['edge'], width=1))
    return canvas

for style in TYPES:
    for camera in CAMERAS:
        for shape in SHAPES:
            im=make_asset(style,camera,shape)
            im.save(OUT/f'{style}-{camera}-{shape}.webp','WEBP',quality=94,method=6)
        # base aliases use cross
        Image.open(OUT/f'{style}-{camera}-cross.webp').save(OUT/f'{style}-{camera}.webp','WEBP',quality=94,method=6)
Image.open(OUT/'stone-isometric-cross.webp').save(OUT/'road-isometric.webp','WEBP',quality=94,method=6)
Image.open(OUT/'stone-topdown-cross.webp').save(OUT/'road-topdown.webp','WEBP',quality=94,method=6)
print('rebuilt deterministic connector road assets')
