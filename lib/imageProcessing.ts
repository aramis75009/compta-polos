// Traitement d'image côté client (correction EXIF + rotation manuelle + download).
// Partagé entre la page /photos et le wizard /mise-en-vente. Tout reste local
// au navigateur via <canvas> — aucun upload serveur.

/**
 * Corrige l'orientation EXIF d'une photo et garantit un rendu portrait.
 * Renvoie le canvas corrigé (non encodé) qui sert de SOURCE lossless :
 * les rotations manuelles s'appliquent dessus, puis on encode une seule fois.
 */
export async function correctImage(file: File): Promise<HTMLCanvasElement> {
  // Import dynamique : exifr n'est chargé qu'au premier traitement de photo.
  const exifr = (await import("exifr")).default;
  const orientation =
    ((await exifr.orientation(file).catch(() => 1)) as number | undefined) || 1;

  const bitmap = await createImageBitmap(file, { imageOrientation: "none" });
  const w = bitmap.width;
  const h = bitmap.height;

  const swap = orientation >= 5 && orientation <= 8;
  const upright = document.createElement("canvas");
  upright.width = swap ? h : w;
  upright.height = swap ? w : h;
  const uctx = upright.getContext("2d");
  if (!uctx) throw new Error("Canvas indisponible.");
  switch (orientation) {
    case 2:
      uctx.transform(-1, 0, 0, 1, w, 0);
      break;
    case 3:
      uctx.transform(-1, 0, 0, -1, w, h);
      break;
    case 4:
      uctx.transform(1, 0, 0, -1, 0, h);
      break;
    case 5:
      uctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      uctx.transform(0, 1, -1, 0, h, 0);
      break;
    case 7:
      uctx.transform(0, -1, -1, 0, h, w);
      break;
    case 8:
      uctx.transform(0, -1, 1, 0, 0, w);
      break;
    default:
      break;
  }
  uctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // Forcer le portrait : si l'image est paysage, rotation 90° horaire.
  let final = upright;
  if (upright.width > upright.height) {
    const rot = document.createElement("canvas");
    rot.width = upright.height;
    rot.height = upright.width;
    const rctx = rot.getContext("2d");
    if (!rctx) throw new Error("Canvas indisponible.");
    rctx.translate(rot.width / 2, rot.height / 2);
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(upright, -upright.width / 2, -upright.height / 2);
    final = rot;
  }

  return final;
}

/**
 * Charge une image sur un canvas SANS aucune correction : ni rotation EXIF,
 * ni forçage portrait. L'image est dessinée telle quelle (createImageBitmap +
 * drawImage). Sert de SOURCE lossless pour les rotations manuelles ultérieures.
 */
export async function loadImageDirect(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/**
 * Applique une rotation manuelle (0/90/180/270°, horaire) sur le canvas SOURCE
 * et encode en JPEG. La rotation part toujours de la source corrigée d'origine,
 * donc une seule génération de compression quel que soit le nombre de clics.
 */
export function encodeRotated(
  base: HTMLCanvasElement,
  rotation: number,
): Promise<Blob> {
  const swap = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? base.height : base.width;
  canvas.height = swap ? base.width : base.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(base, -base.width / 2, -base.height / 2);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Conversion impossible."))),
      "image/jpeg",
      0.92,
    );
  });
}

/** Déclenche le téléchargement d'un blob sous un nom donné. */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Lit un Blob en base64 (sans le préfixe data:). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Lecture du blob impossible."));
    reader.readAsDataURL(blob);
  });
}
