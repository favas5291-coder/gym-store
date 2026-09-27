export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export function photoFileProblem(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Choose a JPEG, PNG or WebP photo. Convert HEIC photos to JPEG first.';
  if (!file.size || file.size > MAX_PHOTO_BYTES) return 'Choose a photo smaller than 8 MB.';
  return '';
}
const readBlob = blob => new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('This photo could not be opened.')); reader.readAsDataURL(blob); });
export async function preparePhoto(file) {
  const problem = photoFileProblem(file); if (problem) throw new Error(problem);
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('This image cannot be opened. Try another JPEG, PNG or WebP photo.'); }
  try {
    const {width,height} = bitmap;
    if (Math.min(width,height) < 384) throw new Error('Choose a clearer photo at least 384 pixels on each side.');
    if (width / height < .25 || width / height > 4) throw new Error('Choose a normal portrait or full-body photo, not a panorama.');
    // Deliberately reduce upload size and re-encode to discard EXIF/location metadata.
    const scale = Math.min(1, 2560 / Math.max(width,height)), canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Your browser could not prepare the photo.');
    context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',.94));
    if (!blob || blob.size > MAX_PHOTO_BYTES) throw new Error('The prepared photo is too large. Choose a smaller image.');
    return { dataUrl: await readBlob(blob), width: canvas.width, height: canvas.height };
  } finally { bitmap.close(); }
}
export function dataImageBlob(data) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data || '');
  if (!match) throw new Error('The preview service returned an invalid image.');
  const text = atob(match[2]), bytes = new Uint8Array(text.length);
  for (let i=0;i<text.length;i++) bytes[i] = text.charCodeAt(i);
  return new Blob([bytes],{type:match[1]});
}