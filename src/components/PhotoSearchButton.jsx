import {lazy,Suspense,useEffect,useState} from 'react';
import {Camera} from 'lucide-react';
const Sheet=lazy(()=>import('./photo-search/PhotoSearchSheet.jsx'));
export default function PhotoSearchButton(props){
 if(import.meta.env.VITE_PHOTO_SEARCH_ENABLED !== "true")return null;
 return <EnabledPhotoSearchButton {...props}/>;
}
function EnabledPhotoSearchButton({restoreCamera=false}){
 const[open,setOpen]=useState(false);
 useEffect(()=>{if(!restoreCamera)return;const restored=()=>setOpen(true);window.addEventListener('gymdrobe-camera-interrupted',restored);return()=>window.removeEventListener('gymdrobe-camera-interrupted',restored);},[restoreCamera]);
 return <><button type="button" className="gn-icon-button photo-search-button" aria-label="Search by photo" onClick={()=>setOpen(true)}><Camera size={21} strokeWidth={1.7} aria-hidden="true"/></button>{open&&<Suspense fallback={<span role="status">Opening photo search…</span>}><Sheet onClose={()=>setOpen(false)}/></Suspense>}</>;
}
