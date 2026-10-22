import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey, score, resolveResult, validateAnswer} from '../src/flow.js';
const doc={questions:[
  {id:'route',type:'choice',required:true,next:'next',options:[{id:'a',points:2,next:'qa'},{id:'b',points:-2,next:'qb'}]},
  {id:'qa',type:'choice',required:true,next:'common',options:[{id:'yes',points:6,next:''}]},
  {id:'qb',type:'number',required:false,next:'common'},
  {id:'common',type:'short',required:false,next:'end'}
],results:[{id:'low',min:null,max:3},{id:'high',min:3,max:null}]};
test('branch navigation and score use only current answers',()=>{
  const flow=new Journey(doc);flow.start();flow.set('a');assert.equal(flow.next(),true);flow.set('yes');flow.next();flow.set('old');
  assert.equal(score(doc,flow.activeAnswers()),8);flow.back();flow.back();flow.set('b');
  assert.deepEqual(flow.answers,{route:'b'});flow.next();assert.equal(flow.current.id,'qb');flow.set(0);flow.next();assert.equal(flow.current.id,'common');assert.equal(flow.answers.common,undefined);
  flow.set('new');assert.equal(flow.next(),false);assert.equal(score(doc,flow.activeAnswers()),-2);assert.equal(resolveResult(doc,-2).id,'low');
});
test('going back follows actual history and retaining an answer does not duplicate score',()=>{
  const flow=new Journey(doc);flow.start();flow.set('a');flow.next();flow.set('yes');flow.next();flow.back();assert.equal(flow.current.id,'qa');flow.next();assert.equal(score(doc,flow.activeAnswers()),8);
});
test('back to welcome preserves history so abandoned answers can be invalidated',()=>{
  const flow=new Journey(doc);flow.start();flow.set('a');flow.next();flow.set('yes');flow.back();flow.back();flow.start();flow.set('b');assert.deepEqual(flow.answers,{route:'b'});
});
test('required, zero, email, whitespace and finite numbers',()=>{
  assert.ok(validateAnswer({type:'short',required:true},'   '));
  assert.equal(validateAnswer({type:'number',required:true},0),'');
  assert.ok(validateAnswer({type:'number'},Infinity));
  assert.ok(validateAnswer({type:'email'},'broken@'));
  assert.equal(validateAnswer({type:'email'},'hola@example.com'),'');
});
test('result intervals are lower inclusive and upper exclusive',()=>{
  assert.equal(resolveResult(doc,2.999).id,'low');assert.equal(resolveResult(doc,3).id,'high');
});
test('cycle and missing targets are rejected in preview',()=>{
  const broken=structuredClone(doc);broken.questions[0].options[0].next='route';const flow=new Journey(broken);flow.start();flow.set('a');assert.throws(()=>flow.next(),/bucle/);
  broken.questions[0].options[0].next='missing';assert.throws(()=>flow.next(),/destino/);
});
