import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Trash2 } from 'lucide-react';
import { getIn, useSheet, type Path } from './SheetContext';

/** Größte erlaubte Data-URL (wie auf dem Server, sonst würde das Bild beim Speichern verworfen) */
const MAX_DATA_URL = 1_450_000;

/**
 * Verkleinert ein Bild clientseitig (max. Kantenlänge maxSize) und liefert eine Data-URL: JPEG für Fotos,
 * PNG bzw. WebP, wenn das Bild transparente Bereiche hat (z. B. Wappen), damit die Transparenz erhalten bleibt.
 */
async function resizeImage(file: File, maxSize: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Transparenz nur bei Formaten, die sie haben können
    let transparent = false;
    if (/png|webp|gif/.test(file.type)) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let k = 3; k < data.length; k += 4 * 7)
        if (data[k] < 250) {
          transparent = true;
          break;
        }
    }
    if (transparent) {
      const png = canvas.toDataURL('image/png');
      if (png.length <= MAX_DATA_URL) return png;
      const webp = canvas.toDataURL('image/webp', 0.9);
      if (webp.startsWith('data:image/webp') && webp.length <= MAX_DATA_URL) return webp;
    }
    // Foto: weißer Hintergrund, JPEG; notfalls mit geringerer Qualität, bis es passt
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const fctx = flat.getContext('2d')!;
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, flat.width, flat.height);
    fctx.drawImage(canvas, 0, 0);
    for (const q of [0.85, 0.7, 0.55]) {
      const jpeg = flat.toDataURL('image/jpeg', q);
      if (jpeg.length <= MAX_DATA_URL) return jpeg;
    }
    throw new Error('too_large');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImageField({ path, label, maxSize = 700, aspect = 'aspect-[3/4]' }: { path: Path; label: string; maxSize?: number; aspect?: string }) {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);
  const value = String(getIn(sheet, path) ?? '');

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError(false);
      set(path, await resizeImage(file, maxSize));
    } catch {
      setError(true);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className={`relative flex ${aspect} w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-parchment-400 bg-parchment-100/50 dark:border-night-700 dark:bg-night-950/40`}
      >
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          !readOnly && (
            <button type="button" className="flex flex-col items-center gap-2 p-4 print:hidden text-parchment-700 dark:text-parchment-400" onClick={() => input.current?.click()}>
              <ImagePlus className="h-10 w-10" />
              <span className="text-sm">{t('sheet.chooseImage')}</span>
            </button>
          )
        )}
        {value && !readOnly && (
          <div className="absolute right-2 top-2 flex gap-1 print:hidden">
            <button
              type="button"
              className="btn-icon bg-parchment-50/90 shadow dark:bg-night-800/90"
              onClick={() => input.current?.click()}
              title={t('sheet.chooseImage')}
              aria-label={t('sheet.chooseImage')}
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-icon bg-parchment-50/90 text-red-700 shadow dark:bg-night-800/90 dark:text-red-400"
              onClick={() => set(path, '')}
              title={t('sheet.removeImage')}
              aria-label={t('sheet.removeImage')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={onFile} tabIndex={-1} />
      </div>
      {error && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{t('sheet.imageError')}</p>}
      <p className="sheet-label mt-1 text-center">{label}</p>
    </div>
  );
}
