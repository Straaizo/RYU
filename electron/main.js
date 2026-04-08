const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');


// ── Manejo global de errores no capturados ─────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err);
  dialog.showErrorBox(
    'RYU — Error inesperado',
    `Ocurrió un error no controlado:\n\n${err.message}\n\nLa aplicación intentará continuar.`
  );
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
});

// ── Store ─────────────────────────────────────────────────────────
let Store;
let store;

async function initStore() {
  Store = (await import('electron-store')).default;
  try {
    store = new Store();
    // Verificar integridad básica
    store.get('_health_check_', null);
  } catch (err) {
    // Store corrupto — respaldar y recrear
    console.error('[store] corrupto, recreando:', err.message);
    const storePath = path.join(app.getPath('userData'), 'config.json');
    const backup = storePath.replace('.json', `.backup-${Date.now()}.json`);
    try { fs.renameSync(storePath, backup); } catch {}
    store = new Store();
    dialog.showMessageBox({
      type: 'warning',
      title: 'RYU — Configuración reiniciada',
      message: 'La configuración estaba dañada y fue reiniciada.\nDeberás volver a ingresar tu API key.',
      buttons: ['OK'],
    });
  }
}

// ── Ventana principal ─────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Mostrar ventana al terminar de cargar — más confiable que ready-to-show en builds
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Error al cargar el HTML (ej: path incorrecto en el .exe instalado)
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDesc, url) => {
    console.error('[renderer] did-fail-load', errorCode, errorDesc, url);
    dialog.showErrorBox(
      'RYU — Error al cargar',
      `No se pudo cargar la interfaz (${errorCode}: ${errorDesc}).\n\nIntentá reinstalar la aplicación.`
    );
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Renderer crash → recargar automáticamente
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer] crash:', details.reason);
    if (details.reason !== 'clean-exit') {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'error',
        title: 'RYU — El renderer se cerró',
        message: `La ventana se cerró inesperadamente (${details.reason}).\n¿Deseas recargar?`,
        buttons: ['Recargar', 'Cerrar'],
        defaultId: 0,
      });
      if (choice === 0) mainWindow.reload();
      else mainWindow.close();
    }
  });

  // Evitar navegación externa accidental
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Abrir links externos en el browser del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('ready', async () => {
  await initStore();
  registerIpcHandlers();
  createWindow();
  buildMenu();
});

// ── Menú de la aplicación ─────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Abrir Proyecto...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open-folder'),
        },
        {
          label: 'Adjuntar Archivos...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow?.webContents.send('menu:pick-files'),
        },
        { type: 'separator' },
        {
          label: 'Reindexar Proyecto',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.send('menu:reindex'),
        },
        { type: 'separator' },
        {
          label: 'Limpiar Historial',
          accelerator: 'CmdOrCtrl+L',
          click: () => mainWindow?.webContents.send('menu:clear'),
        },
        { type: 'separator' },
        { label: 'Salir', accelerator: 'Alt+F4', role: 'quit' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar Todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla Completa' },
        { role: 'toggleDevTools', label: 'Herramientas Dev' },
      ],
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Maximizar' },
        { role: 'close', label: 'Cerrar' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Constantes de indexación (igual que ryu.py) ───────────────────
const CARPETAS_IGNORADAS = new Set([
  'node_modules', '__pycache__', '.git', 'venv', '.venv',
  'env', 'build', 'dist', '.next', '.nuxt', 'out', 'target',
  'bin', 'obj', '.idea', '.vscode', 'coverage', '.gradle',
  '.dart_tool', '.flutter-plugins', '.flutter-plugins-dependencies',
  'migrations', '.mypy_cache', '.pytest_cache',
]);

const ARCHIVOS_IGNORADOS = new Set([
  'package-lock.json', 'yarn.lock', 'poetry.lock',
  'Pipfile.lock', 'pubspec.lock', '.DS_Store', 'Thumbs.db',
]);

const ARCHIVOS_PRIORITARIOS = new Set([
  'main.py', 'app.py', 'run.py', 'run_dev.py', 'server.py',
  'main.dart', 'index.js', 'index.ts', 'app.js', 'app.ts',
  'package.json', 'pubspec.yaml', 'requirements.txt',
  'pyproject.toml', '.env.example', 'README.md',
  'settings.py', 'config.py', 'database.py', 'db.py',
  'models.py', 'schemas.py', 'routes.py', 'router.py',
]);

const CARPETAS_PRIORITARIAS = new Set([
  'routers', 'routes', 'router', 'models', 'schemas',
  'services', 'controllers', 'views', 'api', 'lib',
  'src', 'app', 'core', 'utils', 'helpers',
]);

const EXTENSIONES_CODIGO = new Set([
  '.py', '.dart', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.java', '.go', '.rs', '.cpp', '.c', '.h', '.cc', '.hh',
  '.php', '.rb', '.kt', '.swift', '.vue', '.svelte', '.astro',
  '.cs', '.fs', '.ex', '.exs', '.hs', '.clj', '.scala', '.lua',
  '.r', '.m', '.mm', '.zig', '.nim',
]);

const EXTENSIONES_CONFIG = new Set([
  '.json', '.json5', '.jsonc',
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.config',
  '.env', '.env.local', '.env.example', '.env.production', '.env.development',
  '.html', '.htm', '.xhtml',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.md', '.mdx', '.rst', '.txt',
  '.sql', '.prisma', '.graphql', '.gql',
  '.xml', '.csv', '.tsv',
  '.bat', '.sh', '.bash', '.zsh', '.fish', '.ps1',
  '.lock', '.dockerfile', '.dockerignore',
  '.htaccess', '.nginx',
  '.gradle', '.properties',
  '.tf', '.tfvars',    // Terraform
  '.proto',            // Protobuf
  '.editorconfig',
]);

// Dotfiles sin extensión que siempre se incluyen
const DOTFILES_PERMITIDOS = new Set([
  '.gitignore', '.gitattributes', '.gitmodules',
  '.dockerignore', '.npmignore', '.eslintignore',
  '.eslintrc', '.prettierrc', '.babelrc', '.browserslistrc',
  '.env', '.envrc',
  '.htaccess', '.editorconfig',
  'dockerfile', 'makefile', 'rakefile', 'procfile',
  'gemfile', 'pipfile', 'brewfile',
  'readme', 'license', 'changelog', 'authors', 'contributing',
]);

const EXTENSIONES_PERMITIDAS = new Set([...EXTENSIONES_CODIGO, ...EXTENSIONES_CONFIG]);
// Sin límite de contexto — incluir TODOS los archivos del proyecto
const MAX_TAMANO_ARCHIVO = 200 * 1024;

// ── Indexación de proyecto ────────────────────────────────────────
function indexarProyecto(rutaBase) {
  const resultado = {
    ruta_base: rutaBase,
    archivos_leidos: [],
    estructura: [],
    ignorados: 0,
    total: 0,
  };

  let totalChars = 0;
  const candidatos = [];

  function recorrer(dirPath) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!CARPETAS_IGNORADAS.has(entry.name)) {
          recorrer(fullPath);
        }
      } else if (entry.isFile()) {
        const relPath = path.relative(rutaBase, fullPath);
        const parts = relPath.split(path.sep);
        const ext = path.extname(entry.name).toLowerCase();

        if (parts.some(p => CARPETAS_IGNORADAS.has(p))) {
          resultado.ignorados++;
          continue;
        }
        if (ARCHIVOS_IGNORADOS.has(entry.name)) {
          resultado.ignorados++;
          continue;
        }
        // Permitir: extensiones conocidas O dotfiles (.gitignore, etc.) O archivos sin ext conocidos
        const esDotfile = !ext && DOTFILES_PERMITIDOS.has(entry.name.toLowerCase());
        const esConocido = EXTENSIONES_PERMITIDAS.has(ext);
        if (!esConocido && !esDotfile) {
          resultado.ignorados++;
          continue;
        }

        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_TAMANO_ARCHIVO) {
            resultado.ignorados++;
            continue;
          }
        } catch {
          continue;
        }

        resultado.total++;

        let prioridad = 0;
        if (ARCHIVOS_PRIORITARIOS.has(entry.name)) prioridad += 100;
        if (parts.some(p => CARPETAS_PRIORITARIAS.has(p))) prioridad += 50;
        if (EXTENSIONES_CODIGO.has(ext)) prioridad += 20;
        if (EXTENSIONES_CONFIG.has(ext)) prioridad += 10;
        prioridad -= parts.length * 2;

        candidatos.push({ prioridad, fullPath, relPath });
      }
    }
  }

  recorrer(rutaBase);
  candidatos.sort((a, b) => b.prioridad - a.prioridad);

  // Incluir TODOS los archivos sin límite de contexto
  for (const { fullPath, relPath } of candidatos) {
    try {
      const contenido = fs.readFileSync(fullPath, { encoding: 'utf8', flag: 'r' });
      resultado.archivos_leidos.push({
        ruta: relPath.replace(/\\/g, '/'),
        ruta_abs: fullPath,
        contenido,
      });
      resultado.estructura.push(relPath.replace(/\\/g, '/'));
      totalChars += contenido.length;
    } catch {
      continue;
    }
  }

  return resultado;
}

// ── IPC Handlers ─────────────────────────────────────────────────
function registerIpcHandlers() {
  // Store
  ipcMain.handle('store:get', (_e, key) => store.get(key));
  ipcMain.handle('store:set', (_e, key, value) => { store.set(key, value); });
  ipcMain.handle('store:delete', (_e, key) => { store.delete(key); });

  // Seleccionar carpeta
  ipcMain.handle('fs:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Seleccionar proyecto',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Seleccionar archivos (para el botón 📎 y el menú)
  ipcMain.handle('fs:select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: 'Adjuntar archivos',
      filters: [
        { name: 'Todos los archivos', extensions: ['*'] },
        { name: 'Código', extensions: ['py','js','jsx','ts','tsx','mjs','dart','java','go','rs','cpp','c','h','php','rb','kt','swift','vue','svelte','cs','lua'] },
        { name: 'Web', extensions: ['html','htm','css','scss','sass','less'] },
        { name: 'Config / Data', extensions: ['json','yaml','yml','toml','ini','cfg','conf','env','md','txt','sql','xml','csv','sh','bat','ps1','prisma','graphql'] },
        { name: 'Imágenes', extensions: ['png','jpg','jpeg','gif','webp','bmp','svg'] },
      ],
    });
    if (result.canceled) return [];
    // Devolver { path, name, content/data } para cada archivo
    const archivos = [];
    for (const filePath of result.filePaths) {
      const name = path.basename(filePath);
      const ext = path.extname(name).slice(1).toLowerCase();
      const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','svg']);
      try {
        if (IMAGE_EXTS.has(ext)) {
          const data = fs.readFileSync(filePath);
          archivos.push({ path: filePath, name, ext, tipo: 'imagen', data: data.toString('base64') });
        } else {
          const contenido = fs.readFileSync(filePath, 'utf8');
          archivos.push({ path: filePath, name, ext, tipo: 'archivo', contenido, lineas: contenido.split('\n').length });
        }
      } catch { /* skip */ }
    }
    return archivos;
  });

  // Indexar proyecto
  ipcMain.handle('fs:index-project', (_e, rutaBase) => {
    try {
      return indexarProyecto(rutaBase);
    } catch (err) {
      throw new Error('Error indexando proyecto: ' + err.message);
    }
  });

  // Leer archivo
  ipcMain.handle('fs:read-file', (_e, filePath) => {
    try {
      return fs.readFileSync(filePath, { encoding: 'utf8' });
    } catch (err) {
      throw new Error('Error leyendo archivo: ' + err.message);
    }
  });

  // Escribir archivo (crea directorios si no existen)
  ipcMain.handle('fs:write-file', (_e, filePath, content) => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, { encoding: 'utf8' });
      return true;
    } catch (err) {
      throw new Error('Error escribiendo archivo: ' + err.message);
    }
  });

  // Verificar si existe
  ipcMain.handle('fs:exists', (_e, p) => {
    return fs.existsSync(p);
  });

  // Llamada a la API de Anthropic
  ipcMain.handle('anthropic:call', async (_e, { messages, system, model, maxTokens }) => {
    const apiKey = store.get('apiKey');
    if (!apiKey) throw new Error('API key no configurada. Ve a ⚙ Perfil para configurarla.');

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey, maxRetries: 2 });

    let response;
    try {
      response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages,
      });
    } catch (err) {
      // Mensajes de error amigables según el código HTTP
      const status = err.status || err.statusCode;
      if (status === 401) throw new Error('API key inválida o revocada. Actualizala en ⚙ Perfil.');
      if (status === 403) throw new Error('Sin acceso al modelo. Verifica tu plan en console.anthropic.com');
      if (status === 429) throw new Error('Límite de requests alcanzado. Esperá unos segundos e intentá de nuevo.');
      if (status === 500 || status === 529) throw new Error('Servicio de Anthropic no disponible temporalmente. Intentá en unos minutos.');
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') throw new Error('Sin conexión a internet. Verificá tu red.');
      throw new Error(err.message || 'Error de API desconocido.');
    }

    if (!response.content || !response.content[0]) {
      throw new Error('Respuesta vacía de la API. Intentá de nuevo.');
    }

    return {
      text: response.content[0].text,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  });

  // Test de API key
  ipcMain.handle('anthropic:test-key', async (_e, apiKey) => {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey, maxRetries: 0 });
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return { ok: true };
    } catch (err) {
      const status = err.status || err.statusCode;
      let msg = err.message;
      if (status === 401) msg = 'API key inválida o revocada.';
      else if (status === 403) msg = 'Sin acceso. Verifica tu plan en console.anthropic.com';
      else if (err.code === 'ENOTFOUND') msg = 'Sin conexión a internet.';
      return { ok: false, error: msg };
    }
  });

  // Abrir carpeta en explorador
  ipcMain.handle('shell:open-folder', (_e, folderPath) => {
    shell.openPath(folderPath);
  });
}
