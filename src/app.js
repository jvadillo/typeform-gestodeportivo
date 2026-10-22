import {root,api,brand,button,icon,esc,toast,modal,confirmDelete,formatDate} from './ui.js';
import {Editor} from './editor.js';
import {Player} from './player.js';

let editor;
function dashboardShell(content){root.innerHTML=`<div class="admin-layout"><aside class="app-sidebar">${brand()}<span class="workspace-label">ESPACIO PERSONAL</span><a href="/admin" class="sidebar-link active">${icon('grid')} Mis formularios</a><div class="sidebar-bottom"><div class="personal-note"><span class="online-dot"></span> Tu espacio, tus ideas.<small>Administración privada</small></div><button data-action="logout" class="sidebar-link">${icon('logout')} Cerrar sesión</button></div></aside><div class="dashboard-main"><header class="dashboard-header"><span>Mi espacio <span class="slash">/</span> Formularios</span><div class="owner-avatar" title="Propietario">G</div></header>${content}</div></div>`;}
async function loginPage(status){
  root.innerHTML=`<main class="login-page"><div class="login-art">${brand()}<div class="login-art-copy"><span class="eyebrow">MENOS RUIDO. MÁS CONVERSACIÓN.</span><h1>Las buenas preguntas<br>abren caminos.</h1><p>Un espacio para escuchar, conocer y conectar.</p></div><div class="orbit-art" aria-hidden="true"><div></div><div></div><div></div></div><span class="login-art-footer">Formularios con intención.</span></div><section class="login-panel"><div class="login-box"><span class="eyebrow">TU ESPACIO PERSONAL</span><h1>${status.setup?'Empecemos con buen pie.':'Qué bien verte de nuevo.'}</h1><p>${status.setup?'Elige una contraseña para proteger tus formularios y respuestas. No necesitas crear una cuenta.':'Introduce tu contraseña para seguir creando.'}</p><form id="login-form"><label class="field"><span>${status.setup?'Crea tu contraseña':'Contraseña'}</span><input type="password" name="password" required ${status.setup?'minlength="12"':''} maxlength="1024" autocomplete="${status.setup?'new-password':'current-password'}" autofocus/><small>${status.setup?'Al menos 12 caracteres. Guárdala para futuras visitas.':''}</small></label><p id="login-error" class="error-text" role="alert"></p><button class="btn primary" type="submit">${status.setup?'Crear mi espacio':'Entrar a mi espacio'} ${icon('arrow')}</button></form><p class="login-footer">${icon('check')} Solo tú tienes acceso a la administración.</p></div></section></main>`;
  document.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('button');submit.disabled=true;try{await api('/auth/login',{method:'POST',body:{password:new FormData(e.target).get('password')}});location.assign(location.pathname==='/admin'?'/admin':location.pathname);}catch(error){document.querySelector('#login-error').textContent=error.message;}finally{submit.disabled=false;}};
}
async function dashboard(){
  const forms=await api('/forms');const count=forms.reduce((n,f)=>n+f.submissions,0);
  dashboardShell(`<main class="dashboard-content"><div class="dashboard-heading"><div><span class="eyebrow">PEQUEÑOS GESTOS, GRANDES CONVERSACIONES</span><h1>¿Qué quieres descubrir?</h1><p>Crea una experiencia que invite a responder.</p></div>${button('create','Crear formulario','plus','primary')}</div><section class="welcome-banner"><div><span class="banner-tag">DA FORMA A TUS IDEAS</span><h2>Una pregunta.<br>Infinitas posibilidades.</h2><p>Diseña a tu manera. Escucha con atención.<br>Deja que cada respuesta encuentre su camino.</p>${button('create','Empezar algo nuevo','arrow','banner-button')}</div><div class="banner-art" aria-hidden="true"><span class="art-circle"></span><span class="art-leaf"></span><span class="art-line"></span><div class="floating-note">${icon('branch')}<span>Cada persona,<br><strong>su propio camino.</strong></span></div></div></section><div class="forms-heading"><h2>Mis formularios <span>${forms.length}</span></h2><span>${count} ${count===1?'respuesta recibida':'respuestas recibidas'}</span></div><section class="forms-grid">${forms.map((form,i)=>`<article class="form-card"><a href="/admin/forms/${form.id}" class="form-card-cover cover-${i%4}" aria-label="Editar ${esc(form.name)}"><span class="cover-symbol">${icon(i%2?'branch':'flower')}</span><span class="status-pill ${form.published?'published':'draft'}">${form.published?'Publicado':'Borrador'}</span><h3>${esc(form.name)}</h3><span class="cover-arrow">${icon('arrow')}</span></a><div class="form-card-info"><a href="/admin/forms/${form.id}">${esc(form.name)}</a><div class="form-meta"><span>${icon('chart')} ${form.submissions} respuestas</span><span>${form.published?'v'+form.published:'Sin publicar'}</span></div><div class="form-card-bottom"><span>Actualizado ${formatDate(form.updated).split(',')[0]}</span><div>${button('duplicate','', 'copy','icon-btn',`data-id="${form.id}" aria-label="Duplicar ${esc(form.name)}" title="Duplicar"`)}${button('delete','', 'trash','icon-btn',`data-id="${form.id}" data-name="${esc(form.name)}" aria-label="Eliminar ${esc(form.name)}" title="Eliminar"`)}</div></div></div></article>`).join('')}<button class="new-form-card" data-action="create"><span>${icon('plus')}</span><strong>Una nueva conversación</strong><small>Empieza con una idea</small></button></section><footer class="dashboard-footer">Diseñado para preguntar mejor.<span>gesto.</span></footer></main>`);
}
function createDialog(){
  const dialog=modal('Una nueva conversación',`<form id="create-form"><label class="field"><span>Nombre del formulario</span><input name="name" required maxlength="200" placeholder="Por ejemplo, Conoce a tu equipo" autofocus/></label><div class="dialog-actions"><button class="btn primary" type="submit">Crear formulario ${icon('arrow')}</button></div></form>`);
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button');btn.disabled=true;try{const form=await api('/forms',{method:'POST',body:{name:new FormData(e.target).get('name')}});location.assign('/admin/forms/'+form.id);}catch(error){toast(error.message,true);btn.disabled=false;}};
}
document.addEventListener('click',async e=>{
  const target=e.target.closest('[data-action]');if(!target||editor||target.closest('dialog'))return;
  try{
    const action=target.dataset.action;
    if(action==='create')createDialog();
    if(action==='logout'){await api('/auth/logout',{method:'POST'});location.assign('/admin');}
    if(action==='duplicate'){await api(`/forms/${target.dataset.id}/duplicate`,{method:'POST'});toast('Formulario duplicado');await dashboard();}
    if(action==='delete'&&await confirmDelete('Eliminar formulario',`Se eliminarán «${target.dataset.name}», sus versiones y todos sus envíos. Esta acción no se puede deshacer. Las filas ya enviadas a Google Sheets se conservan.`)){await api(`/forms/${target.dataset.id}`,{method:'DELETE'});await dashboard();toast('Formulario eliminado');}
  }catch(error){toast(error.message,true);}
});
async function boot(){
  const publicMatch=location.pathname.match(/^\/f\/([^/]+)$/);
  if(publicMatch){
    const form=await api('/public/'+publicMatch[1]);root.innerHTML='<main id="public-player"></main>';
    new Player(document.querySelector('#public-player'),form.document,{submit:(id,answers)=>api(`/public/${form.id}/submit`,{method:'POST',body:{id,answers,version:form.version,token:form.token}})});return;
  }
  const status=await api('/auth');if(!status.authenticated){await loginPage(status);return;}
  const editorMatch=location.pathname.match(/^\/admin\/forms\/([^/]+)$/);
  if(editorMatch){const form=await api('/forms/'+editorMatch[1]);editor=new Editor(form,content=>{root.innerHTML=`<div class="editor-app">${content}</div>`;});await editor.init();}
  else await dashboard();
}
boot().catch(error=>{root.innerHTML=`<main class="error-page">${brand()}<h1>No hemos podido abrir esta página.</h1><p>${esc(error.message)}</p><a href="/admin" class="btn primary">Ir a mi espacio ${icon('arrow')}</a></main>`;});
