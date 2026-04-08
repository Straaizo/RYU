import React, { useState } from 'react';

export default function FileConfirm({ bloques, onConfirmar, onCancelar }) {
  const [seleccion, setSeleccion] = useState(new Set(bloques.map((_, i) => i)));
  const [guardando, setGuardando] = useState(false);
  const [preview, setPreview] = useState(null);

  function toggleArchivo(i) {
    setSeleccion(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i);
      else s.add(i);
      return s;
    });
  }

  async function guardar() {
    setGuardando(true);
    const seleccionados = bloques.filter((_, i) => seleccion.has(i));
    await onConfirmar(seleccionados);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancelar()}>
      <div className="modal">
        <div className="modal-header">
          <span className="yellow">⚠</span>{' '}
          <span className="white">
            RYU quiere modificar{' '}
            <strong className="yellow">{bloques.length}</strong>{' '}
            {bloques.length === 1 ? 'archivo' : 'archivos'}
          </span>
        </div>

        <div className="modal-archivos">
          {bloques.map((b, i) => {
            const nombre = b.ruta.split(/[/\\]/).pop();
            return (
              <div key={i} className="modal-archivo-item">
                <label className="modal-archivo-label">
                  <input
                    type="checkbox"
                    checked={seleccion.has(i)}
                    onChange={() => toggleArchivo(i)}
                  />
                  <span className={seleccion.has(i) ? 'cyan' : 'gray'}>
                    {nombre}
                  </span>
                  <span className="gray" style={{ marginLeft: 8, fontSize: 11 }}>
                    ({b.lineas} líneas)
                  </span>
                </label>
                <button
                  className="btn-preview"
                  onClick={() => setPreview(preview === i ? null : i)}
                >
                  {preview === i ? 'ocultar' : 'ver'}
                </button>
              </div>
            );
          })}
        </div>

        {preview !== null && (
          <div className="modal-preview">
            <div className="gray" style={{ fontSize: 11, marginBottom: 4 }}>
              {bloques[preview].ruta}
            </div>
            <pre className="code-block preview-code">
              {bloques[preview].contenido.split('\n').slice(0, 20).join('\n')}
              {bloques[preview].lineas > 20 && '\n... (' + bloques[preview].lineas + ' líneas)'}
            </pre>
          </div>
        )}

        <div className="modal-acciones">
          <button className="btn-cancel" onClick={onCancelar} disabled={guardando}>
            ✗ Descartar
          </button>
          <button
            className="btn-confirm"
            onClick={guardar}
            disabled={guardando || seleccion.size === 0}
          >
            {guardando ? 'Guardando...' : `✓ Guardar ${seleccion.size} archivo${seleccion.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
