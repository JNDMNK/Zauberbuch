/** Rundes Profil-/Charakterbild; ohne Bild der Anfangsbuchstabe */
export function Avatar({ src, name, className = 'h-10 w-10', fallbackCls = 'bg-parchment-300 text-ink dark:bg-night-700 dark:text-parchment-100' }: { src?: string | null; name: string; className?: string; fallbackCls?: string }) {
  if (src) return <img src={src} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  return <span className={`${className} grid shrink-0 place-items-center rounded-full font-display font-bold ${fallbackCls}`}>{(name.trim()[0] ?? '?').toUpperCase()}</span>;
}

/** Quadratisch zuschneiden (Mitte) und auf size×size verkleinern; PNG bei Transparenz, sonst JPEG */
export async function avatarFromFile(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const side = Math.min(img.width, img.height);
    const out = Math.min(size, side);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out);
    if (/png|webp|gif/.test(file.type)) {
      const data = ctx.getImageData(0, 0, out, out).data;
      for (let k = 3; k < data.length; k += 4 * 5) if (data[k] < 250) return canvas.toDataURL('image/png');
    }
    const flat = document.createElement('canvas');
    flat.width = flat.height = out;
    const f = flat.getContext('2d')!;
    f.fillStyle = '#ffffff';
    f.fillRect(0, 0, out, out);
    f.drawImage(canvas, 0, 0);
    return flat.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
