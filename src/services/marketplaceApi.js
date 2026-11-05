const BASE=(import.meta.env?.VITE_API_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"")+"/marketplace";
export async function marketplaceRequest(path,{token,method="GET",body,signal,csv=false}={}){
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(abort,30000);
  try{const r=await fetch(BASE+path,{method,cache:"no-store",signal:controller.signal,headers:{Accept:csv?"text/csv":"application/json",...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
    if(csv&&r.ok)return await r.blob();let d;try{d=await r.json();}catch{ /* An incomplete write is never called saved. */ }
    if(!r.ok||d?.success!==true)throw Object.assign(new Error(d?.message||"Unable to confirm the supplier request. Reload before retrying."),{status:r.status,code:d?.code,outcomeUnknown:method!=="GET"&&(r.ok||r.status>=500)});return d;
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
