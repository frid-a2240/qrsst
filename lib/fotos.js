// Fotos que llegan como data URL (comprimidas en el celular) -> { mime, datos } para BYTEA.

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
export const MAX_BYTES_FOTO = 3 * 1024 * 1024;

// Devuelve { fotos } o { error } con un mensaje para mostrar.
export function decodificarFotos(lista, max) {
  if (lista == null) return { fotos: [] };
  if (!Array.isArray(lista) || lista.length > max) return { error: `Máximo ${max} fotos.` };
  const fotos = [];
  for (const foto of lista) {
    const m = typeof foto === 'string' ? foto.match(DATA_URL) : null;
    if (!m) return { error: 'Una de las fotos no es una imagen válida.' };
    const datos = Buffer.from(m[2], 'base64');
    if (datos.length > MAX_BYTES_FOTO) return { error: 'Una de las fotos es demasiado grande.' };
    fotos.push({ mime: m[1], datos });
  }
  return { fotos };
}
