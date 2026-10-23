import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey, resolveStyle, titleSizes, textSizes, validateAnswer} from '../src/flow.js';

// Controller tests isolate the DOM; the real journey and timer callbacks run unchanged.
globalThis.document = {querySelector: () => null};
globalThis.CSS = {escape: value => value};
globalThis.window = {matchMedia: () => ({matches: false})};
const {Player, styleVars, screenMarkup} = await import('../src/player.js');
const {Editor} = await import('../src/editor.js');
const doc = {
  welcome: {id: 'welcome', title: 'Hola'}, style: {text: '#112233'},
  questions: [
    {id:'route', type:'choice', required:true, options:[{id:'a',label:'A',points:2,next:'branch'},{id:'b',label:'B',points:-1,next:'end'}]},
    {id:'branch', type:'short', required:true, next:'end'}
  ], results: [{id:'result',title:'Gracias',showScore:true}]
};
function fixture(t, reduced = false) {
  let now = 0, serial = 0;
  const timers = new Map(), classes = new Set();
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => {timers.set(++serial,{fn,at:now+delay});return serial;});
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  t.mock.method(window, 'matchMedia', () => ({matches:reduced}));
  const player = Object.create(Player.prototype);
  Object.assign(player, {doc:structuredClone(doc), busy:false, finished:null, error:'', abort:new AbortController(), id:'stable-id', container:{
    classList:{add: c=>classes.add(c), remove:c=>classes.delete(c)},
    querySelector:()=>({focus(){},setAttribute(){}})
  }});
  player.journey = new Journey(player.doc); player.journey.start();
  player.render = () => {};
  function tick(duration) {
    const end = now+duration;
    while (true) {
      const next = [...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;
      now=next[1].at;timers.delete(next[0]);next[1].fn();
    }
    now=end;
  }
  t.after(()=>player.destroy());
  return {player,tick,classes,timers};
}
test('legacy colors, independent overrides and five responsive title sizes',()=>{
  assert.equal(resolveStyle(doc,{style:{text:'#ffffff'}}).titleText,'#ffffff');
  assert.equal(resolveStyle(doc,{style:{text:'#ffffff'}}).optionText,'#ffffff');
  const themed={style:{text:'#112233',titleText:'#445566',optionText:'#778899',titleSize:'small'}};
  const style=resolveStyle(themed,{style:{titleText:'#aabbcc',titleSize:'huge'}});
  assert.equal(style.titleText,'#aabbcc');assert.equal(style.optionText,'#778899');
  assert.equal(resolveStyle(themed,{}).titleSize,'small');
  assert.equal(Object.keys(titleSizes).length,6);
  assert.match(styleVars(themed,{style:{titleSize:'huge'}}),/--title-scale:0.925;/);
  assert.match(styleVars(themed,{style:{titleSize:'xsmall'}}),/--title-scale:0.45;/);
  assert.match(styleVars({style:{option:'#ff8000'}},{}),/--screen-option-bg:#ff8000;/);
  assert.match(styleVars({style:{option:'#ff8000',optionOpacity:.4}},{}),/--screen-option-bg:rgb\(255 128 0 \/ 0.4\);/);
});
test('selection shows feedback before following its conditional destination once',t=>{
  const {player,tick,classes}=fixture(t);
  player.selectChoice('a');tick(299);assert.equal(player.journey.current.id,'route');
  tick(1);assert.ok(classes.has('is-leaving'));tick(160);
  assert.equal(player.journey.current.id,'branch');assert.deepEqual(player.journey.history,['route','branch']);
  tick(1000);assert.equal(player.journey.current.id,'branch');
});
test('new selection replaces the pending advance and resolves the correct result',t=>{
  const {player,tick}=fixture(t);player.selectChoice('a');tick(200);player.selectChoice('b');tick(460);
  assert.equal(player.finished.total,-1);assert.deepEqual(player.journey.activeAnswers(),{route:'b'});
});
test('manual next and back cancel pending timers rather than skipping a question',async t=>{
  const {player,tick,timers}=fixture(t);player.selectChoice('a');await player.next();
  assert.equal(timers.size,0);tick(1000);assert.equal(player.journey.current.id,'branch');
  player.journey.back();player.selectChoice('a');
  player.click({target:{closest:selector=>selector==='[data-back]'?{}:null}});
  tick(1000);assert.equal(player.journey.cursor,-1);
});
test('closing preview cancels completion; reduced motion skips the exit animation',t=>{
  const {player,tick,classes}=fixture(t,true);player.selectChoice('a');tick(300);
  assert.equal(player.journey.current.id,'branch');assert.equal(classes.has('is-leaving'),false);
  player.journey.back();player.selectChoice('b');player.destroy();tick(1000);assert.equal(player.finished,null);
});
test('arrow navigation does not auto-submit; repeated keys do not advance again',t=>{
  const {player,tick}=fixture(t);
  player.key({key:'ArrowDown',target:{tagName:'H1'},preventDefault(){}});
  tick(1000);assert.equal(player.journey.current.id,'route');assert.equal(player.journey.answers.route,'a');
  player.key({key:'b',repeat:true});tick(1000);assert.equal(player.journey.answers.route,'a');
});
test('Enter confirms the focused option rather than a previously selected one',t=>{
  const {player,tick}=fixture(t);player.selectChoice('a',false);
  player.key({key:'Enter',target:{tagName:'BUTTON',closest:()=>({dataset:{option:'b'}})},preventDefault(){}});
  tick(460);assert.equal(player.finished.total,-1);
});
test('auto-completion submits once, keeps the ID on failure, and allows retry',async t=>{
  const {player,tick}=fixture(t);
  let reject, calls=0;
  player.submit=(id,answers)=>{calls++;assert.equal(id,'stable-id');assert.deepEqual(answers,{route:'b'});return new Promise((_,no)=>{reject=no;});};
  player.selectChoice('b');tick(460);player.selectChoice('b');await player.next();
  assert.equal(calls,1);reject(new Error('Sin conexión'));await Promise.resolve();
  assert.equal(player.busy,false);assert.equal(player.error,'Sin conexión');
  player.submit=async id=>{calls++;assert.equal(id,'stable-id');return {result:doc.results[0],total:-1};};
  await player.next();assert.equal(calls,2);assert.equal(player.finished.total,-1);
});
test('sidebar arrows move the named question without changing IDs or destinations',async t=>{
  const editor=Object.create(Editor.prototype), scroll={scrollTop:71,scrollLeft:42};
  Object.assign(editor,{doc:structuredClone(doc),selected:'welcome',markDirty(){this.dirty=true;},render(){}});
  const row={querySelector:()=>({focus(){}})};
  t.mock.method(document,'querySelector',selector=>selector.startsWith('[data-question-row')?row:scroll);
  const target={dataset:{action:'move-up',value:'branch'},closest:()=>null};
  await editor.onClick({target:{closest:()=>target}});
  assert.deepEqual(editor.doc.questions.map(q=>q.id),['branch','route']);
  assert.equal(editor.doc.questions[1].options[0].next,'branch');assert.equal(editor.selected,'branch');assert.equal(editor.dirty,true);
  assert.deepEqual(scroll,{scrollTop:71,scrollLeft:42});
});

test('welcome has no eyebrow and every screen shares the configurable footer',()=>{
  const brand = d => screenMarkup(d, d.questions[0], {index:0}).match(/participant-brand">([^<]*)</)[1];
  assert.equal(screenMarkup(doc, doc.welcome, {welcome:true}).includes('screen-eyebrow'), false);
  assert.equal(brand(doc), 'gesto.');
  const custom = {...doc, footer:'Club <Gesto>'};
  for (const [screen, options] of [[custom.welcome,{welcome:true}],[custom.questions[1],{index:1}],[custom.results[0],{result:true}]])
    assert.match(screenMarkup(custom, screen, options), /participant-brand">Club &lt;Gesto&gt;</);
  assert.equal(brand({...doc, footer:''}), '');
});

test('the score uses the chosen text format and an optional ring',()=>{
  const result = {id:'r', title:'Fin', showScore:true, scoreFormat:'slash', scoreRing:true, style:{}};
  const markup = screenMarkup({...doc, maxScore:10}, result, {result:true, total:7.5});
  assert.match(markup, /--score-ratio:0.75/);
  assert.match(markup, /<strong[^>]*>7,5\/10</);
  assert.match(screenMarkup({...doc, maxScore:10}, {...result, scoreFormat:'of', scoreRing:false}, {result:true, total:7}), /<strong>7 de 10</);
  assert.match(screenMarkup({...doc, maxScore:10}, {...result, scoreFormat:'of'}, {result:true, total:7}), /<strong>7<small>de 10<\/small>/);
  assert.match(screenMarkup({...doc, maxScore:10}, {...result, scoreFormat:'points', scoreRing:false}, {result:true, total:7}), /<strong>7<\/strong>/);
  assert.match(screenMarkup({...doc, maxScore:10}, result, {result:true, total:-3}), /--score-ratio:0"/);
  assert.match(markup, /<span>Tu puntuación:<\/span><div class="score-ring"/);
  assert.equal(/screen-eyebrow|Hecho para escucharte/.test(markup), false);
  const noMax = screenMarkup(doc, result, {result:true, total:7});
  assert.equal(noMax.includes('score-ring'), false);
  assert.match(noMax, /<strong>7</);
});

test('a statement screen shows its button, needs no answer and is left out of the answers',()=>{
  const statement = {id:'info', type:'statement', title:'Antes de seguir', description:'Un texto', button:'Vamos', required:true, next:'next', style:{textSize:'huge'}};
  const d = {...doc, questions:[statement, doc.questions[1]]};
  const markup = screenMarkup(d, statement, {index:0});
  assert.match(markup, /data-next[^>]*>Vamos/);
  assert.equal(/screen-eyebrow|participant-answer|choices/.test(markup), false);
  assert.match(styleVars(d, statement), /--text-scale:1.2/);
  assert.equal(validateAnswer(statement, undefined), '');
  const journey = new Journey(d); journey.start();
  assert.equal(journey.next(), true);
  assert.equal(journey.current.id, 'branch');
  journey.set('ok');
  assert.deepEqual(journey.activeAnswers(), {branch:'ok'});
  assert.equal(resolveStyle(doc).textSize, 'medium');
  assert.equal(Object.keys(textSizes).length, 6);
  assert.equal(resolveStyle({...doc, style:{textSize:'xsmall'}}).textSize, 'xsmall');
});
