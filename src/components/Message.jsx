import React, { useState } from 'react';

// Limpia los tags internos de RYU de la respuesta visible
function limpiarTexto(texto) {
  let t = texto;
  for (const tag of ['===ARCHIVO_MODIFICADO===', '===FIN_ARCHIVO===', '===CREAR_PROYECTO===', '===FIN_PROYECTO===']) {
    t = t.replaceAll(tag, '');
  }
  const lineas = t.split('\n').filter(l => {
    const s = l.trim();
    return !s.startsWith('RUTA:') && !s.startsWith('RUTA_BASE:') &&
           !s.startsWith('ARCHIVO:') && !s.startsWith('CARPETA:');
  });
  return lineas.join('\n').trim();
}

// Bloque de código colapsable
function CollapsibleCode({ lang, codigo }) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const lineas = codigo.split('\n').filter(l => l !== '').length;

  function copiarCodigo(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="code-collapsible">
      <button className="code-toggle" onClick={() => setAbierto(a => !a)}>
        <span className="code-toggle-lang">{lang || 'código'}</span>
        <span className="code-toggle-info">{lineas} líneas</span>
        <span className="code-toggle-arrow">{abierto ? '▲ ocultar' : '▼ ver código'}</span>
        {abierto && (
          <span
            className="code-toggle-copy"
            onClick={copiarCodigo}
            title="Copiar código"
          >
            {copiado ? '✓' : '⎘'}
          </span>
        )}
      </button>
      {abierto && (
        <pre className="code-block code-block-open">
          {codigo}
        </pre>
      )}
    </div>
  );
}

// Renderiza una línea de texto con formato
function renderLinea(linea, idx) {
  if (linea.startsWith('# ')) {
    return <strong key={idx} className="yellow">{linea.slice(2)}</strong>;
  }
  if (linea.startsWith('## ') || linea.startsWith('### ')) {
    return <strong key={idx} className="cyan">{linea.replace(/^#+\s/, '')}</strong>;
  }
  if (linea.startsWith('- ') || linea.startsWith('* ')) {
    return <span key={idx} className="white">{'  ' + linea}</span>;
  }
  // inline code con backticks
  if (linea.includes('`')) {
    const parts = linea.split('`');
    return (
      <span key={idx} className="white">
        {parts.map((part, i) =>
          i % 2 === 1
            ? <code key={i} className="inline-code">{part}</code>
            : part
        )}
      </span>
    );
  }
  if (linea === '') return <br key={idx} />;
  return <span key={idx} className="white">{linea}</span>;
}

// Renderiza el contenido completo separando texto y bloques de código
function renderContenido(texto) {
  const lineas = texto.split('\n');
  const result = [];
  let enCodigo = false;
  let bloqueActual = [];
  let langActual = '';
  let idxBloque = 0;
  let textoPendiente = [];
  let idxLinea = 0;

  function flushTexto() {
    if (textoPendiente.length === 0) return;
    const clave = `text-${idxLinea}`;
    result.push(
      <div key={clave} className="text-segment">
        {textoPendiente.map((linea, i) => (
          <React.Fragment key={i}>
            {renderLinea(linea, i)}
            {i < textoPendiente.length - 1 && '\n'}
          </React.Fragment>
        ))}
      </div>
    );
    textoPendiente = [];
  }

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    idxLinea = i;

    if (!enCodigo && linea.startsWith('```')) {
      flushTexto();
      enCodigo = true;
      langActual = linea.slice(3).trim();
      bloqueActual = [];
    } else if (enCodigo && (linea.trim() === '```' || linea.startsWith('```'))) {
      enCodigo = false;
      const clave = `code-${idxBloque++}`;
      result.push(
        <CollapsibleCode
          key={clave}
          lang={langActual}
          codigo={bloqueActual.join('\n')}
          idx={idxBloque}
        />
      );
      bloqueActual = [];
      langActual = '';
    } else if (enCodigo) {
      bloqueActual.push(linea);
    } else {
      textoPendiente.push(linea);
    }
  }

  // Flush resto de texto
  flushTexto();

  // Si quedó un bloque sin cerrar, mostrarlo igual
  if (enCodigo && bloqueActual.length > 0) {
    const clave = `code-${idxBloque}`;
    result.push(
      <CollapsibleCode
        key={clave}
        lang={langActual}
        codigo={bloqueActual.join('\n')}
        idx={idxBloque}
      />
    );
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
            title="Copiar respuesta completa"
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
