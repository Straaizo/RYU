import React, { useState, useEffect } from 'react';

export default function Sidebar({ indice, onFileClick, onReindexar, indexando }) {
  const [expandido, setExpandido] = useState(true);
  const [archivoActivo, setArchivoActivo] = useState(null);

  // Resetear al cambiar de proyecto
  useEffect(() => {
    setArchivoActivo(null);
    setExpandido(true);
  }, [indice?.ruta_base]);

  if (!indice) {
    return (
      <div className="sidebar sidebar-empty">
        <div className="sidebar-hint">
          <span className="gray">Sin proyecto</span>
          <br />
          <span className="gray" style={{ fontSize: 11 }}>
            Carga una carpeta para indexar
          </span>
        </div>
      </div>
    );
  }

  function handleClick(arch) {
    setArchivoActivo(arch.ruta);
    onFileClick(arch);
  }

  // Construye árbol de archivos desde la lista plana
  const tree = {};
  for (const arch of indice.archivos_leidos) {
    const partes = arch.ruta.split('/');
    let nodo = tree;
    for (let i = 0; i < partes.length - 1; i++) {
      if (!nodo[partes[i]]) nodo[partes[i]] = { _archivos: [] };
      nodo = nodo[partes[i]];
    }
    const nombre = partes[partes.length - 1];
    if (!nodo._archivos) nodo._archivos = [];
    nodo._archivos.push({ ...arch, nombre });
  }

  function renderNodo(nodo, nivel = 0) {
    const items = [];
    for (const [key, valor] of Object.entries(nodo)) {
      if (key === '_archivos') {
        for (const arch of valor) {
          const ext = arch.nombre.split('.').pop();
          items.push(
            <div
              key={arch.ruta}
              className={`sidebar-file ${archivoActivo === arch.ruta ? 'activo' : ''}`}
              style={{ paddingLeft: 12 + nivel * 14 }}
              onClick={() => handleClick(arch)}
              title={arch.ruta}
            >
              <span className="file-icon">{extIcon(ext)}</span>
              <span className="file-name">{arch.nombre}</span>
            </div>
          );
        }
      } else {
        items.push(
          <div key={key}>
            <div
              className="sidebar-folder"
              style={{ paddingLeft: 8 + nivel * 14 }}
            >
              <span className="yellow">▸</span>{' '}
              <span className="gray">{key}/</span>
            </div>
            {renderNodo(valor, nivel + 1)}
          </div>
        );
      }
    }
    return items;
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-proyecto-nombre" onClick={() => window.ryu.openFolder(indice.ruta_base)}>
          <span className="cyan">◈</span>{' '}
          <span className="white" title={indice.ruta_base}>
            {indice.ruta_base.split(/[/\\]/).pop()}
          </span>
        </div>
        <button
          className="btn-icon"
          onClick={onReindexar}
          disabled={indexando}
          title="Reindexar proyecto"
        >
          {indexando ? '⟳' : '↺'}
        </button>
      </div>

      <div className="sidebar-stats gray">
        {indice.archivos_leidos.length} archivos · {indice.ignorados} ignorados
      </div>

      <div
        className="sidebar-section-title"
        onClick={() => setExpandido(e => !e)}
      >
        {expandido ? '▾' : '▸'} ARCHIVOS
      </div>

      {expandido && (
        <div className="sidebar-tree">
          {renderNodo(tree)}
        </div>
      )}
    </div>
  );
}

function extIcon(ext) {
  const icons = {
    py: '🐍', js: '𝐉', jsx: '⚛', ts: '𝐓', tsx: '⚛',
    dart: '🎯', json: '{ }', md: '📝', yaml: '⚙', yml: '⚙',
    css: '🎨', html: '🌐', sql: '🗄', sh: '⚡', bat: '⚡',
    txt: '📄', env: '🔑',
  };
  return icons[ext] || '·';
}
