import {geometryFor} from './export.mjs';

const num=value=>{
  if (!Number.isFinite(value)) throw new Error('Invalid STEP coordinate.');
  const s=Number(value.toPrecision(13)).toString();
  return /[.Ee]/.test(s)?s:`${s}.`;
};
const quote=value=>`'${String(value).replaceAll("'","''")}'`;

// AP214 open shell with one zero-thickness planar face. Circular edges stay analytic.
export function stepFor(pattern) {
  if (!(pattern.flatInner>0 && pattern.flatOuter>pattern.flatInner && pattern.flatSweep>0 && pattern.flatSweep<2*Math.PI)) throw new Error('Invalid annular sector.');
  const entities=[];
  const add=body=>{entities.push(body);return `#${entities.length}`;};
  const point=(x,y,z=0)=>add(`CARTESIAN_POINT('',(${num(x)},${num(y)},${num(z)}))`);
  const direction=(x,y,z)=>add(`DIRECTION('',(${num(x)},${num(y)},${num(z)}))`);
  const vertex=p=>add(`VERTEX_POINT('',${point(p.x,p.y)})`);
  const line=(start,end)=>{
    const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
    const v=add(`VECTOR('',${direction(dx/length,dy/length,0)},${num(length)})`);
    return add(`LINE('',${point(start.x,start.y)},${v})`);
  };
  const g=geometryFor(pattern);
  const os=vertex(g.outerStart),oe=vertex(g.outerEnd),is=vertex(g.innerStart),ie=vertex(g.innerEnd);
  const origin=point(0,0),z=direction(0,0,1),x=direction(1,0,0);
  const placement=add(`AXIS2_PLACEMENT_3D('',${origin},${z},${x})`);
  const outer=add(`CIRCLE('',${placement},${num(pattern.flatOuter)})`);
  const inner=add(`CIRCLE('',${placement},${num(pattern.flatInner)})`);
  const e1=add(`EDGE_CURVE('',${os},${oe},${outer},.T.)`);
  const e2=add(`EDGE_CURVE('',${oe},${ie},${line(g.outerEnd,g.innerEnd)},.T.)`);
  const e3=add(`EDGE_CURVE('',${is},${ie},${inner},.T.)`);
  const e4=add(`EDGE_CURVE('',${is},${os},${line(g.innerStart,g.outerStart)},.T.)`);
  const oriented=[add(`ORIENTED_EDGE('',*,*,${e1},.T.)`),add(`ORIENTED_EDGE('',*,*,${e2},.T.)`),add(`ORIENTED_EDGE('',*,*,${e3},.F.)`),add(`ORIENTED_EDGE('',*,*,${e4},.T.)`)];
  const loop=add(`EDGE_LOOP('',(${oriented.join(',')}))`);
  const bound=add(`FACE_OUTER_BOUND('',${loop},.T.)`);
  const plane=add(`PLANE('',${placement})`);
  const face=add(`ADVANCED_FACE('',(${bound}),${plane},.T.)`);
  const shell=add(`OPEN_SHELL('',(${face}))`);
  const model=add(`SHELL_BASED_SURFACE_MODEL('',(${shell}))`);
  const context=add(`APPLICATION_CONTEXT('core data for automotive mechanical design processes')`);
  add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${context})`);
  const productContext=add(`PRODUCT_CONTEXT('',${context},'mechanical')`);
  const product=add(`PRODUCT(${quote(pattern.label)},${quote(pattern.label)},'',(${productContext}))`);
  const formation=add(`PRODUCT_DEFINITION_FORMATION('','',${product})`);
  const definitionContext=add(`PRODUCT_DEFINITION_CONTEXT('part definition',${context},'design')`);
  const definition=add(`PRODUCT_DEFINITION('design','',${formation},${definitionContext})`);
  const definitionShape=add(`PRODUCT_DEFINITION_SHAPE('','',${definition})`);
  const mm=add('( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )');
  const rad=add('( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )');
  const sr=add('( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )');
  const uncertainty=add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),${mm},'distance_accuracy_value','confusion accuracy')`);
  const geomContext=add(`( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${uncertainty})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm},${rad},${sr})) REPRESENTATION_CONTEXT('3D SPACE','') )`);
  const rep=add(`MANIFOLD_SURFACE_SHAPE_REPRESENTATION('',(${placement},${model}),${geomContext})`);
  add(`SHAPE_DEFINITION_REPRESENTATION(${definitionShape},${rep})`);
  add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(${product}))`);
  const stamp=new Date().toISOString().slice(0,19);
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Cone Flat Studio planar sheet pattern'),'2;1');\nFILE_NAME(${quote(pattern.id+'.step')},${quote(stamp)},('Cone Flat Studio'),(''), 'Cone Flat Studio','Cone Flat Studio','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\n${entities.map((body,i)=>`#${i+1} = ${body};`).join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
