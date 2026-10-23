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
// Share only after an explicit tap, preserving the browser's native-share user gesture.
function showSetupLink(out,url,employee){
 out.replaceChildren();
 const heading=document.createElement('strong');heading.textContent='Sign-in setup link for '+employee;
 const hint=document.createElement('span');hint.style.display='block';hint.textContent='Share privately with this employee. The link expires after 24 hours and works once.';
 const link=document.createElement('a');link.href=url;link.textContent=url;link.style.display='block';
 const actions=document.createElement('span');actions.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin-top:12px';
 const message='Set up your ActivityTAB sign-in using this personal link. It expires after 24 hours and works once.';
 const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='button';b.textContent=label;b.addEventListener('click',action);actions.append(b);return b};
 const status=document.createElement('span');status.setAttribute('role','status');status.style.display='block';
 if(typeof navigator.share==='function')button('Share sign-in link',async()=>{try{await navigator.share({title:'ActivityTAB sign-in setup',text:message,url})}catch(e){if(e.name!=='AbortError')status.textContent='Sharing could not open. Use Email, WhatsApp or Copy link below.'}});
 const email=document.createElement('a');email.className='button';email.textContent='Email';email.href='mailto:?subject='+encodeURIComponent('Your ActivityTAB sign-in setup')+'&body='+encodeURIComponent(message+'\n\n'+url);actions.append(email);
 const whatsapp=document.createElement('a');whatsapp.className='button';whatsapp.textContent='WhatsApp';whatsapp.href='https://wa.me/?text='+encodeURIComponent(message+'\n'+url);whatsapp.target='_blank';whatsapp.rel='noopener noreferrer';actions.append(whatsapp);
 button('Copy link',async()=>{try{await navigator.clipboard.writeText(url);status.textContent='Link copied.'}catch{status.textContent='Copy the link displayed above.'}});
 out.append(heading,hint,link,actions,status);
}
document.querySelectorAll('[data-invite]').forEach(button=>button.addEventListener('click',async()=>{const out=document.getElementById('invite-output');button.disabled=true;out.style.display='block';out.textContent='Creating link…';try{const r=await fetch(base+'/api/auth/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member:button.dataset.invite})}),b=await r.json();if(!r.ok)throw Error(b.error);showSetupLink(out,b.url,button.closest('.access-row')?.querySelector('strong')?.textContent||'the employee');out.scrollIntoView({block:'center',behavior:'smooth'})}catch(e){out.textContent=e.message}finally{button.disabled=false}}));
