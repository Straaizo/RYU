# RYU — Asistente de Programación

```
╔══════════════════════════════════════════════╗
║          ██████╗ ██╗   ██╗██╗   ██╗          ║
║          ██╔══██╗╚██╗ ██╔╝██║   ██║          ║
║          ██████╔╝ ╚████╔╝ ██║   ██║          ║
║          ██╔══██╗  ╚██╔╝  ██║   ██║          ║
║          ██║  ██║   ██║   ╚██████╔╝          ║
║          ╚═╝  ╚═╝   ╚═╝    ╚═════╝           ║
║          Asistente de Programación           ║
║              powered by Claude               ║
╚══════════════════════════════════════════════╝
```

**RYU** es un asistente de programación personal de escritorio, construido con Electron + React y conectado a la API de Anthropic (Claude). Diseñado para desarrolladores que quieren un asistente contextual que entiende su proyecto completo, puede leer y modificar archivos reales, y responde con el estilo directo de un senior dev.

---

## Características

- **Contexto total del proyecto** — indexa todos los archivos de tu codebase y los incluye en cada consulta
- **Modificación de archivos real** — RYU propone cambios, vos confirmás cuáles guardar
- **Drag & drop + adjuntos** — arrastrá archivos o imágenes directamente al chat
- **Soporte multimodal** — enviá capturas de pantalla o diseños y RYU los analiza
- **Dos modelos** — Haiku (rápido, económico) y Sonnet (complejo, potente)
- **Pipeline visible** — Analizando → Generando → Verificando → Listo
- **Persistencia de sesión** — retoma el último proyecto al abrir
- **Sin Python requerido** — el instalador es autocontenido

---

## Requisitos

- Windows 10 / 11 (x64)
- Conexión a internet
- **API Key de Anthropic** — obtenela gratis en [console.anthropic.com](https://console.anthropic.com)

> La API key se guarda localmente en tu equipo con `electron-store`. Nunca sale de tu máquina salvo para llamar directamente a la API de Anthropic.

---

## Instalación (usuario final)

1. Descargá el ZIP desde [Releases](../../releases/latest): `RYU-win32-x64.zip`
2. Descomprimí en la carpeta que quieras
3. Ejecutá `RYU.exe`
4. Al abrir por primera vez, ingresá tu API key de Anthropic
5. Completá el onboarding — tarda menos de 1 minuto

> Sin instalación, sin permisos de administrador, sin dependencias externas.

---

## Instalación para desarrolladores

### Prerequisitos

- [Node.js 20+ LTS](https://nodejs.org/)
- npm 10+

### Setup

```bash
git clone https://github.com/straaizo/ryu.git
cd ryu
npm install
npm start
```

### Build del ZIP portable

```bash
npm run make
```

El ZIP queda en `out/make/zip/win32/x64/RYU-win32-x64.zip`.

---

## Estructura del proyecto

```
ryu/
├── electron/
│   ├── main.js          # proceso principal, IPC handlers, filesystem
│   └── preload.js       # bridge seguro renderer ↔ main
├── src/
│   ├── components/
│   │   ├── Chat.jsx             # pantalla principal de chat
│   │   ├── ErrorBoundary.jsx    # captura de errores de React
│   │   ├── FileConfirm.jsx      # modal confirmación de archivos
│   │   ├── Message.jsx          # renderizado de mensajes
│   │   ├── Onboarding.jsx       # setup inicial y edición de perfil
│   │   ├── Sidebar.jsx          # árbol de archivos del proyecto
│   │   └── TokenCounter.jsx
│   ├── hooks/
│   │   ├── useAnthropicAPI.js   # lógica de IA (pipeline 4 pasos)
│   │   ├── usePersistence.js    # perfil y sesión en electron-store
│   │   └── useProjectIndex.js  # indexación de proyectos
│   ├── styles/globals.css
│   ├── App.jsx
│   └── main.jsx
├── forge.config.js
├── vite.main.config.js
├── vite.preload.config.js
├── vite.renderer.config.js
└── package.json
```

---

## Uso

### Cargar un proyecto

Clic en **📁 Proyecto** en el header o `Ctrl+O`. RYU indexa todos los archivos relevantes y los incluye como contexto en cada mensaje.

### Adjuntar archivos

- **Drag & drop** — arrastrá archivos o imágenes al área de chat
- **Botón 📎** — abre diálogo para seleccionar múltiples archivos
- **Ctrl+V** — pegá imágenes del portapapeles directamente
- Límite: 5 archivos por mensaje

### Modificar archivos

Cuando RYU genera cambios de código, aparece un modal con preview de cada archivo. Podés elegir cuáles guardar antes de confirmar.

### Atajos de teclado

| Atajo | Acción |
|---|---|
| `Enter` | Enviar mensaje |
| `Shift+Enter` | Nueva línea |
| `Ctrl+O` | Abrir proyecto |
| `Ctrl+Shift+O` | Adjuntar archivos |
| `Ctrl+Shift+R` | Reindexar proyecto |
| `Ctrl+L` | Limpiar historial |

---

## Privacidad

- La API key se almacena **localmente** en `%APPDATA%\ryu\config.json`
- Los mensajes van **directamente** a la API de Anthropic — sin servidores intermediarios
- RYU no recopila ni envía telemetría

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Desktop | Electron 31 |
| UI | React 18 + Vite 5 |
| IA | Anthropic SDK (`claude-haiku-4-5`, `claude-sonnet-4-6`) |
| Persistencia | electron-store |
| Build | electron-forge + electron-builder (NSIS) |

---

## Licencia

MIT — libre para uso personal y comercial.

---

*Creado por [Enzo Sabattini](https://github.com/straaizo) · powered by [Claude](https://anthropic.com)*
