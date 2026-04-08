import { useState, useCallback } from 'react';

export function useProjectIndex() {
  const [indice, setIndice] = useState(null);
  const [indexando, setIndexando] = useState(false);

  const indexar = useCallback(async (rutaBase) => {
    setIndexando(true);
    try {
      const resultado = await window.ryu.indexProject(rutaBase);
      setIndice(resultado);
      return resultado;
    } finally {
      setIndexando(false);
    }
  }, []);

  const limpiar = useCallback(() => setIndice(null), []);

  // Genera el bloque de texto de contexto para el system prompt
  function contextoATexto(idx, incluirArchivos = true) {
    if (!idx) return 'Sin proyecto activo.';

    const lineas = [
      'PROYECTO ACTIVO: ' + idx.ruta_base,
      'Archivos (' + idx.archivos_leidos.length + '):',
      '',
      'ESTRUCTURA:',
      ...idx.estructura.map(r => '  ' + r),
      '',
    ];

    if (!incluirArchivos) {
      return lineas.join('\n');
    }

    lineas.push('CONTENIDO:', '');

    for (const arch of idx.archivos_leidos) {
      const ext = arch.ruta.split('.').pop() || '';
      lineas.push('--- ' + arch.ruta_abs + ' ---');
      lineas.push('```' + ext);
      lineas.push(arch.contenido);
      lineas.push('```', '');
    }

    return lineas.join('\n');
  }

  return { indice, indexando, indexar, limpiar, contextoATexto };
}
