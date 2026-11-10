/**
 * Shrinks a phone photo before upload: longest side ≤ maxSide, JPEG. A 4 MB
 * camera shot becomes roughly 150–300 KB, which keeps the database small (images
 * are stored there) and uploads quick on mobile data.
 */
export async function compressImage(file: File, maxSide = 1280, quality = 0.72): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file isn't a photo the browser can read."));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process the photo.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process the photo."))), "image/jpeg", quality)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads an image through /api/upload and returns its URL. */
export async function uploadImage(blob: Blob, name = "photo.jpg"): Promise<string> {
  const fd = new FormData();
  fd.append("file", new File([blob], name, { type: blob.type || "image/jpeg" }));
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}
