/** Shrink a photo to ≤ maxSide px JPEG before upload (keeps menu photos around 150–300 KB). */
export async function compressImage(file: File, maxSide = 1400, quality = 0.82): Promise<{ data: string; mime: string; url: string }> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Couldn’t open that image')); i.src = url; });
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', quality);
  return { data: dataUrl.split(',')[1], mime: 'image/jpeg', url };
}
