import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Journey, score, resolveResult, validateAnswer, scoreOperators} from '../src/flow.js';
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

const scoreCases=JSON.parse(readFileSync(new URL('./score_rule_cases.json',import.meta.url),'utf8'));
for(const {total,value,matches} of scoreCases) {
  test(`all score operators at total ${total} and threshold ${value}`,()=>{
    for(const operator of Object.keys(scoreOperators)) {
      const d=structuredClone(doc);
      d.questions[0].options[0].points=total;
      d.questions[0].scoreRules=[{operator,value,next:'common'}];
      const journey=new Journey(d);journey.start();journey.set('a');journey.next();
      assert.equal(journey.current.id,matches.includes(operator)?'common':'qa',operator);
      assert.equal(score(d,journey.activeAnswers()),total);
    }
  });
}
test('score rules use accumulated points including the current answer, with first match priority',()=>{
  const d=structuredClone(doc);
  d.questions[1].scoreRules=[{operator:'gt',value:5,next:'end'},{operator:'gte',value:8,next:'common'}];
  const journey=new Journey(d);journey.start();journey.set('a');journey.next();journey.set('yes');
  assert.equal(journey.next(),false);
  assert.equal(score(d,journey.activeAnswers()),8);
});
test('going back without changing an answer excludes future points from score rules',()=>{
  const d=structuredClone(doc);
  d.questions[0].scoreRules=[{operator:'gt',value:5,next:'common'}];
  const journey=new Journey(d);journey.start();journey.set('a');journey.next();journey.set('yes');journey.next();
  journey.back();journey.back();journey.next();
  assert.equal(journey.current.id,'qa');
  journey.back();journey.set('b');journey.next();
  assert.equal(journey.current.id,'qb');
  assert.deepEqual(journey.answers,{route:'b'});
});
test('score rules work on all content types, skipped questions and zero at the start',()=>{
  for(const type of ['statement','short','long','number','email','choice']) {
    const d=structuredClone(doc);
    d.questions[0].options[0].next='qa';
    d.questions[1]={id:'qa',type,required:false,options:[{id:'x',points:100}],next:'end',scoreRules:[{operator:'eq',value:2,next:'common'}]};
    const journey=new Journey(d);journey.start();journey.set('a');journey.next();journey.next();
    assert.equal(journey.current.id,'common',type);
    assert.equal(score(d,journey.activeAnswers()),2);
  }
  const d=structuredClone(doc);
  d.questions[0]={id:'route',type:'statement',scoreRules:[{operator:'eq',value:0,next:'end'}]};
  const journey=new Journey(d);journey.start();assert.equal(journey.next(),false);
});
test('score rules support next, validate targets at runtime and survive content reorder',()=>{
  const d=structuredClone(doc);
  d.questions[0].scoreRules=[{operator:'gte',value:0,next:'next'}];
  const journey=new Journey(d);journey.start();journey.set('a');journey.next();assert.equal(journey.current.id,'qa');
  journey.back();d.questions[0].scoreRules[0].next='route';assert.throws(()=>journey.next(),/bucle/);
  d.questions[0].scoreRules[0].next='missing';assert.throws(()=>journey.next(),/destino/);
  d.questions[0].scoreRules[0].next='common';
  [d.questions[1],d.questions[3]]=[d.questions[3],d.questions[1]];
  journey.next();assert.equal(journey.current.id,'common');
});
test('decimal sums, cancellation and exponential notation keep exact score boundaries',()=>{
  for (const [points,total] of [[[.1,.2],.3],[[1e12,.1,-1e12],.1],[[1e-7,2e-7],3e-7],[[5e-324,5e-324],1e-323]]) {
    const d={questions:points.map((p,i)=>({id:`q${i}`,type:'choice',options:[{id:'a',points:p}],next:'next'}))};
    d.questions.at(-1).scoreRules=[{operator:'eq',value:total,next:'end'}];
    d.questions.push({id:'unwanted',type:'short'});
    const journey=new Journey(d);journey.start();
    for(let i=0;i<points.length;i++) {journey.set('a');assert.equal(journey.next(),i<points.length-1);}
    assert.equal(score(d,journey.activeAnswers()),total);
  }
});
