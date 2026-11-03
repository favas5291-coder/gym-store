export const MAX_BYTES=8*1024*1024;
export function validatePhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP image. For HEIC photos, use the app gallery or export as JPEG.');
 if(!file.size||file.size>MAX_BYTES)throw new Error('Choose a photo under 8 MB.');
}
export async function preparePhoto(file,crop=null){
 validatePhoto(file);const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();const w=image.naturalWidth,h=image.naturalHeight;
  if(w<32||h<32||w*h>24000000||w>12000||h>12000)throw new Error('Choose a photo between 32 pixels and 24 megapixels.');
  const side=Math.min(w,h)/(crop?.zoom||1),rect=crop?{x:(w-side)*crop.x/100,y:(h-side)*crop.y/100,w:side,h:side}:{x:0,y:0,w,h};
  const scale=Math.min(1,1024/Math.max(rect.w,rect.h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(rect.w*scale));canvas.height=Math.max(1,Math.round(rect.h*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,canvas.width,canvas.height);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to process this photo.')),'image/jpeg',0.9));
 }finally{URL.revokeObjectURL(url);}
}
