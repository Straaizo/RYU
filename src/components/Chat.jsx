import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar.jsx';
import Message from './Message.jsx';
import FileConfirm from './FileConfirm.jsx';
import TokenCounter from './TokenCounter.jsx';
import { useAnthropicAPI, extraerBloquesArchivos, extraerBloqueProyecto } from '../hooks/useAnthropicAPI.js';
import { useProjectIndex } from '../hooks/useProjectIndex.js';
import { usePersistence } from '../hooks/usePersistence.js';

const PIPELINE_LABELS = {
  analizando: '[ 1/4 ] Analizando proyecto...',
  generando:  '[ 2/4 ] Generando código...',
  verificando:'[ 3/4 ] Verificando sintaxis...',
  listo:      '[ 4/4 ] Listo ✓',
};

const MAX_ARCHIVOS = 5;

// Banner del chat centrado (42 inner = (42-26)/2 = 8 espacios)
const BANNER_CHAT = `╔══════════════════════════════════════════╗
║                                          ║
║        ██████╗ ██╗   ██╗██╗   ██╗        ║
║        ██╔══██╗╚██╗ ██╔╝██║   ██║        ║
║        ██████╔╝ ╚████╔╝ ██║   ██║        ║
║        ██╔══██╗  ╚██╔╝  ██║   ██║        ║
║        ██║  ██║   ██║   ╚██████╔╝        ║
║        ╚═╝  ╚═╝   ╚═╝    ╚═════╝         ║
║                                          ║
╚══════════════════════════════════════════╝`;

export default function Chat({ perfil, onEditarPerfil }) {
  const [mensajes, setMensajes]             = useState([]);
  const [input, setInput]                   = useState('');
  const [pendingFiles, setPendingFiles]     = useState([]);
  const [bloquesPendientes, setBloquesPendientes] = useState(null);
  const [bloqueProyecto, setBloqueProyecto] = useState(null);
  const [enviando, setEnviando]             = useState(false);
  const [dragging, setDragging]             = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const chatEndRef = useRef(null);
  const inputRef   = useRef(null);

  const { indice, indexando, indexar, limpiar, contextoATexto } = useProjectIndex();
  const { sesion, guardarSesion } = usePersistence();

  const {
    chat, pipeline, setPipeline,
    modelo, setModelo,
    tokensSession, limpiarHistorial, agregarContextoProyecto,
    MODELO_HAIKU, MODELO_SONNET,
  } = useAnthropicAPI({ perfil, indice, contextoATexto });

  // Restaurar sesión anterior
  useEffect(() => {
    if (sesion?.proyectoPath) indexar(sesion.proyectoPath).catch(() => {});
    if (sesion?.modelo) setModelo(sesion.modelo);
  }, []);

  // Listeners del menú nativo
  useEffect(() => {
    const c1 = window.ryu.onMenu('menu:open-folder', handleCargarProyecto);
    const c2 = window.ryu.onMenu('menu:reindex', handleReindexar);
    const c3 = window.ryu.onMenu('menu:clear', limpiarTodo);
    const c4 = window.ryu.onMenu('menu:pick-files', handleAdjuntarArchivos);
    return () => { c1(); c2(); c3(); c4(); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, pipeline]);

  useEffect(() => {
    guardarSesion({ modelo });
  }, [modelo]);

  // Pegar imágenes con Ctrl+V
  useEffect(() => {
    async function handlePaste(e) {
      const items = Array.from(e.clipboardData?.items || []);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          if (pendingFiles.length >= MAX_ARCHIVOS) {
            agregarMensaje({ role: 'system-info', content: `Máximo ${MAX_ARCHIVOS} archivos por mensaje.` });
            return;
          }
          const file = item.getAsFile();
          if (!file) continue;
          const data = await fileToBase64(file);
          const mediaType = file.type || 'image/png';
          setPendingFiles(prev => [...prev, {
            tipo: 'imagen',
            nombre: `imagen-${Date.now()}.png`,
            mediaType,
            data,
            preview: `data:${mediaType};base64,${data}`,
          }]);
        }
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [pendingFiles]);

  const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','svg']);

  function esImagen(file) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return file.type.startsWith('image/') || IMAGE_EXTS.has(ext);
  }

  function agregarMensaje(msg) {
    setMensajes(prev => [...prev, msg]);
  }

  // Adjuntar via diálogo nativo (botón 📎 y menú Archivo → Adjuntar)
  async function handleAdjuntarArchivos() {
    const archivos = await window.ryu.selectFiles();
    if (!archivos.length) return;

    const disponibles = MAX_ARCHIVOS - pendingFiles.length;
    const procesar = archivos.slice(0, disponibles);
    if (archivos.length > disponibles) {
      agregarMensaje({ role: 'system-info', content: `Solo se agregarán ${disponibles} archivo(s) (límite: ${MAX_ARCHIVOS}).` });
    }

    const nuevos = procesar.map(a => {
      if (a.tipo === 'imagen') {
        const mediaType = `image/${a.ext === 'jpg' ? 'jpeg' : a.ext}`;
        return { tipo: 'imagen', nombre: a.name, mediaType, data: a.data, preview: `data:${mediaType};base64,${a.data}` };
      }
      return { tipo: 'archivo', nombre: a.name, extension: a.ext, contenido: a.contenido, lineas: a.lineas };
    });
    setPendingFiles(prev => [...prev, ...nuevos]);
  }

  async function handleCargarProyecto() {
    const ruta = await window.ryu.selectFolder();
    if (!ruta) return;

    agregarMensaje({ role: 'system-info', content: `Indexando proyecto: ${ruta}...` });
    const resultado = await indexar(ruta);
    guardarSesion({ proyectoPath: ruta });

    const n = resultado.archivos_leidos.length;
    agregarMensaje({
      role: 'system-info',
      content: `✓ Proyecto cargado: ${ruta.split(/[/\\]/).pop()} · ${n} archivos indexados`,
    });

    const ctx = `[SISTEMA] Proyecto activo cambiado.\nNombre: ${ruta.split(/[/\\]/).pop()}\nRuta: ${ruta}\nArchivos indexados (${n}):\n${resultado.archivos_leidos.map(a => '  ' + a.ruta_abs).join('\n')}\nIMPORTANTE: Trabaja EXCLUSIVAMENTE con archivos de esta ruta.`;
    agregarContextoProyecto(ctx);
  }

  async function handleReindexar() {
    if (!indice) return;
    const resultado = await indexar(indice.ruta_base);
    agregarMensaje({ role: 'system-info', content: `✓ Proyecto reindexado · ${resultado.archivos_leidos.length} archivos` });
  }

  function handleFileClick(arch) {
    setInput(prev =>
      prev ? `${prev}\n\nRevisa el archivo: ${arch.ruta_abs}` : `Revisa el archivo: ${arch.ruta_abs}`
    );
    inputRef.current?.focus();
  }

  // ── Drag & drop ──────────────────────────────────────────────────
  function handleDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e) {
    // Solo desactivar si el mouse salió del layout completo
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const disponibles = MAX_ARCHIVOS - pendingFiles.length;

    if (disponibles <= 0) {
      agregarMensaje({ role: 'system-info', content: `Máximo ${MAX_ARCHIVOS} archivos por mensaje.` });
      return;
    }

    const procesar = files.slice(0, disponibles);
    if (files.length > disponibles) {
      agregarMensaje({ role: 'system-info', content: `Solo se agregarán ${disponibles} archivo(s) (límite: ${MAX_ARCHIVOS}).` });
    }

    for (const file of procesar) {
      if (esImagen(file)) {
        const data = await fileToBase64(file);
        setPendingFiles(prev => [...prev, {
          tipo: 'imagen',
          nombre: file.name,
          mediaType: file.type,
          data,
          preview: `data:${file.type};base64,${data}`,
        }]);
      } else {
        try {
          // Usar FileReader para texto — funciona sin file.path (más compatible)
          const contenido = await fileToText(file);
          const extension = file.name.split('.').pop() || '';
          const lineas = contenido.split('\n').length;
          setPendingFiles(prev => [...prev, {
            tipo: 'archivo',
            nombre: file.name,
            extension,
            contenido,
            lineas,
          }]);
        } catch {
          agregarMensaje({ role: 'system-info', content: `No se pudo leer: ${file.name}` });
        }
      }
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function fileToText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
  }

  function removePendingFile(i) {
    setPendingFiles(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Enviar mensaje ───────────────────────────────────────────────
  async function enviar() {
    const texto = input.trim();
    if (!texto || enviando) return;

    setInput('');
    setEnviando(true);

    // Construir contenido del mensaje para mostrar en UI
    let contenidoUI;
    if (pendingFiles.length > 0) {
      const partes = [{ type: 'text', text: texto }];
      for (const f of pendingFiles) {
        if (f.tipo === 'imagen') {
          partes.push({ type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.data } });
        }
      }
      contenidoUI = partes;
    } else {
      contenidoUI = texto;
    }

    agregarMensaje({ role: 'user', content: contenidoUI });
    const adjuntos = [...pendingFiles];
    setPendingFiles([]);

    try {
      const { texto: respuesta, uso } = await chat(texto, adjuntos);

      const esHaiku = modelo.includes('haiku');
      const costo = esHaiku
        ? (uso.input * 0.80 + uso.output * 4.0) / 1_000_000
        : (uso.input * 3.0 + uso.output * 15.0) / 1_000_000;

      agregarMensaje({ role: 'assistant', content: respuesta, uso, costo });

      if (respuesta.includes('===ARCHIVO_MODIFICADO===')) {
        const bloques = extraerBloquesArchivos(respuesta);
        if (bloques.length > 0) setBloquesPendientes(bloques);
      }
      if (respuesta.includes('===CREAR_PROYECTO===')) {
        const bloque = extraerBloqueProyecto(respuesta);
        if (bloque) setBloqueProyecto(bloque);
      }
    } catch (err) {
      agregarMensaje({ role: 'system-info', content: `✗ Error: ${err.message}` });
    } finally {
      setEnviando(false);
      setPipeline(null);
      inputRef.current?.focus();
    }
  }

  async function confirmarArchivos(seleccionados) {
    let guardados = 0;
    for (const b of seleccionados) {
      try {
        await window.ryu.writeFile(b.ruta, b.contenido);
        guardados++;
      } catch (err) {
        agregarMensaje({ role: 'system-info', content: `✗ Error guardando ${b.ruta}: ${err.message}` });
      }
    }
    setBloquesPendientes(null);
    agregarMensaje({
      role: 'system-info',
      content: `✓ ${guardados}/${seleccionados.length} archivo${guardados !== 1 ? 's' : ''} guardado${guardados !== 1 ? 's' : ''}`,
    });
    if (indice) await indexar(indice.ruta_base);
  }

  async function confirmarProyecto() {
    const { rutaBase, archivos, carpetas } = bloqueProyecto;
    let base = rutaBase;
    if (!base) {
      base = await window.ryu.selectFolder();
      if (!base) { setBloqueProyecto(null); return; }
    }
    for (const carp of carpetas) {
      await window.ryu.writeFile(`${base}/${carp}/.gitkeep`, '');
    }
    let creados = 0;
    for (const arch of archivos) {
      try {
        await window.ryu.writeFile(`${base}/${arch.ruta}`, arch.contenido);
        creados++;
      } catch (err) {
        agregarMensaje({ role: 'system-info', content: `✗ Error: ${err.message}` });
      }
    }
    setBloqueProyecto(null);
    agregarMensaje({ role: 'system-info', content: `✓ Proyecto creado: ${creados} archivos en ${base}` });
    await indexar(base);
    guardarSesion({ proyectoPath: base });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  function limpiarTodo() {
    setMensajes([]);
    limpiarHistorial();
    limpiar();
    guardarSesion({ proyectoPath: null });
  }

  const nombreProyecto = indice ? indice.ruta_base.split(/[/\\]/).pop() : null;

  return (
    <div
      className="chat-layout"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sidebar */}
      {sidebarVisible && (
        <Sidebar
          indice={indice}
          onFileClick={handleFileClick}
          onReindexar={handleReindexar}
          indexando={indexando}
        />
      )}

      {/* Área principal */}
      <div className="chat-main">
        {/* Header */}
        <div className="chat-header">
          <button className="btn-icon" onClick={() => setSidebarVisible(v => !v)} title="Toggle sidebar">☰</button>

          <div className="header-proyecto">
            {nombreProyecto
              ? <span className="cyan">◈ {nombreProyecto}</span>
              : <span className="gray">Sin proyecto</span>
            }
          </div>

          <div className="modelo-selector">
            <button
              className={`modelo-btn ${modelo.includes('haiku') ? 'activo' : ''}`}
              onClick={() => setModelo(MODELO_HAIKU)}
              title="Haiku - Rápido, económico"
            >
              Haiku
            </button>
            <button
              className={`modelo-btn ${modelo.includes('sonnet') ? 'activo' : ''}`}
              onClick={() => setModelo(MODELO_SONNET)}
              title="Sonnet - Poderoso, complejo"
            >
              Sonnet
            </button>
          </div>

          <TokenCounter tokens={tokensSession} modelo={modelo} />

          <div className="header-acciones">
            <button className="btn-header" onClick={handleCargarProyecto} title="Cargar proyecto">
              📁 Proyecto
            </button>
            <button className="btn-header gray" onClick={limpiarTodo} title="Limpiar historial y proyecto">
              ✕ Limpiar
            </button>
            <button className="btn-header gray" onClick={onEditarPerfil} title="Editar perfil">
              ⚙ Perfil
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div className="chat-messages">
          {mensajes.length === 0 && (
            <div className="chat-welcome">
              <pre className="banner-mini cyan">{BANNER_CHAT}</pre>
              <p className="white" style={{ marginTop: 16 }}>
                Hola, <span className="cyan">{perfil.nombre}</span> 👋
              </p>
              <p className="gray">¿En qué trabajamos hoy?</p>
              <div className="tips">
                <span className="gray">· Carga un proyecto con </span>
                <span className="yellow">📁 Proyecto</span>
                <br />
                <span className="gray">· Arrastra archivos o imágenes — o pega con Ctrl+V</span>
                <br />
                <span className="gray">· Límite: {MAX_ARCHIVOS} archivos por mensaje</span>
                <br />
                <span className="gray">· Cambia modelo con los botones del header</span>
              </div>
            </div>
          )}

          {mensajes.map((msg, i) => <Message key={i} msg={msg} />)}

          {pipeline && pipeline !== 'listo' && (
            <div className="pipeline-indicator">
              <span className="pipeline-spinner">⟳</span>
              <span className="gray">{PIPELINE_LABELS[pipeline]}</span>
            </div>
          )}
          {pipeline === 'listo' && (
            <div className="pipeline-indicator listo">
              <span className="green">{PIPELINE_LABELS.listo}</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Archivos pendientes */}
        {pendingFiles.length > 0 && (
          <div className="pending-files">
            <span className="gray pending-count">{pendingFiles.length}/{MAX_ARCHIVOS}</span>
            {pendingFiles.map((f, i) => (
              <div key={i} className="pending-file">
                {f.tipo === 'imagen' ? (
                  <>
                    <img src={f.preview} alt={f.nombre} className="pending-img" />
                    <span className="gray pending-file-name">{f.nombre}</span>
                  </>
                ) : (
                  <>
                    <span className="pending-file-icon">📄</span>
                    <div className="pending-file-info">
                      <span className="white">{f.nombre}</span>
                      {f.lineas && <span className="gray">{f.lineas} líneas</span>}
                    </div>
                  </>
                )}
                <button className="btn-remove" onClick={() => removePendingFile(i)} title="Quitar">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className={`chat-input-area ${dragging ? 'dragging' : ''}`}>
          {dragging && (
            <div className="drag-overlay">
              <span className="cyan">↓ Suelta para adjuntar</span>
            </div>
          )}
          <button
            className="btn-attach"
            onClick={handleAdjuntarArchivos}
            disabled={enviando || pendingFiles.length >= MAX_ARCHIVOS}
            title={`Adjuntar archivos (Ctrl+Shift+O) · ${pendingFiles.length}/${MAX_ARCHIVOS}`}
          >
            📎
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={
              enviando
                ? 'RYU está pensando...'
                : indice
                ? `Pregunta sobre ${nombreProyecto}... (Shift+Enter = nueva línea)`
                : 'Escribe tu pregunta... (Shift+Enter para nueva línea)'
            }
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={enviando}
            rows={3}
          />
          <button
            className="btn-send"
            onClick={enviar}
            disabled={enviando || !input.trim()}
          >
            {enviando ? '⟳' : '↑'}
          </button>
        </div>
      </div>

      {/* Modal FileConfirm */}
      {bloquesPendientes && (
        <FileConfirm
          bloques={bloquesPendientes}
          onConfirmar={confirmarArchivos}
          onCancelar={() => setBloquesPendientes(null)}
        />
      )}

      {/* Modal Crear Proyecto */}
      {bloqueProyecto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setBloqueProyecto(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="cyan">+</span>{' '}
              <span className="white">RYU quiere crear un proyecto</span>
            </div>
            <div className="modal-body">
              <p className="gray">
                Ubicación: <span className="white">{bloqueProyecto.rutaBase || '(seleccionar carpeta)'}</span>
              </p>
              <p className="yellow" style={{ marginTop: 8 }}>Archivos a crear:</p>
              {bloqueProyecto.archivos.map((a, i) => (
                <div key={i} className="gray" style={{ paddingLeft: 12 }}>+ {a.ruta}</div>
              ))}
              {bloqueProyecto.carpetas.map((c, i) => (
                <div key={i} className="cyan" style={{ paddingLeft: 12 }}>+ {c}/</div>
              ))}
            </div>
            <div className="modal-acciones">
              <button className="btn-cancel" onClick={() => setBloqueProyecto(null)}>✗ Cancelar</button>
              <button className="btn-confirm" onClick={confirmarProyecto}>✓ Crear proyecto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
