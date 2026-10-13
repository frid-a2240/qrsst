// Resumen al inicio del panel: indicadores de acciones del NMHA y gráficas pequeñas
// (SVG propio, sin librerías externas: el panel funciona sin internet).

const COLOR = {
  // Estados de una acción (paleta de estado: siempre acompañada de su etiqueta).
  pendientes: '#ec835a',
  en_revision: '#fab219',
  cerradas: '#0ca30c',
  atrasadas: '#d03b3b',
  // Tipos de libreta (paleta categórica validada, orden fijo).
  art: '#2a78d6',
  stop_work: '#eb6834',
  nmha: '#1baf7a',
  barra: '#2a78d6',
  grid: '#e1e0d9',
  eje: '#c3c2b7'
};
const ESTADOS = [
  ['pendientes', 'Por realizar'],
  ['en_revision', 'En revisión'],
  ['cerradas', 'Cerradas']
];
const LIBRETAS = [
  ['art', 'ART'],
  ['stop_work', 'Stop Work'],
  ['nmha', 'NMHA']
];
const TIPO_NMHA = {
  acto_inseguro: 'Acto inseguro',
  condicion_insegura: 'Condición insegura',
  casi_incidente: 'Casi incidente',
  mejora: 'Mejora'
};

function escR(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Rectángulo con el extremo de datos redondeado (derecha en barras horizontales, arriba en columnas).
function barra(x, y, w, h, redondear, horizontal) {
  const r = Math.min(4, horizontal ? w / 2 : h / 2, horizontal ? h / 2 : w / 2);
  if (!redondear || r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  if (horizontal) {
    return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}Z`;
  }
  return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}Z`;
}

function leyenda(items) {
  return `<div class="rs-leyenda">${items.map(([color, texto]) =>
    `<span><i style="background:${color}"></i>${escR(texto)}</span>`).join('')}</div>`;
}

function tarjetaKpi(valor, etiqueta, color, nota, enlace) {
  return `<a class="rs-kpi" href="${enlace}">
    <div class="rs-kpi-etq"><i style="background:${color}"></i>${etiqueta}</div>
    <div class="rs-kpi-num">${valor}</div>
    ${nota ? `<div class="rs-kpi-nota">${nota}</div>` : ''}
  </a>`;
}

function graficaResponsables(filas) {
  if (!filas.length) return '<div class="rs-vacio">Todavía no hay acciones asignadas.</div>';
  const fila = 26;
  const anchoNombre = 128;
  const ancho = 340;
  const util = ancho - anchoNombre - 34;
  const max = Math.max(...filas.map((f) => f.pendientes + f.en_revision + f.cerradas), 1);
  const alto = filas.length * fila + 4;
  let svg = '';
  filas.forEach((f, i) => {
    const y = i * fila + 5;
    const total = f.pendientes + f.en_revision + f.cerradas;
    const nombre = f.nombre.split(',')[0];
    svg += `<text x="${anchoNombre - 8}" y="${y + 11}" class="rs-etq" text-anchor="end">${escR(nombre.length > 18 ? nombre.slice(0, 17) + '…' : nombre)}</text>`;
    let x = anchoNombre;
    const partes = ESTADOS.filter(([k]) => f[k] > 0);
    partes.forEach(([k, texto], j) => {
      const w = Math.max(2, (f[k] / max) * util - (j < partes.length - 1 ? 2 : 0));
      svg += `<path d="${barra(x, y, w, 14, j === partes.length - 1, true)}" fill="${COLOR[k]}"
        data-tip="<b>${escR(f.nombre)}</b><br>${texto}: ${f[k]}"/>`;
      x += w + 2;
    });
    svg += `<text x="${x + 4}" y="${y + 11}" class="rs-val">${total}</text>`;
    svg += `<rect x="0" y="${y - 5}" width="${ancho}" height="${fila}" fill="transparent"
      data-tip="<b>${escR(f.nombre)}</b><br>Por realizar: ${f.pendientes}<br>En revisión: ${f.en_revision}<br>Cerradas: ${f.cerradas}"/>`;
  });
  return leyenda(ESTADOS.map(([k, t]) => [COLOR[k], t])) +
    `<svg viewBox="0 0 ${ancho} ${alto}" class="rs-svg" role="img" aria-label="Acciones por responsable">${svg}</svg>`;
}

function etiquetaSemana(fecha) {
  const [, m, d] = String(fecha).slice(0, 10).split('-');
  return `${Number(d)}/${Number(m)}`;
}

function graficaSemanas(semanas) {
  const ancho = 340;
  const alto = 170;
  const izq = 22;
  const abajo = 22;
  const arriba = 16;
  const util = alto - abajo - arriba;
  const totales = semanas.map((s) => s.art + s.stop_work + s.nmha);
  const max = Math.max(...totales, 1);
  const paso = (ancho - izq) / semanas.length;
  const anchoCol = Math.min(24, paso * 0.55);
  let svg = `<line x1="${izq}" x2="${ancho}" y1="${alto - abajo}" y2="${alto - abajo}" stroke="${COLOR.eje}"/>`;
  svg += `<line x1="${izq}" x2="${ancho}" y1="${arriba}" y2="${arriba}" stroke="${COLOR.grid}"/>`;
  svg += `<text x="${izq - 4}" y="${arriba + 4}" class="rs-eje" text-anchor="end">${max}</text>`;
  svg += `<text x="${izq - 4}" y="${alto - abajo + 4}" class="rs-eje" text-anchor="end">0</text>`;
  semanas.forEach((s, i) => {
    const cx = izq + paso * i + paso / 2;
    let y = alto - abajo;
    const partes = LIBRETAS.filter(([k]) => s[k] > 0);
    partes.forEach(([k], j) => {
      const h = Math.max(2, (s[k] / max) * util - (j < partes.length - 1 ? 2 : 0));
      y -= h;
      svg += `<path d="${barra(cx - anchoCol / 2, y, anchoCol, h, j === partes.length - 1, false)}" fill="${COLOR[k]}"/>`;
      y -= 2;
    });
    if (totales[i]) svg += `<text x="${cx}" y="${y - 2}" class="rs-val" text-anchor="middle">${totales[i]}</text>`;
    svg += `<text x="${cx}" y="${alto - 6}" class="rs-eje" text-anchor="middle">${etiquetaSemana(s.semana)}</text>`;
    svg += `<rect x="${cx - paso / 2}" y="0" width="${paso}" height="${alto}" fill="transparent"
      data-tip="<b>Semana del ${etiquetaSemana(s.semana)}</b><br>ART: ${s.art}<br>Stop Work: ${s.stop_work}<br>NMHA: ${s.nmha}"/>`;
  });
  const tabla = `<details class="rs-tabla"><summary>Ver datos</summary><table>
    <tr><th>Semana</th><th>ART</th><th>Stop Work</th><th>NMHA</th></tr>
    ${semanas.map((s) => `<tr><td>${etiquetaSemana(s.semana)}</td><td>${s.art}</td><td>${s.stop_work}</td><td>${s.nmha}</td></tr>`).join('')}
  </table></details>`;
  return leyenda(LIBRETAS.map(([k, t]) => [COLOR[k], t])) +
    `<svg viewBox="0 0 ${ancho} ${alto}" class="rs-svg" role="img" aria-label="Libretas por semana">${svg}</svg>` + tabla;
}

function graficaTipos(tipos) {
  const filas = Object.keys(TIPO_NMHA).map((k) => ({ k, n: (tipos.find((t) => t.tipo === k) || { n: 0 }).n }));
  if (!filas.some((f) => f.n)) return '<div class="rs-vacio">Todavía no hay NMHA registrados.</div>';
  const ancho = 340;
  const anchoNombre = 128;
  const fila = 28;
  const util = ancho - anchoNombre - 34;
  const max = Math.max(...filas.map((f) => f.n), 1);
  let svg = '';
  filas.forEach((f, i) => {
    const y = i * fila + 6;
    const w = f.n ? Math.max(2, (f.n / max) * util) : 0;
    svg += `<text x="${anchoNombre - 8}" y="${y + 11}" class="rs-etq" text-anchor="end">${TIPO_NMHA[f.k]}</text>`;
    if (w) svg += `<path d="${barra(anchoNombre, y, w, 14, true, true)}" fill="${COLOR.barra}" data-tip="<b>${TIPO_NMHA[f.k]}</b><br>${f.n} reporte${f.n === 1 ? '' : 's'}"/>`;
    svg += `<text x="${anchoNombre + w + 4}" y="${y + 11}" class="rs-val">${f.n}</text>`;
  });
  return `<svg viewBox="0 0 ${ancho} ${filas.length * fila + 4}" class="rs-svg" role="img" aria-label="NMHA por tipo">${svg}</svg>`;
}

function conectarTooltip(raiz) {
  const tip = document.createElement('div');
  tip.className = 'rs-tooltip';
  document.body.appendChild(tip);
  const mostrar = (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el || !raiz.contains(el)) {
      tip.style.display = 'none';
      return;
    }
    tip.innerHTML = el.getAttribute('data-tip');
    tip.style.display = 'block';
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.max(8, e.clientY - tip.offsetHeight - 12);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };
  raiz.addEventListener('pointermove', mostrar);
  raiz.addEventListener('pointerdown', mostrar);
  raiz.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
}

async function cargarResumen() {
  const raiz = document.getElementById('resumen');
  if (!raiz) return;
  try {
    const res = await fetch('../api/admin-resumen');
    if (!res.ok) throw new Error();
    const d = await res.json();
    const a = d.acciones;
    const total = a.pendientes + a.en_revision + a.cerradas;
    const cumplimiento = total ? Math.round((a.cerradas / total) * 100) : 0;
    const mes = d.libretas_mes;
    raiz.innerHTML = `
      <div class="rs-kpis">
        ${tarjetaKpi(a.pendientes, 'Acciones por realizar', COLOR.pendientes,
          a.atrasadas ? `<span style="color:${COLOR.atrasadas}">● ${a.atrasadas} con más de 7 días</span>` : 'Ninguna atrasada',
          '#acciones/pendientes')}
        ${tarjetaKpi(a.en_revision, 'En revisión', COLOR.en_revision, a.en_revision ? 'Esperan tu revisión' : 'Nada por revisar', '#acciones/en_revision')}
        ${tarjetaKpi(a.cerradas, 'Cerradas', COLOR.cerradas, `de ${total} asignada${total === 1 ? '' : 's'}`, '#acciones/cerradas')}
        ${tarjetaKpi(`${cumplimiento}%`, 'Cumplimiento', COLOR.cerradas, 'Cerradas / asignadas', '#acciones/todas')}
      </div>
      <div class="rs-graficas">
        <div class="rs-card"><div class="rs-titulo">Acciones por responsable</div>${graficaResponsables(d.por_responsable)}</div>
        <div class="rs-card"><div class="rs-titulo">Libretas por semana</div>
          <div class="rs-sub">Este mes: ART ${mes.art} · Stop Work ${mes.stop_work} · NMHA ${mes.nmha}</div>
          ${graficaSemanas(d.libretas_por_semana)}</div>
        <div class="rs-card"><div class="rs-titulo">NMHA por tipo</div>${graficaTipos(d.nmha_por_tipo)}</div>
      </div>`;
    if (!raiz.dataset.tooltip) {
      raiz.dataset.tooltip = '1';
      conectarTooltip(raiz);
    }
  } catch {
    raiz.innerHTML = '<div class="rs-vacio">No se pudo cargar el resumen.</div>';
  }
}

window.cargarResumen = cargarResumen;
