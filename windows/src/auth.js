const base='/ActivityTAB';
if('serviceWorker'in navigator)navigator.serviceWorker.register(base+'/sw.js',{scope:base+'/'}).catch(()=>{});
// Recheck from the sign-in origin rather than treating a launcher navigation as logout.
// Keep the session HttpOnly: credentials never enter localStorage or JavaScript.
if(document.querySelector('form[data-action="login"]')){
 const resumeSession=async()=>{try{const r=await fetch(base+'/api/auth/session',{credentials:'same-origin',cache:'no-store'});if(r.ok&&(await r.json()).signedIn)location.replace(base+'/?workspace=1')}catch{}};
 resumeSession();
 window.addEventListener('pageshow',e=>{if(e.persisted)resumeSession()});
}
document.querySelector('form[data-action]')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),error=form.querySelector('[role=alert]');button.disabled=true;error.textContent='';const data=Object.fromEntries(new FormData(form));data.remember=!!form.querySelector('[name=remember]')?.checked;try{const r=await fetch(base+'/api/auth/'+form.dataset.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),b=await r.json();if(!r.ok)throw Error(b.error||'Please try again');location.replace(b.redirect||base+'/?workspace=1')}catch(err){error.textContent=err.message;button.disabled=false}});
document.querySelectorAll('[data-invite]').forEach(button=>button.addEventListener('click',async()=>{const out=document.getElementById('invite-output');button.disabled=true;out.style.display='block';out.textContent='Creating link…';try{const r=await fetch(base+'/api/auth/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member:button.dataset.invite})}),b=await r.json();if(!r.ok)throw Error(b.error);out.textContent='Share this link privately with the employee: '+b.url;out.scrollIntoView({block:'center',behavior:'smooth'})}catch(e){out.textContent=e.message}finally{button.disabled=false}}));
