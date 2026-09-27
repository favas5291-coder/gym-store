import { TryOnError, validateImage } from './image-validation.mjs';
// Only this fixed provider is contacted. Clients cannot supply URLs, prompts or models.
const API = 'https://api.fashn.ai/v1';
export function createFashnProvider({apiKey, model = 'tryon-max', fetchImpl = fetch}) {
  if (!['tryon-max','tryon-v1.6'].includes(model)) throw new Error('Unsupported TRYON_MODEL');
  async function request(path, body) {
    const response = await fetchImpl(API+path,{ method:body ? 'POST' : 'GET',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:body ? JSON.stringify(body) : undefined,signal:AbortSignal.timeout(45000),redirect:'error' });
    if (!response.ok) {
      // Do not expose provider payloads, credentials or photo data in logs/errors.
      if (response.status === 429) throw new TryOnError(503,'The preview service is busy. Please try again later.','PROVIDER_BUSY');
      throw new TryOnError(502,'The preview service could not complete the request. Please contact the store if this continues.','PROVIDER_ERROR');
    }
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 32*1024*1024) throw new TryOnError(502,'The returned preview was too large.');
    const reader = response.body.getReader();let size=0;const chunks=[];
    for (;;) { const {done,value}=await reader.read(); if(done)break;size+=value.length;if(size>32*1024*1024){await reader.cancel();throw new TryOnError(502,'The returned preview was too large.');}chunks.push(Buffer.from(value)); }
    try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new TryOnError(502,'The preview service returned an unreadable response.');}
  }
  return {
    model,
    async start({personImage,productImage,category}) {
      if (model === 'tryon-v1.6' && !['tops','bottoms','one-pieces'].includes(category)) throw new TryOnError(400,'This preview model does not support this item.');
      const inputs = model === 'tryon-max'
        ? {model_image:personImage,product_image:productImage,generation_mode:'quality',resolution:'2k',num_images:1,return_base64:true,output_format:'jpeg'}
        : {model_image:personImage,garment_image:productImage,category,mode:'quality',num_samples:1,moderation_level:'conservative',return_base64:true,output_format:'jpeg'};
      const result = await request('/run',{model_name:model,inputs});
      if (result.error || typeof result.id !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(result.id)) throw new TryOnError(502,'The preview could not be started.');
      return result.id;
    },
    async status(id) {
      const result = await request('/status/'+encodeURIComponent(id));
      if (result.status === 'failed' || result.error) {
        const name = result.error?.name;
        const message = name === 'PoseError' ? 'Use a clear photo with one person, facing the camera and with the clothing area visible.' : name === 'NSFWError' ? 'Choose an appropriate, fully clothed photo to continue.' : 'This photo could not be processed. Try a clearer, fully clothed photo.';
        return {status:'failed',message};
      }
      if (result.status === 'completed') {
        const output = result.output?.[0];
        try {validateImage(output,{minSide:64,maxBytes:20*1024*1024,maxPixels:24000000});}
        catch {throw new TryOnError(502,'A valid preview image was not returned.');}
        return {status:'completed',image:output};
      }
      if (!['starting','in_queue','processing'].includes(result.status)) throw new TryOnError(502,'The preview status could not be read.');
      return {status:result.status};
    },
  };
}