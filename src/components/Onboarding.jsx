import React, { useState } from 'react';

// Banner con RYU perfectamente centrado (10 espacios antes del logo = (46-26)/2)
const BANNER = `╔══════════════════════════════════════════════╗
║                                              ║
║   ·  CREADO        POR         STRAAIZO  ·   ║
║                                              ║
║          ██████╗ ██╗   ██╗██╗   ██╗          ║
║          ██╔══██╗╚██╗ ██╔╝██║   ██║          ║
║          ██████╔╝ ╚████╔╝ ██║   ██║          ║
║          ██╔══██╗  ╚██╔╝  ██║   ██║          ║
║          ██║  ██║   ██║   ╚██████╔╝          ║
║          ╚═╝  ╚═╝   ╚═╝    ╚═════╝           ║
║                                              ║
║          Asistente de Programación           ║
║              powered by Claude               ║
╚══════════════════════════════════════════════╝`;

const PASOS = [
  { id: 1, titulo: 'API Key de Anthropic', color: 'yellow' },
  { id: 2, titulo: '¿Cómo te llamas?', color: 'cyan' },
  { id: 3, titulo: '¿Con qué tecnologías trabajas?', color: 'magenta' },
  { id: 4, titulo: '¿Cuál es tu rol?', color: 'yellow' },
  { id: 5, titulo: 'Proyectos activos (opcional)', color: 'cyan' },
  { id: 6, titulo: 'Idioma de respuestas', color: 'magenta' },
];

// editMode=true → salta el paso 1 (API key) y pre-carga valores existentes
export default function Onboarding({ onComplete, editMode = false, perfilActual = null }) {
  const pasoInicial = editMode ? 2 : 1;

  const [paso, setPaso] = useState(pasoInicial);
  const [valores, setValores] = useState({
    apiKey: '',
    nombre: perfilActual?.nombre || '',
    stack: perfilActual?.stack?.join(', ') || '',
    rol: perfilActual?.rol || '',
    proyectos: perfilActual?.proyectos || '',
    idioma: perfilActual?.idioma || 'español',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [keyVerificada, setKeyVerificada] = useState(false);

  function actualizar(campo, valor) {
    setValores(v => ({ ...v, [campo]: valor }));
    setError('');
    if (campo === 'apiKey') setKeyVerificada(false);
  }

  async function verificarApiKey() {
    const key = valores.apiKey.trim();
    if (!key.startsWith('sk-ant-') || key.length < 20) {
      setError("Debe empezar con 'sk-ant-' y tener al menos 20 caracteres.");
      return;
    }
    setCargando(true);
    setError('');
    const result = await window.ryu.testApiKey(key);
    setCargando(false);
    if (!result.ok) {
      setError('API key inválida. Verifica en console.anthropic.com');
      return;
    }
    await window.ryu.storeSet('apiKey', key);
    setKeyVerificada(true);
  }

  async function avanzar() {
    setError('');

    if (paso === 1) {
      if (!keyVerificada) {
        await verificarApiKey();
        return;
      }
    }

    if (paso === 2 && !valores.nombre.trim()) {
      setError('Ingresa tu nombre.');
      return;
    }

    if (paso < 6) {
      setPaso(p => p + 1);
      return;
    }

    // Paso 6: guardar perfil
    const stackArr = valores.stack
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const perfil = {
      nombre: valores.nombre.trim() || 'Dev',
      stack: stackArr.length ? stackArr : ['Python'],
      rol: valores.rol.trim() || 'Desarrollador',
      proyectos: valores.proyectos.trim() || 'Sin proyectos definidos',
      idioma: valores.idioma,
    };

    await window.ryu.storeSet('perfil', perfil);
    onComplete(perfil);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && paso !== 1) {
      e.preventDefault();
      avanzar();
    }
  }

  const pasoActual = PASOS[paso - 1];
  const pasosDesplegados = editMode ? PASOS.slice(1) : PASOS;

  return (
    <div className="onboarding">
      <pre className="banner cyan">{BANNER}</pre>

      <div className="onboarding-card">
        {/* Indicador de pasos */}
        <div className="pasos-indicador">
          {pasosDesplegados.map(p => (
            <div
              key={p.id}
              className={`paso-dot ${p.id === paso ? 'activo' : ''} ${p.id < paso ? 'completo' : ''}`}
            />
          ))}
        </div>

        {editMode && (
          <div className="onboarding-edit-badge gray">Editando perfil</div>
        )}

        <div className={`onboarding-titulo ${pasoActual.color}`}>
          PASO {editMode ? paso - 1 : paso} — {pasoActual.titulo}
        </div>

        <div className="onboarding-separador" />

        {/* Paso 1: API Key */}
        {paso === 1 && (
          <div className="onboarding-campo">
            <p className="gray">Necesitas una API key para que funcione.</p>
            <p className="gray">
              Creala en:{' '}
              <span className="cyan">https://console.anthropic.com</span>
            </p>
            <p className="gray" style={{ marginTop: 4 }}>(Empieza con 'sk-ant-...')</p>
            <div className="apikey-row">
              <input
                className="onboarding-input"
                type="password"
                placeholder="sk-ant-..."
                value={valores.apiKey}
                onChange={e => actualizar('apiKey', e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); verificarApiKey(); }
                }}
                autoFocus
              />
              <button
                className={`btn-verificar ${keyVerificada ? 'verificada' : ''}`}
                onClick={verificarApiKey}
                disabled={cargando || keyVerificada}
              >
                {cargando ? '⟳' : keyVerificada ? '✓ OK' : 'Verificar'}
              </button>
            </div>
            {keyVerificada && (
              <p className="green" style={{ fontSize: 12, marginTop: 4 }}>
                ✓ Conexión exitosa
              </p>
            )}
          </div>
        )}

        {/* Paso 2: Nombre */}
        {paso === 2 && (
          <div className="onboarding-campo">
            <input
              className="onboarding-input"
              type="text"
              placeholder="Tu nombre"
              value={valores.nombre}
              onChange={e => actualizar('nombre', e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        )}

        {/* Paso 3: Stack */}
        {paso === 3 && (
          <div className="onboarding-campo">
            <p className="gray">Separadas por comas. Ej: Python, FastAPI, React</p>
            <input
              className="onboarding-input"
              type="text"
              placeholder="Python, JavaScript, React..."
              value={valores.stack}
              onChange={e => actualizar('stack', e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        )}

        {/* Paso 4: Rol */}
        {paso === 4 && (
          <div className="onboarding-campo">
            <p className="gray">Ej: Backend Developer, Estudiante, Full Stack</p>
            <input
              className="onboarding-input"
              type="text"
              placeholder="Tu rol"
              value={valores.rol}
              onChange={e => actualizar('rol', e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        )}

        {/* Paso 5: Proyectos */}
        {paso === 5 && (
          <div className="onboarding-campo">
            <p className="gray">Ej: API REST en FastAPI, App móvil en Flutter</p>
            <p className="gray">(Enter para omitir)</p>
            <input
              className="onboarding-input"
              type="text"
              placeholder="Tus proyectos actuales..."
              value={valores.proyectos}
              onChange={e => actualizar('proyectos', e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        )}

        {/* Paso 6: Idioma */}
        {paso === 6 && (
          <div className="onboarding-campo">
            <div className="idioma-opciones">
              <button
                className={`idioma-btn ${valores.idioma === 'español' ? 'activo' : ''}`}
                onClick={() => actualizar('idioma', 'español')}
              >
                🇦🇷 Español
              </button>
              <button
                className={`idioma-btn ${valores.idioma === 'english' ? 'activo' : ''}`}
                onClick={() => actualizar('idioma', 'english')}
              >
                🇺🇸 English
              </button>
            </div>
          </div>
        )}

        {error && <p className="onboarding-error">{error}</p>}

        <button
          className="onboarding-btn"
          onClick={avanzar}
          disabled={cargando || (paso === 1 && !keyVerificada && valores.apiKey.length > 0 && !cargando && false)}
        >
          {paso === 1 && !keyVerificada
            ? cargando ? 'Verificando...' : 'Verificar y continuar →'
            : paso === 6
            ? editMode ? '✓ Guardar cambios' : '✓ Comenzar'
            : 'Siguiente →'}
        </button>
      </div>
    </div>
  );
}
