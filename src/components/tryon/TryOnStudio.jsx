import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../Modal.jsx';
import { ProductImage } from '../StorefrontShared.jsx';
import FitFinder from './FitFinder.jsx';
import { preparePhoto, dataImageBlob } from '../../utils/tryonPhoto.js';
import { getVariantStock } from '../../utils/cartUtils.js';
const wait = (ms,signal) => new Promise((resolve,reject) => {
  if(signal.aborted)return reject(new DOMException('Aborted','AbortError'));
  const done=()=>{signal.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,ms);
  const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'));};signal.addEventListener('abort',abort,{once:true});
});
async function api(url,options={}) {
  let response;
  try { response=await fetch('/api/try-on'+url,{credentials:'same-origin',cache:'no-store',...options}); }
  catch (error) { if(error.name==='AbortError')throw error;throw new Error('The connection was interrupted. Please check your connection and try again.'); }
  let data;try{data=await response.json();}catch{throw new Error('The photo preview service is not available yet. You can still use the size guide.');}
  if(!response.ok)throw new Error(data.message || 'The fitting room is temporarily unavailable.');return data;
}
function PersonOutline() {return <svg viewBox="0 0 160 250" aria-hidden="true"><circle cx="80" cy="35" r="22"/><path d="M57 68c-12 3-18 15-22 34L22 148m81-80c12 3 18 15 22 34l13 46M57 68h46l3 88-6 75M54 156l6 75m-6-75h52M80 157v74"/></svg>;}
export default function TryOnStudio({product,color,selectedSize,onSelectSize,onClose,initialTab='photo'}) {
  const [tab,setTab]=useState(initialTab),[config,setConfig]=useState(null),[configError,setConfigError]=useState('');
  const [photo,setPhoto]=useState(null),[result,setResult]=useState(null),[phase,setPhase]=useState('idle');
  const [consent,setConsent]=useState(false),[error,setError]=useState(''),[comparison,setComparison]=useState('after'),[slider,setSlider]=useState(50);
  const [preparing,setPreparing]=useState(false),[elapsed,setElapsed]=useState(0);
  const upload=useRef(null),camera=useRef(null),operation=useRef(null),activeJob=useRef(null),resultUrl=useRef(null),serial=useRef(0),csrf=useRef(''),configController=useRef(null);
  const id=useId();const busy=['starting','in_queue','processing'].includes(phase);
  const colorReady=Boolean(config?.product?.colors?.includes(String(color || '')));
  const ready=Boolean(config?.configured && colorReady);
  function discardJob() {
    const current=activeJob.current;activeJob.current=null;
    if(current)fetch(`/api/try-on/jobs/${current}`,{method:'DELETE',credentials:'same-origin',keepalive:true,headers:{'X-GymDrobe-Token':csrf.current}}).catch(()=>{});
  }
  function clearResult() {if(resultUrl.current){URL.revokeObjectURL(resultUrl.current);resultUrl.current=null;}setResult(null);}
  function removePhoto() {
    serial.current++;operation.current?.abort();discardJob();clearResult();setPhoto(null);setPhase('idle');setConsent(false);setError('');setPreparing(false);
    if(upload.current)upload.current.value='';if(camera.current)camera.current.value='';
  }
  async function loadConfig() {
    configController.current?.abort();const controller=new AbortController();configController.current=controller;setConfigError('');setConfig(null);
    try{const data=await api(`/config?product=${encodeURIComponent(product.id)}`,{signal:controller.signal});if(!controller.signal.aborted){setConfig(data);csrf.current=data.csrf;}}
    catch(e){if(e.name!=='AbortError')setConfigError(e.message);}
  }
  useEffect(()=>{loadConfig();return()=>{configController.current?.abort();operation.current?.abort();serial.current++;discardJob();if(resultUrl.current)URL.revokeObjectURL(resultUrl.current);};},[product.id]);
  useEffect(()=>{if(!busy)return;setElapsed(0);const timer=setInterval(()=>setElapsed(n=>n+1),1000);return()=>clearInterval(timer);},[busy]);
  async function choosePhoto(file) {
    if(!file)return;removePhoto();const current=serial.current;setPreparing(true);
    try {const value=await preparePhoto(file);if(current===serial.current){setPhoto(value);setError('');}}
    catch(e){if(current===serial.current)setError(e.message);}
    finally{if(current===serial.current)setPreparing(false);}
  }
  async function generate() {
    if(!ready || !photo || !consent || busy || preparing)return;
    operation.current?.abort();discardJob();clearResult();setError('');setPhase('starting');setComparison('after');
    const controller=new AbortController();operation.current=controller;const current=++serial.current;
    const requestKey=crypto.randomUUID();
    try {
      const started=await api('/jobs',{method:'POST',headers:{'Content-Type':'application/json','X-GymDrobe-Token':csrf.current},body:JSON.stringify({productId:String(product.id),color,personImage:photo.dataUrl,consent:true,requestKey}),signal:controller.signal});
      // A close/reset can happen while submission is arriving; never retain that job.
      if(current!==serial.current){activeJob.current=started.id;discardJob();return;}
      activeJob.current=started.id;const start=Date.now();
      while(Date.now()-start<185000){
        await wait(2500,controller.signal);
        const next=await api(`/jobs/${started.id}`,{signal:controller.signal});
        if(current!==serial.current)return;
        if(next.status==='completed'){
          const blob=dataImageBlob(next.image),url=URL.createObjectURL(blob);resultUrl.current=url;setResult({url,color:next.color,extension:blob.type==='image/png'?'png':'jpg'});setPhase('completed');discardJob();return;
        }
        if(next.status==='failed')throw new Error(next.message || 'This photo could not be processed. Try a clearer photo.');
        setPhase(next.status);
      }
      throw new Error('This preview took too long. Please try again later.');
    }catch(e){if(e.name!=='AbortError' && current===serial.current){setError(e.message);setPhase('failed');discardJob();}}
  }
  function cancel(){serial.current++;operation.current?.abort();discardJob();setPhase('idle');setError('Preview stopped here. A request already sent may still finish at the image service.');}
  function chooseSize(size){onSelectSize?.(size);onClose();}
  const stock=getVariantStock(product,selectedSize,color);
  return <Modal title="Your fitting room" onClose={onClose} className="tryon-modal">
    <div className="try-product"><ProductImage product={product} decorative/><div><p className="try-eyebrow">GymDrobe · try it your way</p><h3>{product.name}</h3><p>{color || 'Selected colour'}{selectedSize ? ` · Size ${selectedSize}` : ''}</p></div><span className="try-beta">AI preview</span></div>
    <div className="try-tabs" aria-label="Fitting room tools">
      <button type="button" aria-pressed={tab==='photo'} onClick={()=>setTab('photo')}>01 <span>See it on me</span></button>
      <button type="button" aria-pressed={tab==='size'} onClick={()=>setTab('size')}>02 <span>Find my size</span></button>
    </div>
    <div hidden={tab!=='photo'} className="try-photo-layout">
      <div className="try-canvas-column">
        <div className={`try-canvas ${photo?'has-photo':''}`}>
          {!photo ? <div className="try-empty"><PersonOutline/><strong>Your photo. Your preview.</strong><p>Add a clear, fully clothed photo with one person.</p><button type="button" className="button secondary try-mobile-upload" disabled={preparing} onClick={()=>upload.current.click()}>Add my photo</button></div> : <>
            <img className="try-person" src={result && comparison==='after'?result.url:photo.dataUrl} alt={result && comparison==='after'?`AI appearance preview of ${product.name} in ${result.color}`:'Your uploaded photo'} />
            {result && comparison==='compare' && <img className="try-person try-overlay" style={{clipPath:`inset(0 ${100-slider}% 0 0)`}} src={result.url} alt={`AI appearance preview of ${product.name}`}/>}
            {result && comparison==='compare' && <div className="try-divider" style={{left:`${slider}%`}} aria-hidden="true"><span>↔</span></div>}
            <span className="try-image-label">{!result?'Original photo':comparison==='before'?'Original photo':comparison==='compare'?'AI preview / original':'AI-generated appearance preview'}</span>
          </>}
          {(busy || preparing) && <div className="try-processing" role="status"><span className="try-spinner" aria-hidden="true"/><strong>{preparing?'Preparing your photo':phase==='in_queue'?'Your preview is in the queue':'Creating your preview'}</strong><p>{preparing?'Checking dimensions and removing photo metadata.':`You can explore the size guide while you wait. ${elapsed}s elapsed.`}</p></div>}
        </div>
        {result && <>
          <div className="try-segment try-view-controls" aria-label="Preview comparison">{[['before','Original'],['after','Try-on'],['compare','Compare']].map(([value,label])=><button key={value} type="button" aria-pressed={comparison===value} onClick={()=>setComparison(value)}>{label}</button>)}</div>
          {comparison==='compare' && <label className="try-slider">Slide to compare<input type="range" min="0" max="100" value={slider} onChange={e=>setSlider(Number(e.target.value))} aria-label="Before and after comparison"/></label>}
          <p className="try-small">Appearance preview only. AI may alter details, body proportions or drape. Changing size does not generate a physically accurate fit simulation.</p>
          <div className="try-result-actions"><a className="text-link" href={result.url} download={`GymDrobe-AI-preview-${product.id}.${result.extension}`}>Download preview</a><button type="button" className="text-link" onClick={()=>setTab('size')}>Check my size →</button></div>
        </>}
      </div>
      <div className="try-controls">
        <p className="try-eyebrow">A closer look, before you choose</p><h3>See how it could look on you.</h3>
        <p className="try-muted">Preview the style and colour, then use your measurements to choose a size.</p>
        {configError ? <div className="try-notice"><strong>Photo preview unavailable</strong><p>{configError}</p><button type="button" className="text-link" onClick={loadConfig}>Check again</button></div> : config && !ready && <div className="try-notice"><strong>{!config.configured?'Photo previews are not available yet':'This colour needs a product photo'}</strong><p>{!config.configured?'You can prepare a photo locally and explore the size guide. Photo generation will open when the store connects its image service.':`An approved photo for ${color || 'this selection'} is needed before we can show this item on you.`}</p></div>}
        {!config && !configError && <p role="status" className="try-small">Checking preview availability…</p>}
        <div className="try-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)choosePhoto(e.dataTransfer.files?.[0]);}}>
          <input ref={upload} id={`${id}-upload`} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>choosePhoto(e.target.files?.[0])}/>
          <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden onChange={e=>choosePhoto(e.target.files?.[0])}/>
          <button type="button" className="button secondary" disabled={busy || preparing} onClick={()=>upload.current.click()}>{photo?'Replace photo':'Upload your photo'}</button>
          <button type="button" className="text-link" disabled={busy || preparing} onClick={()=>camera.current.click()}>Take a photo</button>
          <p className="try-small">JPEG, PNG or WebP · up to 8 MB. You can also drop a photo here. Camera capture depends on your device.</p>
        </div>
        <ul className="try-photo-tips"><li>One person, facing the camera, with arms slightly away from the body.</li><li>{config?.product?.category==='shoes'?'Include both feet and ankles clearly.':'Show the full torso and hips; use a full-body photo for a complete outfit.'}</li><li>Use even lighting and an uncluttered background.</li><li>Wear fitted everyday clothes; avoid coats, crossed arms and mirror obstructions.</li></ul>
        <label className="try-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>I have permission to use this photo and agree to send it to FASHN to create this preview.</span></label>
        <button type="button" className="button full" disabled={!ready || !photo || !consent || busy || preparing} onClick={generate}>{busy?'Creating preview…':result?'Create another preview':'Generate my preview'}</button>
        {busy && <button type="button" className="text-link" onClick={cancel}>Stop waiting</button>}
        {photo && !busy && <button type="button" className="text-link" onClick={removePhoto}>Remove photo and preview</button>}
        {error && <p className="try-error" role="alert">{error}</p>}
        <details className="try-guidance"><summary>Your photo and privacy</summary><p>Adding a photo keeps it in this window. Pressing Generate sends a prepared copy and the product photo to FASHN. Your body measurements are never included.</p><p>GymDrobe does not save these photos to your account or browser storage. Closing this window clears its local copies. Already submitted requests may continue processing. FASHN temporarily retains processed images and request records under its policy.</p><a href="https://docs.fashn.ai/api-overview/data-retention-privacy" target="_blank" rel="noreferrer">Read FASHN’s retention policy ↗</a></details>
      </div>
    </div>
    <div hidden={tab!=='size'} className="try-fit-panel"><FitFinder product={product} color={color} onSelect={chooseSize}/></div>
    <div className="try-footer"><span>{selectedSize?`Selected: ${selectedSize} · ${color}`:'Choose your options on the product page'}{stock?'':' · Check availability'}</span><button type="button" className="button secondary" onClick={onClose}>Continue shopping</button></div>
  </Modal>;
}