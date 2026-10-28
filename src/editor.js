import {api, esc, icon, button, iconButton, field, input, area, select, toggle, uid, toast, modal, confirmDelete, formatDate} from './ui.js';
import {types, resolveStyle, titleSizes, textSizes, isStatement} from './flow.js';
// Order and short descriptions for the «Añadir contenido» picker.
const contentTypes = [['choice','list','Una sola opción entre varias. Permite cálculos y saltos.'],['short','short','Una respuesta breve de una línea.'],['long','long','Una respuesta extensa en varias líneas.'],['number','number','Una cifra, con o sin decimales.'],['email','mail','Una dirección de correo válida.'],['statement','text','Un título, un texto y un botón para continuar. Sin respuesta.']];
import {variableEditor} from './variable-editor.js';
import {resultVariableName} from './variables.js';
import {Player, screenMarkup, styleVars, footerText, scoreFormats} from './player.js';

export class Editor {
  constructor(form, renderShell) {
    this.form = form; this.doc = form.draft; this.selected = this.doc.welcome.id; this.tab = 'content'; this.view = 'editor'; this.mobile = false; this.dirty = false; this.saving = null; this.saveError = ''; this.renderShell = renderShell; this.changeNumber = 0;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    document.addEventListener('click', e => {
      const link=e.target.closest('a[href="/admin"]');
      if(link && this.dirty){e.preventDefault();this.save().then(()=>location.assign('/admin')).catch(()=>{});return;}
      this.onClick(e);
    }, {signal});
    document.addEventListener('input', e => this.onInput(e), {signal});
    document.addEventListener('change', e => this.onChange(e), {signal});
    window.addEventListener('beforeunload', e => {if (this.dirty) {e.preventDefault(); e.returnValue = ''; }}, {signal});
  }
  destroy() {clearTimeout(this.timer); this.abort.abort();}
  get screen() {return [this.doc.welcome, ...this.doc.questions, ...this.doc.results].find(s => s.id === this.selected);}
  get kind() {return this.selected === this.doc.welcome.id ? 'welcome' : this.doc.results.some(r => r.id === this.selected) ? 'result' : 'question';}
  async init() {this.render(); if (new URLSearchParams(location.search).has('google')) {this.view = 'integration'; await this.loadIntegration();}}
  header() {
    return `<header class="editor-header"><a class="back-home" href="/admin" aria-label="Volver a formularios">${icon('back')}</a><div class="editor-name"><span class="eyebrow">FORMULARIO</span><input aria-label="Nombre del formulario" data-name value="${esc(this.doc.name)}" maxlength="200"/></div><span class="save-state" role="status">${this.status()}</span><div class="header-actions">${button('save', 'Guardar', 'check', 'subtle')}${button('preview', 'Probar', 'play')}${this.form.published ? button('share', 'Enlace', 'link') : ''}${button('publish', 'Publicar', 'arrow', 'primary')}</div></header><nav class="editor-nav" aria-label="Secciones del formulario"><div>${[['editor','Editor','edit'],['variables','Variables','number'],['responses','Respuestas','chart'],['integration','Conexiones','link']].map(([v,label,symbol]) => `<button data-action="view" data-value="${v}" class="nav-tab ${this.view === v ? 'active' : ''}">${icon(symbol)}${label}</button>`).join('')}</div><span class="version-label">${this.form.published ? `Versión pública ${this.form.published} · editando borrador` : 'Borrador · aún no publicado'}</span></nav>`;
  }
  status() {return this.saving ? 'Guardando…' : this.saveError ? 'Error al guardar' : this.dirty ? 'Cambios sin guardar' : 'Guardado';}
  render() {
    this.renderShell(this.header() + `<main class="editor-main">${this.view === 'editor' ? this.editorMarkup() : this.view === 'variables' ? this.variablesMarkup() : this.view === 'responses' ? this.responsesMarkup() : this.integrationMarkup()}</main>`);
  }
  editorMarkup() {
    const screen = this.screen;
    return `<aside class="screen-list"><div class="panel-title"><h2>Pantallas</h2><span>${this.doc.questions.filter(q=>!isStatement(q)).length} preguntas</span></div><div class="screen-list-items"><div class="screen-section-label">INICIO</div>${this.screenItem(this.doc.welcome, 'play', 'Bienvenida')}<div class="screen-section-label">CONTENIDO</div>${this.doc.questions.map((q,i) => this.screenItem(q, null, String(i+1).padStart(2,'0'))).join('')}${button('add-content', 'Añadir contenido', 'plus', 'add-screen')}<div class="screen-section-label">CIERRE</div>${this.doc.results.map(r => this.screenItem(r, 'check', 'Resultado')).join('')}${button('add-result', 'Añadir resultado', 'plus', 'add-screen')}</div><div class="screen-list-footer">${icon('branch')}<span>Un recorrido que se adapta a cada persona.</span></div></aside><section class="preview-panel"><div class="preview-toolbar"><span>VISTA DEL PARTICIPANTE</span><div class="device-toggle">${iconButton('desktop','Vista de escritorio','desktop', `aria-pressed="${!this.mobile}"`)}${iconButton('mobile','Vista móvil','phone', `aria-pressed="${this.mobile}"`)}</div></div><div class="preview-stage ${this.mobile ? 'mobile' : ''}"><div class="participant editor-canvas" style="${esc(styleVars(this.doc,screen))}" aria-label="Vista de la pantalla seleccionada">${screenMarkup(this.doc,screen,{welcome:this.kind==='welcome',result:this.kind==='result',index:Math.max(0,this.doc.questions.findIndex(q=>q.id===screen.id)),preview:true})}</div></div><div class="preview-caption">${icon('eye')} La apariencia se actualiza al editar. Usa <strong>Probar</strong> para recorrer el formulario.</div><div class="validation-box" ${this.form.errors?.length ? '' : 'hidden'}><strong>Antes de publicar</strong><ul>${(this.form.errors || []).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div></section><aside class="settings-panel"><div class="settings-tabs" role="tablist">${[['content','Contenido'],['design','Diseño'],['logic','Lógica']].map(([v,label])=>`<button role="tab" aria-selected="${this.tab===v}" data-action="tab" data-value="${v}" class="${this.tab===v?'active':''}">${label}</button>`).join('')}</div><div class="settings-content">${this.tab==='content'?this.contentSettings():this.tab==='design'?this.designSettings():this.logicSettings()}</div></aside>`;
  }
  screenItem(screen, symbol, tag) {
    const item = `<button data-action="screen" data-value="${esc(screen.id)}" class="screen-item ${this.selected===screen.id?'active':''}"><span class="screen-type">${symbol?icon(symbol):tag}</span><span><strong>${esc(screen.title || 'Sin título')}</strong><small>${symbol?tag:types[screen.type]}</small></span></button>`;
    if (symbol) return item;
    const index = this.doc.questions.findIndex(q => q.id === screen.id);
    return `<div class="screen-row" data-question-row="${esc(screen.id)}">${item}<div class="screen-reorder">${iconButton('move-up',`Subir pregunta: ${screen.title}`, 'up', `data-value="${esc(screen.id)}" ${index===0?'disabled':''}`)}${iconButton('move-down',`Bajar pregunta: ${screen.title}`, 'down', `data-value="${esc(screen.id)}" ${index===this.doc.questions.length-1?'disabled':''}`)}</div></div>`;
  }
  contentSettings() {
    const s = this.screen, kind = this.kind, statement = isStatement(s);
    return `<div class="settings-heading"><h2>${statement?'Tu pantalla de texto':kind==='question'?'Tu pregunta':kind==='welcome'?'Una buena bienvenida':'El último gesto'}</h2><p>${statement?'Comparte una idea antes de seguir. No pide respuesta.':kind==='question'?'Una pregunta clara invita a responder.':kind==='welcome'?'Cuenta por qué merece la pena empezar.':'Cierra la conversación con un mensaje.'}</p></div>${kind==='question'?field('Tipo de contenido',select('data-screen="type"',s.type,Object.entries(types))):''}${field('Título',area('data-screen="title"',s.title,'rows="3" maxlength="500"'))}${field(statement?'Texto':'Descripción',area('data-screen="description"',s.description || '',`rows="${statement?6:3}" maxlength="10000"`))}${kind==='welcome'?field('Texto del botón',input('data-screen="button"',s.button||'Empezar')):''}${statement?field('Texto del botón',input('data-screen="button"',s.button||'Continuar','text','maxlength="100"')):''}${kind==='question'&&!statement?toggle('data-screen="required"',s.required,'Respuesta obligatoria'):''}${kind==='question'&&s.type==='choice'?`<div class="section-divider"></div><h3>Opciones de respuesta</h3>${s.options.map((o,i)=>`<div class="option-editor"><span class="option-letter">${String.fromCharCode(65+i)}</span><input aria-label="Opción ${i+1}" data-option-field="label" data-id="${esc(o.id)}" value="${esc(o.label)}" maxlength="1000"/>${iconButton('remove-option','Eliminar opción','close',`data-value="${esc(o.id)}"`)}</div>`).join('')}${button('add-option','Añadir opción','plus','text-btn')}`:''}${kind==='result'?`${toggle('data-screen="showScore"',s.showScore,'Mostrar variable del resultado')}${s.showScore?`${field('Valor máximo de la variable',input('data-max-score',this.doc.maxScore??'','number','step="any" min="0" placeholder="Sin indicar"'),'Común a todo el formulario. Necesaria para «X de Y», «X/Y» y el gráfico circular.')}${field('Formato del valor',select('data-screen="scoreFormat"',s.scoreFormat||'points',Object.entries(scoreFormats)))}${toggle('data-screen="scoreRing"',!!s.scoreRing,'Mostrar gráfico circular')}`:''}`:''}${kind!=='welcome'?`<div class="section-divider"></div><div class="screen-tools">${button('duplicate-screen','Duplicar','copy','subtle')}${kind==='question'?`${iconButton('move-up','Mover pregunta arriba','up')}${iconButton('move-down','Mover pregunta abajo','down')}`:''}${iconButton('delete-screen','Eliminar pantalla','trash')}</div>`:''}`;
  }
  designSettings() {
    const global = this.designGlobal || false, s = global ? this.doc.style : this.screen.style || {};
    const merged = resolveStyle(this.doc, {style:s});
    // The text size only applies to a description, so hide it where there is none.
    const hasText = (global ? [this.doc.welcome, ...this.doc.questions, ...this.doc.results] : [this.screen]).some(x => x.description?.trim());
    return `<div class="settings-heading"><h2>Dale tu toque</h2><p>Color, luz y espacio para tus preguntas.</p></div>${field('Aplicar diseño a',select('data-design-scope',global?'global':'screen',[['screen','Esta pantalla'],['global','Todo el formulario']]))}${!global?`<p class="field-hint">Los ajustes sin modificar se heredan del formulario.</p>${button('reset-style','Restaurar estilo heredado',null,'text-btn')}`:''}${field('Tipografía',select('data-style="font"',merged.font,[['sans','Clara · Sans serif'],['serif','Editorial · Serif'],['mono','Precisa · Monoespaciada']]))}${field('Tamaño del título',select('data-style="titleSize"',merged.titleSize,Object.entries(titleSizes).map(([id,[label]])=>[id,label])),'Seis tamaños que se adaptan a móvil y escritorio.')}${hasText?field('Tamaño del texto',select('data-style="textSize"',merged.textSize,Object.entries(textSizes).map(([id,[label]])=>[id,label])),'Para la descripción y el texto de las pantallas.'):''}<div class="color-grid">${[['background','Fondo'],['titleText','Título'],['text','Texto general'],['optionText','Texto de opciones'],['button','Botón'],['buttonText','Texto del botón'],['option','Fondo de opciones']].map(([key,label])=>field(label,`<div class="color-input"><input aria-label="${label}" type="color" data-style="${key}" value="${esc(merged[key])}"/><span>${esc(merged[key])}</span></div>`)).join('')}</div>${field('Opacidad del fondo de opciones',`<div class="alpha-input" style="--alpha-color:${esc(merged.option)}"><input type="range" min="0" max="1" step="0.01" aria-label="Opacidad del fondo de opciones" data-style="optionOpacity" value="${merged.optionOpacity}"/><span>${Math.round(merged.optionOpacity*100)} %</span></div>`,'Con menos opacidad se ve el fondo a través de las opciones.')}<div class="section-divider"></div><h3>Imagen de fondo</h3><div class="image-sources"><label class="upload-control">${icon('plus')}<span>${merged.image?'Subir otra':'Subir imagen'}</span><input type="file" data-upload accept="image/jpeg,image/png,image/webp"/></label>${button('gallery','Mis imágenes','image','upload-control')}</div><p class="field-hint">JPEG, PNG o WebP · hasta 8 MB. Se adapta sin deformarse.</p>${merged.image?`${button('remove-image','Quitar imagen',null,'text-btn')}${field('Punto focal horizontal',`<input type="range" min="0" max="100" data-style="x" value="${merged.x}"/>`)}${field('Punto focal vertical',`<input type="range" min="0" max="100" data-style="y" value="${merged.y}"/>`)}`:''}${field('Color de la capa',`<input type="color" data-style="overlay" value="${esc(merged.overlay)}"/>`)}${field('Opacidad de la capa',`<input type="range" min="0" max="1" step="0.05" data-style="opacity" value="${merged.opacity}"/>`,'Ajusta la capa para que el texto sea legible sobre la imagen.')}<div class="design-tip">${icon('phone')} Comprueba el punto focal y el contraste también en móvil.</div><div class="section-divider"></div><h3>Pie de página</h3>${field('Texto del pie',input('data-footer',footerText(this.doc),'text','maxlength="100" placeholder="Sin texto"'),'Común a todas las pantallas del formulario.')}`;
  }
  destinations(selected, includeDefault = false) {
    const items = [...(includeDefault?[['','Usar destino predeterminado']]:[]),['next','Siguiente contenido'],['end','Finalizar → resultado'],...this.doc.questions.map((q,i)=>[q.id,`${i+1}. ${q.title||'Sin título'}`])];
    if (selected && !items.some(([id])=>id===selected)) items.push([selected,'⚠ Destino eliminado']);
    return items;
  }
  logicSettings() {
    const s = this.screen;
    if (this.kind === 'welcome') return `<div class="settings-heading"><h2>Cada camino empieza aquí</h2><p>La bienvenida lleva al primer contenido de la lista.</p></div><div class="design-tip">${icon('branch')} Configura las reglas de navegación y los cálculos de las respuestas en cada contenido.</div>`;
    if (this.kind === 'result') return `<div class="settings-heading"><h2>Un resultado a medida</h2><p>Los intervalos se aplican a «${esc(resultVariableName(this.doc))}».</p></div>${this.resultVariableField()}${this.doc.results.length===1?'<p class="notice">Al ser el único resultado, se mostrará para cualquier valor.</p>':`${toggle('data-screen="default"',s.default,'Resultado predeterminado')}${!s.default?`${field('Desde · incluido',input('data-screen="min"',s.min,'number','step="any" placeholder="Sin límite inferior"'))}${field('Hasta · excluido',input('data-screen="max"',s.max,'number','step="any" placeholder="Sin límite superior"'))}<p class="field-hint">Por ejemplo, desde 0 hasta 4 incluye 0 y no incluye 4. Deja un límite vacío para no poner tope.</p>`:'<p class="field-hint">Se muestra cuando ningún intervalo incluye la puntuación. Solo puede haber uno.</p>'}`}<div class="section-divider"></div><h3>Mapa de resultados</h3>${this.doc.results.map(r=>`<div class="range-summary"><strong>${esc(r.title)}</strong><span>${this.doc.results.length===1?'Cualquier puntuación':r.default?'Predeterminado':`[${r.min??'−∞'}, ${r.max??'+∞'})`}</span></div>`).join('')}`;
    return this.variableLogicSettings();
  }
  markDirty() {
    this.dirty = true; this.changeNumber++; this.saveError = ''; clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save().catch(()=>{}), 1000);
    this.updateStatus(); this.updatePreview();
  }
  updateStatus() { const node = document.querySelector('.save-state'); if(node) {node.textContent=this.status(); node.classList.toggle('failed',!!this.saveError);} }
  updatePreview() {
    const canvas = document.querySelector('.editor-canvas');
    if(canvas) {canvas.style.cssText=styleVars(this.doc,this.screen); canvas.innerHTML=screenMarkup(this.doc,this.screen,{welcome:this.kind==='welcome',result:this.kind==='result',index:Math.max(0,this.doc.questions.findIndex(q=>q.id===this.screen.id)),preview:true});}
    const selectedTitle = document.querySelector('.screen-item.active strong'); if(selectedTitle) selectedTitle.textContent=this.screen.title||'Sin título';
  }
  async save() {
    clearTimeout(this.timer);
    if(this.saving) {await this.saving; if(this.dirty) return this.save(); return;}
    if(!this.dirty) return;
    const revision = this.form.revision, draft = structuredClone(this.doc), change = this.changeNumber;
    this.saving = api(`/forms/${this.form.id}`,{method:'PUT',body:{draft,revision}});
    this.updateStatus();
    try {
      const result = await this.saving; this.form.revision=result.revision; this.form.errors=result.errors; this.dirty=this.changeNumber!==change; this.saveError='';
      const errors = document.querySelector('.validation-box'); if(errors) {errors.hidden=!result.errors.length; errors.innerHTML=`<strong>Antes de publicar</strong><ul>${result.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`;}
    } catch(error) {this.saveError=error.message; toast(error.message,true); throw error;}
    finally {this.saving=null;this.updateStatus();}
    if(this.dirty) return this.save();
  }
  onInput(e) {
    const target=e.target;
    if(this.onVariableInput(target))return;
    if(target.matches('[data-name]')) {this.doc.name=target.value;this.markDirty();return;}
    if(target.matches('[data-footer]')) {this.doc.footer=target.value;this.markDirty();return;}
    if(target.matches('[data-max-score]')) {this.doc.maxScore=target.value===''?null:Number(target.value);this.markDirty();return;}
    if(target.matches('[data-screen]') && !['checkbox','select-one'].includes(target.type)) {
      const key=target.dataset.screen;
      this.screen[key]=['min','max'].includes(key)?target.value===''?null:Number(target.value):target.value;
      this.markDirty();return;
    }
    if(target.matches('[data-option-field]') && target.tagName!=='SELECT') {
      const opt=this.screen.options.find(o=>o.id===target.dataset.id); if(!opt)return;
      opt[target.dataset.optionField]=target.dataset.optionField==='points'?Number(target.value):target.value;this.markDirty();return;
    }
    if(target.matches('[data-style]')) {
      const style=this.designGlobal?this.doc.style:(this.screen.style ||= {}); const key=target.dataset.style;
      style[key]=['x','y','opacity','optionOpacity'].includes(key)?Number(target.value):target.value; this.markDirty();
      if(target.type==='color'&&target.nextElementSibling)target.nextElementSibling.textContent=target.value;
      if(key==='optionOpacity')target.nextElementSibling.textContent=`${Math.round(target.value*100)} %`;
      if(key==='option')document.querySelector('.alpha-input')?.style.setProperty('--alpha-color',target.value);
    }
  }
  async onChange(e) {
    const target=e.target;
    try {
      if(this.onVariableChange(target))return;
      if(target.matches('[data-screen]') && ['checkbox','select-one'].includes(target.type)) {
        const key=target.dataset.screen;
        if(key==='type') {
          try {this.assertContentType(target.value);} catch(error) {target.value=this.screen.type;throw error;}
        }
        this.screen[key]=target.type==='checkbox'?target.checked:target.value;
        if(key==='type'&&target.value==='choice'&&!this.screen.options)this.screen.options=[{id:uid(),label:'Primera opción',points:0,next:''},{id:uid(),label:'Segunda opción',points:0,next:''}];
        if(key==='default'&&target.checked)for(const r of this.doc.results)if(r!==this.screen)r.default=false;
        this.markDirty();this.render();
      }
      if(target.matches('select[data-option-field]')) {this.screen.options.find(o=>o.id===target.dataset.id)[target.dataset.optionField]=target.value;this.markDirty();}
      if(target.matches('[data-design-scope]')) {this.designGlobal=target.value==='global';this.render();}
      if(target.matches('[data-style]')) this.render();
      if(target.matches('[data-upload]') && target.files[0]) {
        const file=target.files[0];if(file.size>8*1024*1024)throw new Error('La imagen debe ocupar menos de 8 MB.');
        const style=this.designGlobal?this.doc.style:(this.screen.style ||= {});
        const data=new FormData();data.append('file',file);toast('Subiendo imagen…');
        const result=await api('/uploads',{method:'POST',body:data});style.image=result.url;this.markDirty();this.render();toast('Imagen guardada');
      }
      if(target.matches('[data-date]')) {this.dateFilters ||= {};this.dateFilters[target.dataset.date]=target.value;}
    } catch(error){toast(error.message,true);}
  }
  async onClick(e) {
    const target=e.target.closest('[data-action]'); if(!target || target.closest('dialog') || !document.querySelector('.editor-main'))return;
    const action=target.dataset.action,value=target.dataset.value;
    try {
      if(this.onVariableAction(action,value,target))return;
      if(action==='screen'){this.selected=value;this.designGlobal=false;this.render();}
      if(action==='tab'){this.tab=value;this.render();}
      if(action==='view'){await this.save();this.view=value;if(value==='responses')await this.loadResponses();else if(value==='integration')await this.loadIntegration();else this.render();}
      if(action==='save'){await this.save();toast('Borrador guardado');}
      if(action==='desktop'||action==='mobile'){this.mobile=action==='mobile';this.render();}
      if(action==='add-content'){
        if(this.doc.questions.length>=100)throw new Error('El máximo es de 100 pantallas de contenido.');
        this.openContentPicker();
      }
      if(action==='add-result'){
        if(this.doc.results.length>=20)throw new Error('El máximo es de 20 resultados.');
        const r={id:uid(),title:'Un nuevo resultado',description:'Gracias por compartir tus respuestas.',min:null,max:null,default:false,showScore:false,style:{}};this.doc.results.push(r);this.selected=r.id;this.tab='logic';this.markDirty();this.render();
      }
      if(action==='add-option'){if(this.screen.options.length>=50)throw new Error('El máximo es de 50 opciones.');this.screen.options.push({id:uid(),label:'Nueva opción',points:0,next:''});this.markDirty();this.render();}
      if(action==='remove-option'){if(await confirmDelete('Eliminar opción','Se eliminará esta opción del borrador.')){this.screen.options=this.screen.options.filter(o=>o.id!==value);this.markDirty();this.render();}}
      if(action==='delete-screen'){
        const list=this.kind==='result'?this.doc.results:this.doc.questions;
        if(list.length===1)throw new Error('Conserva al menos una pregunta y un resultado.');
        if(await confirmDelete('Eliminar pantalla','Los saltos que apunten a esta pantalla deberán corregirse antes de publicar.')){list.splice(list.findIndex(s=>s.id===this.selected),1);this.selected=this.doc.welcome.id;this.markDirty();this.render();}
      }
      if(action==='duplicate-screen'){
        const list=this.kind==='result'?this.doc.results:this.doc.questions;
        if(list.length >= (this.kind==='result'?20:100))throw new Error('Se ha alcanzado el máximo de pantallas.');
        const copy=structuredClone(this.screen);copy.id=uid();copy.title+=' · copia';copy.default=false;if(copy.options)copy.options.forEach(o=>o.id=uid());list.splice(list.findIndex(s=>s.id===this.selected)+1,0,copy);this.selected=copy.id;this.markDirty();this.render();
      }
      if(action==='move-up'||action==='move-down'){
        const list=this.doc.questions,id=value||this.selected,index=list.findIndex(q=>q.id===id),dest=index+(action==='move-up'?-1:1);
        if(index>=0&&dest>=0&&dest<list.length){
          const scrollTop=document.querySelector('.screen-list').scrollTop,scrollLeft=document.querySelector('.screen-list-items').scrollLeft;
          [list[index],list[dest]]=[list[dest],list[index]];this.selected=id;this.markDirty();this.render();
          document.querySelector('.screen-list').scrollTop=scrollTop;document.querySelector('.screen-list-items').scrollLeft=scrollLeft;
          const row=document.querySelector(`[data-question-row="${CSS.escape(id)}"]`);
          (row.querySelector(`[data-action="${action}"]:not(:disabled)`)||row.querySelector('[data-action="screen"]')).focus({preventScroll:true});
        }
      }
      if(action==='reset-style'){this.screen.style={};this.markDirty();this.render();}
      if(action==='gallery')await this.openGallery();
      if(action==='remove-image'){(this.designGlobal?this.doc.style:(this.screen.style ||= {})).image='';this.markDirty();this.render();}
      if(action==='preview'){
        await this.save();if(this.form.errors?.length)throw new Error('Corrige los avisos del formulario para probar un recorrido válido.');
        const dialog=modal('Vista previa · no se guardan respuestas','<div id="preview-player"></div>',true);
        const player=new Player(dialog.querySelector('#preview-player'),structuredClone(this.doc),{preview:true});dialog.addEventListener('close',()=>player.destroy());
      }
      if(action==='publish'){
        target.disabled=true;await this.save();const result=await api(`/forms/${this.form.id}/publish`,{method:'POST'});this.form.published=result.version;this.render();this.share();toast(`Versión ${result.version} publicada`);
      }
      if(action==='share')this.share();
      if(action==='filter-responses')await this.loadResponses();
      if(action==='response-detail')this.responseDetail(value);
      if(action==='retry'){await api(`/submissions/${value}/retry`,{method:'POST'});toast('Reintento programado');await this.loadResponses();}
      if(action==='google-check'){
        const spreadsheet=document.querySelector('#spreadsheet').value;
        target.disabled=true;this.googleCheck=await api(`/forms/${this.form.id}/integration/check`,{method:'POST',body:{spreadsheet}});this.render();toast('Documento accesible. Selecciona una pestaña.');
      }
      if(action==='google-save'){
        target.disabled=true;const spreadsheet=document.querySelector('#spreadsheet').value,sheet_id=Number(document.querySelector('#sheet-id').value);
        await api(`/forms/${this.form.id}/integration`,{method:'PUT',body:{enabled:true,spreadsheet,sheet_id}});await this.loadIntegration();toast('Sincronización automática activada');
      }
      if(action==='delete-responses'&&await confirmDelete('Eliminar respuestas','Se eliminarán todas las respuestas de este formulario, no solo las del filtro, y también sus filas en Google Sheets. Esta acción no se puede deshacer.')){
        target.disabled=true;const {deleted}=await api(`/forms/${this.form.id}/submissions`,{method:'DELETE'});toast(deleted===1?'1 respuesta eliminada':`${deleted} respuestas eliminadas`);await this.loadResponses();
      }
      if(action==='google-resync'&&await confirmDelete('Sincronizar todo de nuevo','Se vaciará la pestaña de Google Sheets y se volverán a escribir todas las respuestas guardadas en la aplicación. Los cambios hechos a mano en esa pestaña se perderán.','Sincronizar','clock')){
        target.disabled=true;const {synced}=await api(`/forms/${this.form.id}/integration/resync`,{method:'POST'});toast(synced===1?'1 respuesta sincronizada con Google Sheets':`${synced} respuestas sincronizadas con Google Sheets`);await this.loadIntegration();
      }
      if(action==='google-disable'){await api(`/forms/${this.form.id}/integration`,{method:'PUT',body:{enabled:false}});await this.loadIntegration();toast('Sincronización desactivada para nuevos envíos');}
    }catch(error){toast(error.message,true);}finally{target.disabled=false;}
  }
  openContentPicker() {
    const dialog=modal('Añadir contenido',`<p class="dialog-text">¿Qué quieres añadir después de la pantalla seleccionada?</p><div class="content-picker">${contentTypes.map(([type,symbol,hint])=>`<button type="button" class="content-option" data-content-type="${type}">${icon(symbol)}<span><strong>${types[type]}</strong><small>${hint}</small></span></button>`).join('')}</div>`);
    dialog.addEventListener('click',e=>{const option=e.target.closest('[data-content-type]');if(option){dialog.close();this.addContent(option.dataset.contentType);}});
  }
  addContent(type) {
    const q=type==='statement'
      ?{id:uid(),type,title:'Un momento para contarte algo',description:'Escribe aquí el texto que quieres mostrar.',button:'Continuar',next:'next',style:{}}
      :{id:uid(),type,title:'Tu nueva pregunta',description:'',required:true,next:'next',style:{},...(type==='choice'?{options:[{id:uid(),label:'Primera opción',points:0,next:''},{id:uid(),label:'Segunda opción',points:0,next:''}]}:{})};
    const index=this.doc.questions.findIndex(q=>q.id===this.selected);this.doc.questions.splice(index<0?this.doc.questions.length:index+1,0,q);this.selected=q.id;this.tab='content';this.markDirty();this.render();
  }
  async openGallery() {
    const style=this.designGlobal?this.doc.style:(this.screen.style ||= {}), current=resolveStyle(this.doc,{style}).image;
    const images=await api('/uploads');
    const dialog=modal('Mis imágenes',images.length?`<p class="dialog-text">Elige una imagen que ya hayas subido para no repetir la subida.</p><div class="gallery-grid">${images.map(i=>`<button type="button" class="gallery-item ${i.url===current?'selected':''}" data-image="${esc(i.url)}" aria-pressed="${i.url===current}" aria-label="Usar imagen subida el ${esc(formatDate(i.uploaded))}"><img src="${esc(i.url)}" alt="" loading="lazy" decoding="async"/></button>`).join('')}</div>`:'<p class="dialog-text gallery-empty">Aún no has subido imágenes. Usa <strong>Subir imagen</strong> y aparecerán aquí.</p>',true);
    dialog.addEventListener('click',e=>{
      const item=e.target.closest('[data-image]'); if(!item)return;
      style.image=item.dataset.image;this.markDirty();this.render();dialog.close();toast('Imagen aplicada');
    });
  }
  share() {
    const link=()=>location.origin+'/f/'+(this.form.slug||this.form.id);
    const dialog=modal('Tu formulario está listo',`<p class="dialog-text">Comparte este enlace. Las nuevas visitas verán la versión ${this.form.published}.</p><div class="share-url">${input('id="share-url" readonly aria-label="Enlace público"',link())}${button('copy-link','Copiar','copy','primary')}</div><a class="btn open-link" href="${esc(link())}" target="_blank" rel="noopener">Abrir formulario ${icon('arrow')}</a><div class="custom-link"><h3>Enlace personalizado</h3><p>Una dirección fácil de recordar. El enlace con el identificador sigue funcionando.</p><label class="slug-input"><span>${esc(location.host)}/f/</span><input id="slug" value="${esc(this.form.slug||'')}" maxlength="60" placeholder="mi-formulario" autocomplete="off" spellcheck="false" aria-label="Enlace personalizado" aria-describedby="slug-status"/></label><p class="slug-status" id="slug-status" aria-live="polite"></p><div class="inline-actions">${button('save-slug','Guardar enlace','check','primary')}${button('remove-slug','Quitar enlace',null,'subtle')}</div></div>`);
    const shareUrl=dialog.querySelector('#share-url'),slug=dialog.querySelector('#slug'),status=dialog.querySelector('.slug-status'),save=dialog.querySelector('[data-action="save-slug"]'),remove=dialog.querySelector('[data-action="remove-slug"]');
    const show=(text,kind='')=>{status.textContent=text;status.className='slug-status '+kind;};
    const typed=()=>slug.value.replace(/-+$/,'');
    const refresh=()=>{shareUrl.value=link();dialog.querySelector('.open-link').href=link();remove.hidden=!this.form.slug;save.disabled=!typed()||typed()===this.form.slug;};
    refresh();
    let timer;
    slug.oninput=()=>{
      // Lowercase, no accents, and any other character becomes a hyphen.
      slug.value=slug.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+/,'');
      refresh();show('');clearTimeout(timer);const value=typed();if(!value||value===this.form.slug)return;
      timer=setTimeout(async()=>{try{const result=await api(`/slugs/${encodeURIComponent(value)}?form_id=${this.form.id}`);if(typed()!==value)return;show(result.available?'Disponible':result.message,result.available?'ok':'error');save.disabled=!result.available;}catch{}},300);
    };
    save.onclick=async()=>{save.disabled=true;try{const result=await api(`/forms/${this.form.id}/slug`,{method:'PUT',body:{slug:typed()}});this.form.slug=result.slug;slug.value=result.slug;refresh();show('Enlace guardado','ok');toast('Enlace personalizado guardado');}catch(error){show(error.message,'error');save.disabled=false;}};
    remove.onclick=async()=>{remove.disabled=true;try{await api(`/forms/${this.form.id}/slug`,{method:'PUT',body:{slug:''}});this.form.slug=null;slug.value='';refresh();show('');toast('Enlace personalizado quitado');}catch(error){show(error.message,'error');}finally{remove.disabled=false;}};
    dialog.querySelector('[data-action="copy-link"]').onclick=async()=>{try{await navigator.clipboard.writeText(shareUrl.value);toast('Enlace copiado');}catch{shareUrl.select();toast('Selecciona y copia el enlace.');}};
  }
  async loadResponses(){[this.responses,this.integration]=await Promise.all([api(`/forms/${this.form.id}/submissions?`+new URLSearchParams(this.dateFilters||{})),api(`/forms/${this.form.id}/integration`)]);this.render();}
  responsesMarkup(){
    const rows=this.responses||[],status={disabled:'Sin integración',pending:'Pendiente',synced:'Sincronizado',error:'Error'};
    const sheet=this.integration?.connected&&this.integration.integration?.enabled?this.integration.integration:null;
    return `<section class="responses-page"><div class="page-title"><div><span class="eyebrow">ESCUCHAR ES EL PRIMER PASO</span><h1>Sus respuestas, en un lugar.</h1><p>${rows.length} envíos en este intervalo · Fechas mostradas en Europe/Madrid</p></div><div class="inline-actions">${sheet?`<a class="btn" href="https://docs.google.com/spreadsheets/d/${esc(sheet.spreadsheet)}/edit#gid=${esc(sheet.sheet_id)}" target="_blank" rel="noopener">${icon('file')} Abrir Google Sheets</a>`:''}<a class="btn primary" href="/api/forms/${this.form.id}/export?${esc(new URLSearchParams(this.dateFilters||{}).toString())}">${icon('download')} Descargar Excel</a>${button('delete-responses','Eliminar respuestas','trash','danger')}</div></div><div class="response-filters">${field('Desde · UTC',input('data-date="start"',this.dateFilters?.start||'','date'))}${field('Hasta · UTC, incluido',input('data-date="end"',this.dateFilters?.end||'','date'))}${button('filter-responses','Aplicar filtro',null)}${button('filter-responses','Actualizar','clock','subtle')}</div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Envío</th><th>Finalizado · Madrid</th><th>Versión</th><th>Variables</th><th>Resultado</th><th>Google Sheets</th><th></th></tr></thead><tbody>${rows.map(s=>`<tr><td><button class="text-link" data-action="response-detail" data-value="${s.id}">${s.id.slice(0,8)}</button></td><td>${formatDate(s.completed)}</td><td>v${s.version}</td><td>${(s.variables||[{name:'Puntuación',value:s.total}]).map(v=>`${esc(v.name)}: ${esc(v.value)}`).join('<br>')}</td><td>${esc(s.result_title)}</td><td><span class="status-pill ${s.sync_status}">${status[s.sync_status]}</span></td><td>${s.sync_status==='error'||s.sync_status==='pending'?button('retry','Reintentar',null,'subtle',`data-value="${s.id}"`):''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state">${icon('chart')}<h2>Aquí empieza la conversación</h2><p>Los envíos completados aparecerán aquí, aunque Google Sheets no esté conectado.</p>${this.form.published?button('share','Compartir formulario','link'):button('publish','Publicar formulario','arrow','primary')}</div>`}</section>`;
  }
  responseDetail(id){
    const s=this.responses.find(s=>s.id===id);
    modal('Detalle del envío',`<div class="response-detail"><p class="mono small">${esc(s.id)}</p><p>${formatDate(s.completed)} · Europe/Madrid · v${s.version}</p><div class="detail-result"><strong>${esc(s.result_title)}</strong>${(s.variables||[{name:'Puntuación',value:s.total}]).map(v=>`<p>${esc(v.name)}: <strong>${esc(v.value)}</strong></p>`).join('')}</div>${s.answers.map(a=>`<div class="detail-answer"><h3>${esc(a.title)}</h3><p>${a.label===null?'Sin respuesta':esc(a.label)}</p><small>ID: ${esc(a.question_id)}${a.type==='choice'&&a.value?' · Opción: '+esc(a.value):''}</small></div>`).join('')}<p class="field-hint">Las preguntas fuera del recorrido no tienen respuesta activa y aparecen vacías en Excel.</p>${s.destination_id?`<div class="notice"><strong>Destino original</strong><p>${esc(s.sheet_title)} · ${esc(s.spreadsheet)}</p><p>Intentos fallidos: ${s.attempts||0}</p>${s.error?`<p class="error-text">${esc(s.error)}</p>`:''}</div>`:'<p>Google Sheets no estaba activado al recibir este envío.</p>'}</div>`);
  }
  async loadIntegration(){this.integration=await api(`/forms/${this.form.id}/integration`);this.render();}
  integrationMarkup(){
    const data=this.integration;if(!data)return '<div class="loading">Cargando conexiones…</div>';
    const config=data.integration,check=this.googleCheck;
    return `<section class="integration-page"><span class="eyebrow">CADA RESPUESTA, BIEN GUARDADA</span><h1>Conecta tu flujo de trabajo.</h1><p class="lead">Tus respuestas siempre se guardan aquí. Google Sheets recibe una copia automáticamente.</p><div class="integration-card"><div class="integration-card-heading"><span class="sheets-symbol">${icon('file')}</span><div><h2>Google Sheets</h2><span class="status-pill ${config?.enabled?'synced':'disabled'}">${config?.enabled?'Sincronización activa':data.connected?'Google conectado':'Sin conectar'}</span></div></div>${!data.configured?`<div class="notice"><strong>Configura el cliente OAuth en el servidor</strong><p>Añade GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env y reinicia el servidor. Encontrarás los pasos en README.md.</p><p>URI de redirección:</p><code>${esc(data.redirect)}</code></div>`:`<p>Autoriza tu cuenta para acceder a una hoja donde tengas permiso de edición.</p><a class="btn" href="/api/google/connect?form_id=${this.form.id}">${icon('link')}${data.connected?'Volver a conectar Google':'Conectar Google'}</a>`}${data.connected?`<div class="section-divider"></div>${field('Documento de Google Sheets',input('id="spreadsheet"',check?.spreadsheet||config?.spreadsheet||'','text','placeholder="Pega la URL o el identificador del documento"'))}${button('google-check','Comprobar acceso','check')}${check?`<div class="notice">Documento: <strong>${esc(check.title)}</strong></div>`:''}${check||config?`${field('Pestaña de destino',select('id="sheet-id"',String(config?.sheet_id??check?.sheets[0]?.sheetId??''),(check?.sheets||[{sheetId:config.sheet_id,title:config.title}]).map(s=>[String(s.sheetId),s.title])))}<p class="field-hint">Usa una pestaña vacía dedicada a la aplicación. Mantén sus filas y columnas en el orden original. Puedes analizar los datos desde otra pestaña.</p><div class="inline-actions">${button('google-save',config?.enabled?'Guardar destino':'Activar sincronización','check','primary')}${config?.enabled?button('google-disable','Desactivar',null,'subtle'):''}</div>${config?.enabled?`<div class="section-divider"></div><h3>Volcar todas las respuestas</h3><p class="field-hint">Vacía la pestaña de destino y vuelve a escribir todas las respuestas guardadas en la aplicación. Úsalo si ya había respuestas antes de conectar Google Sheets o si la hoja se ha desordenado.</p>${button('google-resync','Sincronizar todo de nuevo','clock')}`:''}`:''}`:''}</div><div class="integration-notes"><h3>Preparado para los imprevistos</h3><p>Los errores temporales se reintentan con espera progresiva. Puedes consultar el estado y reintentar manualmente desde Respuestas.</p><p>Los trabajos pendientes mantienen su destino original al cambiar esta configuración. La integración se aplica a los nuevos envíos; para volcar los anteriores, usa «Sincronizar todo de nuevo».</p></div></section>`;
  }
}

Object.assign(Editor.prototype, variableEditor);
