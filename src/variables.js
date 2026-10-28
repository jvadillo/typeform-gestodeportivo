// Keep decimal arithmetic exact, including divisions followed by multiplications.
const gcd = (a,b) => { a=a<0n?-a:a; while(b) [a,b]=[b,a%b]; return a||1n; };
function fraction(n,d=1n) {
  if (!d) throw new Error('No se puede dividir una variable entre cero.');
  if(d<0n){n=-n;d=-d;}
  const g=gcd(n,d);return [n/g,d/g];
}
function decimal(value) {
  if(typeof value!=='number'||!Number.isFinite(value))throw new Error('El cálculo necesita un número válido.');
  const [m,e='0']=String(value).split('e'), scale=(m.split('.')[1]||'').length-Number(e);
  const n=BigInt(m.replace('.',''));
  return scale<0?fraction(n*10n**BigInt(-scale)):fraction(n,10n**BigInt(scale));
}
function numeric([n,d]) {
  const sign=n<0n?'-':'';n=n<0n?-n:n;
  return Number(`${sign}${n/d}.${((n%d)*10n**400n/d).toString().padStart(400,'0')}`);
}
export const operations={add:'Sumar (+)',subtract:'Restar (−)',multiply:'Multiplicar (×)',divide:'Dividir (÷)'};
export const variableDefinitions=doc=>doc.variables??[{id:'score',name:'Puntuación',initial:0}];
export const resultVariable=doc=>doc.resultVariable??'score';
export const resultVariableName=doc=>variableDefinitions(doc).find(v=>v.id===resultVariable(doc))?.name||'Variable eliminada';
export const calculationsFor=owner=>owner.calculations??(owner.points? [{variable:'score',operation:'add',value:owner.points}]:[]);
export const conditionsFor=rule=>rule.conditions??[{variable:rule.variable??'score',operator:rule.operator,value:rule.value}];
export function initialVariables(doc){return Object.fromEntries(variableDefinitions(doc).map(v=>[v.id,decimal(v.initial??0)]));}
export function applyCalculations(state,owner,answer) {
  for(const calc of calculationsFor(owner)) {
    if(!Object.hasOwn(state,calc.variable))throw new Error('El cálculo usa una variable eliminada.');
    const [a,b]=state[calc.variable], [c,d]=decimal(calc.source==='answer'?answer:calc.value);
    let value;
    switch(calc.operation){
      case 'add': value=fraction(a*d+c*b,b*d);break;
      case 'subtract': value=fraction(a*d-c*b,b*d);break;
      case 'multiply': value=fraction(a*c,b*d);break;
      case 'divide': value=fraction(a*d,b*c);break;
      default: throw new Error('Operación de cálculo inválida.');
    }
    if((value[0]<0n?-value[0]:value[0])>100000000000000n*value[1])throw new Error('El valor de una variable supera el límite de ±10¹⁴. Revisa los cálculos.');
    if(value[0].toString(2).length>16384||value[1].toString(2).length>16384)throw new Error('El cálculo supera la precisión admitida. Simplifica las operaciones.');
    state[calc.variable]=value;
  }
}
export function matchesVariableRule(rule,state) {
  const matches=conditionsFor(rule).map(condition=>{
    const current=state[condition.variable];
    if(!current||typeof condition.value!=='number'||!Number.isFinite(condition.value))return false;
    const [a,b]=current,[c,d]=decimal(condition.value),delta=a*d-c*b;
    return {gt:delta>0n,lt:delta<0n,eq:delta===0n,gte:delta>=0n,lte:delta<=0n,neq:delta!==0n}[condition.operator]??false;
  });
  return matches.length>0&&(rule.match==='any'?matches.some(Boolean):matches.every(Boolean));
}
export function variableValues(doc,state){return variableDefinitions(doc).map(v=>({id:v.id,name:v.name,value:numeric(state[v.id])}));}
export function resultValue(doc,state){return numeric(state[resultVariable(doc)]);}
export function variablesAlong(doc,answers,path) {
  const state=initialVariables(doc),byId=new Map(doc.questions.map(q=>[q.id,q]));
  // An explicit visited path is required: multiplication and division are order-sensitive.
  for(const id of path) {
    const q=byId.get(id),value=answers[id];
    if(!q||q.type==='statement'||value==null||value===''||(typeof value==='string'&&!value.trim()))continue;
    const owner=q.type==='choice'?q.options.find(o=>o.id===value):q;
    if(owner)applyCalculations(state,owner,value);
  }
  return state;
}
