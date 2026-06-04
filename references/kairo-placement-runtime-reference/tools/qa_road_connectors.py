from pathlib import Path
from PIL import Image, ImageDraw
import json, math, statistics

BASE = Path(__file__).resolve().parents[1]
ROADS = BASE / 'assets/image2-clean/roads'
OUT = ROADS / 'qa'
OUT.mkdir(parents=True, exist_ok=True)
TYPES = ['stone','dirt','grass','wood']
CAMERAS = ['isometric','topdown']
SHAPES = ['straight-x','straight-y','corner','cross']
EDGE_EXPECT = {
    'straight-x': {'left','right'},
    'straight-y': {'top','bottom'},
    'corner': {'right','bottom'},
    'cross': {'left','right','top','bottom'},
}

def alpha_mask(im):
    if im.mode != 'RGBA': im = im.convert('RGBA')
    return im.getchannel('A')

def bbox_alpha(im, threshold=20):
    a = alpha_mask(im)
    return a.point(lambda p: 255 if p > threshold else 0).getbbox()

def edge_hits(im, threshold=20, band=6):
    a = alpha_mask(im)
    w,h = im.size
    hits = set()
    def count_box(box):
        crop = a.crop(box)
        return sum(1 for v in crop.getdata() if v > threshold)
    if count_box((0,0,band,h)) > h * band * .08: hits.add('left')
    if count_box((w-band,0,w,h)) > h * band * .08: hits.add('right')
    if count_box((0,0,w,band)) > w * band * .08: hits.add('top')
    if count_box((0,h-band,w,h)) > w * band * .08: hits.add('bottom')
    return hits

def connected_components(im, threshold=20):
    a = alpha_mask(im)
    w,h = im.size
    data = list(a.getdata())
    seen = bytearray(w*h)
    comps = []
    for idx,v in enumerate(data):
        if v <= threshold or seen[idx]: continue
        stack = [idx]; seen[idx] = 1; xs=[]; ys=[]; count=0
        while stack:
            cur = stack.pop(); count += 1
            x = cur % w; y = cur // w; xs.append(x); ys.append(y)
            for nb in (cur-1,cur+1,cur-w,cur+w):
                if nb < 0 or nb >= w*h or seen[nb] or data[nb] <= threshold: continue
                nx = nb % w
                if abs(nx-x) > 1: continue
                seen[nb] = 1; stack.append(nb)
        if count > 30:
            comps.append({'count':count,'bbox':(min(xs),min(ys),max(xs)+1,max(ys)+1)})
    comps.sort(key=lambda c:c['count'], reverse=True)
    return comps

def audit_asset(path, camera, shape):
    issues=[]
    if not path.exists() or path.stat().st_size == 0:
        return {'ok':False,'issues':['missing_or_empty']}
    im = Image.open(path).convert('RGBA')
    if im.size != (256,256): issues.append(f'bad_size:{im.size}')
    bbox = bbox_alpha(im)
    if not bbox: issues.append('empty_alpha')
    else:
        x0,y0,x1,y1 = bbox
        area = (x1-x0)*(y1-y0)
        if area < 1400: issues.append('too_small')
        if camera == 'isometric':
            if (x1-x0) < 70 or (y1-y0) < 35: issues.append('isometric_bbox_too_small')
            # Isometric can be wide or tall depending on diamond axis, but it must not carry a full-cell background.
            if x0 <= 3 and y0 <= 3 and x1 >= 253 and y1 >= 253: issues.append('full_cell_background_not_isometric')
        if camera == 'topdown':
            if shape in ('straight-x','straight-y') and max(x1-x0,y1-y0) < 170: issues.append('topdown_straight_too_short')
    comps = connected_components(im)
    if len(comps) > 2: issues.append(f'too_many_components:{len(comps)}')
    expected = EDGE_EXPECT[shape]
    hits = edge_hits(im)
    if camera == 'topdown':
        if not expected.issubset(hits): issues.append(f'edge_connection_mismatch:expected={sorted(expected)} hits={sorted(hits)}')
    else:
        # Isometric connector art does not have to touch the square canvas edges, but should not contain obvious extra cropped roads.
        if len(comps) > 1 and comps[1]['count'] > max(260, comps[0]['count']*.12): issues.append('extra_visible_fragment')
    return {'ok':not issues,'issues':issues,'bbox':bbox,'components':len(comps),'edgeHits':sorted(hits)}

def make_contact(results):
    cell=146; left=126; top=30; label_h=34
    width=left+len(SHAPES)*cell+20
    height=top+len(CAMERAS)*len(TYPES)*(cell+label_h)+40
    canvas=Image.new('RGB',(width,height),(244,240,226))
    d=ImageDraw.Draw(canvas)
    for i,s in enumerate(SHAPES): d.text((left+i*cell+10,8),s,fill=(25,25,25))
    y=top
    for cam in CAMERAS:
        for typ in TYPES:
            d.text((10,y+55),f'{typ}\n{cam}',fill=(20,20,20))
            for i,shape in enumerate(SHAPES):
                x=left+i*cell
                path=ROADS/f'{typ}-{cam}-{shape}.webp'
                key=f'{typ}-{cam}-{shape}'
                if path.exists():
                    im=Image.open(path).convert('RGBA').resize((128,128),Image.Resampling.LANCZOS)
                    bg=Image.new('RGBA',(128,128),(232,228,210,255)); bg.alpha_composite(im)
                    canvas.paste(bg.convert('RGB'),(x+10,y+label_h))
                ok=results[key]['ok']
                d.rectangle((x+9,y+label_h-1,x+139,y+label_h+129),outline=(62,150,75) if ok else (210,50,46),width=3 if not ok else 1)
                if not ok: d.text((x+12,y+label_h+132),'FAIL',fill=(210,50,46))
            y += cell + label_h
    canvas.save(OUT/'road-connectors-qa.png')

results={}
for typ in TYPES:
    for cam in CAMERAS:
        for shape in SHAPES:
            key=f'{typ}-{cam}-{shape}'
            results[key]=audit_asset(ROADS/f'{key}.webp', cam, shape)
make_contact(results)
(OUT/'road-connectors-qa.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
failed={k:v for k,v in results.items() if not v['ok']}
print(json.dumps({'total':len(results),'failed':failed},ensure_ascii=False,indent=2))
raise SystemExit(1 if failed else 0)
