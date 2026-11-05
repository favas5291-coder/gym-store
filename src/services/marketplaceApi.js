const BASE=(import.meta.env?.VITE_API_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"")+"/marketplace";
function completeWriteReply(path,d){
  if(path.endsWith("/invitation")||path==="/admin/suppliers")return Boolean(d.account?.id)&&typeof d.invitationCode==="string";
  if(path==="/session"||path==="/activate"||path==="/password")return typeof d.token==="string"&&Boolean(d.user?.id);
  if(path==="/invitations/inspect")return typeof d.termsDigest==="string"&&Boolean(d.businessName);
  if(path==="/earnings/reconcile")return Boolean(d.balance)&&Array.isArray(d.earnings);
  if(path.endsWith("/financial-preview"))return Boolean(d.preview);
  if(path.endsWith("/collection"))return Boolean(d.collectionId);
  if(path.includes("/resolutions"))return Boolean(d.resolution?.id);
  if(path==="/admin/expenses")return Boolean(d.expense?.id);
  if(path.includes("/destinations/")&&path.endsWith("/reveal"))return Boolean(d.details)&&Boolean(d.destinationId);
  if(path.includes("/destinations/")||path==="/payment-details")return Boolean(d.destination?.id);
  if(path.includes("/payouts"))return Boolean(d.payout?.id);
  if(path==="/media")return Boolean(d.media?.id);
  if(path.startsWith("/media/"))return d.removed===true;
  if(path.startsWith("/shipments/"))return Boolean(d.shipment?.id);
  if(path.includes("/listings"))return Boolean(d.listing?.id);
  return Boolean(d.account?.id);
}
export async function marketplaceRequest(path,{token,method="GET",body,signal,csv=false}={}){
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(abort,30000);
  try{const r=await fetch(BASE+path,{method,cache:"no-store",signal:controller.signal,headers:{Accept:csv?"text/csv":"application/json",...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
    if(csv&&r.ok)return await r.blob();let d;try{d=await r.json();}catch{ /* An incomplete write is never called saved. */ }
    if(!r.ok||d?.success!==true)throw Object.assign(new Error(d?.message||"Unable to confirm the supplier request. Reload before retrying."),{status:r.status,code:d?.code,outcomeUnknown:method!=="GET"&&(r.ok||r.status>=500)});if(method!=="GET"&&!completeWriteReply(path,d))throw Object.assign(new Error("The change could not be confirmed. Review the latest record before retrying."),{status:r.status,code:"MARKETPLACE_REPLY_INCOMPLETE",outcomeUnknown:true});return d;
  }catch(e){if(signal?.aborted&&method==="GET")throw e;if(e.status)throw e;throw Object.assign(new Error("Connection interrupted. Reload to confirm the latest record before making another change."),{outcomeUnknown:method!=="GET"});}
  finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}
export function parsePaise(value,label="Amount"){
  if(typeof value!=="string"||!/^\d{1,8}(?:\.\d{1,2})?$/.test(value.trim()))throw new Error(`${label}: enter a positive INR amount with up to two decimal places.`);
  const [whole,fraction=""]=value.trim().split(".");const n=Number(BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0")));if(!Number.isSafeInteger(n)||n>10000000000)throw new Error(`${label} is too large.`);return n;
}
export const rupees=value=>Number.isSafeInteger(value)?(value/100).toFixed(2):"";
export async function uploadMarketplaceImage(token,file,kind="product"){
  const {compressSupplierImage}=await import("../utils/marketplaceImage.js");const data=await compressSupplierImage(file);return marketplaceRequest("/media",{token,method:"POST",body:{kind,...data}});
}
export async function downloadPayoutStatement(token,id){const blob=await marketplaceRequest(`/payouts/${encodeURIComponent(id)}/statement`,{token,csv:true}),url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`GymDrobe-payout-${id}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
