<div align="center">

  <img src="assets/logo.png" alt="RYU" width="160" />

  # RYU — Asistente de Programación

  **Asistente de escritorio impulsado por Claude AI que trabaja directamente con tu código**

  [![Licencia: No Comercial](https://img.shields.io/badge/Licencia-No%20Comercial-red.svg)](LICENSE)
  [![Plataforma](https://img.shields.io/badge/Plataforma-Windows%2010%2F11-blue.svg)](../../releases/latest)
  [![Electron](https://img.shields.io/badge/Electron-31-47848F.svg)](https://electronjs.org)
  [![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)

</div>

---

RYU nació de una necesidad concreta: tener un asistente de programación que realmente entienda el proyecto en el que estás trabajando, no solo el fragmento de código que le pegás. Indexa toda tu base de código, lee y modifica archivos reales, y responde con la precisión de un desarrollador experimentado.

---

## ¿Qué hace RYU?

- **Contexto completo del proyecto** — indexa todos los archivos del repositorio y los incluye en cada consulta. RYU sabe qué hay en cada archivo antes de que le preguntes.
- **Modifica archivos reales** — propone los cambios, vos decidís cuáles guardar. Sin copiar y pegar código manualmente.
- **Adjuntos de todo tipo** — arrastrá archivos o imágenes al chat, pegá capturas de pantalla con Ctrl+V, o usá el botón de adjuntar.
- **Soporte multimodal** — mandále un diseño en imagen y RYU lo interpreta para generar el código correspondiente.
- **Dos modelos según la tarea** — Haiku para consultas rápidas y económicas, Sonnet para tareas complejas que requieren razonamiento profundo.
- **Pipeline visible** — sabés exactamente en qué paso está: Analizando → Generando → Verificando → Listo.
- **Bloques de código colapsables** — RYU explica con palabras lo que hizo primero, y el código queda en un bloque desplegable para no saturar el chat.
- **Privado por diseño** — la API key se guarda localmente en tu equipo. Nada pasa por servidores intermedios.

---

## Requisitos

- Windows 10 / 11 (x64)
- Conexión a internet
- **API Key de Anthropic** — la conseguís en [console.anthropic.com](https://console.anthropic.com)

---

## Instalación

1. Descargá el ZIP desde [Releases](../../releases/latest): `RYU-win32-x64.zip`
2. Descomprimí en cualquier carpeta
3. Ejecutá `RYU.exe`
4. En el primer inicio completás el onboarding — menos de un minuto

No requiere instalación, no pide permisos de administrador, no instala dependencias externas.

---

## Para desarrolladores

### Requisitos previos

- [Node.js 20+ LTS](https://nodejs.org/)
- npm 10+

### Levantar el proyecto

```bash
git clone https://github.com/straaizo/ryu.git
cd ryu
npm install
npm start
```

### Generar el ZIP portable

```bash
npm run make
```

El resultado queda en `out/make/zip/win32/x64/RYU-win32-x64.zip`.

---

## Estructura del proyecto

```
ryu/
├── electron/
│   ├── main.js          # proceso principal, IPC, sistema de archivos
│   └── preload.js       # bridge seguro renderer ↔ main
├── src/
│   ├── components/
│   │   ├── Chat.jsx             # pantalla principal del chat
│   │   ├── ErrorBoundary.jsx    # manejo de errores de React
│   │   ├── Message.jsx          # renderizado con bloques colapsables
│   │   ├── Onboarding.jsx       # configuración inicial
│   │   ├── Sidebar.jsx          # árbol de archivos del proyecto
│   │   └── TokenCounter.jsx     # contador de tokens y costo
│   ├── hooks/
│   │   ├── useAnthropicAPI.js   # lógica de IA y pipeline
│   │   ├── usePersistence.js    # perfil y sesión con electron-store
│   │   └── useProjectIndex.js  # indexación del proyecto
│   └── styles/globals.css
├── assets/
│   └── icon.ico
├── forge.config.js
└── package.json
```

---

## Cómo se usa

### Cargar un proyecto

Hacé clic en **📁 Proyecto** en el header o presioná `Ctrl+O`. RYU indexa todos los archivos relevantes y los usa como contexto en cada mensaje.

### Adjuntar archivos

| Método | Descripción |
|---|---|
| Drag & drop | Arrastrá archivos o imágenes directo al área del chat |
| Botón 📎 | Abre un diálogo para seleccionar múltiples archivos |
| Ctrl+V | Pegá imágenes del portapapeles directamente |

Límite: 5 archivos por mensaje.

### Confirmar cambios

Cuando RYU genera modificaciones en archivos, aparece un modal con la vista previa de cada uno. Podés elegir qué guardar antes de confirmar.

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
- Los mensajes van **directamente** a la API de Anthropic — sin servidores intermedios
- RYU no recopila ni envía telemetría de ningún tipo

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Escritorio | Electron 31 |
| Interfaz | React 18 + Vite 5 |
| Inteligencia Artificial | Anthropic SDK (`claude-haiku-4-5`, `claude-sonnet-4-6`) |
| Persistencia | electron-store |
| Build | electron-forge + maker-zip |

---

## Licencia

Copyright (c) 2026 Enzo Sabattini

Este software se distribuye **gratuitamente para uso personal y educativo**.

**Queda prohibido cualquier uso comercial.** No podés vender, licenciar ni utilizar este software o cualquier trabajo derivado con fines comerciales o de lucro.

La redistribución en cualquier formato está permitida siempre que se mantenga este aviso de copyright y los términos de licencia intactos.

Este software se entrega "tal cual", sin garantías de ningún tipo.

---

<div align="center">
  <sub>Creado por <a href="https://github.com/straaizo">Enzo Sabattini</a> · impulsado por <a href="https://anthropic.com">Claude</a></sub>
</div>
