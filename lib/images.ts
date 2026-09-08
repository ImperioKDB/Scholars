// lib/images.ts
// Shared client-side image downscale used by both uploaders
// (components/AvatarUploader.tsx, components/AboutPhotoUploader.tsx).
// Was copy-pasted in both files; one implementation removes the drift
// risk. Center-crops to a square then scales to outputSize, encodes as
// JPEG 0.85 -- keeps uploads small and consistent regardless of source.
export function downscaleToJpeg(file: File, outputSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, outputSize, outputSize);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode the image"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image"));
    };
    img.src = url;
  });
}
