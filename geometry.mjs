// Analytic STEP AP203/AP214/AP242 cone-face reader. No CAD file leaves the browser.
const ids = text => [...text.matchAll(/#(\d+)/g)].map(m => Number(m[1]));
const kind = text => text?.match(/^([A-Z][A-Z_0-9]*)\s*\(/)?.[1];
const nums = text => [...text.matchAll(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:E[-+]?\d+)?/gi)].map(m => Number(m[0]));
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const norm = a => Math.hypot(...a);
const unit = a => a.map(v=>v/norm(a));
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const TAU = Math.PI * 2;

function entityMap(text) {
  if (!/ISO-10303-21\s*;/i.test(text) || !/DATA\s*;/i.test(text)) throw new Error('This is not an ISO 10303 STEP text file. Export the part as .step or .stp.');
  const map = new Map();
  for (const m of text.matchAll(/#(\d+)\s*=\s*([\s\S]*?)\s*;/g)) map.set(Number(m[1]),m[2].trim());
  if (!map.size) throw new Error('No STEP geometry entities were found.');
  return map;
}

function scaleFor(map) {
  const lengthUnits = [...map.values()].filter(v=>v.includes('LENGTH_UNIT') && v.includes('SI_UNIT'));
  const found = lengthUnits.find(v=>/\.METRE\./.test(v));
  if (!found) throw new Error('Only SI metre-based STEP length units are supported. Re-export this model in mm or m.');
  const prefix = found.match(/SI_UNIT\s*\(\s*\.([A-Z]+)\./)?.[1];
  const factors = {MILLI:1,METRE:1000,CENTI:10,MICRO:0.001,KILO:1000000};
  return prefix ? (factors[prefix] ?? 1000) : 1000;
}

export function analyzeStep(text, filename='model.step') {
  const map = entityMap(text);
  const mm = scaleFor(map);
  const get = id => map.get(id) || '';
  const point = vertex => {
    const p = get(ids(get(vertex))[0]);
    const match = p.match(/CARTESIAN_POINT\s*\([^,]*,\s*\(([^)]*)\)/);
    if (!match) throw new Error(`Could not read STEP vertex #${vertex}.`);
    return nums(match[1]);
  };
  const dir = id => {
    const m = get(id).match(/DIRECTION\s*\([^,]*,\s*\(([^)]*)\)/);
    if (!m) throw new Error(`Could not read cone axis #${id}.`);
    return unit(nums(m[1]));
  };
  const shells = new Map();
  let shellNo=0;
  for (const [id,e] of map) if (kind(e)==='CLOSED_SHELL' || kind(e)==='OPEN_SHELL') {
    shellNo++;
    for (const face of ids(e)) shells.set(face,shellNo);
  }
  const faces=[];
  const unsupported=[];
  for (const [id,e] of map) {
    if (kind(e)!=='ADVANCED_FACE') continue;
    const rr=ids(e), surface=get(rr.at(-1));
    if (kind(surface)!=='CONICAL_SURFACE') continue;
    try {
      const sm=surface.match(/CONICAL_SURFACE\s*\([^,]*,\s*#\d+\s*,\s*([-+\d.E]+)\s*,\s*([-+\d.E]+)\s*\)/i);
      if (!sm) throw new Error('invalid cone surface');
      const semi=Number(sm[2]);
      if (!(semi>0 && semi<Math.PI/2)) throw new Error('cone semi-angle outside 0–90°');
      const placement=get(ids(surface)[0]);
      const pr=ids(placement);
      const axis=dir(pr[1]);
      const originMatch=get(pr[0]).match(/CARTESIAN_POINT\s*\([^,]*,\s*\(([^)]*)\)/);
      const origin=nums(originMatch[1]);
      const bounds=rr.slice(0,-1).map(r=>get(r));
      if(bounds.length!==1) throw new Error('face has holes or multiple bounds');
      const loop=get(ids(bounds[0])[0]);
      const edges=ids(loop).map(ref=>{
        const oe=get(ref), edge=get(ids(oe)[0]), er=ids(edge);
        return {vertices:er.slice(0,2), curve:kind(get(er[2])), curveId:er[2]};
      });
      const arcs=edges.filter(x=>x.curve==='CIRCLE');
      const lines=edges.filter(x=>x.curve==='LINE');
      if(arcs.length!==2 || lines.length!==2) throw new Error('face is not bounded by two circular arcs and two straight generators');
      const radii=arcs.map(a=>{
        const vertices=a.vertices.map(point);
        const r=norm(sub(vertices[0],origin).map((v,i)=>v-dot(sub(vertices[0],origin),axis)*axis[i]));
        const c=get(a.curveId).match(/CIRCLE\s*\([^,]*,\s*#\d+\s*,\s*([-+\d.E]+)\s*\)/i);
        if(!c || Math.abs(Number(c[1])-r)>Math.max(r*0.002,1e-6)) throw new Error('circle radius disagrees with cone axis');
        const v1=sub(vertices[0],origin),v2=sub(vertices[1],origin);
        const p1=v1.map((v,i)=>v-dot(v1,axis)*axis[i]);
        const p2=v2.map((v,i)=>v-dot(v2,axis)*axis[i]);
        const sweep=Math.acos(clamp(dot(p1,p2)/(norm(p1)*norm(p2)),-1,1));
        return {radius:r*mm,sweep};
      }).sort((a,b)=>a.radius-b.radius);
      if(radii[1].radius-radii[0].radius<1e-5) throw new Error('zero radial width');
      if(Math.abs(radii[0].sweep-radii[1].sweep)>0.002) throw new Error('arc sweeps disagree');
      const sweep=(radii[0].sweep+radii[1].sweep)/2;
      if(sweep<1e-5) throw new Error('closed or zero-sweep arc needs a different face representation');
      faces.push({id,shell:shells.get(id)||0,semi,inner:radii[0].radius,outer:radii[1].radius,sweep,orientation:/\.T\.\s*\)\s*$/.test(e)});
    } catch(error) { unsupported.push({id,reason:error.message}); }
  }
  if(!faces.length) throw new Error('No supported conical sheet faces found. This tool needs analytic cone faces with two circular and two straight edges.');
  // Separate the two sides of a solid wall by radius, then keep the larger side.
  const angleGroups=new Map();
  for(const f of faces) {
    const key=`${f.shell}:${Math.round(f.semi*1e6)}`;
    if(!angleGroups.has(key))angleGroups.set(key,[]);
    angleGroups.get(key).push(f);
  }
  const patterns=[];
  for(const group of angleGroups.values()) {
    const surfaces=[];
    for(const f of group) {
      let g=surfaces.find(g=>Math.abs(g[0].inner-f.inner)<0.15 && Math.abs(g[0].outer-f.outer)<0.15);
      if(!g){g=[];surfaces.push(g);} g.push(f);
    }
    const chosen=surfaces.sort((a,b)=>(b[0].inner+b[0].outer)-(a[0].inner+a[0].outer))[0];
    const semi=chosen[0].semi;
    const total=chosen.reduce((s,f)=>s+f.sweep,0);
    if(total>TAU+0.015) {unsupported.push({id:chosen[0].id,reason:'combined face sweep exceeds a full turn'});continue;}
    const p={
      id:`P${patterns.length+1}`,body:chosen[0].shell||1,semi,
      innerRadius:chosen.reduce((s,f)=>s+f.inner,0)/chosen.length,
      outerRadius:chosen.reduce((s,f)=>s+f.outer,0)/chosen.length,
      sourceSweep:Math.min(TAU,total),faces:chosen.map(f=>f.id),
      sideCount:surfaces.length
    };
    p.flatInner=p.innerRadius/Math.sin(semi);
    p.flatOuter=p.outerRadius/Math.sin(semi);
    p.flatSweep=p.sourceSweep*Math.sin(semi);
    p.slant=p.flatOuter-p.flatInner;
    p.full=Math.abs(p.sourceSweep-TAU)<0.015;
    p.label=`Body ${p.body} · cone ${Math.round(semi*180/Math.PI)}°`;
    patterns.push(p);
  }
  patterns.sort((a,b)=>a.body-b.body||a.semi-b.semi);
  const maxByBody=new Map();
  for(const p of patterns) maxByBody.set(p.body,Math.max(maxByBody.get(p.body)||0,p.slant));
  const filtered=patterns.filter(p=>{
    if(p.slant>=maxByBody.get(p.body)*0.05)return true;
    unsupported.push({id:p.faces[0],reason:`short ${p.slant.toFixed(2)} mm conical edge face excluded as a bevel`});
    return false;
  });
  filtered.forEach((p,i)=>p.id=`P${i+1}`);
  return {filename,patterns:filtered,faceCount:faces.length,unsupported,units:'mm',shellCount:new Set(faces.map(f=>f.shell)).size};
}

export const degrees = rad => rad*180/Math.PI;
