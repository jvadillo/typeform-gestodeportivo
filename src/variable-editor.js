import {esc, field, input, select, button, iconButton, uid} from './ui.js';
import {scoreOperators} from './flow.js';
import {variableDefinitions, resultVariable, operations, calculationsFor, conditionsFor} from './variables.js';

const numericInput=(attr,value)=>input(attr,value??'','number','step="any" min="-1000000000000" max="1000000000000" required');
const orderButtons=(kind,index,length,extra='')=>`<div class="inline-actions">${iconButton(`move-${kind}-up`,'Subir','up',`data-value="${index}" ${extra} ${index===0?'disabled':''}`)}${iconButton(`move-${kind}-down`,'Bajar','down',`data-value="${index}" ${extra} ${index===length-1?'disabled':''}`)}${iconButton(`remove-${kind}`,'Eliminar','trash',`data-value="${index}" ${extra}`)}</div>`;

export const variableEditor={
  assertContentType(type) {
    const calculations=this.screen.calculations||[];
    if(calculations.length&&(['choice','statement'].includes(type)||(type!=='number'&&calculations.some(c=>c.source==='answer'))))
      throw new Error('Revisa o quita los cálculos de esta pregunta en Lógica antes de cambiar a ese tipo de contenido.');
  },
  variableOptions(selected) {
    const options=variableDefinitions(this.doc).map(v=>[v.id,v.name||'Sin nombre']);
    if(selected&&!options.some(([id])=>id===selected))options.push([selected,'⚠ Variable eliminada']);
    return options;
  },
  variablesMarkup() {
    const vars=variableDefinitions(this.doc);
    return `<section class="integration-page"><h1>Variables del formulario</h1><p class="lead">Cada persona empieza con estos valores. Las respuestas pueden modificarlos y las reglas los usan para elegir el siguiente contenido.</p><div class="integration-card">${vars.map(v=>`<div class="logic-option">${field('Nombre',input(`data-variable="name" data-id="${esc(v.id)}"`,v.name,'text','maxlength="80" required'))}${field('Valor inicial',numericInput(`data-variable="initial" data-id="${esc(v.id)}"`,v.initial===undefined?0:v.initial))}${button('remove-variable','Eliminar variable','trash','text-btn',`data-value="${esc(v.id)}"`)}</div>`).join('')}${button('add-variable','Añadir variable','plus','',vars.length>=20?'disabled':'')}<div class="section-divider"></div>${this.resultVariableField()}<p class="field-hint">Los intervalos y el valor que se muestra al finalizar usan esta variable. Todos los valores se guardan en Respuestas, Excel y Google Sheets.</p>${this.variableValidationMarkup()}</div></section>`;
  },
  variableValidationMarkup() {
    const errors=this.form?.errors||[];
    return `<div class="validation-box" ${errors.length?'':'hidden'}><strong>Antes de publicar</strong><ul>${errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`;
  },
  resultVariableField() {
    return field('Variable de los resultados',select('data-result-variable',resultVariable(this.doc),this.variableOptions(resultVariable(this.doc))),'Común a todos los resultados del formulario.');
  },
  variableLogicSettings() {
    const s=this.screen,rules=s.scoreRules||[];
    return `<div class="settings-heading"><h2>El siguiente paso</h2><p>Las reglas eligen el destino; los cálculos modifican las variables.</p></div>${button('manage-variables','Gestionar variables','settings','text-btn')}<h3>Reglas de navegación</h3><p class="field-hint">Primero se ejecutan los cálculos de la respuesta actual. Después se evalúan estas reglas de arriba abajo y se aplica la primera que se cumpla.</p>${rules.map((rule,i)=>this.variableRuleMarkup(rule,i,rules.length)).join('')}${button('add-score-rule','Añadir regla','plus','text-btn',rules.length>=50?'disabled':'')}<div class="section-divider"></div><h3>Si ninguna regla se cumple</h3>${field('Destino predeterminado',select('data-screen="next"',s.next||'next',this.destinations(s.next)))}${s.type==='choice'?`<h3>Saltos por respuesta</h3>${s.options.map(o=>`<div class="logic-option"><strong>${esc(o.label)}</strong>${field('Continuar a',select(`data-option-field="next" data-id="${esc(o.id)}"`,o.next||'',this.destinations(o.next,true)))}</div>`).join('')}`:''}${s.type==='statement'?'':`<div class="section-divider"></div><h3>Cálculos por respuesta</h3><p class="field-hint">Se ejecutan una vez, de arriba abajo, antes de navegar. Si se omite la pregunta, no se ejecuta ningún cálculo. Al volver atrás se recalculan según el recorrido activo.</p>${s.type==='choice'?s.options.map(o=>`<div class="logic-option"><strong>${esc(o.label)}</strong>${this.calculationsMarkup(o,o.id)}</div>`).join(''):this.calculationsMarkup(s,'')}`}`;
  },
  variableRuleMarkup(rule,index,length) {
    const conditions=conditionsFor(rule);
    return `<div class="logic-option score-rule"><strong>Regla ${index+1}</strong>${field('Aplicar cuando se cumplan',select(`data-rule-match data-index="${index}"`,rule.match||'all',[['all','Todas las condiciones (Y)'],['any','Cualquiera de las condiciones (O)']]))}${conditions.map((c,j)=>`<div class="variable-condition">${field('Variable',select(`data-condition="variable" data-rule="${index}" data-index="${j}"`,c.variable,this.variableOptions(c.variable)))}${field('Comparación',select(`data-condition="operator" data-rule="${index}" data-index="${j}"`,c.operator,Object.entries(scoreOperators)))}${field('Valor',numericInput(`data-condition="value" data-rule="${index}" data-index="${j}"`,c.value))}${conditions.length>1?button('remove-condition','Quitar condición','close','text-btn',`data-rule="${index}" data-value="${j}"`):''}</div>`).join('')}${button('add-condition','Añadir condición','plus','text-btn',`data-value="${index}" ${conditions.length>=20?'disabled':''}`)}${field('Ir a',select(`data-rule-destination data-index="${index}"`,rule.next,this.destinations(rule.next)))}${orderButtons('score-rule',index,length)}</div>`;
  },
  calculationsMarkup(owner,ownerId) {
    const calcs=calculationsFor(owner),extra=`data-owner="${esc(ownerId)}"`;
    return `${calcs.length?'':'<p class="field-hint">Esta respuesta todavía no modifica ninguna variable.</p>'}${calcs.map((calc,i)=>`<div class="variable-condition">${field('Variable',select(`data-calculation="variable" data-index="${i}" ${extra}`,calc.variable,this.variableOptions(calc.variable)))}${field('Operación',select(`data-calculation="operation" data-index="${i}" ${extra}`,calc.operation,Object.entries(operations)))}${this.screen.type==='number'?field('Usar como valor',select(`data-calculation="source" data-index="${i}" ${extra}`,calc.source||'constant',[['constant','Un número fijo'],['answer','La respuesta numérica']])):''}${calc.source==='answer'?'<p class="field-hint">Se usa el número introducido por la persona.</p>':field('Valor',numericInput(`data-calculation="value" data-index="${i}" ${extra}`,calc.value))}${orderButtons('calculation',i,calcs.length,extra)}</div>`).join('')}${button('add-calculation','Añadir cálculo','plus','text-btn',`${extra} ${calcs.length>=50?'disabled':''}`)}`;
  },
  editableVariables() {return this.doc.variables ||= structuredClone(variableDefinitions(this.doc));},
  editableConditions(index) {
    const rule=this.screen.scoreRules[index];
    if(!rule.conditions){rule.conditions=conditionsFor(rule);delete rule.variable;delete rule.operator;delete rule.value;}
    return rule.conditions;
  },
  editableCalculations(id) {
    const owner=this.screen.type==='choice'?this.screen.options.find(o=>o.id===id):this.screen;
    owner.calculations ||= structuredClone(calculationsFor(owner));delete owner.points;
    return owner.calculations;
  },
  onVariableInput(target) {
    const d=target.dataset;
    if(target.matches('[data-variable]')) {
      this.editableVariables().find(v=>v.id===d.id)[d.variable]=d.variable==='initial'?(target.value===''?null:Number(target.value)):target.value;
    } else if(target.matches('input[data-condition]')) {
      this.editableConditions(Number(d.rule))[Number(d.index)].value=target.value===''?null:Number(target.value);
    } else if(target.matches('input[data-calculation]')) {
      this.editableCalculations(d.owner)[Number(d.index)].value=target.value===''?null:Number(target.value);
    } else return false;
    this.markDirty();return true;
  },
  onVariableChange(target) {
    const d=target.dataset;
    if(target.matches('[data-result-variable]'))this.doc.resultVariable=target.value;
    else if(target.matches('[data-rule-match]'))this.screen.scoreRules[Number(d.index)].match=target.value;
    else if(target.matches('[data-rule-destination]'))this.screen.scoreRules[Number(d.index)].next=target.value;
    else if(target.matches('select[data-condition]'))this.editableConditions(Number(d.rule))[Number(d.index)][d.condition]=target.value;
    else if(target.matches('select[data-calculation]'))this.editableCalculations(d.owner)[Number(d.index)][d.calculation]=target.value;
    else return false;
    this.markDirty();this.render();return true;
  },
  onVariableAction(action,value,target) {
    const vars=variableDefinitions(this.doc),id=vars[0].id;
    if(action==='manage-variables'){this.view='variables';this.render();return true;}
    if(action==='add-variable') {
      if(vars.length>=20)throw new Error('El máximo es de 20 variables.');
      let n=vars.length+1;while(vars.some(v=>v.name===`Variable ${n}`))n++;
      this.editableVariables().push({id:uid(),name:`Variable ${n}`,initial:0});
    } else if(action==='remove-variable') {
      const used=resultVariable(this.doc)===value||this.doc.questions.some(q=>(q.scoreRules||[]).some(r=>conditionsFor(r).some(c=>c.variable===value))||(q.type==='choice'?q.options:[q]).some(o=>calculationsFor(o).some(c=>c.variable===value)));
      if(vars.length===1||used)throw new Error('Esta variable se usa en cálculos, reglas o resultados. Cambia esas referencias antes de eliminarla.');
      this.doc.variables=vars.filter(v=>v.id!==value);
    } else if(action==='add-score-rule') {
      const rules=this.screen.scoreRules ||= [];if(rules.length>=50)throw new Error('El máximo es de 50 reglas.');
      rules.push({match:'all',conditions:[{variable:id,operator:'gt',value:0}],next:'next'});
    } else if(action==='add-condition') {
      const conditions=this.editableConditions(Number(value));if(conditions.length>=20)throw new Error('El máximo es de 20 condiciones.');
      conditions.push({variable:id,operator:'gt',value:0});
    } else if(action==='remove-condition') {
      const conditions=this.editableConditions(Number(target.dataset.rule));if(conditions.length>1)conditions.splice(Number(value),1);
    } else if(action==='add-calculation') {
      const calcs=this.editableCalculations(target.dataset.owner);if(calcs.length>=50)throw new Error('El máximo es de 50 cálculos por respuesta.');
      calcs.push({variable:id,operation:'add',value:0});
    } else if(/^(remove|move)-(calculation|score-rule)(-up|-down)?$/.test(action)) {
      const list=action.includes('calculation')?this.editableCalculations(target.dataset.owner):this.screen.scoreRules;
      const index=Number(value),dest=index+(action.endsWith('-up')?-1:1);
      if(action.startsWith('remove-'))list.splice(index,1);
      else if(index>=0&&index<list.length&&dest>=0&&dest<list.length)[list[index],list[dest]]=[list[dest],list[index]];
    } else return false;
    this.markDirty();this.render();return true;
  }
};
