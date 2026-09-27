import { lazy, Suspense, useState } from 'react';
import config from '../../../scripts/config/tryon-products.json';
const TryOnStudio=lazy(()=>import('./TryOnStudio.jsx'));
export default function TryOnEntry({product,color,size,onSelectSize}) {
  const [open,setOpen]=useState(false);
  if(!config.products[String(product.id)]?.enabled)return null;
  return <>
    <button type="button" className="try-entry" onClick={()=>setOpen(true)}>
      <span className="try-entry-icon" aria-hidden="true">✧</span><span><strong>Try it on. Find your fit.</strong><small>A photo preview and a guide to your size</small></span><span aria-hidden="true">↗</span>
    </button>
    {open && <Suspense fallback={<p role="status" className="try-small">Opening your fitting room…</p>}><TryOnStudio product={product} color={color} selectedSize={size} onSelectSize={onSelectSize} onClose={()=>setOpen(false)}/></Suspense>}
  </>;
}