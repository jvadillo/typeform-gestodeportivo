import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Journey} from '../src/flow.js';
import {initialVariables,applyCalculations,matchesVariableRule,variableValues,resultValue} from '../src/variables.js';

const cases=JSON.parse(readFileSync(new URL('./variable_cases.json',import.meta.url),'utf8'));
for(const c of cases)test(c.name,()=>{
  const doc={variables:c.variables,resultVariable:'x'},state=initialVariables(doc);
  applyCalculations(state,{calculations:c.calculations});
  assert.deepEqual(Object.fromEntries(variableValues(doc,state).map(v=>[v.id,v.value])),c.expected);
  for(const [variable,value] of Object.entries(c.expected))assert.equal(matchesVariableRule({conditions:[{variable,operator:'eq',value}]},state),true);
});
const doc={variables:[{id:'x',name:'Fuerza',initial:1},{id:'y',name:'Resistencia',initial:0}],resultVariable:'x',questions:[
  {id:'first',type:'choice',required:true,next:'third',options:[{id:'a',calculations:[{variable:'x',operation:'add',value:2}]},{id:'b',calculations:[{variable:'x',operation:'subtract',value:2}]}]},
  {id:'second',type:'number',required:false,next:'end',calculations:[{variable:'x',operation:'add',source:'answer'}]},
  {id:'third',type:'choice',required:true,next:'second',options:[{id:'a',calculations:[{variable:'x',operation:'multiply',value:3}]}]}
],results:[{id:'done'}]};
test('journey applies operations in visited order, replays safely and removes abandoned answers',()=>{
  const journey=new Journey(doc);journey.start();journey.set('a');journey.next();journey.set('a');journey.next();journey.set(2);
  assert.equal(journey.next(),false);assert.equal(journey.total,11);
  journey.back();assert.equal(journey.total,9);journey.next();assert.equal(journey.total,11);
  journey.back();journey.back();journey.set('b');journey.next();journey.set('a');journey.next();
  assert.equal(journey.total,-3);assert.equal(journey.answers.second,undefined);
  journey.set(0);assert.equal(journey.total,-3);
});
test('AND / OR rules compare distinct variables, include current operations and keep priority',()=>{
  const d=structuredClone(doc);
  const conditions=[{variable:'x',operator:'gte',value:3},{variable:'y',operator:'eq',value:1}];
  d.questions[0].scoreRules=[{match:'all',conditions,next:'end'},{match:'any',conditions,next:'second'}];
  const journey=new Journey(d);journey.start();journey.set('a');journey.next();assert.equal(journey.current.id,'second');
  journey.back();d.questions[0].options[0].calculations.push({variable:'y',operation:'add',value:1});
  assert.equal(journey.next(),false);assert.equal(journey.total,3);
});
test('skipping optional answers does not execute calculations or use stale future values',()=>{
  const d=structuredClone(doc);d.questions[0].options[0].next='second';
  const journey=new Journey(d);journey.start();journey.set('a');journey.next();
  assert.equal(journey.next(),false);assert.equal(journey.total,3);
});
test('zero division, removed references and oversized calculations fail before navigation',()=>{
  const d=structuredClone(doc);d.questions[1].calculations[0].operation='divide';
  const journey=new Journey(d);journey.start();journey.set('a');journey.next();journey.set('a');journey.next();journey.set(0);
  assert.throws(()=>journey.next(),/cero/);assert.equal(journey.current.id,'second');
  journey.set(3);assert.equal(journey.next(),false);assert.equal(journey.total,3);
  assert.throws(()=>applyCalculations(initialVariables(d),{calculations:[{variable:'gone',operation:'add',value:1}]}),/eliminada/);
  assert.throws(()=>applyCalculations(initialVariables(d),{calculations:[{variable:'x',operation:'multiply',value:1e12},{variable:'x',operation:'multiply',value:1e12}]}),/límite/);
});
test('initial values drive statement rules and rational equality remains exact',()=>{
  const state=initialVariables(doc);applyCalculations(state,{calculations:[{variable:'x',operation:'divide',value:3}]});
  assert.equal(resultValue(doc,state),1/3);
  assert.equal(matchesVariableRule({conditions:[{variable:'x',operator:'gt',value:.3333333333333333}]},state),true);
  const d=structuredClone(doc);d.questions=[{id:'info',type:'statement',scoreRules:[{variable:'x',operator:'eq',value:1,next:'end'}]}];
  const j=new Journey(d);j.start();assert.equal(j.next(),false);assert.equal(j.total,1);
});
