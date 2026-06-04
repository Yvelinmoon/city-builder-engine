const SAVE_KEY = 'pure_brick_city_builder_v4';
const GRID_SAVE_KEY = 'pure_brick_city_grid_v4';
const CATEGORY_LABELS = { common:'COMMON', residential:'HOME', commercial:'SHOP', service:'SERVICE', landmark:'LANDMARK', campus:'CAMPUS', bridge:'BRIDGE', transport:'ROAD' };
const METRIC_LABELS = { money:'CASH', population:'POP', popularity:'HYPE', commerce:'BIZ', culture:'CULTURE', traffic:'TRAFFIC' };
const HEAT_MODES = [null, 'commerce', 'culture', 'traffic', 'popularity'];
const CAMERA_MODES = ['isometric', 'rpg_topdown'];
const DESIGN_W = 1600;
const BASE_GRID_ZOOM = .72;
const WORLD_ZOOM_MAX = 2.35;
const CAMERA_LABELS = { isometric:'ISO', rpg_topdown:'RPG' };
const REGION_TEMPLATE = { cols:128, rows:128, gridScale:1 };
const DEFAULT_REGIONS = [
  { id:'world', name:'WORLD', x:-64, y:-64, cols:REGION_TEMPLATE.cols, rows:REGION_TEMPLATE.rows, offsetX:0, offsetY:0, gridScale:REGION_TEMPLATE.gridScale }
];
const els = {
  title: document.getElementById('projectTitle'), subtitle: document.getElementById('projectSubtitle'), brand: document.getElementById('brandMark'),
  resourceBar: document.getElementById('resourceBar'), cycleLabel: document.getElementById('cycleLabel'), modeLabel: document.getElementById('modeLabel'),
  map: document.getElementById('isoMap'), roadLayer: document.getElementById('roadLayer'), mapWrap: document.getElementById('mapWrap'), agents: document.getElementById('agentLayer'), floats: document.getElementById('floatLayer'), minimap: document.getElementById('minimap'), minimapWorld: document.getElementById('minimapWorld'),
  categoryTabs: document.getElementById('categoryTabs'), buildingList: document.getElementById('buildingList'), selectedLabel: document.getElementById('selectedLabel'),
  buildPanel: document.getElementById('buildPanel'), statusPanel: document.getElementById('statusPanel'), goalPanel: document.getElementById('goalPanel'), settingsPanel: document.getElementById('settingsPanel'),
  buildDockBtn: document.getElementById('buildDockBtn'), statusDockBtn: document.getElementById('statusDockBtn'), goalsDockBtn: document.getElementById('goalsDockBtn'),
  infoPanel: document.getElementById('infoPanel'), infoTab: document.getElementById('infoTab'), infoContent: document.getElementById('infoContent'), goals: document.getElementById('goals'), incomeLabel: document.getElementById('incomeLabel'), log: document.getElementById('cityLog'),
  message: document.getElementById('messageStrip'), inspectBtn: document.getElementById('inspectBtn'), heatBtn: document.getElementById('heatBtn'), resetBtn: document.getElementById('resetBtn'), settingsToggleBtn: document.getElementById('settingsToggleBtn'), settingsMenu: document.getElementById('settingsMenu'), gridEditBtn: document.getElementById('gridEditBtn'), gridResetBtn: document.getElementById('gridResetBtn')
};
const state = {
  config:null, buildings:[], characters:[], goals:[], events:[], cols:32, rows:28,
  money:50000, population:0, popularity:0, commerce:0, culture:0, traffic:0, satisfaction:65, trafficCapacity:0, monthlyIncome:0,
  month:1, placed:[], nextId:1, selectedId:null, category:'landmark', selectedPlacedId:null, completedGoals:{}, heatMode:null,
  gridZoom:BASE_GRID_ZOOM, viewX:0, viewY:0, panning:null, minimapPanning:false, gridEditing:false, regionDrag:null, activeRegionId:'world', regions:structuredClone(DEFAULT_REGIONS), roads:[], roadBuildMode:false, roadDraft:null, activeRoadType:'stone', roadTypes:[], hoverTile:null, placementGhost:null, activeModal:null, cameraMode:'isometric'
};
async function loadJson(path, fallback){ try{ const r=await fetch(path,{cache:'no-store'}); if(!r.ok) throw new Error(r.status); return await r.json(); }catch(e){ console.warn('fallback',path,e); return fallback; } }
const fmt=n=>Math.round(n).toLocaleString('zh-CN');
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const buildingById=id=>state.buildings.find(b=>b.id===id);
const placedById=id=>state.placed.find(p=>p.id===id);
const ROAD_SHAPES = ['straight-x','straight-y','corner','cross'];
function roadAssetSet(id){
  const root='./assets/image2-clean/roads';
  return {
    isometric:`${root}/${id}-isometric.webp`,
    topdown:`${root}/${id}-topdown.webp`,
    variants:Object.fromEntries(['isometric','topdown'].flatMap(camera=>ROAD_SHAPES.map(shape=>[`${camera}-${shape}`,`${root}/${id}-${camera}-${shape}.webp`])))
  };
}
const DEFAULT_ROAD_TYPES = [
  { id:'stone', name:'Stone Path', cost:80, assets:roadAssetSet('stone') },
  { id:'dirt', name:'Dirt Path', cost:40, assets:roadAssetSet('dirt') },
  { id:'grass', name:'Grass Trail', cost:30, assets:roadAssetSet('grass') },
  { id:'wood', name:'Wood Plank Path', cost:70, assets:roadAssetSet('wood') }
];
const DEPTH_SCALE = 10;
const depthFromTop=(top,boost=0)=>Math.round(10000+(Number(top)||0)*DEPTH_SCALE+boost);
function normalizeCameraMode(mode){ return CAMERA_MODES.includes(mode) ? mode : 'isometric'; }
function roadVariantPath(base, shape){ return typeof base==='string' ? base.replace(/\.webp(\?.*)?$/i,`-${shape}.webp$1`) : ''; }
function normalizeRoadTypes(config=state.config){ const cfgTypes=config?.roads?.types; const types=Array.isArray(cfgTypes)&&cfgTypes.length?cfgTypes:DEFAULT_ROAD_TYPES; return types.map((type,index)=>{ const id=type.id||`road-${index+1}`; const iso=type.assets?.isometric||roadAssetSet(id).isometric||'./assets/image2-clean/roads/road-isometric.webp'; const top=type.assets?.topdown||roadAssetSet(id).topdown||'./assets/image2-clean/roads/road-topdown.webp'; const configuredVariants=type.assets?.variants||{}; const variants=Object.fromEntries(['isometric','topdown'].flatMap(camera=>ROAD_SHAPES.map(shape=>{ const base=camera==='isometric'?iso:top; return [`${camera}-${shape}`, configuredVariants[`${camera}-${shape}`]||roadVariantPath(base,shape)||base]; }))); return { id, name:type.name||id||`Road ${index+1}`, cost:Number(type.cost??80), assets:{ isometric:iso, topdown:top, variants } }; }); }
function roadTypeById(id){ return state.roadTypes.find(type=>type.id===id) || state.roadTypes[0] || DEFAULT_ROAD_TYPES[0]; }
function defaultRoadTypeId(){ return state.config?.roads?.defaultType || state.roadTypes[0]?.id || 'stone'; }
function normalizeRoad(rd){ const regionId=rd.regionId||regionForTile(rd.x,rd.y)?.id||'world'; return { x:rd.x, y:rd.y, regionId, type:roadTypeById(rd.type)?.id || defaultRoadTypeId() }; }
function activeRoadCost(){ return roadTypeById(state.activeRoadType)?.cost ?? 80; }
function isTopDownCamera(){ return state.cameraMode === 'rpg_topdown'; }
function syncCameraClass(){ document.body.classList.toggle('camera-rpg-topdown', isTopDownCamera()); document.body.classList.toggle('camera-isometric', !isTopDownCamera()); }
function normalizeRegion(region=DEFAULT_REGIONS[0], index=0){ return { id:'world', name:'WORLD', x:DEFAULT_REGIONS[0].x, y:DEFAULT_REGIONS[0].y, cols:REGION_TEMPLATE.cols, rows:REGION_TEMPLATE.rows, offsetX:0, offsetY:0, gridScale:REGION_TEMPLATE.gridScale }; }
function normalizeRegions(){ return [normalizeRegion(DEFAULT_REGIONS[0])]; }
function cellKey(p){ return `${p.regionId||regionForTile(p.x,p.y)?.id||'none'}:${p.x},${p.y}`; }
function screenToMapPoint(event){ return { x:event.clientX, y:event.clientY }; }
function viewportCenter(){ return { x:innerWidth/2, y:innerHeight/2 }; }
function cameraBaseMetrics(){ if(isTopDownCamera()) return { tw:DESIGN_W*.025, th:DESIGN_W*.025*.72, oxRatio:.50, oyRatio:.50 }; return { tw:DESIGN_W*.0165, th:DESIGN_W*.00825, oxRatio:.50, oyRatio:.18 }; }
function worldFootprintAt(zoom=state.gridZoom){ const r=state.regions?.[0]||DEFAULT_REGIONS[0]; const base=cameraBaseMetrics(); if(isTopDownCamera()) return { width:r.cols*base.tw*zoom, height:r.rows*base.th*zoom }; return { width:(r.cols+r.rows)*base.tw*zoom, height:(r.cols+r.rows)*base.th*zoom }; }
function worldBoundsAtPan(viewX=state.viewX, viewY=state.viewY){ const r=state.regions?.[0]||DEFAULT_REGIONS[0]; const base=cameraBaseMetrics(); const tw=base.tw*state.gridZoom, th=base.th*state.gridZoom; const ox=innerWidth*base.oxRatio+viewX+(r.offsetX||0), oy=innerHeight*base.oyRatio+viewY+(r.offsetY||0); const corners=isTopDownCamera() ? [{left:ox+r.x*tw,top:oy+r.y*th},{left:ox+(r.x+r.cols)*tw,top:oy+r.y*th},{left:ox+(r.x+r.cols)*tw,top:oy+(r.y+r.rows)*th},{left:ox+r.x*tw,top:oy+(r.y+r.rows)*th}] : [{left:ox+(r.x-r.y)*tw,top:oy+(r.x+r.y)*th},{left:ox+(r.x+r.cols-r.y)*tw,top:oy+(r.x+r.cols+r.y)*th},{left:ox+(r.x+r.cols-r.y-r.rows)*tw,top:oy+(r.x+r.cols+r.y+r.rows)*th},{left:ox+(r.x-r.y-r.rows)*tw,top:oy+(r.x+r.y+r.rows)*th}]; return polygonBounds(corners); }
function panRange(){ const bounds=worldBoundsAtPan(0,0); const margin=Math.min(innerWidth,innerHeight)*.08; const rangeFor=(start,end,size)=>{ if(end-start<=size) return { min:size*.5-(start+end)*.5, max:size*.5-(start+end)*.5 }; return { min:size-end-margin, max:-start+margin }; }; return { x:rangeFor(bounds.left,bounds.right,innerWidth), y:rangeFor(bounds.top,bounds.bottom,innerHeight) }; }
function clampViewPan(){ const range=panRange(); state.viewX=clamp(Number(state.viewX)||0,range.x.min,range.x.max); state.viewY=clamp(Number(state.viewY)||0,range.y.min,range.y.max); }
function syncWorldTransform(){ clampViewPan(); document.documentElement.style.setProperty('--world-x',`${state.viewX.toFixed(2)}px`); document.documentElement.style.setProperty('--world-y',`${state.viewY.toFixed(2)}px`); document.documentElement.style.setProperty('--scene-zoom',`${(state.gridZoom/BASE_GRID_ZOOM).toFixed(3)}`); }
function regionById(id){ return state.regions.find(r=>r.id===id) || state.regions[0]; }
function logicalRegionsOverlap(a,b){ return Math.max(a.x,b.x) < Math.min(a.x+a.cols,b.x+b.cols) && Math.max(a.y,b.y) < Math.min(a.y+a.rows,b.y+b.rows); }
function tileToScreenInRegion(x,y,r){ const m=gridMetrics(); if(isTopDownCamera()) return { left:m.ox+x*m.tw+(r?.offsetX||0), top:m.oy+y*m.th+(r?.offsetY||0) }; return { left:m.ox+(x-y)*m.tw+(r?.offsetX||0), top:m.oy+(x+y)*m.th+(r?.offsetY||0) }; }
function polygonBounds(poly){ return { left:Math.min(...poly.map(p=>p.left)), right:Math.max(...poly.map(p=>p.left)), top:Math.min(...poly.map(p=>p.top)), bottom:Math.max(...poly.map(p=>p.top)) }; }
function regionScreenPolygon(r){ const m=gridMetrics(); const corners=[
  tileToScreenInRegion(r.x, r.y, r),
  tileToScreenInRegion(r.x+r.cols-1, r.y, r),
  tileToScreenInRegion(r.x+r.cols-1, r.y+r.rows-1, r),
  tileToScreenInRegion(r.x, r.y+r.rows-1, r)
  ];
  return corners.map(p=>({ left:p.left, top:p.top }));
}
function regionScreenBounds(r){ return polygonBounds(regionScreenPolygon(r)); }
function projectPolygon(axis, poly){ let min=Infinity,max=-Infinity; poly.forEach(p=>{ const v=p.left*axis.x+p.top*axis.y; min=Math.min(min,v); max=Math.max(max,v); }); return {min,max}; }
function polygonsOverlap(a,b){ const axes=[]; [a,b].forEach(poly=>{ for(let i=0;i<poly.length;i++){ const p1=poly[i], p2=poly[(i+1)%poly.length]; const ex=p2.left-p1.left, ey=p2.top-p1.top; const len=Math.hypot(ex,ey)||1; axes.push({x:-ey/len,y:ex/len}); } }); return axes.every(axis=>{ const pa=projectPolygon(axis,a), pb=projectPolygon(axis,b); return Math.max(pa.min,pb.min) < Math.min(pa.max,pb.max)-1; }); }
function regionVisuallyOverlaps(id){ const r=regionById(id); if(!r) return false; const p=regionScreenPolygon(r); return state.regions.some(other=>other.id!==id && polygonsOverlap(p, regionScreenPolygon(other))); }
function regionForTile(x,y){ return state.regions.find(r=>x>=r.x && y>=r.y && x<r.x+r.cols && y<r.y+r.rows) || null; }
function roadPlan(){ return state.roads; }
function roadCells(regionId=null){ return new Set(state.roads.filter(r=>!regionId || r.regionId===regionId).map(r=>regionId?`${r.x},${r.y}`:cellKey(r))); }
function gridMetrics(){ const base=cameraBaseMetrics(); const tw=base.tw*state.gridZoom; const th=base.th*state.gridZoom; return { ox:innerWidth*base.oxRatio+state.viewX, oy:innerHeight*base.oyRatio+state.viewY, tw, th, tileW:tw*(isTopDownCamera()?.96:1.84), tileH:th*(isTopDownCamera()?.96:1.84) }; }
function minGridZoom(){ const r=state.regions?.[0]||DEFAULT_REGIONS[0]; const base=cameraBaseMetrics(); if(isTopDownCamera()){ const baseW=r.cols*base.tw, baseH=r.rows*base.th; return clamp(Math.max(innerWidth/baseW,innerHeight/baseH,BASE_GRID_ZOOM)*1.03,BASE_GRID_ZOOM,1.1); } const baseW=(r.cols+r.rows)*base.tw, baseH=(r.cols+r.rows)*base.th; return clamp(Math.max(innerWidth/baseW,innerHeight/baseH,BASE_GRID_ZOOM)*1.03,BASE_GRID_ZOOM,1.1); }
function normalizeGridZoom(value=state.gridZoom){ return clamp(value,minGridZoom(),WORLD_ZOOM_MAX); }
function setGridZoom(value,{render=true,anchor=null}={}){ const old=state.gridZoom; const next=normalizeGridZoom(value); if(Math.abs(next-old)<.001){ clampViewPan(); return; } if(anchor){ const c=viewportCenter(); const ratio=next/old; state.viewX=anchor.x-c.x-(anchor.x-c.x-state.viewX)*ratio; state.viewY=anchor.y-c.y-(anchor.y-c.y-state.viewY)*ratio; } state.gridZoom=next; clampViewPan(); saveGridCalibration(); if(render) renderAll(); }
function handleMapWheel(event){ event.preventDefault(); const factor=Math.exp(-event.deltaY*.0012); setGridZoom(state.gridZoom*factor,{anchor:{x:event.clientX,y:event.clientY}}); }
function startViewportPan(event){ if(state.selectedId||state.roadBuildMode||state.gridEditing||state.activeModal) return; if(event.button!==0 && event.button!==1) return; if(event.target.closest?.('.building,.bottom-dock,.panel,.top-hud,.minimap')) return; event.preventDefault(); state.panning={startX:event.clientX,startY:event.clientY,baseX:state.viewX,baseY:state.viewY}; document.body.classList.add('map-panning'); els.mapWrap.setPointerCapture?.(event.pointerId); }
function dragViewportPan(event){ if(!state.panning) return; event.preventDefault(); state.viewX=state.panning.baseX+(event.clientX-state.panning.startX); state.viewY=state.panning.baseY+(event.clientY-state.panning.startY); clampViewPan(); renderMap(); }
function stopViewportPan(){ if(!state.panning) return; state.panning=null; document.body.classList.remove('map-panning'); saveGridCalibration(); renderMap(); }
function setViewCenterTile(x,y,{render=true,saveState=true}={}){ const r=state.regions?.[0]||DEFAULT_REGIONS[0]; const base=cameraBaseMetrics(); const tw=base.tw*state.gridZoom, th=base.th*state.gridZoom; const cx=innerWidth/2, cy=innerHeight/2; if(isTopDownCamera()){ state.viewX=cx-innerWidth*base.oxRatio-(x*tw)-(r.offsetX||0); state.viewY=cy-innerHeight*base.oyRatio-(y*th)-(r.offsetY||0); } else { state.viewX=cx-innerWidth*base.oxRatio-((x-y)*tw)-(r.offsetX||0); state.viewY=cy-innerHeight*base.oyRatio-((x+y)*th)-(r.offsetY||0); } clampViewPan(); if(saveState) saveGridCalibration(); if(render) renderMap(); }
function minimapTileFromPointer(event){ const rect=els.minimapWorld?.getBoundingClientRect?.(); const r=state.regions?.[0]||DEFAULT_REGIONS[0]; if(!rect||!rect.width||!rect.height) return null; const nx=clamp((event.clientX-rect.left)/rect.width,0,1); const ny=clamp((event.clientY-rect.top)/rect.height,0,1); return { x:r.x+nx*r.cols, y:r.y+ny*r.rows };
}
function updateMinimapNavigation(event){ const tile=minimapTileFromPointer(event); if(!tile) return; setViewCenterTile(tile.x,tile.y,{render:true,saveState:false}); }
function startMinimapNavigation(event){ if(state.activeModal) return; event.preventDefault(); event.stopPropagation(); state.minimapPanning=true; document.body.classList.add('minimap-panning'); els.minimapWorld.setPointerCapture?.(event.pointerId); updateMinimapNavigation(event); }
function dragMinimapNavigation(event){ if(!state.minimapPanning) return; event.preventDefault(); updateMinimapNavigation(event); }
function stopMinimapNavigation(){ if(!state.minimapPanning) return; state.minimapPanning=false; document.body.classList.remove('minimap-panning'); saveGridCalibration(); renderMap(); }
function tileToScreen(x,y){ const r=regionForTile(x,y); return tileToScreenInRegion(x,y,r); }
function screenCenterOf(p){ const b=buildingById(p.type); return tileToScreen(p.x+(b.size?.[0]||1)/2-.5, p.y+(b.size?.[1]||1)/2-.5); }
function occupiedCells(ignoreId=null, options={}){ const set=options.includeRoads===false?new Set():roadCells(); state.placed.forEach(p=>{ if(p.id===ignoreId) return; const b=buildingById(p.type); if(b?.assetKind==='ground'&&!options.includeGround) return; const regionId=regionForTile(p.x,p.y)?.id; for(let y=0;y<(b.size?.[1]||1);y++) for(let x=0;x<(b.size?.[0]||1);x++) set.add(`${regionId}:${p.x+x},${p.y+y}`); }); return set; }
function canPlace(type,x,y){ const b=buildingById(type); if(!b) return {ok:false,reason:'UNKNOWN BUILDING'}; if(b.category==='transport') return {ok:false,reason:'USE ROAD TOOL'}; const [w,h]=b.size||[1,1]; const r=regionForTile(x,y); if(!r || x+w>r.x+r.cols || y+h>r.y+r.rows) return {ok:false,reason:'OUTSIDE BUILD ZONE'}; const kind=assetKindOf(b); const occ=occupiedCells(null,{includeRoads:kind!=='ground',includeGround:kind==='ground'}); for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++) if(occ.has(`${r.id}:${x+xx},${y+yy}`)) return {ok:false,reason:'TILE OCCUPIED'}; if(state.money<b.cost) return {ok:false,reason:'NOT ENOUGH CASH'}; return {ok:true}; }
function rangesOverlap(a1,a2,b1,b2){ return Math.max(a1,b1)<Math.min(a2,b2); }
function edgeTouch(a,w,h,b,bw,bh){ return ((a.x+w===b.x||b.x+bw===a.x)&&rangesOverlap(a.y,a.y+h,b.y,b.y+bh))||((a.y+h===b.y||b.y+bh===a.y)&&rangesOverlap(a.x,a.x+w,b.x,b.x+bw)); }
function adjacentToRoad(p){ const b=buildingById(p.type); if(b.category==='bridge'||b.category==='common') return true; const r=regionForTile(p.x,p.y); return state.roads.some(rd=>rd.regionId===r?.id && edgeTouch(p,b.size[0],b.size[1],rd,1,1)); }
function nearby(p,range){ const b=buildingById(p.type); const r=regionForTile(p.x,p.y); const cx=p.x+b.size[0]/2, cy=p.y+b.size[1]/2; return state.placed.filter(q=>q.id!==p.id && regionForTile(q.x,q.y)?.id===r?.id).filter(q=>{ const qb=buildingById(q.type); return Math.abs((q.x+qb.size[0]/2)-cx)+Math.abs((q.y+qb.size[1]/2)-cy)<=range; }); }
function renderResources(){ const heatLabel=state.heatMode?`${METRIC_LABELS[state.heatMode]} MAP`:'OFF'; const items=[['money','CASH',`$${fmt(state.money)}`],['population','POP',fmt(state.population)],['popularity','HYPE',fmt(state.popularity)],['commerce','BIZ',fmt(state.commerce)],['culture','CULTURE',fmt(state.culture)],['traffic','TRAFFIC',fmt(state.traffic)],['heat','HEAT',heatLabel]]; els.resourceBar.innerHTML=items.map(([k,l,v])=>`<div class="res-card ${k==='traffic'&&state.traffic>70?'bad':k==='money'?'good':''}"><small>${l}</small><b>${v}</b></div>`).join(''); els.incomeLabel.textContent=`+${fmt(state.monthlyIncome)} / MO`; }
function heatClassFor(x,y){ if(!state.heatMode) return ''; let score=0; state.placed.forEach(p=>{ const b=buildingById(p.type); const dist=Math.abs((p.x+(b.size[0]-1)/2)-x)+Math.abs((p.y+(b.size[1]-1)/2)-y); if(dist<=3) score+=Math.max(0,4-dist)*Math.max(1,b.effects?.[state.heatMode]||0); }); return score>8?`heat-${state.heatMode}`:''; }
function roadConnections(rd){ const pool=[...state.roads,...(state.roadDraft?.path||[])]; const same=pool.filter(other=>other.regionId===rd.regionId && (other.type||defaultRoadTypeId())===(rd.type||defaultRoadTypeId())); const has=(x,y)=>same.some(other=>other.x===x&&other.y===y); return { e:has(rd.x+1,rd.y), w:has(rd.x-1,rd.y), s:has(rd.x,rd.y+1), n:has(rd.x,rd.y-1) }; }
function roadVisual(rd){ const c=roadConnections(rd); const count=Object.values(c).filter(Boolean).length; if(count>=3) return { shape:'cross' }; if((c.e||c.w)&&!(c.n||c.s)) return { shape:'straight-x' }; if((c.n||c.s)&&!(c.e||c.w)) return { shape:'straight-y' }; if(count===2){ if(c.e&&c.w) return { shape:'straight-x' }; if(c.n&&c.s) return { shape:'straight-y' }; if((c.e&&c.s)||(c.s&&c.w)||(c.w&&c.n)||(c.n&&c.e)) return { shape:'corner' }; } return { shape:'cross' }; }
function roadAssetSrc(rd){ const type=roadTypeById(rd?.type || state.activeRoadType); if(!isTopDownCamera()) return type.assets?.isometric || './assets/image2-clean/roads/road-isometric.webp'; const shape=rd?.shape || roadVisual(rd||{type:type.id,regionId:'world',x:0,y:0}).shape; return type.assets?.variants?.[`topdown-${shape}`] || type.assets?.topdown || './assets/image2-clean/roads/road-topdown.webp'; }
function renderRoadNode(rd,className='preset-road',boost=0){ const s=tileToScreen(rd.x,rd.y); const visual=isTopDownCamera()?roadVisual(rd):{shape:'isometric-fixed'}; const node=document.createElement('div'); node.className=className; node.dataset.roadType=rd.type||defaultRoadTypeId(); node.dataset.roadShape=visual.shape; node.style.left=`${s.left}px`; node.style.top=`${s.top}px`; node.style.zIndex=String(depthFromTop(s.top,boost)); node.innerHTML=`<img src="${roadAssetSrc({...rd,shape:visual.shape})}" alt="" aria-hidden="true">`; els.roadLayer.appendChild(node); }
function renderRoads(){ els.roadLayer.innerHTML=''; state.roads.forEach(rd=>renderRoadNode(rd)); if(state.roadDraft) state.roadDraft.path.forEach(rd=>renderRoadNode(rd,'preset-road road-draft',2)); }
function canPlaceCell(type,x,y){ const b=buildingById(type); if(!b) return false; const r=regionForTile(x,y); if(!r) return false; const kind=assetKindOf(b); const occ=occupiedCells(null,{includeRoads:kind!=='ground',includeGround:kind==='ground'}); return !occ.has(`${r.id}:${x},${y}`) && state.money>=b.cost; }
function renderPlacementCells(x,y,type){ const b=buildingById(type); if(!b) return; const [w,h]=b.size||[1,1]; const whole=canPlace(type,x,y).ok; for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++){ const cx=x+xx, cy=y+yy; const s=tileToScreen(cx,cy); const div=document.createElement('div'); const ok=whole && canPlaceCell(type,cx,cy); div.className=`tile placement-cell ${ok?'place-ok':'place-bad'}`; div.style.left=`${s.left}px`; div.style.top=`${s.top}px`; div.style.zIndex=String(depthFromTop(s.top,12)); els.map.appendChild(div); } }
function renderMap(){ state.gridZoom=normalizeGridZoom(); syncWorldTransform(); const m=gridMetrics(); document.documentElement.style.setProperty('--tile-w',`${m.tileW}px`); document.documentElement.style.setProperty('--tile-h',`${m.tileH}px`); renderRoads(); els.map.innerHTML=''; state.placementGhost=null; const placed=[...state.placed].sort((a,b)=>{ const ab=buildingById(a.type), bb=buildingById(b.type); const ag=ab?.assetKind==='ground', bg=bb?.assetKind==='ground'; if(ag!==bg) return ag?-1:1; return screenCenterOf(a).top-screenCenterOf(b).top; }); placed.forEach(renderBuilding); if(state.selectedId&&state.hoverTile) renderPlacementCells(state.hoverTile.x,state.hoverTile.y,state.selectedId); updatePlacementGhost(); renderMinimap(); }
function mapCenterTile(){ const r=state.regions?.[0]||DEFAULT_REGIONS[0]; const m=gridMetrics(); const pt=viewportCenter(); if(isTopDownCamera()){ return { x:(pt.x-m.ox-(r.offsetX||0))/m.tw, y:(pt.y-m.oy-(r.offsetY||0))/m.th }; } const dx=pt.x-m.ox-(r.offsetX||0), dy=pt.y-m.oy-(r.offsetY||0); return { x:(dx/m.tw+dy/m.th)/2, y:(dy/m.th-dx/m.tw)/2 }; }
function renderMinimap(){ if(!els.minimapWorld) return; const r=state.regions?.[0]||DEFAULT_REGIONS[0]; const dots=state.placed.filter(p=>assetKindOf(buildingById(p.type)||{})!=='ground').map(p=>{ const b=buildingById(p.type)||{}; const x=((p.x+(b.size?.[0]||1)/2-r.x)/r.cols)*100; const y=((p.y+(b.size?.[1]||1)/2-r.y)/r.rows)*100; return `<i class="minimap-dot ${assetKindOf(b)==='prop'?'prop':'building'}" style="left:${clamp(x,0,100)}%;top:${clamp(y,0,100)}%"></i>`; }).join(''); const fp=worldFootprintAt(); const viewW=clamp(innerWidth/fp.width*100,8,100); const viewH=clamp(innerHeight/fp.height*100,8,100); const center=mapCenterTile(); const cx=clamp(((center.x-r.x)/r.cols)*100,viewW/2,100-viewW/2); const cy=clamp(((center.y-r.y)/r.rows)*100,viewH/2,100-viewH/2); els.minimapWorld.innerHTML=`${dots}<b class="minimap-view" style="width:${viewW}%;height:${viewH}%;left:${cx-viewW/2}%;top:${cy-viewH/2}%"></b>`; }
function commonAssetName(b){ return b.commonAsset || b.id.replace(/^common-(ground|prop)-/,''); }
function assetKindOf(b){ return b.assetKind || 'building'; }
function assetSrcFor(b){ if(assetKindOf(b)==='ground') return `./assets/image2-clean/common/ground/${commonAssetName(b)}-${isTopDownCamera()?'topdown':'isometric'}.webp`; if(assetKindOf(b)==='prop') return `./assets/image2-clean/common/props/${commonAssetName(b)}.webp`; if(assetKindOf(b)==='road') return roadAssetSrc({type:b.roadType||defaultRoadTypeId()}); return `./assets/image2-clean/buildings-normalized/${b.id}.webp`; }
function spriteSizeFor(b){ if(assetKindOf(b)==='ground') return Math.round((isTopDownCamera()?62:70)*state.gridZoom); if(assetKindOf(b)==='prop') return Math.round((b.commonAsset==='tree'?92:b.commonAsset==='rock'?74:64)*state.gridZoom); const footprint=Math.max(b.size?.[0]||1,b.size?.[1]||1); const area=(b.size?.[0]||1)*(b.size?.[1]||1); return Math.round((72+area*11+footprint*9+(b.category==='landmark'?14:0))*state.gridZoom); }
function updatePlacementGhost(){ if(!state.selectedId||!state.hoverTile){ if(state.placementGhost) state.placementGhost.style.display='none'; return; } renderPlacementGhost(state.hoverTile.x,state.hoverTile.y); }
function renderPlacementGhost(x,y){ const b=buildingById(state.selectedId); if(!b) return; const p={type:b.id,x,y,level:1}; const s=screenCenterOf(p); const c=canPlace(b.id,x,y); let node=state.placementGhost; if(!node||node.dataset.type!==b.id||!node.isConnected){ node?.remove(); node=document.createElement('div'); node.dataset.type=b.id; node.innerHTML=`<img class="building-sprite" src="${assetSrcFor(b)}" alt="">`; state.placementGhost=node; els.map.appendChild(node); } node.className=`building placement-ghost ${assetKindOf(b)==='ground'?'ground-asset':''} ${assetKindOf(b)==='prop'?'prop-asset':''} ${c.ok?'ok':'bad'}`; const footprint=assetKindOf(b)==='ground'?'common-ground':`${b.size?.[0]||1}x${b.size?.[1]||1}`; node.dataset.footprint=footprint; node.style.display='block'; node.style.left=`${s.left}px`; node.style.top=`${s.top}px`; node.style.zIndex=String(depthFromTop(s.top,15)); node.style.setProperty('--sprite-size',`${spriteSizeFor(b)}px`); }
function renderBuilding(p){ const b=buildingById(p.type); if(!b) return; const s=screenCenterOf(p); const kind=assetKindOf(b); const node=document.createElement('div'); node.className=`building ${b.category} ${kind==='ground'?'ground-asset':''} ${kind==='prop'?'prop-asset':''} ${adjacentToRoad(p)?'':'needs-road'} ${p.id===state.selectedPlacedId?'selected':''}`; node.dataset.footprint=kind==='ground'?'common-ground':`${b.size?.[0]||1}x${b.size?.[1]||1}`; node.style.left=`${s.left}px`; node.style.top=`${s.top}px`; node.style.zIndex=String(depthFromTop(s.top,kind==='ground'?8:30)); node.style.setProperty('--sprite-size',`${spriteSizeFor(b)}px`); node.innerHTML=`<img class="building-sprite" src="${assetSrcFor(b)}" alt="${b.name}" loading="eager"><span class="level-badge">Lv.${p.level||1}</span>`; node.title=b.name; node.onclick=e=>{ e.stopPropagation(); if(state.selectedId||state.roadBuildMode||state.gridEditing) return; selectPlaced(p.id); }; els.map.appendChild(node); }
function renderPalette(){ const order=['common','transport','residential','commercial','service','landmark','campus','bridge']; const cats=[...new Set(state.buildings.map(b=>b.category))].sort((a,b)=>order.indexOf(a)-order.indexOf(b)); if(!cats.includes(state.category)) state.category=cats[0]||'landmark'; els.categoryTabs.innerHTML=cats.map(c=>`<button class="${c===state.category?'active':''}" data-cat="${c}">${CATEGORY_LABELS[c]||c}</button>`).join(''); els.categoryTabs.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{state.category=btn.dataset.cat;renderPalette();}); els.buildingList.innerHTML=state.buildings.filter(b=>b.category===state.category).map(b=>{ const isRoad=b.assetKind==='road'||b.roadType; const activeRoad=isRoad&&state.roadBuildMode&&state.activeRoadType===(b.roadType||b.id); const cost=isRoad?(roadTypeById(b.roadType)?.cost??b.cost):b.cost; const src=isRoad?roadAssetSrc({type:b.roadType||defaultRoadTypeId()}):assetSrcFor(b); const meta=isRoad?`1x1 · ${fmt(cost)} · PATH`: `${b.size[0]}x${b.size[1]} · ${fmt(b.cost)}${b.category==='common'?' · SCENE':` · UPKEEP ${b.maintenance} / MO`}`; return `<button class="build-card ${(state.selectedId===b.id||activeRoad)?'active':''} ${state.money>=cost?'':'locked'}" data-id="${b.id}"><img src="${src}" alt=""><span><b>${b.name}</b><small>${meta}</small></span></button>`; }).join(''); els.buildingList.querySelectorAll('.build-card').forEach(btn=>btn.onclick=()=>{ const b=buildingById(btn.dataset.id); const isRoad=b.assetKind==='road'||b.roadType||b.category==='transport'; const cost=isRoad?(roadTypeById(b.roadType)?.cost??b.cost):b.cost; if(state.money<cost) return message('NOT ENOUGH CASH. GROW INCOME FIRST.','invalid'); if(isRoad){ state.activeRoadType=b.roadType||defaultRoadTypeId(); state.roadBuildMode=true; state.selectedId=null; state.roadDraft=null; state.selectedPlacedId=null; clearPlacement(); closeInfoPanel(); document.body.classList.add('road-building'); document.body.classList.remove('road-dragging'); els.selectedLabel.textContent=roadTypeById(state.activeRoadType)?.name||b.name; message(`${els.selectedLabel.textContent}: PRESS A START TILE AND DRAG TO AN END TILE.`); renderAll(); closeModal(); return; } state.selectedId=b.id; state.roadBuildMode=false; state.roadDraft=null; state.selectedPlacedId=null; closeModal(); document.body.classList.remove('road-building','road-dragging'); els.selectedLabel.textContent=b.name; document.body.classList.add('placing'); message(`BUILD MODE: ${b.name}. CLICK A TILE. ESC / RIGHT CLICK TO CANCEL.`); renderMap(); }); const selected=buildingById(state.selectedId); els.selectedLabel.textContent=state.roadBuildMode?(roadTypeById(state.activeRoadType)?.name||'ROAD PATH'):(selected?.name||'SELECT'); }
function renderGoals(){ els.goals.innerHTML=state.goals.map(g=>`<li class="${state.completedGoals[g.id]?'done':''}">${g.label}</li>`).join(''); }
function logLine(text){ const div=document.createElement('div'); div.className='log-line'; div.textContent=`${state.month} MO · ${text}`; els.log.prepend(div); while(els.log.children.length>8) els.log.lastChild.remove(); }
function message(text,sound='tap'){ els.message.textContent=text; window.RoomCareSfx?.play(sound); }
function floatText(text,p){ const s=p?screenCenterOf(p):{left:560,top:330}; const n=document.createElement('div'); n.className='float-text'; n.style.left=`${s.left}px`; n.style.top=`${s.top-60}px`; n.textContent=text; els.floats.appendChild(n); setTimeout(()=>n.remove(),1200); }
function spawnBuildImpact(p){ const b=buildingById(p.type); if(!b) return; const s=screenCenterOf(p); const w=(b.size?.[0]||1), h=(b.size?.[1]||1); const scale=clamp((w+h)/3,.9,2.2); const root=document.createElement('div'); root.className='build-impact'; root.style.left=`${s.left}px`; root.style.top=`${s.top+5}px`; root.style.zIndex=String(depthFromTop(s.top,75)); const count=clamp(Math.round(12+scale*6),14,24); for(let i=0;i<count;i++){ const a=(Math.PI*2/count)*i+(Math.random()-.5)*.34; const dist=(18+Math.random()*24)*scale*state.gridZoom; const dust=document.createElement('i'); dust.className='build-impact-dust'; dust.style.left=`${(Math.random()-.5)*10}px`; dust.style.top=`${(Math.random()-.5)*6}px`; dust.style.setProperty('--dx',`${Math.cos(a)*dist}px`); dust.style.setProperty('--dy',`${Math.sin(a)*dist*.38-4}px`); dust.style.setProperty('--dust-scale',`${(.72+Math.random()*.62)*scale}`); dust.style.animationDelay=`${Math.random()*45}ms`; root.appendChild(dust); } els.floats.appendChild(root); setTimeout(()=>root.remove(),760); }
function placeSelected(x,y){ if(!state.selectedId) return; const b=buildingById(state.selectedId); const c=canPlace(b.id,x,y); if(!c.ok) return message(c.reason,'invalid'); const p={id:`b${state.nextId++}`,type:b.id,x,y,level:1,age:0}; state.placed.push(p); state.money-=b.cost; state.selectedPlacedId=null; clearPlacement(); closeModal(); message(`BUILT: ${b.name}. CLICK IT TO INSPECT.`,'build'); floatText(`-${fmt(b.cost)}`,p); recalc(); checkGoals(); renderResources(); renderGoals(); renderPalette(); renderMap(); spawnBuildImpact(p); save(); }
function sourceBlock(b){ return `<div class="source-box"><b>MODULE NOTES</b><br>This block is tuned for road, neighborhood, and zone synergy.</div>`; }
function openInfoPanel(){ openModal('info'); } function closeInfoPanel(){ if(state.activeModal==='info') closeModal(); else els.infoPanel.classList.remove('open'); }
function selectPlaced(id){ state.selectedPlacedId=id; const p=placedById(id); if(!p) return; const b=buildingById(p.type); openInfoPanel(); els.infoContent.innerHTML=`<h2 class="info-title">${b.name} Lv.${p.level}</h2><p>${b.desc||''}</p><div class="info-grid"><div>COST $${fmt(b.cost)}</div><div>UPKEEP $${fmt(b.maintenance)}</div><div>INCOME $${fmt(incomeOf(p))} / MO</div><div>POP ${fmt((b.population||0)*p.level)}</div><div>ROAD LINK ${adjacentToRoad(p)?'100%':'45%'}</div><div>ZONE ${regionForTile(p.x,p.y)?.name||'-'}</div></div>${sourceBlock(b)}<div class="synergy-box"><b>SYNERGY</b><br>${synergyText(p)}</div><div class="info-actions"><button id="upgradeBtn">UPGRADE $${fmt(upgradeCost(p))}</button><button id="bulldozeBtn">DEMOLISH</button></div>`; document.getElementById('upgradeBtn').onclick=()=>upgradeBuilding(p.id); document.getElementById('bulldozeBtn').onclick=()=>bulldozeBuilding(p.id); renderMap(); }
function synergyText(p){ return 'Buildings only sync with roads and facilities in the same build zone. Agents do not travel between separate zones.'; }
function upgradeCost(p){ return Math.round(buildingById(p.type).cost*(.55+p.level*.42)); }
function upgradeBuilding(id){ const p=placedById(id); if(!p||p.level>=5) return message('MAX LEVEL','invalid'); const cost=upgradeCost(p); if(state.money<cost) return message('NOT ENOUGH CASH TO UPGRADE.','invalid'); state.money-=cost; p.level++; message(`UPGRADED: ${buildingById(p.type).name} Lv.${p.level}`,'upgrade'); recalc(); renderAll(); selectPlaced(id); save(); }
function bulldozeBuilding(id){ const p=placedById(id); const b=buildingById(p.type); state.money+=Math.round(b.cost*.35); state.placed=state.placed.filter(q=>q.id!==id); state.selectedPlacedId=null; closeInfoPanel(); message(`DEMOLISHED: ${b.name}`,'build'); recalc(); renderAll(); save(); }
function incomeOf(p){ const b=buildingById(p.type); let mult=p.level||1; if(!adjacentToRoad(p)) mult*=.45; return Math.round((b.income||0)*mult); }
function recalc(){ let pop=0,popularity=0,commerce=0,culture=0,traffic=0,satisfaction=65,cap=0,income=0,maint=0; state.placed.forEach(p=>{ const b=buildingById(p.type); if(!b) return; const eff=b.effects||{}, lvl=p.level||1; pop+=(b.population||0)*lvl; popularity+=(eff.popularity||0)*lvl; commerce+=(eff.commerce||0)*lvl; culture+=(eff.culture||0)*lvl; traffic+=(eff.traffic||0)*lvl; satisfaction+=(eff.satisfaction||0); cap+=(eff.trafficCapacity||0)*lvl; income+=incomeOf(p); maint+=(b.maintenance||0)*lvl; }); state.population=Math.round(pop); state.popularity=Math.round(popularity); state.commerce=Math.round(commerce); state.culture=Math.round(culture); state.traffic=clamp(Math.round(traffic-cap*.35),0,100); state.satisfaction=clamp(Math.round(satisfaction-state.traffic*.25),0,100); state.monthlyIncome=Math.round(income-maint+state.population*2+state.popularity*4+state.commerce*8+state.culture*3); }
function monthTick(){ state.month++; state.placed.forEach(p=>p.age++); recalc(); state.money+=state.monthlyIncome; spawnAgents(); checkGoals(); renderResources(); renderGoals(); els.cycleLabel.textContent=`M ${state.month}`; save(); }
function checkGoals(){ state.goals.forEach(g=>{ if(state.completedGoals[g.id]) return; let ok=false; if(g.type==='built') ok=(g.building==='road'?state.roads.length:state.placed.filter(p=>p.type===g.building).length)>=g.count; if(g.type==='categoryBuilt') ok=state.placed.filter(p=>buildingById(p.type)?.category===g.category).length>=g.count; if(g.type==='metric') ok=(state[g.metric]||0)>=g.target; if(ok){ state.completedGoals[g.id]=true; Object.entries(g.reward||{}).forEach(([k,v])=>{if(k in state) state[k]+=v;}); logLine(g.message||g.label); message(`QUEST DONE: ${g.label}`,'coin'); } }); }
function roadNeighbors(cell){ const c=roadCells(cell.regionId); return [[cell.x+1,cell.y],[cell.x-1,cell.y],[cell.x,cell.y+1],[cell.x,cell.y-1]].filter(([x,y])=>c.has(`${x},${y}`)).map(([x,y])=>({x,y,regionId:cell.regionId})); }
function nearestRoadToBuilding(p){ const b=buildingById(p.type); const r=regionForTile(p.x,p.y); const roads=state.roads.filter(rd=>rd.regionId===r?.id); if(!roads.length) return null; const cx=p.x+(b.size?.[0]||1)/2, cy=p.y+(b.size?.[1]||1)/2; return roads.reduce((best,rd)=>{ const d=Math.abs(rd.x-cx)+Math.abs(rd.y-cy); return !best||d<best.d?{...rd,d}:best;},null); }
function findRoadPath(start,end){ if(!start||!end||start.regionId!==end.regionId) return []; const queue=[start], came=new Map([[`${start.x},${start.y}`,null]]); while(queue.length){ const cur=queue.shift(), key=`${cur.x},${cur.y}`; if(key===`${end.x},${end.y}`) break; roadNeighbors(cur).forEach(n=>{ const nk=`${n.x},${n.y}`; if(came.has(nk)) return; came.set(nk,cur); queue.push(n); }); } if(!came.has(`${end.x},${end.y}`)) return []; const path=[]; let cur=end; while(cur){ path.unshift(cur); cur=came.get(`${cur.x},${cur.y}`); } return path; }
function moveAgentAlongPath(agent,path){ const points=path.map(p=>tileToScreen(p.x,p.y)); points.forEach((pt,i)=>setTimeout(()=>{ agent.style.left=`${pt.left}px`; agent.style.top=`${pt.top-18}px`; agent.style.zIndex=String(depthFromTop(pt.top,60)); },90+i*520)); return 1200+points.length*520; }
function spawnAgents(){ if(!state.roads.length) return; const roadsByRegion=new Map(); state.roads.forEach(r=>{ if(!roadsByRegion.has(r.regionId)) roadsByRegion.set(r.regionId,[]); roadsByRegion.get(r.regionId).push(r); }); const allTargets=state.placed.filter(p=>nearestRoadToBuilding(p)); const amount=Math.min(5, Math.max(1, Math.floor(state.population/320)+Math.floor(state.popularity/85)+1)); for(let i=0;i<amount;i++){ if(Math.random()>.82) continue; const c=state.characters[i%Math.max(1,state.characters.length)]; if(!c) break; let tos=allTargets.filter(p=>c.to?.includes(p.type)); if(!tos.length) tos=allTargets; const regions=[...roadsByRegion.keys()].filter(id=>roadsByRegion.get(id)?.length>1); if(!regions.length) return; const to=tos.length?tos[Math.floor(Math.random()*tos.length)]:null; const target=to?nearestRoadToBuilding(to):null; const regionId=target?.regionId || regions[Math.floor(Math.random()*regions.length)]; const roads=roadsByRegion.get(regionId)||[]; if(roads.length<2) continue; const from=roads[Math.floor(Math.random()*roads.length)]; const end=target || roads[Math.floor(Math.random()*roads.length)]; const path=findRoadPath(from,end); if(path.length<2) continue; const a=document.createElement('div'); a.className='agent'; a.innerHTML=`<img src="./assets/image2-clean/characters-normalized/${c.id}.webp" alt="${c.name}">`; a.dataset.line=(c.lines||['Just walking the city today.'])[Math.floor(Math.random()*(c.lines?.length||1))]; const fs=tileToScreen(from.x,from.y); a.style.left=`${fs.left}px`; a.style.top=`${fs.top-18}px`; a.style.zIndex=String(depthFromTop(fs.top,60)); els.map.appendChild(a); const life=moveAgentAlongPath(a,path); if(Math.random()<.62) setTimeout(()=>a.classList.add('speaking'),Math.min(1700,life*.45)); setTimeout(()=>a.remove(),life+1800); } }
function cycleHeat(){ const i=HEAT_MODES.indexOf(state.heatMode); state.heatMode=HEAT_MODES[(i+1)%HEAT_MODES.length]; els.heatBtn.classList.toggle('active',Boolean(state.heatMode)); els.heatBtn.textContent=state.heatMode?`${METRIC_LABELS[state.heatMode]} MAP`:'HEATMAP'; renderMap(); renderResources(); }
function setCameraMode(mode){ state.cameraMode=normalizeCameraMode(mode); state.gridZoom=normalizeGridZoom(); syncCameraClass(); saveGridCalibration(); renderAll(); message(`CAMERA: ${CAMERA_LABELS[state.cameraMode]}`); }
function toggleCameraMode(){ const i=CAMERA_MODES.indexOf(state.cameraMode); setCameraMode(CAMERA_MODES[(i+1)%CAMERA_MODES.length]); }
function saveGridCalibration(){ localStorage.setItem(GRID_SAVE_KEY,JSON.stringify({gridZoom:state.gridZoom,viewX:state.viewX,viewY:state.viewY,roads:state.roads,activeRoadType:state.activeRoadType,cameraMode:state.cameraMode})); }
function loadGridCalibration(){ state.regions=normalizeRegions(); try{ const saved=JSON.parse(localStorage.getItem(GRID_SAVE_KEY)||'null'); if(!saved){ state.gridZoom=normalizeGridZoom(); state.activeRoadType=roadTypeById(state.activeRoadType)?.id||defaultRoadTypeId(); return; } state.gridZoom=Number(saved.gridZoom)||state.gridZoom; state.viewX=Number(saved.viewX)||0; state.viewY=Number(saved.viewY)||0; state.cameraMode=normalizeCameraMode(saved.cameraMode||state.cameraMode); state.activeRoadType=roadTypeById(saved.activeRoadType)?.id || defaultRoadTypeId(); state.gridZoom=normalizeGridZoom(); clampViewPan(); state.roads=(saved.roads||[]).filter(rd=>regionForTile(rd.x,rd.y)).map(rd=>normalizeRoad({...rd,regionId:'world'})); }catch(e){console.warn(e); state.gridZoom=normalizeGridZoom(); state.activeRoadType=defaultRoadTypeId();} }
function startRegionDrag(event,id){ if(!state.gridEditing) return; event.preventDefault(); const r=regionById(id); state.activeRegionId=id; state.regionDrag={id,startX:event.clientX,startY:event.clientY,baseX:r.offsetX||0,baseY:r.offsetY||0,invalid:false}; event.currentTarget.setPointerCapture?.(event.pointerId); addEventListener('pointermove',dragRegion); addEventListener('pointerup',stopRegionDrag,{once:true}); }
function dragRegion(event){ if(!state.regionDrag) return; const r=regionById(state.regionDrag.id); r.offsetX=state.regionDrag.baseX+(event.clientX-state.regionDrag.startX); r.offsetY=state.regionDrag.baseY+(event.clientY-state.regionDrag.startY); state.regionDrag.invalid=regionVisuallyOverlaps(r.id); renderMap(); }
function stopRegionDrag(){ if(!state.regionDrag) return; const drag=state.regionDrag; const r=regionById(drag.id); const invalid=drag.invalid || regionVisuallyOverlaps(drag.id); if(invalid){ r.offsetX=drag.baseX; r.offsetY=drag.baseY; message('BUILD ZONES CANNOT OVERLAP. POSITION RESTORED.','invalid'); } else { saveGridCalibration(); message('ZONE POSITION SAVED.'); } state.regionDrag=null; removeEventListener('pointermove',dragRegion); renderMap(); }
function addRegion(){ message('BUILD AREA ALREADY COVERS THE FULL WINDOW.'); }
function toggleGridEditing(){ state.gridEditing=false; document.body.classList.remove('grid-editing'); message('BUILD AREA IS HIDDEN AND COVERS THE FULL WINDOW.'); renderMap(); }
function resetGridCalibration(){ state.regions=normalizeRegions(); state.roads=[]; state.activeRoadType=defaultRoadTypeId(); state.gridZoom=BASE_GRID_ZOOM; state.viewX=0; state.viewY=0; state.cameraMode=normalizeCameraMode(state.config?.camera?.mode||'isometric'); state.gridZoom=normalizeGridZoom(); localStorage.removeItem(GRID_SAVE_KEY); message('ROADS AND CAMERA CALIBRATION RESET.'); renderMap(); }
function save(){ localStorage.setItem(SAVE_KEY,JSON.stringify({money:state.money,month:state.month,placed:state.placed,nextId:state.nextId,completedGoals:state.completedGoals,selectedId:state.selectedId,category:state.category})); saveGridCalibration(); }
function loadSave(){ try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); if(!s) return; Object.assign(state,{money:s.money??state.money,month:s.month??1,placed:s.placed||[],nextId:s.nextId||1,completedGoals:s.completedGoals||{},selectedId:s.selectedId??null,category:s.category||'landmark'}); state.placed=(state.placed||[]).filter(p=>buildingById(p.type)); if(state.selectedId&&!buildingById(state.selectedId)) state.selectedId=null; }catch(e){console.warn(e);} }
function renderAll(){ syncCameraClass(); renderResources(); renderPalette(); renderMap(); renderGoals(); els.cycleLabel.textContent=`M ${state.month}`; els.modeLabel.textContent=state.roadBuildMode?'ROAD':(state.gridEditing?'EDIT':'BUILD'); const camBtn=document.getElementById('cameraModeBtn'); if(camBtn) camBtn.textContent=`CAMERA ${CAMERA_LABELS[state.cameraMode]}`; }
function clearPlacement(){ state.selectedId=null; state.hoverTile=null; state.placementGhost?.remove(); state.placementGhost=null; document.body.classList.remove('placing'); }
function modalMap(){ return { build:els.buildPanel, status:els.statusPanel, goals:els.goalPanel, settings:els.settingsPanel, info:els.infoPanel }; }
function dockButtons(){ return [els.buildDockBtn, els.statusDockBtn, els.goalsDockBtn, els.settingsToggleBtn].filter(Boolean); }
function setDockState(active){ dockButtons().forEach(btn=>{ const on=btn.dataset.modal===active; btn.classList.toggle('active',on); btn.setAttribute('aria-expanded',String(on)); }); }
function openModal(name){ Object.entries(modalMap()).forEach(([key,panel])=>panel?.classList.toggle('open',key===name)); state.activeModal=name; setDockState(name); }
function closeModal(){ Object.values(modalMap()).forEach(panel=>panel?.classList.remove('open')); state.activeModal=null; setDockState(null); }
function toggleModal(name){ state.activeModal===name ? closeModal() : openModal(name); }
function closeAllPanels(){ clearPlacement(); state.roadBuildMode=false; state.roadDraft=null; state.selectedPlacedId=null; closeModal(); document.body.classList.remove('road-building','road-dragging'); }
function tileFromPointer(event){ const m=gridMetrics(); const pt=screenToMapPoint(event); let best=null; state.regions.forEach(r=>{ if(isTopDownCamera()){ const gx=(pt.x-m.ox-(r.offsetX||0))/m.tw, gy=(pt.y-m.oy-(r.offsetY||0))/m.th; const x=Math.round(gx), y=Math.round(gy); if(x<r.x||y<r.y||x>=r.x+r.cols||y>=r.y+r.rows) return; const c=tileToScreen(x,y); const nx=Math.abs(pt.x-c.left)/(m.tileW/2), ny=Math.abs(pt.y-c.top)/(m.tileH/2); if(nx<=1.05&&ny<=1.05) best={x,y,regionId:r.id}; return; } const dx=pt.x-m.ox-(r.offsetX||0), dy=pt.y-m.oy-(r.offsetY||0); const gx=(dx/m.tw+dy/m.th)/2, gy=(dy/m.th-dx/m.tw)/2; const x=Math.floor(gx+.5), y=Math.floor(gy+.5); if(x<r.x||y<r.y||x>=r.x+r.cols||y>=r.y+r.rows) return; const c=tileToScreen(x,y); const nx=Math.abs(pt.x-c.left)/(m.tileW/2), ny=Math.abs(pt.y-c.top)/(m.tileH/2); if(nx+ny<=1.12) best={x,y,regionId:r.id}; }); return best; }
function draftPath(a,b){ if(!a||!b||a.regionId!==b.regionId) return []; const path=[]; const type=roadTypeById(state.activeRoadType)?.id||defaultRoadTypeId(); const sx=a.x<=b.x?1:-1; for(let x=a.x;x!==b.x+sx;x+=sx) path.push({x,y:a.y,regionId:a.regionId,type}); const sy=a.y<=b.y?1:-1; for(let y=a.y+sy;y!==b.y+sy;y+=sy) path.push({x:b.x,y,regionId:a.regionId,type}); return path.filter(p=>regionForTile(p.x,p.y)?.id===a.regionId); }
function startRoad(tile){ const type=roadTypeById(state.activeRoadType)?.id||defaultRoadTypeId(); state.roadDraft={start:{...tile,type},path:[{...tile,type}]}; message(`${roadTypeById(type)?.name||'Road'}: DRAG TO AN END TILE AND RELEASE TO BUILD.`); }
function commitRoad(){ if(!state.roadDraft) return; const existing=roadCells(); const blocked=occupiedCells(null,{includeGround:false}); let added=0, blockedCount=0; state.roadDraft.path.forEach(p=>{ const key=cellKey(p); if(blocked.has(key) && !existing.has(key)){ blockedCount++; return; } if(!existing.has(key)){ state.roads.push(normalizeRoad(p)); existing.add(key); added++; } }); state.roadDraft=null; if(added) state.money=Math.max(0,state.money-added*activeRoadCost()); save(); recalc(); renderAll(); message(blockedCount?`BUILT ${added} ROAD TILES. SKIPPED ${blockedCount} OCCUPIED TILES.`:`BUILT ${added} ROAD TILES.`,'build'); }
function handleMapPointerMove(event){ const tile=tileFromPointer(event); if(state.roadBuildMode&&state.roadDraft){ if(tile) state.roadDraft.path=draftPath(state.roadDraft.start,tile); renderRoads(); return; } if(!state.selectedId) return; if(!tile){ if(state.hoverTile){state.hoverTile=null;renderMap();} return; } if(!state.hoverTile||state.hoverTile.x!==tile.x||state.hoverTile.y!==tile.y){ state.hoverTile=tile; renderMap(); } }
function handleMapClick(event){ if(state.roadBuildMode) return; if(!state.selectedId) return; event.preventDefault(); event.stopPropagation(); const tile=tileFromPointer(event); if(tile) placeSelected(tile.x,tile.y); }
function handlePointerDown(event){ if(!state.roadBuildMode) return; const tile=tileFromPointer(event); if(tile){ event.preventDefault(); document.body.classList.add('road-dragging'); startRoad(tile); renderRoads(); } }
function handlePointerUp(event){ if(state.roadBuildMode&&state.roadDraft){ event?.preventDefault?.(); document.body.classList.remove('road-dragging'); commitRoad(); } }
function ensureEditorButtons(){ if(!document.getElementById('roadBuildBtn')){ const b=document.createElement('button'); b.id='roadBuildBtn'; b.textContent='ROAD TOOL'; els.settingsMenu.insertBefore(b,els.inspectBtn); b.onclick=()=>{state.roadBuildMode=!state.roadBuildMode; state.activeRoadType=roadTypeById(state.activeRoadType)?.id||defaultRoadTypeId(); clearPlacement(); if(state.roadBuildMode){ closeInfoPanel(); state.selectedPlacedId=null; state.gridEditing=false; document.body.classList.remove('grid-editing'); if(els.gridEditBtn){ els.gridEditBtn.classList.remove('active'); els.gridEditBtn.textContent='EDIT GRID'; } } document.body.classList.toggle('road-building',state.roadBuildMode); b.classList.toggle('active',state.roadBuildMode); message(state.roadBuildMode?`${roadTypeById(state.activeRoadType)?.name||'ROAD'}: PRESS A START TILE AND DRAG TO AN END TILE.`:'ROAD TOOL OFF.'); renderAll(); closeModal();}; } if(!document.getElementById('cameraModeBtn')){ const b=document.createElement('button'); b.id='cameraModeBtn'; b.textContent=`CAMERA ${CAMERA_LABELS[state.cameraMode]}`; els.settingsMenu.insertBefore(b,els.inspectBtn); b.onclick=()=>{toggleCameraMode(); b.textContent=`CAMERA ${CAMERA_LABELS[state.cameraMode]}`; closeModal();}; } }
function bind(){
  ensureEditorButtons();
  els.resetBtn.onclick=()=>{
    localStorage.removeItem(SAVE_KEY); localStorage.removeItem(GRID_SAVE_KEY);
    state.placed=[]; state.roads=[]; state.activeRoadType=defaultRoadTypeId(); state.regions=normalizeRegions(); state.activeRegionId='world'; state.gridZoom=BASE_GRID_ZOOM; state.viewX=0; state.viewY=0; state.cameraMode=normalizeCameraMode(state.config?.camera?.mode||'isometric'); state.gridEditing=false; state.regionDrag=null; state.roadDraft=null; state.nextId=1; state.month=1; state.money=50000; state.completedGoals={}; state.selectedId=null; state.selectedPlacedId=null;
    document.body.classList.remove('grid-editing','road-building','road-dragging');
    if(els.gridEditBtn){ els.gridEditBtn.classList.remove('active'); els.gridEditBtn.textContent='EDIT GRID'; }
    closeAllPanels(); recalc(); renderAll();
    els.infoContent.innerHTML='<p class="empty-info">Click a placed building to inspect, upgrade, or demolish it.</p>';
    message('RESET COMPLETE: BUILDINGS, ROADS, ZONES, AND GRID CALIBRATION RESTORED.');
  };
  els.buildDockBtn.onclick=e=>{e.stopPropagation();toggleModal('build');};
  els.statusDockBtn.onclick=e=>{e.stopPropagation();toggleModal('status');};
  els.goalsDockBtn.onclick=e=>{e.stopPropagation();toggleModal('goals');};
  els.settingsToggleBtn.onclick=e=>{e.stopPropagation();toggleModal('settings');};
  Object.values(modalMap()).forEach(panel=>panel?.addEventListener('click',e=>e.stopPropagation()));
  document.addEventListener('click',()=>closeModal());
  if(els.gridEditBtn) els.gridEditBtn.onclick=()=>{toggleGridEditing();closeModal();};
  if(els.gridResetBtn) els.gridResetBtn.onclick=()=>{resetGridCalibration();closeModal();};
  els.heatBtn.onclick=()=>{cycleHeat();closeModal();};
  els.inspectBtn.onclick=()=>{document.body.classList.toggle('inspect-mode');els.inspectBtn.classList.toggle('active');message('Click a building to inspect module notes.');};
  els.map.addEventListener('pointerdown',handlePointerDown);
  els.mapWrap.addEventListener('pointerdown',startViewportPan);
  els.mapWrap.addEventListener('pointermove',dragViewportPan);
  window.addEventListener('pointerup',stopViewportPan);
  els.minimapWorld?.addEventListener('pointerdown',startMinimapNavigation);
  els.minimapWorld?.addEventListener('pointermove',dragMinimapNavigation);
  window.addEventListener('pointerup',stopMinimapNavigation);
  window.addEventListener('pointerup',handlePointerUp);
  els.map.addEventListener('pointermove',handleMapPointerMove);
  els.map.addEventListener('pointerleave',()=>{state.hoverTile=null;updatePlacementGhost();});
  els.map.addEventListener('click',handleMapClick);
  els.infoTab?.addEventListener('click',()=>{ if(els.infoPanel.classList.contains('open')) closeInfoPanel(); else if(state.selectedPlacedId) openInfoPanel(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeAllPanels();renderAll();} });
  window.addEventListener('contextmenu',e=>{e.preventDefault();closeAllPanels();renderAll();});
  els.mapWrap.addEventListener('wheel',handleMapWheel,{passive:false});
  window.addEventListener('resize',()=>{ state.gridZoom=normalizeGridZoom(); clampViewPan(); renderMap(); });
}
async function init(){ const [config,buildings,chars,goals,events]=await Promise.all([loadJson('./data/project-config.json',{}),loadJson('./data/buildings.json',[]),loadJson('./data/characters.json',[]),loadJson('./data/goals.json',[]),loadJson('./data/events.json',[])]); state.config=config; state.roadTypes=normalizeRoadTypes(config); state.activeRoadType=roadTypeById(config?.roads?.defaultType)?.id || defaultRoadTypeId(); state.buildings=buildings; state.characters=chars; state.goals=goals; state.events=events; state.cols=REGION_TEMPLATE.cols; state.rows=REGION_TEMPLATE.rows; state.regions=normalizeRegions(); state.money=50000; const cfg=state.config||config; els.title.textContent=cfg.title||'Block City Builder'; els.subtitle.textContent=cfg.subtitle||'Modular City Management'; els.brand.textContent=cfg.brandMark||'$'; els.message.textContent=cfg.initialMessage||'Plan roads, homes, services, shops, and landmarks. Keep agents moving and the city growing.'; state.cameraMode=normalizeCameraMode(cfg.camera?.mode||state.cameraMode); loadGridCalibration(); loadSave(); recalc(); bind(); renderAll(); setInterval(monthTick,(config.tickSeconds||8)*1000); setInterval(spawnAgents,10000); logLine('City board online.'); }
window.__brickCityQA = {
  state,
  regionForTile,
  tileToScreen,
  canPlace,
  draftPath,
  cellKey,
  roadCells,
  occupiedCells,
  findRoadPath,
  moveAgentAlongPath,
  nearestRoadToBuilding,
  minGridZoom,
  normalizeGridZoom,
  setGridZoom,
  renderMinimap,
  clampViewPan,
  syncWorldTransform,
  panRange,
  setViewCenterTile,
  updateMinimapNavigation,
  depthFromTop,
  run(){
    const report = [];
    const assert = (name, ok) => report.push({ name, ok: Boolean(ok) });
    const testType = state.buildings.find(b => b.category !== 'transport')?.id;
    const r = state.regions[0];
    assert('default has one hidden full-window build region', state.regions.length === 1 && r.id === 'world');
    assert('building accepts center of full-window region when empty', testType ? canPlace(testType, 0, 0).ok : true);
    assert('depth ordering strongly follows lower screen position', depthFromTop(260,0) > depthFromTop(250,75));
    assert('camera modes are available', CAMERA_MODES.includes('isometric') && CAMERA_MODES.includes('rpg_topdown'));
    assert('road type config supports multiple path styles', state.roadTypes.length >= 4 && state.roadTypes.some(t => t.id === 'dirt') && state.roadTypes.some(t => t.id === 'grass'));
    const oldActiveRoadType = state.activeRoadType;
    state.activeRoadType = 'dirt';
    const typedDraft = draftPath({x:0,y:0,regionId:'world'}, {x:2,y:0,regionId:'world'});
    assert('road draft stores active road type per tile', typedDraft.length === 3 && typedDraft.every(step => step.type === 'dirt'));
    assert('road asset contract includes camera-specific reusable connection shapes', state.roadTypes.every(t => ROAD_SHAPES.every(shape => t.assets?.variants?.[`isometric-${shape}`] && t.assets?.variants?.[`topdown-${shape}`])));
    const oldRoadShapePlan = [...state.roads];
    state.roads = [{x:0,y:0,regionId:'world',type:'stone'},{x:1,y:0,regionId:'world',type:'stone'},{x:1,y:1,regionId:'world',type:'stone'}];
    assert('topdown road visual can choose straight and corner shapes from neighbors', roadVisual(state.roads[0]).shape === 'straight-x' && roadVisual(state.roads[1]).shape === 'corner');
    assert('isometric road rendering uses fixed authored tile without connector selection', roadAssetSrc(state.roads[1]) === roadTypeById('stone').assets.isometric);
    assert('isometric road rendering does not rotate authored assets', !('rotate' in roadVisual(state.roads[1])) && !/rotate\(/.test(getComputedStyle(document.querySelector('.preset-road img')||document.body).transform));
    state.roads = oldRoadShapePlan;
    state.activeRoadType = oldActiveRoadType;
    const oldZoom = state.gridZoom;
    state.gridZoom = .01;
    renderMap();
    assert('wheel zoom clamp prevents map smaller than viewport', state.gridZoom >= minGridZoom() - .001);
    assert('zoom out does not shrink assets below scene baseline', state.gridZoom >= BASE_GRID_ZOOM);
    const oldViewX = state.viewX, oldViewY = state.viewY;
    state.gridZoom = Math.min(WORLD_ZOOM_MAX, Math.max(minGridZoom(), BASE_GRID_ZOOM * 1.6));
    state.viewX = 100; state.viewY = -80; syncWorldTransform();
    assert('scene transform uses the same pan and zoom as map objects', getComputedStyle(document.documentElement).getPropertyValue('--world-x').includes('100') && Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scene-zoom')) - state.gridZoom / BASE_GRID_ZOOM) < .01);
    setViewCenterTile(24,24,{render:false,saveState:false});
    assert('setViewCenterTile changes camera pan for map navigation', Math.abs(state.viewX-oldViewX)>1 || Math.abs(state.viewY-oldViewY)>1);
    renderMinimap();
    const navFrame = els.minimapWorld?.querySelector('.minimap-view');
    assert('minimap renders viewport frame', Boolean(navFrame));
    assert('minimap navigator accepts pointer interaction', getComputedStyle(els.minimap).pointerEvents !== 'none' && getComputedStyle(els.minimapWorld).cursor === 'grab');
    state.viewX = oldViewX; state.viewY = oldViewY;
    state.gridZoom = oldZoom;
    const oldRoads = [...state.roads], oldPlaced = [...state.placed], oldMoney = state.money, oldChars = [...state.characters];
    const oldAppend = els.map.appendChild.bind(els.map);
    let capturedAgent = null;
    els.map.appendChild = node => { if(node?.classList?.contains('agent')) capturedAgent = node; return oldAppend(node); };
    state.characters = [{id:state.characters[0]?.id||'agent_01', name:'QA Agent', to:testType?[testType]:[], lines:['QA']}];
    state.roads = [{x:0,y:0,regionId:'world'},{x:1,y:0,regionId:'world'},{x:2,y:0,regionId:'world'}];
    state.placed = testType ? [{id:'qa-target', type:testType, x:2, y:1, level:1}] : [];
    const roadOnlyTarget = state.placed[0] ? nearestRoadToBuilding(state.placed[0]) : null;
    const capturedPath = roadOnlyTarget ? findRoadPath(state.roads[0], roadOnlyTarget) : [];
    assert('nearest target for a building is a road cell, not building center', Boolean(roadOnlyTarget && state.roads.some(rd => rd.x===roadOnlyTarget.x && rd.y===roadOnlyTarget.y && rd.regionId===roadOnlyTarget.regionId)));
    assert('agent road path consists only of road cells', capturedPath.length>1 && capturedPath.every(step => state.roads.some(rd => rd.x===step.x && rd.y===step.y && rd.regionId===step.regionId)));
    const oldRandom = Math.random;
    Math.random = () => 0;
    spawnAgents();
    Math.random = oldRandom;
    assert('spawned agent does not receive a building-center waypoint', capturedAgent ? capturedAgent.style.left !== `${screenCenterOf(state.placed[0]).left}px` : true);
    capturedAgent?.remove();
    els.map.appendChild = oldAppend;
    state.characters = oldChars;
    state.roads = [{x:0,y:0,regionId:'world'}];
    state.placed = testType ? [{id:'qa', type:testType, x:1, y:1, level:1}] : [];
    state.roadDraft = {start:{x:0,y:0,regionId:'world'}, path:[{x:1,y:1,regionId:'world'},{x:2,y:1,regionId:'world'}]};
    commitRoad();
    assert('road commit skips building occupied cell', !state.roads.some(rd => rd.regionId==='world' && rd.x===1 && rd.y===1));
    state.roads = oldRoads; state.placed = oldPlaced; state.money = oldMoney; state.characters = oldChars; state.activeRoadType = oldActiveRoadType; state.roadDraft = null; renderAll();
    return report;
  }
};

init();
