import { useAuth } from "../../context/AuthContext.jsx";
import useEditorRecovery from "../../hooks/useEditorRecovery.jsx";
import ProductSourceSuggestions from "../ProductSourceSuggestions.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {Field,Notice,Status,Empty,request,parsePaise,rupees,useMarketLoad,LoadingState,useMutation,amount} from "./Shared.jsx";
export const emptyDraft=()=>({name:"",brand:"",category:"",description:"",images:[],variantImages:[],specifications:{},material:"",careInstructions:[],sizeChart:"",manufacturer:"",origin:"",warranty:"",shippingLeadDays:0,returnsEligible:"unconfirmed",returnWindowDays:7,returnRequestTypes:["return","exchange"],returnConditions:"",weightGrams:0,dimensionsCm:{length:0,width:0,height:0},expiryDate:"",batch:"",variants:[{size:null,color:null,supplierSku:"",barcode:"",supplierUnitAmount:0,mrpUnitAmount:null,stock:"",supplierPromotionMaximumPaise:0,promotionAgreement:""}]});
const editDraft=d=>({...d,variants:d.variants.map(v=>({...v,supplierPrice:rupees(v.supplierUnitAmount),mrp:rupees(v.mrpUnitAmount),promotion:rupees(v.supplierPromotionMaximumPaise||0)}))});
function payload(d){if(d.variants.some(v=>v.stock===""||v.stock==null))throw new Error("Enter a stock quantity for each variant. Enter 0 for sold out.");return {...d,shippingLeadDays:Number(d.shippingLeadDays),returnWindowDays:Number(d.returnWindowDays),weightGrams:Number(d.weightGrams),dimensionsCm:Object.fromEntries(Object.entries(d.dimensionsCm).map(([k,v])=>[k,Number(v)])),variants:d.variants.map(({supplierPrice,mrp,promotion,...v})=>({...v,size:v.size||null,color:v.color||null,stock:Number(v.stock),supplierUnitAmount:parsePaise(supplierPrice,"Supplier price"),mrpUnitAmount:mrp===""?null:parsePaise(mrp,"MRP"),supplierPromotionMaximumPaise:parsePaise(promotion||"0","Supplier promotion contribution")}))};}
export function ListingEditor({token,account,id}){if(!id)return <NewListing token={token} account={account}/>;return <ExistingListing token={token} account={account} id={id}/>;}
function NewListing({token,account}) {
 const [generation,setGeneration]=useState(0);
 const [warning,setWarning]=useState("");
 return <><Notice error={warning}/><Editor key={generation} token={token} account={account} record={null} previews={{}} reload={()=>setGeneration(n=>n+1)} onPartial={setWarning}/></>;
}
function ExistingListing({token,account,id}){const location=useLocation();const [partial,setPartial]=useState(location.state?.marketplaceSubmissionWarning||"");const load=useMarketLoad(id?`/listings/${id}`:"/me",token);return <><Notice error={partial}/><LoadingState load={load}>{load.data&&<Editor key={id?`${id}:${load.data.listing.revision}:${load.data.listing.stockDigest||""}`:"new"} token={token} account={account} record={id?load.data.listing:null} previews={load.data.imagePreviews||{}} reload={load.reload} onPartial={setPartial}/>}</LoadingState></>;}
function Editor({token,account,record,previews,reload,onPartial}){
 const navigate=useNavigate(),[draft,setDraft]=useState(()=>editDraft(record?.draft||emptyDraft())),[sourceUrl,setSourceUrl]=useState(record?.sourceUrl||""),[link,setLink]=useState(""),[color,setColor]=useState(""),[images,setImages]=useState(previews),[dirty,setDirty]=useState(false);const action=useMutation();
 const {user}=useAuth();
 const [pendingPhotos, setPendingPhotos] = useState([]);
 const requestId=useRef(crypto.randomUUID());
 const originalRevision=useRef(record?.revision);
 const recoveryValue=useMemo(()=>({draft,sourceUrl,link,color,images,pendingPhotos,revision:originalRevision.current,requestId:requestId.current}),[draft,sourceUrl,link,color,images,pendingPhotos]);
 const recovery=useEditorRecovery({user,token,entity:["supplier-product",account.id,record?.id||"new"],value:recoveryValue,dirty:dirty||Boolean(link),restore(saved){
   setDraft(saved.draft);setSourceUrl(saved.sourceUrl);setLink(saved.link);setColor(saved.color);setImages({...previews,...saved.images});
   requestId.current=saved.requestId;originalRevision.current=saved.revision;setPendingPhotos(saved.pendingPhotos || []);setDirty(true);
 }});
 const set=(k,v)=>{setDraft(d=>({...d,[k]:v}));setDirty(true);};const changeVariant=(i,key,value)=>set("variants",draft.variants.map((v,n)=>n===i?{...v,[key]:value}:v));
 async function save(submit){let saved,submissionWarning="";onPartial("");const result=await action.run(async()=>{if(record && originalRevision.current!==record.revision)throw new Error("The listing changed after this draft was saved. Review the latest record before applying your edits.");
 if(pendingPhotos.length)throw new Error("Finish or remove the waiting photo uploads before saving this listing.");
 const d=payload(draft);if(!record)await recovery.checkpoint(recoveryValue);saved=await request(record?`/listings/${record.id}`:"/listings",{token,method:record?"PUT":"POST",body:{revision:record?.revision,draft:d,sourceUrl,...(!record?{requestId:requestId.current}:{})}});if(!submit)return saved;try{return await request(`/listings/${saved.listing.id}/submit`,{token,method:"POST",body:{revision:saved.listing.revision}});}catch(error){submissionWarning=`Draft saved. Submission ${error.outcomeUnknown?"could not be confirmed; review its current status before retrying.":`was not completed: ${error.message}`}`;onPartial(submissionWarning);throw error;}},submit?"Submitted for admin review. Approved live content stays unchanged.":"Draft saved.");if(saved){await recovery.clear().catch(()=>{});setDirty(false);if(!record)navigate(`/supplier/products/${saved.listing.id}`,{replace:true,state:{marketplaceSubmissionWarning:submissionWarning}});else reload();}}
 async function storePhotoProgress(snapshot) {
   // Commit the remote reference and the remaining queue together. If a
   // response is lost, the backend deduplicates the same bytes for this owner.
   await recovery.checkpoint(snapshot);
   setDraft(snapshot.draft);
   setImages(snapshot.images);
   setPendingPhotos(snapshot.pendingPhotos);
   setDirty(true);
 }
 async function upload(files = []) {
   await action.run(async () => {
     let next = recoveryValue;
     if (files.length) {
       if (pendingPhotos.length) throw new Error("Finish the waiting uploads before choosing more photos.");
       if (files.length + draft.images.length > 12) throw new Error("Choose up to twelve gallery photos.");
       const { compressSupplierImage } = await import("../../utils/marketplaceImage.js");
       // Sequential decoding bounds memory use on low-memory phones.
       const prepared = [];
       for (const file of files) prepared.push({color, image: await compressSupplierImage(file)});
       next = {...next, pendingPhotos: prepared};
       await storePhotoProgress(next);
     }
     while (next.pendingPhotos.length) {
       const [photo, ...remaining] = next.pendingPhotos;
       const {media} = await request("/media", {token, method:"POST", body:{kind:"product", ...photo.image}});
       const previous = next.draft;
       let groups = previous.variantImages;
       if (photo.color) {
         const existing = groups.find(group => group.color === photo.color);
         groups = [...groups.filter(group => group.color !== photo.color), {
           color: photo.color, images: [...new Set([...(existing?.images || []), media.url])],
         }];
       }
       next = {...next, pendingPhotos:remaining, images:{...next.images, [media.url]:media.preview},
         draft:{...previous, images:[...new Set([...previous.images, media.url])], variantImages:groups}};
       await storePhotoProgress(next);
     }
     return true;
   }, "Product photos uploaded.");
 }
 function discardWaitingPhotos() {
   if (window.confirm("Remove the waiting uploads? Completed photos stay in the gallery.")) {
     void action.run(async () => {
       await storePhotoProgress({...recoveryValue, pendingPhotos:[]});
       return true;
     }, "Waiting photos removed.");
   }
 }
 const disabled=action.busy||action.locked||account.status!=="active"||record?.status==="submitted";
 return <section><div className="mp-heading"><div><p className="mp-eyebrow">YOUR CATALOGUE</p><h1>{record?"Edit product":"Add product"}</h1></div>{record&&<Status>{record.status}</Status>}</div><Notice error={action.error} message={action.message}/>{record?.feedback&&<p className="mp-note">Admin feedback: {record.feedback}</p>}{action.locked&&<button className="button secondary" onClick={reload}>Reload latest record</button>}{record?.live&&<StockEditor token={token} record={record} reload={reload}/>} {record?.live&&<p className="mp-note">Customers continue to see the approved version while proposed content or supplier-price changes await review.</p>}
 {recovery.notice}<form onSubmit={e=>{e.preventDefault();save(true);}}><fieldset disabled={disabled} className="mp-form"><section className="mp-panel"><Field label="Original product website link (optional)" type="url" value={sourceUrl} onChange={e=>{setSourceUrl(e.target.value);setDirty(true);}}/>
 {/^https?:\/\//i.test(sourceUrl) && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Open original product</a>}
 <ProductSourceSuggestions url={sourceUrl} token={token} allowPrice={draft.variants.length===1} onPrice={price=>changeVariant(0,"supplierPrice",String(price))}
 onPhoto={url=>{setDraft(d=>({...d,images:[...new Set([...d.images,url])]}));setDirty(true);}}
 onDetails={result=>{setDraft(d=>({...d,name:d.name||result.name,category:d.category||account.business.categories.find(c=>c.toLowerCase()===result.category.toLowerCase())||""}));setDirty(true);}}/>
 <h2>Product basics</h2><div className="mp-form-grid"><Field label="Product name" required minLength={2} maxLength={200} value={draft.name} onChange={e=>set("name",e.target.value)}/><Field label="Brand"><select required value={draft.brand} onChange={e=>set("brand",e.target.value)}><option value="">Choose approved brand</option>{account.business.brands.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Category"><select required value={draft.category} onChange={e=>set("category",e.target.value)}><option value="">Choose approved category</option>{account.business.categories.map(v=><option key={v}>{v}</option>)}</select></Field></div><Field label="Description"><textarea rows={5} maxLength={5000} value={draft.description} onChange={e=>set("description",e.target.value)}/></Field></section>
 <section className="mp-panel"><h2>Product photos</h2><p className="muted">JPEG, PNG or WebP. Images are resized before upload and decoded/validated again by the server. Up to 12 gallery images.</p>{pendingPhotos.length > 0 && <div role="status" className="notice">
   {pendingPhotos.length} {pendingPhotos.length === 1 ? "photo is" : "photos are"} saved on this device for upload.{" "}
   <button type="button" className="text-link" onClick={() => upload()}>Continue photo uploads</button>{" "}
   <button type="button" className="text-link" onClick={discardWaitingPhotos}>Remove waiting photos</button>
 </div>}<div className="mp-form-grid"><Field label="Apply new uploads to colour (optional)"><select value={color} onChange={e=>setColor(e.target.value)}><option value="">Whole product gallery</option>{[...new Set(draft.variants.map(v=>v.color).filter(Boolean))].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Upload product photos" disabled={Boolean(pendingPhotos.length)} multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{upload(Array.from(e.target.files || []));e.target.value="";}}/></div><div className="mp-inline"><Field label="Or use an authorized public HTTPS image" type="url" value={link} onChange={e=>setLink(e.target.value)}/><button type="button" className="button secondary" onClick={()=>{if(!link)return;set("images",[...draft.images,link]);setLink("");}}>Add image URL</button></div><div className="mp-gallery">{draft.images.map((url,i)=><figure key={url+i}><img src={images[url]||url} alt={`Product photo ${i+1}`} loading="lazy"/>{i === 0 ? <figcaption>Cover photo</figcaption> : <button type="button" onClick={()=>set("images",[url,...draft.images.filter((_,n)=>n!==i)])}>Make cover</button>}<button type="button" onClick={()=>{set("images",draft.images.filter((_,n)=>n!==i));set("variantImages",draft.variantImages.map(v=>({...v,images:v.images.filter(image=>image!==url)})));}}>Remove photo {i+1}</button></figure>)}</div></section>
 <section className="mp-panel"><h2>Variants, supplier amounts and stock</h2><p>Enter your agreed supplier amount in INR. Admin sets customer selling prices separately. Prices are tax inclusive; admin must confirm the declared tax rate before publication.</p>{draft.variants.map((v,i)=><fieldset className="mp-variant" key={i}><legend>Variant {i+1}</legend><div className="mp-form-grid">{[["size","Size / pack / capacity"],["color","Colour / flavour / style"],["supplierSku","Your SKU"],["barcode","Barcode (optional)"]].map(([k,l])=><Field key={k} label={l} required={k==="supplierSku"} value={v[k]||""} onChange={e=>changeVariant(i,k,e.target.value)}/>)}<Field label="Supplier amount ₹" inputMode="decimal" required value={v.supplierPrice} onChange={e=>changeVariant(i,"supplierPrice",e.target.value)}/><Field label="MRP ₹ (optional)" inputMode="decimal" value={v.mrp} onChange={e=>changeVariant(i,"mrp",e.target.value)}/><Field label="Stock quantity" type="number" min="0" max="1000000" step="1" required value={v.stock} onChange={e=>changeVariant(i,"stock",e.target.value)}/></div><details><summary>Supplier-funded promotion agreement (optional)</summary><p>Leave contribution zero for platform-funded discounts. A positive cap explicitly agrees to reduce your supplier payable for eligible promotions.</p><div className="mp-form-grid"><Field label="Maximum contribution per unit ₹" inputMode="decimal" value={v.promotion} onChange={e=>changeVariant(i,"promotion",e.target.value)}/><Field label="Explicit agreement reference / terms" value={v.promotionAgreement} onChange={e=>changeVariant(i,"promotionAgreement",e.target.value)}/></div></details>{draft.variants.length>1&&<button type="button" className="text-link" onClick={()=>set("variants",draft.variants.filter((_,n)=>n!==i))}>Remove variant</button>}</fieldset>)}<button type="button" className="button secondary" onClick={()=>set("variants",[...draft.variants,{...editDraft(emptyDraft()).variants[0]}])}>Add variant</button></section>
 <details className="mp-panel"><summary>More details</summary><section className="mp-panel"><h2>Shipping and purchased returns policy</h2><div className="mp-form-grid">{[["shippingLeadDays","Preparation / dispatch lead time (days)"],["weightGrams","Packaged weight (grams)"]].map(([k,l])=><Field key={k} label={l} type="number" min="0" step="1" required value={draft[k]} onChange={e=>set(k,e.target.value)}/>)}{["length","width","height"].map(k=><Field key={k} label={`Package ${k} (cm)`} type="number" min="0" step="1" required value={draft.dimensionsCm[k]} onChange={e=>set("dimensionsCm",{...draft.dimensionsCm,[k]:e.target.value})}/>)}<Field label="Routine return / exchange eligibility"><select value={draft.returnsEligible} onChange={e=>set("returnsEligible",e.target.value)}><option value="unconfirmed">Needs confirmation</option><option value="yes">Eligible under stated conditions</option><option value="no">No routine return / exchange</option></select></Field><Field label="Purchased request window (1–7 days)" type="number" required min="1" max="7" value={draft.returnWindowDays} onChange={e=>set("returnWindowDays",e.target.value)}/></div><div className="mp-inline">{["return","exchange"].map(type=><label key={type} className="mp-check"><input type="checkbox" checked={draft.returnRequestTypes.includes(type)} onChange={e=>set("returnRequestTypes",e.target.checked?[...draft.returnRequestTypes,type]:draft.returnRequestTypes.filter(v=>v!==type))}/>{type}</label>)}</div><Field label="Actual return/exchange conditions"><textarea rows={3} value={draft.returnConditions} onChange={e=>set("returnConditions",e.target.value)}/></Field></section>
 <section className="mp-panel"><h2>Category details</h2><div className="mp-form-grid">{[["manufacturer","Manufacturer"],["origin","Country of origin"],["warranty","Warranty information"]].map(([k,l])=><Field key={k} label={l} value={draft[k]} onChange={e=>set(k,e.target.value)}/>)}{/shirt|cloth|jogger|short|shoe|wear|sock/i.test(draft.category)&&<><Field label="Material" value={draft.material} onChange={e=>set("material",e.target.value)}/><Field label="Size chart / measurements" value={draft.sizeChart} onChange={e=>set("sizeChart",e.target.value)}/><Field label="Care instructions (one per line)"><textarea rows={3} value={draft.careInstructions.join("\n")} onChange={e=>set("careInstructions",e.target.value.split("\n"))}/></Field></>}{/protein|supplement|creatine|nutrition|fish oil|pre.?workout/i.test(draft.category)&&<><Field label="Batch number" required value={draft.batch} onChange={e=>set("batch",e.target.value)}/><Field label="Expiry date" type="date" required value={draft.expiryDate} onChange={e=>set("expiryDate",e.target.value)}/></>}</div><SpecificationFields value={draft.specifications} onChange={v=>set("specifications",v)}/></section>
 </details><details className="mp-panel"><summary>Preview submission</summary><h2>{draft.name||"Product name"}</h2><p>{draft.brand} · {draft.category}</p><p className="mp-prewrap">{draft.description}</p><p>{draft.variants.length} variant(s). Customer prices await admin review.</p></details><div className="mp-actions"><button type="submit" className="button">Submit for approval</button><button type="button" className="button secondary" disabled={!dirty&&Boolean(record)} onClick={()=>save(false)}>Save draft</button></div></fieldset></form></section>;
}
function SpecificationFields({value,onChange}){const rows=Object.entries(value);return <div><h3>Specifications</h3>{rows.map(([key,value],i)=><div className="mp-inline" key={i}><Field label={`Specification ${i+1}`} value={key} onChange={e=>onChange(Object.fromEntries(rows.map((row,n)=>n===i?[e.target.value,row[1]]:row)))}/><Field label="Value" value={value} onChange={e=>onChange({...Object.fromEntries(rows),[key]:e.target.value})}/><button type="button" className="text-link" onClick={()=>onChange(Object.fromEntries(rows.filter((_,n)=>n!==i)))}>Remove</button></div>)}<button type="button" className="button secondary" onClick={()=>onChange({...value,[`Detail ${rows.length+1}`]:""})}>Add specification</button></div>;}
export function ListingsTable({token,admin=false,supplierId}){const load=useMarketLoad(`/listings${supplierId?`?supplier=${supplierId}`:""}`,token);return <LoadingState load={load}><div className="mp-heading"><h1>{admin?"Product submissions":"Your products"}</h1>{!admin&&<Link className="button" to="/supplier/new">Add product</Link>}</div>{load.data?.listings.length?<div className="mp-table-wrap"><table><thead><tr><th>Product</th><th>Review status</th><th>Live version</th><th>Action</th></tr></thead><tbody>{load.data.listings.map(l=><tr key={l.id}><td><strong>{l.draft.name}</strong><small>{l.draft.brand}</small></td><td><Status>{l.status}</Status></td><td>{l.live?"Approved version retained":"Not published"}</td><td><Link to={admin?`/admin/marketplace/reviews/${l.id}`:`/supplier/products/${l.id}`}>{admin?"Review":"Edit / preview"}</Link></td></tr>)}</tbody></table></div>:<Empty>No products yet. {admin?"Supplier submissions will appear here.":"Start with a draft and submit it for approval."}</Empty>}</LoadingState>;}

function StockEditor({token,record,reload}){
 const {user}=useAuth();
 const act=useMutation();
 const initial=useMemo(()=>record.live.variants.map(({size,color,stock})=>({size,color,stock})),[record]);
 const [rows,setRows]=useState(initial);
 const baseline=useRef({revision:record.revision,digest:record.stockDigest});
 const value=useMemo(()=>({rows,...baseline.current}),[rows]);
 const recovery=useEditorRecovery({user,token,entity:["supplier-stock",record.id],value,dirty:rows!==initial,restore(saved){
   baseline.current={revision:saved.revision,digest:saved.digest};
   setRows(saved.rows);
 }});
 return <details className="mp-panel"><summary>Update live stock without content review</summary><p>These are current catalogue quantities, including sales. Stock updates preserve approved descriptions and prices.</p><Notice error={act.error} message={act.message}/>{recovery.notice}<form onSubmit={async e=>{e.preventDefault();const r=await act.run(()=>request(`/listings/${record.id}/stock`,{token,method:"PUT",body:{revision:baseline.current.revision,stockDigest:baseline.current.digest,variants:rows.map(r=>({...r,stock:Number(r.stock)}))}}),"Live stock updated.");if(r){await recovery.clear().catch(()=>{});reload();}}}><fieldset disabled={act.busy||act.locked}>{rows.map((row,i)=><Field key={i} label={`${[row.size,row.color].filter(Boolean).join(" / ")||"Default variant"} stock`} type="number" min="0" max="1000000" step="1" required value={row.stock} onChange={e=>setRows(rows.map((r,n)=>n===i?{...r,stock:e.target.value}:r))}/>)}<button className="button">Save stock quantities</button></fieldset></form></details>;}
