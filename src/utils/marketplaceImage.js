export async function compressSupplierImage(file){
  if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Choose a JPEG, PNG or WebP image.");if(file.size>12*1024*1024)throw new Error("Choose a photo under 12 MB.");
  const url=URL.createObjectURL(file);try{
    const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("This photo could not be opened. Choose another image."));image.src=url;});
    if(img.naturalWidth*img.naturalHeight>24000000||img.naturalWidth<32||img.naturalHeight<32)throw new Error("Choose a photo between 32px and 24 megapixels.");
    const scale=Math.min(1,1280/img.naturalWidth,1280/img.naturalHeight),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    let blob;for(const quality of [.82,.68,.52]){blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));if(blob&&blob.size<=524288)break;}if(!blob||blob.size>524288)throw new Error("Crop this image and retry; it is too large after compression.");
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Unable to read the selected photo."));reader.readAsDataURL(blob);});return {mime:blob.type,base64};
  }finally{URL.revokeObjectURL(url);}
}
