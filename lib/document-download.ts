// Fetch inside the signed-in app before handing bytes to the browser's download UI.
// Opening a protected API URL in a new Android browser/download context can lose cookies.
export async function downloadDocument(url:string,name:string){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
 if(!response.ok){
  const body=await response.json().catch(()=>null);
  throw new Error(body?.error||'Unable to download this document. Please try again.');
 }
 const blob=await response.blob(),objectUrl=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=objectUrl;link.download=name;link.hidden=true;
 try{document.body.appendChild(link);link.click()}
 catch(error){URL.revokeObjectURL(objectUrl);throw error}
 finally{link.remove()}
 // Allow Android time to consume the blob before releasing it; never persist file bytes.
 setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
