import {degrees} from './geometry.mjs';
const f=n=>Number(n.toFixed(6));
const pt=(r,a,cx=0,cy=0)=>({x:f(cx+r*Math.cos(a)),y:f(cy+r*Math.sin(a))});

export function geometryFor(p,cx=0,cy=0) {
  const h=p.flatSweep/2,r=p.flatOuter,q=p.flatInner;
  return {outerStart:pt(r,-h,cx,cy),outerEnd:pt(r,h,cx,cy),innerStart:pt(q,-h,cx,cy),innerEnd:pt(q,h,cx,cy),cx,cy,start:-h,end:h};
}
export function pathFor(p,cx=0,cy=0) {
  const g=geometryFor(p,cx,cy),large=p.flatSweep>Math.PI?1:0;
  const xy=v=>`${v.x} ${v.y}`;
  return `M ${xy(g.outerStart)} A ${f(p.flatOuter)} ${f(p.flatOuter)} 0 ${large} 1 ${xy(g.outerEnd)} L ${xy(g.innerEnd)} A ${f(p.flatInner)} ${f(p.flatInner)} 0 ${large} 0 ${xy(g.innerStart)} Z`;
}
function bounds(p) {
  const samples=[];
  for(let i=0;i<=120;i++){
    const a=-p.flatSweep/2+p.flatSweep*i/120;
    samples.push(pt(p.flatOuter,a),pt(p.flatInner,a));
  }
  return {minX:Math.min(...samples.map(v=>v.x)),maxX:Math.max(...samples.map(v=>v.x)),minY:Math.min(...samples.map(v=>v.y)),maxY:Math.max(...samples.map(v=>v.y))};
}
function layout(patterns) {
  let cursor=5;
  const placed=patterns.map(p=>{
    const b=bounds(p),cx=cursor-b.minX,cy=5-b.minY;
    cursor+=b.maxX-b.minX+15;
    return {p,cx,cy,b};
  });
  return {placed,width:cursor-10,height:Math.max(...placed.map(x=>x.b.maxY-x.b.minY))+10};
}
const pair=(code,value)=>`${code}\n${value}\n`;
const entity=(name,values)=>pair(0,name)+pair(8,'CUT')+values.map(([k,v])=>pair(k,f(v))).join('');
export function dxfFor(patterns) {
  if(!patterns.length)throw new Error('No patterns selected.');
  const {placed}=layout(patterns);
  let out='0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  for(const {p,cx,cy} of placed){
    const g=geometryFor(p,cx,cy),start=(degrees(g.start)+360)%360,end=(degrees(g.end)+360)%360;
    const arc=r=>entity('ARC',[[10,cx],[20,cy],[30,0],[40,r],[50,start],[51,end]]);
    const line=(a,b)=>entity('LINE',[[10,a.x],[20,a.y],[30,0],[11,b.x],[21,b.y],[31,0]]);
    out+=arc(p.flatOuter)+arc(p.flatInner)+line(g.outerStart,g.innerStart)+line(g.outerEnd,g.innerEnd);
  }
  return out+'0\nENDSEC\n0\nEOF\n';
}
export function csvFor(patterns) {
  const headers=['Pattern','Body','Cone half angle (deg)','Small 3D radius (mm)','Large 3D radius (mm)','Slant width (mm)','Flat inner radius (mm)','Flat outer radius (mm)','Flat sweep (deg)','Source sweep (deg)','STEP face IDs'];
  const lines=patterns.map(p=>[p.id,p.body,degrees(p.semi),p.innerRadius,p.outerRadius,p.slant,p.flatInner,p.flatOuter,degrees(p.flatSweep),degrees(p.sourceSweep),p.faces.map(x=>`#${x}`).join(' ')].map((v,i)=>i>1&&i<10?f(v):`"${String(v).replaceAll('"','""')}"`).join(','));
  return [headers.join(','),...lines].join('\r\n')+'\r\n';
}
