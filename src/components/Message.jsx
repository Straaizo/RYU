import React, { useState } from 'react';

// Limpia los tags internos de RYU de la respuesta visible
function limpiarTexto(texto) {
  let t = texto;
  for (const tag of ['===ARCHIVO_MODIFICADO===', '===FIN_ARCHIVO===', '===CREAR_PROYECTO===', '===FIN_PROYECTO===']) {
    t = t.replaceAll(tag, '');
  }
  // Ocultar líneas de metadatos
  const lineas = t.split('\n').filter(l => {
    const s = l.trim();
    return !s.startsWith('RUTA:') && !s.startsWith('RUTA_BASE:') &&
           !s.startsWith('ARCHIVO:') && !s.startsWith('CARPETA:');
  });
  return lineas.join('\n').trim();
}

// Renderiza una línea con formato
function renderLinea(linea, idx) {
  if (linea.startsWith('```')) {
    return (
      <span key={idx} className="code-fence green">
        {linea}
      </span>
    );
  }
  if (linea.startsWith('# ')) {
    return (
      <strong key={idx} className="yellow">
        {linea}
      </strong>
    );
  }
  if (linea.startsWith('## ') || linea.startsWith('### ')) {
    return (
      <strong key={idx} className="cyan">
        {linea}
      </strong>
    );
  }
  if (linea.startsWith('- ') || linea.startsWith('* ')) {
    return (
      <span key={idx} className="white">
        {'  ' + linea}
      </span>
    );
  }
  if (linea === '') return <br key={idx} />;
  return <span key={idx} className="white">{linea}</span>;
}

// Renderiza el contenido completo de un mensaje formateando código
function renderContenido(texto) {
  const lineas = texto.split('\n');
  const result = [];
  let enCodigo = false;
  let bloqueActual = [];
  let idxBloque = 0;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    if (linea.startsWith('```')) {
      if (!enCodigo) {
        enCodigo = true;
        bloqueActual = [linea];
      } else {
        enCodigo = false;
        bloqueActual.push(linea);
        const clave = `code-${idxBloque++}`;
        result.push(
          <pre key={clave} className="code-block">
            {bloqueActual.slice(1, -1).join('\n')}
          </pre>
        );
        bloqueActual = [];
      }
    } else if (enCodigo) {
      bloqueActual.push(linea);
    } else {
      result.push(
        <React.Fragment key={i}>
          {renderLinea(linea, i)}
          {'\n'}
        </React.Fragment>
      );
    }
  }

  return result;
}

export default function Message({ msg }) {
  const [copiado, setCopiado] = useState(false);

  if (msg.role === 'user') {
    const texto = typeof msg.content === 'string'
      ? msg.content
      : msg.content.find(p => p.type === 'text')?.text || '';

    const imagenes = Array.isArray(msg.content)
      ? msg.content.filter(p => p.type === 'image')
      : [];

    return (
      <div className="msg msg-user">
        <span className="msg-role green">TÚ →</span>
        {texto && <div className="msg-content">{texto}</div>}
        {imagenes.length > 0 && (
          <div className="msg-images">
            {imagenes.map((img, i) => (
              <img
                key={i}
                src={`data:${img.source.media_type};base64,${img.source.data}`}
                alt={`imagen ${i + 1}`}
                className="msg-img"
              />
            ))}
          </div>
        )}
        {msg.uso && (
          <div className="msg-meta">
            ↑ {msg.uso.input} ↓ {msg.uso.output} tokens ~${msg.costo?.toFixed(5)} USD
          </div>
        )}
      </div>
    );
  }

  if (msg.role === 'assistant') {
    const textoLimpio = limpiarTexto(msg.content || '');
    if (!textoLimpio) return null;

    return (
      <div className="msg msg-ryu">
        <div className="msg-header-ryu">
          <span className="msg-role cyan">RYU →</span>
          <button
            className="btn-copy"
            onClick={() => {
              navigator.clipboard.writeText(textoLimpio);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            }}
          >
            {copiado ? '✓' : '⎘'}
          </button>
        </div>
        <div className="msg-content ryu-content">
          {renderContenido(textoLimpio)}
        </div>
        {msg.uso && (
          <div className="msg-meta">
            ↑ {msg.uso.input} ↓ {msg.uso.output} tokens ~${msg.costo?.toFixed(5)} USD
          </div>
        )}
      </div>
    );
  }

  if (msg.role === 'system-info') {
    return (
      <div className="msg msg-system">
        <span className="gray">{msg.content}</span>
      </div>
    );
  }

  return null;
}
