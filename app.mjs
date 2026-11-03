import {analyzeStep,degrees} from './geometry.mjs';
import {dxfFor,csvFor,pathFor} from './export.mjs';
import {stepFor} from './step-export.mjs';
import {zipFiles} from './zip.mjs';

const $=id=>document.getElementById(id);
const state={analysis:null,selected:new Set(),active:null,unit:'mm'};
const example={filename:'27-PTN-ENG-EXH-Cone-1.STEP · example',faceCount:16,shellCount:2,unsupported:[{id:228,reason:'short 1.00 mm conical edge face excluded as a bevel'},{id:435,reason:'short 1.00 mm conical edge face excluded as a bevel'}],patterns:[
  {id:'P1',body:1,label:'Body 1 · cone 30°',semi:Math.PI/6,innerRadius:25.4,outerRadius:50.8,sourceSweep:Math.PI*2,flatInner:50.8,flatOuter:101.6,flatSweep:Math.PI,slant:50.8,full:true,faces:[276,485],sideCount:2},
  {id:'P2',body:2,label:'Body 2 · cone 18°',semi:Math.PI/10,innerRadius:25.4,outerRadius:50.8,sourceSweep:Math.PI*2,flatInner:25.4/Math.sin(Math.PI/10),flatOuter:50.8/Math.sin(Math.PI/10),flatSweep:Math.PI*2*Math.sin(Math.PI/10),slant:25.4/Math.sin(Math.PI/10),full:true,faces:[166,241],sideCount:2}
]};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(n,d=2){const x=state.unit==='in'?n/25.4:n;return `${x.toFixed(d)} ${state.unit}`;}
function setStatus(msg,error=false){$('status').textContent=msg;$('status').classList.toggle('error',error);}
function setAnalysis(analysis){state.analysis=analysis;state.selected=new Set(analysis.patterns.map(p=>p.id));state.active=analysis.patterns[0]?.id;render();setStatus(`${analysis.patterns.length} flat pattern${analysis.patterns.length===1?'':'s'} ready from ${analysis.filename}.`);}
async function loadFile(file){if(!file)return;try{setStatus(`Reading ${file.name}…`);const text=await file.text();setAnalysis(analyzeStep(text,file.name));}catch(error){setStatus(error.message,true);}}
function patternRow(p){const active=p.id===state.active?' active':'';return `<div class="pattern-row${active}" data-id="${p.id}"><input type="checkbox" data-check="${p.id}" aria-label="Include ${esc(p.label)} in exports" ${state.selected.has(p.id)?'checked':''}><button class="pattern-open" data-open="${p.id}"><span class="pattern-tag">${p.id}</span><span><strong>${esc(p.label)}</strong><small>${p.full?'Full 360° cone':'Partial cone'} · Ø ${fmt(p.innerRadius*2)} → ${fmt(p.outerRadius*2)}</small></span><span class="row-arrow">↗</span></button></div>`;}
function render(){const a=state.analysis;if(!a)return;$('results').hidden=false;$('exports').hidden=false;$('source-name').textContent=a.filename;$('count-patterns').textContent=a.patterns.length;$('count-bodies').textContent=a.shellCount;$('count-faces').textContent=a.faceCount;$('pattern-list').innerHTML=a.patterns.map(patternRow).join('');$('selected-count').textContent=`${state.selected.size} selected`;
  const p=a.patterns.find(x=>x.id===state.active)||a.patterns[0];
  if(p){$('preview-title').textContent=`${p.id} / ${p.label}`;const r=p.flatOuter, m=r*0.12;const labels=`<text x="0" y="${-r-m*.2}" text-anchor="middle" class="svg-label">FLAT SWEEP ${degrees(p.flatSweep).toFixed(2)}°</text>`;$('preview').innerHTML=`<svg viewBox="${-r-m} ${-r-m} ${2*(r+m)} ${2*(r+m)}" role="img" aria-label="Annular sector flat pattern for ${esc(p.label)}"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8eef1" stroke-width=".5"/></pattern></defs><rect x="${-r-m}" y="${-r-m}" width="${2*(r+m)}" height="${2*(r+m)}" fill="url(#grid)"/><path d="${pathFor(p)}" fill="#e9f2f4" stroke="#d97a43" stroke-width="${Math.max(0.6,r*.006)}"/><circle r="2" fill="#5a7890"/>${labels}</svg>`;
    const dims=[['Small 3D radius',fmt(p.innerRadius)],['Large 3D radius',fmt(p.outerRadius)],['Cone half-angle',`${degrees(p.semi).toFixed(2)}°`],['Slant width',fmt(p.slant)],['Flat inner radius',fmt(p.flatInner)],['Flat outer radius',fmt(p.flatOuter)],['Flat sector sweep',`${degrees(p.flatSweep).toFixed(2)}°`],['STEP faces',p.faces.map(x=>`#${x}`).join(' + ')]];$('dimensions').innerHTML=dims.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('');}
  $('note-count').textContent=`(${a.unsupported.length})`;$('analysis-notes').innerHTML=a.unsupported.length?a.unsupported.map(n=>`<li>Face #${n.id}: ${esc(n.reason)}.</li>`).join(''):'<li>No faces were excluded.</li>';
  document.querySelectorAll('.export').forEach(b=>b.disabled=!state.selected.size);
}
function download(kind){
  const patterns=state.analysis?.patterns.filter(x=>state.selected.has(x.id))||[];if(!patterns.length)return;
  const base=(state.analysis.filename.replace(/\s*·.*$/,'').replace(/\.(step|stp)$/i,'').replace(/[^a-z0-9_-]+/gi,'-')||'cone')+'-flat-patterns';
  const files=patterns.map(p=>({name:`${p.id}-body-${p.body}-cone-${Math.round(degrees(p.semi))}deg.${kind==='step'?'step':'dxf'}`,content:kind==='step'?stepFor(p):dxfFor([p])}));
  const content=kind==='csv'?csvFor(patterns):zipFiles(files);
  const type=kind==='csv'?'text/csv':'application/zip';
  const name=`${base}-${kind}.${kind==='csv'?'csv':'zip'}`;
  const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$('open-file').onclick=()=>$('file-input').click();$('drop-zone').onclick=()=>$('file-input').click();$('drop-zone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file-input').click();}};$('file-input').onchange=e=>loadFile(e.target.files[0]);
for(const id of ['load-example','example-inline'])$(id).onclick=()=>setAnalysis(structuredClone(example));
for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.add('dragover');});
for(const event of ['dragleave','drop'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.remove('dragover');if(event==='drop')loadFile(e.dataTransfer.files[0]);});
$('pattern-list').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b){state.active=b.dataset.open;render();}});
$('pattern-list').addEventListener('change',e=>{const b=e.target.closest('[data-check]');if(b){b.checked?state.selected.add(b.dataset.check):state.selected.delete(b.dataset.check);render();}});
$('select-all').onclick=()=>{state.selected=new Set(state.analysis.patterns.map(p=>p.id));render();};$('select-none').onclick=()=>{state.selected.clear();render();};$('display-unit').onchange=e=>{state.unit=e.target.value;render();};document.querySelectorAll('.export').forEach(b=>b.onclick=()=>download(b.dataset.kind));
