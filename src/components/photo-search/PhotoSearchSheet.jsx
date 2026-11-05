import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Camera,ImagePlus,ScanSearch,X} from 'lucide-react';
import Modal from '../Modal.jsx';
import ProductCard from '../ProductCard.jsx';
import {isNativeApp} from '../../native/platform.js';
import {preparePhoto} from './photo.js';
import './photo-search.css';
const API=String(import.meta.env.VITE_API_URL||'http://localhost:5000/api').replace(/\/+$/,'');
export default function PhotoSearchSheet({onClose}){
 const[available,setAvailable]=useState(null),[error,setError]=useState(''),[file,setFile]=useState(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[results,setResults]=useState(null),[cropping,setCropping]=useState(false),[crop,setCrop]=useState({x:50,y:50,zoom:1});
 const gallery=useRef(),camera=useRef(),pending=useRef(),mounted=useRef(true),sequence=useRef(0),previewSequence=useRef(0);
 useEffect(()=>{
  mounted.current=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  fetch(API+'/visual-search/status',{signal:controller.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(mounted.current)setAvailable(data.available===true);}).catch(()=>{if(mounted.current)setAvailable(false);}).finally(()=>clearTimeout(timer));
  return()=>{mounted.current=false;sequence.current++;previewSequence.current++;controller.abort();clearTimeout(timer);pending.current?.abort();};
 },[]);
 useEffect(()=>{
  if(!file){setPreview('');return;}const id=++previewSequence.current;let url;
  preparePhoto(file,cropping?crop:null).then(blob=>{if(!mounted.current||id!==previewSequence.current)return;url=URL.createObjectURL(blob);setPreview(url);}).catch(e=>{if(mounted.current&&id===previewSequence.current){setError(e.message||'This photo could not be read.');setPreview('');}});
  return()=>{previewSequence.current++;if(url)URL.revokeObjectURL(url);};
 },[file,cropping,crop]);
 function cancel(){sequence.current++;pending.current?.abort();setBusy(false);}
 async function accept(selected){
  if(!selected)return;cancel();const id=sequence.current;setError('');setResults(null);setCropping(false);setCrop({x:50,y:50,zoom:1});
  try{await preparePhoto(selected);if(mounted.current&&sequence.current===id)setFile(selected);}catch(e){if(mounted.current&&sequence.current===id)setError(e.message||'This photo could not be read.');}
 }
 async function choose(source){
  setError('');if(!isNativeApp()){(source==='camera'?camera:gallery).current?.click();return;}
  try{
   const{Camera:NativeCamera,CameraSource,CameraResultType}=await import('@capacitor/camera');
   const photo=await NativeCamera.getPhoto({source:source==='camera'?CameraSource.Camera:CameraSource.Photos,resultType:CameraResultType.DataUrl,quality:90,width:1600,height:1600,correctOrientation:true,saveToGallery:false,allowEditing:false});
   if(photo.dataUrl)await accept(await(await fetch(photo.dataUrl)).blob());
  }catch(e){if(!mounted.current||/cancel/i.test(e.message||''))return;setError(source==='camera'?'Camera access is unavailable or denied. Gallery upload is still available.':'Gallery could not open. Try the file picker below.');}
 }
 async function search(){
  if(!file||busy||available!==true)return;setBusy(true);setError('');setResults(null);const id=++sequence.current,controller=new AbortController();pending.current=controller;const timer=setTimeout(()=>controller.abort(),70000);
  try{
   const bytes=await preparePhoto(file,cropping?crop:null);if(!mounted.current||id!==sequence.current)return;
   const response=await fetch(API+'/visual-search',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:bytes,signal:controller.signal,cache:'no-store'}),data=await response.json();
   if(!response.ok)throw new Error(data.message||'Photo search failed. Please retry.');if(mounted.current&&id===sequence.current)setResults(Array.isArray(data.products)?data.products:[]);
  }catch(e){if(mounted.current&&id===sequence.current)setError(e.name==='AbortError'?'The connection took too long. Retry or search by name.':e.message||'Upload failed. Check your connection and retry.');}
  finally{clearTimeout(timer);if(mounted.current&&id===sequence.current)setBusy(false);}
 }
 return <Modal title="Search by photo" onClose={onClose} className="photo-search-sheet">
  <p className="photo-intro">See it. Find your workout version.</p><p className="muted">Find visually similar products in GymDrobe’s catalogue.</p>
  {available===null&&<p role="status">Checking photo search availability…</p>}{available===false&&<p role="status" className="photo-unavailable">Photo search is not available yet. You can preview a photo, or search by name.</p>}
  <div className="photo-sources"><button type="button" onClick={()=>choose('camera')}><Camera size={23} aria-hidden="true"/>Take a photo</button><button type="button" onClick={()=>choose('gallery')}><ImagePlus size={23} aria-hidden="true"/>Upload from gallery</button></div>
  <input hidden ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{accept(e.target.files?.[0]);e.target.value='';}}/><input hidden ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{accept(e.target.files?.[0]);e.target.value='';}}/>
  {isNativeApp()&&<button type="button" className="text-link" onClick={()=>gallery.current?.click()}>Use file picker instead</button>}
  {preview&&<section className="photo-preview" aria-label="Selected photo"><img src={preview} alt="Selected search photo preview"/><div className="photo-edit-actions"><button type="button" onClick={()=>{cancel();setResults(null);setCropping(!cropping);}}>{cropping?'Use full photo':'Crop photo'}</button><button type="button" onClick={()=>choose('gallery')}>Replace</button><button type="button" onClick={()=>{cancel();setFile(null);setResults(null);setError('');}}><X size={15} aria-hidden="true"/>Remove</button></div>
   {cropping&&<fieldset><legend>Frame your product</legend>{[['x','Horizontal position',0,100,1],['y','Vertical position',0,100,1],['zoom','Zoom',1,3,0.1]].map(([key,label,min,max,step])=><label key={key}>{label}<input type="range" min={min} max={max} step={step} value={crop[key]} onChange={e=>{cancel();setResults(null);setCrop({...crop,[key]:Number(e.target.value)});}}/></label>)}</fieldset>}
  </section>}
  <p className="photo-privacy">Use a clear product photo without faces or personal details. Your photo is processed for this search and is not saved to your account.</p>
  {error&&<p role="alert" className="photo-error">{error}</p>}
  <button type="button" className="button photo-submit" disabled={!file||!preview||busy||available!==true} onClick={search}><ScanSearch size={19} aria-hidden="true"/>{busy?'Finding similar products…':error&&file&&available?'Retry photo search':'Find similar products'}</button>
  {busy&&<p role="status">Comparing your photo with our catalogue. <button type="button" className="text-link" onClick={cancel}>Cancel</button></p>}
  {results&&<section aria-label="Photo search results" aria-live="polite"><h2>{results.length?'Visually similar products':'No close matches found. Try another photo or search by name.'}</h2>{results.length>0&&<p>These products look similar. An exact match has not been verified.</p>}<div className="photo-results">{results.map(product=><div key={product.id} onClick={e=>{if(e.target.closest('a'))onClose();}}><ProductCard product={product}/></div>)}</div></section>}
  <Link className="photo-text-search" to="/search" onClick={onClose}>Search by name instead →</Link>
 </Modal>;
}
