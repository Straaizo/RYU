import { useState, useRef, useCallback } from 'react';

const MODELO_HAIKU = 'claude-haiku-4-5-20251001';
const MODELO_SONNET = 'claude-sonnet-4-6';

const KEYWORDS_CODIGO = [
  'crea', 'crear', 'modifica', 'modifica', 'arregla', 'agrega', 'añade',
  'implementa', 'haz', 'fix', 'build', 'make', 'add', 'update', 'change',
  'seccion', 'pagina', 'componente', 'endpoint', 'funcion', 'clase', 'ruta', 'route',
];

function construirSystemPrompt(perfil, indice, contextoATexto, incluirArchivos = true) {
  const stackStr = (perfil.stack || ['Python']).join(', ');
  const idioma = perfil.idioma || 'español';
  const nombre = perfil.nombre || 'Dev';
  const rol = perfil.rol || 'Desarrollador';
  const proyectos = perfil.proyectos || 'Sin proyectos';

  const ctx = indice ? contextoATexto(indice, incluirArchivos) : 'Sin proyecto activo.';

  return `Eres RYU, asistente personal de programacion de ${nombre}.
Rol: ${rol}. Stack: ${stackStr}. Proyectos: ${proyectos}.
Directo, preciso, sin rodeos. Senior dev experimentado.
Responde siempre en ${idioma}. Respuestas cortas salvo que se pida detalle.

## Fecha actual
Hoy es abril 2026. Usa siempre las versiones mas recientes y patrones modernos.

## Stack moderno OBLIGATORIO (abril 2026)

### JavaScript / React
- React 18+: SIEMPRE createRoot, NUNCA ReactDOM.render
- SIEMPRE functional components + hooks, NUNCA class components
- Vite como bundler, NUNCA Create React App (obsoleto)
- React Router v6+: useNavigate, Outlet, NUNCA history.push
- Estado global: Zustand o Context API, NUNCA Redux para proyectos nuevos
- ESModules (import/export), NUNCA require() en frontend

### Python
- Python 3.11+: type hints en todo, match/case cuando aplique
- FastAPI: async/await, Pydantic v2
- NUNCA Flask para APIs nuevas
- SQLAlchemy 2.0+: sintaxis nueva con select()

### General
- Node 20+ LTS
- Git: conventional commits (feat:, fix:, chore:)
- NUNCA hardcodear secrets

## Reglas de comportamiento
- Sin introducciones ni frases de relleno
- Codigo directo con manejo de errores
- Variables en ingles, comentarios en ${idioma}
- No agregar codigo extra que no se pidio
- No hacer refactors no pedidos
- Si hay ambiguedad, PREGUNTAR antes de escribir codigo

## Formato de respuesta OBLIGATORIO
SIEMPRE que generes codigo, sigue este orden:
1. PRIMERO: 2-4 lineas en texto plano explicando QUE hiciste y POR QUE (sin codigo aqui)
2. LUEGO: los bloques de codigo/archivos

Ejemplo correcto:
"Cree el componente Login con validacion de formulario y manejo de errores. Uso useState para el estado y axios para el POST al backend."
[bloque de codigo]

NUNCA pongas codigo sin explicacion previa.

## IMPORTANTE
Cuando hay un proyecto activo, trabajas EXCLUSIVAMENTE con los archivos de ese proyecto.
Siempre usa las rutas absolutas que se te proveen.

## Modificar archivos
Cuando el usuario pida modificar uno o VARIOS archivos, devuelve TODOS en la misma respuesta.
Usa este formato por cada archivo:

===ARCHIVO_MODIFICADO===
RUTA: [ruta absoluta completa del archivo]
\`\`\`[extension]
[contenido completo]
\`\`\`
===FIN_ARCHIVO===

REGLA CRITICA: Devuelve TODOS los archivos necesarios de una vez.
PROHIBIDO: No digas "voy a revisar" o frases sin codigo.
OBLIGATORIO: Cada respuesta con cambios DEBE terminar con los bloques ===ARCHIVO_MODIFICADO===.

## Crear proyectos — REGLAS DE COMPLETITUD
Cuando pidan crear un proyecto nuevo, es OBLIGATORIO:

1. LISTAR primero todos los archivos que vas a crear
2. Verificar que cada import/require referencia un archivo de esa lista
3. Si un archivo A importa B, B DEBE estar en la lista y ser creado
4. NUNCA dejar imports rotos o archivos faltantes
5. Crear el proyecto COMPLETO en una sola respuesta, sin omitir nada

Antes de generar el codigo, razona internamente:
- ¿Que archivos necesita este proyecto para funcionar?
- ¿Hay algun import en un archivo que no se va a crear?
- ¿El package.json tiene todas las dependencias necesarias?
- ¿Hay archivos de configuracion que se necesitan (vite.config, tsconfig, etc)?

Solo cuando estes seguro de que el proyecto es completo, genera los bloques.

===CREAR_PROYECTO===
RUTA_BASE: [ruta donde crear]

ARCHIVO: [ruta/relativa/archivo.ext]
\`\`\`[extension]
[contenido]
\`\`\`

CARPETA: [carpeta/vacia]
===FIN_PROYECTO===

## Contexto del proyecto actual
${ctx}`;
}

// Extrae bloques ===ARCHIVO_MODIFICADO=== de una respuesta
export function extraerBloquesArchivos(respuesta) {
  const bloques = [];
  const partes = respuesta.split('===ARCHIVO_MODIFICADO===');
  for (const parte of partes.slice(1)) {
    if (!parte.includes('===FIN_ARCHIVO===')) continue;
    const bloque = parte.split('===FIN_ARCHIVO===')[0];
    const lineas = bloque.trim().split('\n');

    let rutaStr = '';
    for (const linea of lineas) {
      if (linea.startsWith('RUTA:')) {
        rutaStr = linea.replace('RUTA:', '').trim();
        break;
      }
    }

    const match = bloque.match(/```[\w]*\n([\s\S]*?)```/);
    if (!match || !rutaStr) continue;

    bloques.push({
      ruta: rutaStr,
      contenido: match[1],
      lineas: match[1].split('\n').length,
    });
  }
  return bloques;
}

// Extrae bloque ===CREAR_PROYECTO===
export function extraerBloqueProyecto(respuesta) {
  if (!respuesta.includes('===CREAR_PROYECTO===')) return null;
  const bloque = respuesta.split('===CREAR_PROYECTO===')[1].split('===FIN_PROYECTO===')[0];
  const lineas = bloque.trim().split('\n');

  let rutaBase = '';
  const archivos = [];
  const carpetas = [];

  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i].trim();
    if (linea.startsWith('RUTA_BASE:')) {
      rutaBase = linea.replace('RUTA_BASE:', '').trim();
    } else if (linea.startsWith('ARCHIVO:')) {
      const rutaRel = linea.replace('ARCHIVO:', '').trim();
      const contenidoLineas = [];
      i++;
      let enBloque = false;
      while (i < lineas.length) {
        if (lineas[i].trim().startsWith('```') && !enBloque) {
          enBloque = true;
          i++;
          continue;
        } else if (lineas[i].trim() === '```' && enBloque) {
          break;
        } else if (enBloque) {
          contenidoLineas.push(lineas[i]);
        }
        i++;
      }
      archivos.push({ ruta: rutaRel, contenido: contenidoLineas.join('\n') });
    } else if (linea.startsWith('CARPETA:')) {
      carpetas.push(linea.replace('CARPETA:', '').trim());
    }
    i++;
  }

  return { rutaBase, archivos, carpetas };
}

export function useAnthropicAPI({ perfil, indice, contextoATexto }) {
  const [pipeline, setPipeline] = useState(null); // null | 'analizando' | 'generando' | 'verificando' | 'listo'
  const [modelo, setModelo] = useState(MODELO_HAIKU);
  const [tokensSession, setTokensSession] = useState({ input: 0, output: 0, mensajes: 0 });
  const historialRef = useRef([]);

  const callAPI = useCallback(async (messages, system, modelOverride, maxTokens) => {
    return window.ryu.callAPI({
      messages,
      system,
      model: modelOverride || modelo,
      maxTokens: maxTokens || 4096,
    });
  }, [modelo]);

  const chat = useCallback(async (mensaje, attachments = []) => {
    const historial = historialRef.current;

    // Comprimir historial largo
    if (historial.length > 20) {
      historialRef.current = historial.slice(-6);
    }

    // Comprimir bloques de código en historial antiguo
    for (let i = 0; i < historialRef.current.length; i++) {
      const msg = historialRef.current[i];
      if (msg.role === 'assistant' && msg.content.includes('===ARCHIVO_MODIFICADO===')) {
        const n = (msg.content.match(/===ARCHIVO_MODIFICADO===/g) || []).length;
        historialRef.current[i] = {
          role: 'assistant',
          content: `[CODIGO GENERADO Y GUARDADO: ${n} archivo(s) modificado(s). Contenido omitido para ahorrar contexto.]`,
        };
      }
    }

    const esTareaConCodigo = KEYWORDS_CODIGO.some(w => mensaje.toLowerCase().includes(w));
    // Siempre incluir archivos completos — el usuario quiere contexto total del proyecto
    const system = construirSystemPrompt(perfil, indice, contextoATexto, true);

    // Construir contenido del mensaje (texto + adjuntos)
    let contenidoMensaje;
    if (attachments.length > 0) {
      const partes = [{ type: 'text', text: mensaje }];
      for (const att of attachments) {
        if (att.tipo === 'imagen') {
          partes.push({
            type: 'image',
            source: { type: 'base64', media_type: att.mediaType, data: att.data },
          });
        } else if (att.tipo === 'archivo') {
          partes[0].text += `\n\n--- ARCHIVO ADJUNTO: ${att.nombre} ---\n\`\`\`${att.extension}\n${att.contenido}\n\`\`\`\n--- FIN ---`;
        }
      }
      contenidoMensaje = partes;
    } else {
      contenidoMensaje = mensaje;
    }

    const historialTrabajo = [
      ...historialRef.current,
      { role: 'user', content: contenidoMensaje },
    ];

    let texto;
    const usoTotal = { input: 0, output: 0, total: 0 };

    if (esTareaConCodigo && indice) {
      // Pipeline de 4 pasos
      setPipeline('analizando');

      const planSystem = system + `\n\nTAREA ACTUAL: ${mensaje}\n
PRIMERO determina si esta tarea es:
A) NUEVA: pide algo diferente a lo anterior
B) CONTINUACION: corrige o extiende exactamente lo anterior

Responde SOLO con este formato:
TIPO: [NUEVA o CONTINUACION]
ARCHIVOS_A_TOCAR: [lista de rutas absolutas]
CAMBIOS: [descripcion breve de QUE cambiar]
STACK: [tecnologias]
Nada mas, sin codigo todavia.`;

      const { text: planTexto, usage: usoPlan } = await callAPI(
        historialTrabajo, planSystem, modelo, 512
      );
      usoTotal.input += usoPlan.input;
      usoTotal.output += usoPlan.output;
      usoTotal.total += usoPlan.total;

      setPipeline('generando');

      const esTareaNueva = planTexto.toUpperCase().includes('TIPO: NUEVA') ||
                           planTexto.toUpperCase().replace(/\s/g, '').includes('TIPO:NUEVA');

      if (esTareaNueva) {
        historialRef.current = [];
      }

      const genSystem = system + `\n\n[TAREA ACTUAL]\nTarea: ${mensaje}\n\nPLAN:\n${planTexto}\n\nGenera SOLO los cambios de esta tarea. No toques archivos fuera del plan. ${esTareaNueva ? 'No hay tareas anteriores relevantes.' : 'Continuacion de la tarea anterior.'}`;

      const historialGen = esTareaNueva
        ? [{ role: 'user', content: contenidoMensaje }]
        : [...historialTrabajo, { role: 'user', content: contenidoMensaje }];

      const { text: textoGen, usage: usoGen } = await callAPI(historialGen, genSystem, modelo, 6144);
      usoTotal.input += usoGen.input;
      usoTotal.output += usoGen.output;
      usoTotal.total += usoGen.total;
      texto = textoGen;

    } else {
      setPipeline('generando');
      const { text: textoSimple, usage: usoSimple } = await callAPI(historialTrabajo, system, modelo, 4096);
      usoTotal.input += usoSimple.input;
      usoTotal.output += usoSimple.output;
      usoTotal.total += usoSimple.total;
      texto = textoSimple;
    }

    // Paso verificar: si hay proyecto, pedir a Claude que valide completitud
    if (texto.includes('===CREAR_PROYECTO===')) {
      setPipeline('verificando');

      const archivosCreados = [];
      const bloqueProyecto = texto.split('===CREAR_PROYECTO===')[1]?.split('===FIN_PROYECTO===')[0] || '';
      for (const linea of bloqueProyecto.split('\n')) {
        if (linea.trim().startsWith('ARCHIVO:')) {
          archivosCreados.push(linea.replace('ARCHIVO:', '').trim());
        }
      }

      if (archivosCreados.length > 0) {
        const verifySystem = system + `\n\nVERIFICACION DE PROYECTO\nArchivos generados:\n${archivosCreados.map(a => '- ' + a).join('\n')}\n\nRevisa el codigo generado. Si hay algun import que referencia un archivo NO en la lista, agrega ese archivo ahora con el formato ===CREAR_PROYECTO===. Si todo esta completo, responde exactamente: VERIFICACION_OK`;
        const { text: verificado } = await callAPI(
          [{ role: 'user', content: `Verifica completitud del proyecto generado:\n\n${texto.slice(0, 3000)}` }],
          verifySystem, modelo, 2048
        );

        if (!verificado.includes('VERIFICACION_OK') && verificado.includes('===CREAR_PROYECTO===')) {
          texto = texto + '\n' + verificado;
        }
      }
    } else if (texto.includes('===ARCHIVO_MODIFICADO===')) {
      setPipeline('verificando');
      await new Promise(r => setTimeout(r, 200));
    }

    setPipeline('listo');

    // Guardar en historial
    historialRef.current.push({ role: 'user', content: typeof contenidoMensaje === 'string' ? contenidoMensaje : mensaje });

    if (texto.includes('===ARCHIVO_MODIFICADO===')) {
      const archMod = [];
      for (const parte of texto.split('===ARCHIVO_MODIFICADO===').slice(1)) {
        if (!parte.includes('===FIN_ARCHIVO===')) continue;
        const bloque = parte.split('===FIN_ARCHIVO===')[0];
        for (const linea of bloque.trim().split('\n')) {
          if (linea.startsWith('RUTA:')) {
            archMod.push(linea.replace('RUTA:', '').trim());
            break;
          }
        }
      }
      const textoPrevio = texto.split('===ARCHIVO_MODIFICADO===')[0].trim();
      const resumen = `[TAREA COMPLETADA] ${mensaje}\n[ARCHIVOS MODIFICADOS]:\n${archMod.map(a => '  - ' + a).join('\n')}\n[ESTADO: guardado en disco.]`;
      historialRef.current.push({ role: 'assistant', content: textoPrevio ? textoPrevio + '\n' + resumen : resumen });
    } else if (texto.includes('===CREAR_PROYECTO===')) {
      const textoPrevio = texto.split('===CREAR_PROYECTO===')[0].trim();
      const resumen = `[PROYECTO CREADO]\n[ESTADO: guardado en disco.]`;
      historialRef.current.push({ role: 'assistant', content: textoPrevio ? textoPrevio + '\n' + resumen : resumen });
    } else {
      const contenidoHist = texto.length > 2000 ? texto.slice(0, 2000) + '\n[...truncado]' : texto;
      historialRef.current.push({ role: 'assistant', content: contenidoHist });
    }

    // Limpiar historial si es muy largo
    if (historialRef.current.length > 16) {
      const ancla = historialRef.current.slice(0, 2);
      const recientes = historialRef.current.slice(-8);
      historialRef.current = [...ancla, ...recientes];
    }

    // Acumular tokens
    setTokensSession(prev => ({
      input: prev.input + usoTotal.input,
      output: prev.output + usoTotal.output,
      mensajes: prev.mensajes + 1,
    }));

    return { texto, uso: usoTotal };
  }, [perfil, indice, contextoATexto, callAPI, modelo]);

  function limpiarHistorial() {
    historialRef.current = [];
  }

  function agregarContextoProyecto(proyectoInfo) {
    historialRef.current.push({ role: 'user', content: proyectoInfo });
    historialRef.current.push({
      role: 'assistant',
      content: `Entendido. Proyecto ${proyectoInfo.split('\n')[1]?.replace('Nombre:', '').trim() || ''} cargado. Listo para trabajar.`,
    });
  }

  return {
    chat,
    pipeline,
    setPipeline,
    modelo,
    setModelo,
    tokensSession,
    limpiarHistorial,
    agregarContextoProyecto,
    MODELO_HAIKU,
    MODELO_SONNET,
  };
}
