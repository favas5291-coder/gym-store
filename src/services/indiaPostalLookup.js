// Optional, public-only postal lookup. This community service is NOT an
// India Post operated SLA: all failures must leave checkout usable by typing.
// Do not send names, phone numbers or full address details to the provider.
const ORIGIN = "https://api.postalpincode.in";
const PIN_RE = /^[1-9]\d{5}$/;
const cache = new Map();
const TTL = 12 * 60 * 60 * 1000;

export function normalizePostOfficeResponse(response) {
  if (!Array.isArray(response) || response[0]?.Status !== "Success" || !Array.isArray(response[0]?.PostOffice)) return [];
  const seen = new Set();
  return response[0].PostOffice.map(row=>({
    locality: String(row.Name || "").trim(),
    district: String(row.District || "").trim(),
    state: String(row.State || "").trim(),
    pin: String(row.Pincode || "").trim(),
    delivery: String(row.DeliveryStatus || "").toLowerCase()==="delivery",
  })).filter(row=>{
    const key=[row.locality,row.district,row.state,row.pin].join("|").toLowerCase();
    if (!row.locality || !row.state || seen.has(key)) return false;
    seen.add(key);return true;
  });
}
async function load(url,signal) {
  const internal=new AbortController();
  const onAbort=()=>internal.abort();
  signal?.addEventListener("abort",onAbort,{once:true});
  const timer=setTimeout(()=>internal.abort(),6500);
  try {
    const res=await fetch(url,{signal:internal.signal,headers:{Accept:"application/json"}});
    if(!res.ok) throw new Error("Postal lookup is unavailable.");
    return normalizePostOfficeResponse(await res.json());
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort",onAbort);
  }
}
export async function lookupIndianPincode(pin,{signal}={}) {
  if(!PIN_RE.test(String(pin)))return [];
  const key=`pin:${pin}`;
  const cached=cache.get(key);
  if(cached&&Date.now()-cached.at<TTL)return cached.value;
  const value=await load(`${ORIGIN}/pincode/${encodeURIComponent(pin)}`,signal);
  cache.set(key,{at:Date.now(),value});
  return value;
}
export async function searchIndianPostOffices(term,{signal}={}) {
  const query=String(term||"").trim().slice(0,50);
  if(query.length<3)return [];
  const key=`office:${query.toLowerCase()}`;
  const saved=cache.get(key);
  if(saved&&Date.now()-saved.at<TTL)return saved.value;
  const list=await load(`${ORIGIN}/postoffice/${encodeURIComponent(query)}`,signal);
  cache.set(key,{at:Date.now(),value:list});
  return list;
}
