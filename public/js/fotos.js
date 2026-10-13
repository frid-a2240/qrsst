// Selector de fotos reutilizable: "Tomar foto" (cámara) y "Elegir de galería", con
// vista previa, botón para quitar y compresión en el celular (máx. 1600 px, JPEG 0.8)
// para que el envío sea ligero. Uso: const sel = selectorFotos(contenedor, 3); sel.fotos

function comprimirFoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer una de las fotos.'));
    };
    img.src = url;
  });
}

function selectorFotos(contenedor, max) {
  const fotos = [];
  const previews = contenedor.querySelector('.ma-previews');
  const msg = contenedor.querySelector('.fotos-msg');

  function aviso(texto) {
    msg.textContent = texto || '';
  }

  function pintar() {
    previews.innerHTML = fotos.map((src, i) => `
      <div class="ma-prev">
        <img src="${src}" alt="Foto ${i + 1}">
        <button type="button" class="ma-prev-quitar" data-i="${i}" aria-label="Quitar foto">&times;</button>
      </div>`).join('');
    previews.querySelectorAll('.ma-prev-quitar').forEach((btn) => {
      btn.addEventListener('click', () => {
        fotos.splice(Number(btn.dataset.i), 1);
        aviso('');
        pintar();
      });
    });
  }

  contenedor.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener('change', async () => {
      aviso('');
      const archivos = [...input.files];
      input.value = '';
      for (const archivo of archivos) {
        if (fotos.length >= max) {
          aviso(`Máximo ${max} fotos.`);
          break;
        }
        try {
          fotos.push(await comprimirFoto(archivo));
        } catch (err) {
          aviso(err.message);
        }
      }
      pintar();
    });
  });

  return { fotos };
}
