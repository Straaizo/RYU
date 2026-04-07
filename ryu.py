import os
import sys
import json
import time
import re
import subprocess
import tempfile
from pathlib import Path
from dotenv import load_dotenv, set_key
import anthropic

load_dotenv()

DIR_BASE    = Path(__file__).parent
PERFIL_JSON = DIR_BASE / "perfil.json"
ENV_FILE    = DIR_BASE / ".env"


# ═══════════════════════════════════════════
#  COLORES ANSI
# ═══════════════════════════════════════════
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    CYAN    = "\033[96m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    RED     = "\033[91m"
    GRAY    = "\033[90m"
    WHITE   = "\033[97m"
    MAGENTA = "\033[95m"


# ═══════════════════════════════════════════
#  UTILIDADES
# ═══════════════════════════════════════════
def limpiar_pantalla():
    os.system("cls" if os.name == "nt" else "clear")


def escribir_lento(texto, delay=0.02):
    for char in texto:
        print(char, end="", flush=True)
        time.sleep(delay)
    print()


def separador(color=None):
    color = color or C.CYAN
    print(f"{color}{'─' * 50}{C.RESET}")


def cargar_perfil():
    if PERFIL_JSON.exists():
        with open(PERFIL_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def guardar_perfil(perfil):
    with open(PERFIL_JSON, "w", encoding="utf-8") as f:
        json.dump(perfil, f, ensure_ascii=False, indent=2)


# ═══════════════════════════════════════════
#  VERIFICACION DE CODIGO ANTES DE ENTREGAR
# ═══════════════════════════════════════════

def verificar_python(codigo):
    """Verifica sintaxis Python antes de entregar el codigo."""
    try:
        import ast as _ast
        _ast.parse(codigo)
        return True, None
    except SyntaxError as e:
        return False, "SyntaxError linea " + str(e.lineno) + ": " + str(e.msg)


def verificar_javascript(codigo):
    """Verifica JS/TS con node --check si esta disponible."""
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
            f.write(codigo)
            tmp = f.name
        resultado = subprocess.run(
            ['node', '--check', tmp],
            capture_output=True, text=True, timeout=10
        )
        os.unlink(tmp)
        if resultado.returncode != 0:
            return False, resultado.stderr.strip()
        return True, None
    except Exception:
        return True, None  # Si node no está disponible, pasar igual


def verificar_codigo(contenido, extension):
    """Verifica el codigo segun su extension."""
    ext = extension.lower().lstrip('.')
    if ext == 'py':
        return verificar_python(contenido)
    elif ext in ('js', 'jsx', 'ts', 'tsx'):
        return verificar_javascript(contenido)
    return True, None  # Otros tipos no se verifican


def verificar_bloques_en_respuesta(respuesta):
    """
    Verifica todos los bloques de codigo en la respuesta antes de mostrarlos.
    Retorna lista de errores encontrados.
    """
    errores = []
    partes = respuesta.split("===ARCHIVO_MODIFICADO===")
    for parte in partes[1:]:
        if "===FIN_ARCHIVO===" not in parte:
            continue
        bloque = parte.split("===FIN_ARCHIVO===")[0]

        ruta_str = ""
        for linea in bloque.strip().split("\n"):
            if linea.startswith("RUTA:"):
                ruta_str = linea.replace("RUTA:", "").strip()
                break

        import re as _re
        codigo_match = _re.search(r"```(\w+)?\n(.*?)```", bloque, _re.DOTALL)
        if not codigo_match:
            continue

        ext      = codigo_match.group(1) or ""
        contenido = codigo_match.group(2)

        ok, error = verificar_codigo(contenido, ext)
        if not ok:
            errores.append({
                "archivo": ruta_str or "archivo",
                "error":   error,
            })

    return errores


# ═══════════════════════════════════════════
#  INDEXACIÓN INTELIGENTE
# ═══════════════════════════════════════════
CARPETAS_IGNORADAS = {
    "node_modules", "__pycache__", ".git", "venv", ".venv",
    "env", "build", "dist", ".next", ".nuxt", "out", "target",
    "bin", "obj", ".idea", ".vscode", "coverage", ".gradle",
    ".dart_tool", ".flutter-plugins", ".flutter-plugins-dependencies",
    "migrations", ".mypy_cache", ".pytest_cache",
}

ARCHIVOS_IGNORADOS = {
    "package-lock.json", "yarn.lock", "poetry.lock",
    "Pipfile.lock", "pubspec.lock", ".DS_Store", "Thumbs.db",
}

ARCHIVOS_PRIORITARIOS = {
    "main.py", "app.py", "run.py", "run_dev.py", "server.py",
    "main.dart", "index.js", "index.ts", "app.js", "app.ts",
    "package.json", "pubspec.yaml", "requirements.txt",
    "pyproject.toml", ".env.example", "README.md",
    "settings.py", "config.py", "database.py", "db.py",
    "models.py", "schemas.py", "routes.py", "router.py",
}

CARPETAS_PRIORITARIAS = {
    "routers", "routes", "router", "models", "schemas",
    "services", "controllers", "views", "api", "lib",
    "src", "app", "core", "utils", "helpers",
}

EXTENSIONES_CODIGO = {
    ".py", ".dart", ".js", ".ts", ".jsx", ".tsx",
    ".java", ".go", ".rs", ".cpp", ".c", ".h",
    ".php", ".rb", ".kt", ".swift", ".vue", ".svelte",
}

EXTENSIONES_CONFIG = {
    ".json", ".yaml", ".yml", ".toml", ".env",
    ".html", ".css", ".scss", ".sass",
    ".md", ".txt", ".sql", ".xml", ".csv", ".bat", ".sh",
}

EXTENSIONES_PERMITIDAS = EXTENSIONES_CODIGO | EXTENSIONES_CONFIG

MAX_TAMANO_ARCHIVO = 20 * 1024
MAX_CHARS_CONTEXTO = 8_000
MODELO_DEFAULT = "claude-haiku-4-5-20251001"


def indexar_proyecto(ruta_base):
    print(f"\n{C.CYAN}  Indexando proyecto...{C.RESET}", flush=True)

    resultado = {
        "ruta_base":       str(ruta_base),
        "archivos_leidos": [],
        "estructura":      [],
        "ignorados":       0,
        "total":           0,
    }

    total_chars = 0
    candidatos  = []

    for ruta in ruta_base.rglob("*"):
        if not ruta.is_file():
            continue
        partes = ruta.relative_to(ruta_base).parts
        if any(p in CARPETAS_IGNORADAS for p in partes):
            resultado["ignorados"] += 1
            continue
        if ruta.name in ARCHIVOS_IGNORADOS:
            resultado["ignorados"] += 1
            continue
        ext = ruta.suffix.lower()
        if ext not in EXTENSIONES_PERMITIDAS:
            resultado["ignorados"] += 1
            continue
        try:
            if ruta.stat().st_size > MAX_TAMANO_ARCHIVO:
                resultado["ignorados"] += 1
                continue
        except Exception:
            continue

        resultado["total"] += 1

        prioridad = 0
        if ruta.name in ARCHIVOS_PRIORITARIOS:
            prioridad += 100
        if any(p in CARPETAS_PRIORITARIAS for p in partes):
            prioridad += 50
        if ext in EXTENSIONES_CODIGO:
            prioridad += 20
        if ext in EXTENSIONES_CONFIG:
            prioridad += 10
        prioridad -= len(partes) * 2

        candidatos.append((prioridad, ruta))

    candidatos.sort(key=lambda x: x[0], reverse=True)

    for _, ruta in candidatos:
        if total_chars >= MAX_CHARS_CONTEXTO:
            break
        try:
            contenido = ruta.read_text(encoding="utf-8", errors="ignore")
            ruta_rel  = str(ruta.relative_to(ruta_base))
            resultado["archivos_leidos"].append({
                "ruta":      ruta_rel,
                "ruta_abs":  str(ruta),
                "contenido": contenido,
            })
            resultado["estructura"].append(ruta_rel)
            total_chars += len(contenido)
        except Exception:
            continue

    leidos = len(resultado["archivos_leidos"])
    print(f"  {C.GREEN}✓ {leidos} archivos indexados{C.RESET} "
          f"{C.GRAY}({resultado['ignorados']} ignorados){C.RESET}\n")
    return resultado


def contexto_a_texto(indice):
    if not indice:
        return "Sin proyecto activo."

    lineas = [
        "PROYECTO ACTIVO: " + indice["ruta_base"],
        "Archivos (" + str(len(indice["archivos_leidos"])) + "):",
        "",
        "ESTRUCTURA:",
    ]
    for r in indice["estructura"]:
        lineas.append("  " + r)

    lineas.append("")
    lineas.append("CONTENIDO:")
    lineas.append("")

    for arch in indice["archivos_leidos"]:
        ext = Path(arch["ruta"]).suffix.lstrip(".")
        lineas.append("--- " + arch["ruta_abs"] + " ---")
        lineas.append("```" + ext)
        # Mandar solo primeras 30 líneas para ahorrar tokens
        lineas_archivo = arch["contenido"].split("\n")
        if len(lineas_archivo) > 30:
            lineas.append("\n".join(lineas_archivo[:30]))
            lineas.append("# ... (" + str(len(lineas_archivo)) + " lineas totales, truncado)")
        else:
            lineas.append(arch["contenido"])
        lineas.append("```")
        lineas.append("")

    return "\n".join(lineas)


# ═══════════════════════════════════════════
#  BANNERS
# ═══════════════════════════════════════════
BANNER_BIENVENIDA = (
    "\n"
    + C.CYAN
    + "╔══════════════════════════════════════════════╗\n"
    + "║                                              ║ \n"
    + "║   " + C.GRAY + " CREADO        POR         STRAAIZO " + C.CYAN + "       ║\n"
    + "║                                              ║\n"
    + "║        ██████╗ ██╗   ██╗██╗   ██╗            ║\n"
    + "║        ██╔══██╗╚██╗ ██╔╝██║   ██║            ║\n"
    + "║        ██████╔╝ ╚████╔╝ ██║   ██║            ║\n"
    + "║        ██╔══██╗  ╚██╔╝  ██║   ██║            ║\n"
    + "║        ██║  ██║   ██║   ╚██████╔╝            ║\n"
    + "║        ╚═╝  ╚═╝   ╚═╝    ╚═════╝             ║\n"
    + "║                                              ║\n"
    + "║" + C.WHITE + "        Asistente de Programación" + C.CYAN + "             ║\n"
    + "║" + C.GRAY + "             powered by Claude" + C.CYAN + "                ║\n"
    + "╚══════════════════════════════════════════════╝"
    + C.RESET + "\n"
)

COMANDOS = (
    "\n"
    + C.YELLOW
    + "╔══════════════════════════════════════════════╗\n"
    + "║  COMANDOS                                    ║\n"
    + "║  /salir       → Cerrar RYU                   ║\n"
    + "║  /limpiar     → Limpiar historial            ║\n"
    + "║  /proyecto    → Ver archivos indexados       ║\n"
    + "║  /reindexar   → Reindexar proyecto activo    ║\n"
+ "║  /tokens      → Ver uso de tokens sesion     ║\n"
+ "║  /sonnet      → Modo complejo (mas tokens)   ║\n"
+ "║  /haiku       → Modo rapido (menos tokens)   ║\n"
    + "║  /perfil      → Ver tu perfil                ║\n"
    + "║  /ayuda       → Ver comandos                 ║\n"
    + "║                                              ║\n"
    + "║  CARGAR PROYECTO                             ║\n"
    + "║  Pega la ruta de una carpeta y RYU           ║\n"
    + "║  la indexa y lee automaticamente             ║\n"
    + "║                                              ║\n"
    + "║  CREAR PROYECTO                              ║\n"
    + '║  "crea un proyecto [descripcion]"            ║\n'
    + "╚══════════════════════════════════════════════╝"
    + C.RESET + "\n"
)


# ═══════════════════════════════════════════
#  ONBOARDING
# ═══════════════════════════════════════════
def onboarding():
    limpiar_pantalla()
    print(BANNER_BIENVENIDA)
    time.sleep(0.5)
    escribir_lento(C.CYAN + "Hola! Soy RYU, tu asistente de programacion personal." + C.RESET, 0.03)
    escribir_lento(C.GRAY + "Antes de empezar necesito conocerte un poco..." + C.RESET, 0.03)
    print()

    separador(C.YELLOW)
    print(C.YELLOW + C.BOLD + "  PASO 1 — API Key de Anthropic" + C.RESET)
    separador(C.YELLOW)
    print(C.GRAY + "  Necesitas una API key para que funcione.")
    print("  Creala en: " + C.CYAN + "https://console.anthropic.com" + C.RESET)
    print(C.GRAY + "  (Empieza con 'sk-ant-...')" + C.RESET + "\n")

    while True:
        api_key = input("  " + C.WHITE + "Pega tu API key: " + C.RESET).strip()
        if api_key.startswith("sk-ant-") and len(api_key) > 20:
            break
        print("  " + C.RED + "Debe empezar con 'sk-ant-'" + C.RESET)

    ENV_FILE.touch(exist_ok=True)
    set_key(str(ENV_FILE), "ANTHROPIC_API_KEY", api_key)
    print("  " + C.GREEN + "✓ API key guardada" + C.RESET + "\n")

    print("  " + C.GRAY + "Verificando conexion..." + C.RESET, end="", flush=True)
    try:
        client_test = anthropic.Anthropic(api_key=api_key)
        client_test.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{"role": "user", "content": "hola"}]
        )
        print("\r  " + C.GREEN + "✓ Conexion exitosa" + C.RESET + "           \n")
    except Exception:
        print("\r  " + C.RED + "✗ API key invalida. Verifica en console.anthropic.com" + C.RESET + "\n")
        input("  Presiona Enter para salir...")
        sys.exit(1)

    separador(C.CYAN)
    print(C.CYAN + C.BOLD + "  PASO 2 — Como te llamas?" + C.RESET)
    separador(C.CYAN)
    nombre = input("\n  " + C.WHITE + "Tu nombre: " + C.RESET).strip() or "Dev"
    print("  " + C.GREEN + "✓ Hola, " + nombre + "!" + C.RESET + "\n")

    separador(C.MAGENTA)
    print(C.MAGENTA + C.BOLD + "  PASO 3 — Con que tecnologias trabajas?" + C.RESET)
    separador(C.MAGENTA)
    print(C.GRAY + "  Ejemplos: Python, JavaScript, React (separa con comas)" + C.RESET + "\n")
    stack_raw = input("  " + C.WHITE + "Tu stack: " + C.RESET).strip()
    stack = [s.strip() for s in stack_raw.split(",") if s.strip()] or ["Python"]
    print("  " + C.GREEN + "✓ Stack: " + ", ".join(stack) + C.RESET + "\n")

    separador(C.YELLOW)
    print(C.YELLOW + C.BOLD + "  PASO 4 — Cual es tu rol?" + C.RESET)
    separador(C.YELLOW)
    print(C.GRAY + "  Ejemplo: Backend Developer, Estudiante, Full Stack" + C.RESET + "\n")
    rol = input("  " + C.WHITE + "Tu rol: " + C.RESET).strip() or "Desarrollador"
    print("  " + C.GREEN + "✓ Rol: " + rol + C.RESET + "\n")

    separador(C.CYAN)
    print(C.CYAN + C.BOLD + "  PASO 5 — Tienes proyectos activos? (opcional)" + C.RESET)
    separador(C.CYAN)
    print(C.GRAY + "  Ejemplo: API REST en FastAPI, App movil en Flutter")
    print("  (Enter para omitir)" + C.RESET + "\n")
    proyectos = input("  " + C.WHITE + "Tus proyectos: " + C.RESET).strip() or "Sin proyectos definidos"
    print("  " + C.GREEN + "✓ Registrado" + C.RESET + "\n")

    separador(C.MAGENTA)
    print(C.MAGENTA + C.BOLD + "  PASO 6 — Idioma de las respuestas?" + C.RESET)
    separador(C.MAGENTA)
    print("  " + C.WHITE + "1" + C.RESET + " → Español  |  " + C.WHITE + "2" + C.RESET + " → English\n")
    idioma = "english" if input("  " + C.WHITE + "Elige (1/2): " + C.RESET).strip() == "2" else "español"
    print("  " + C.GREEN + "✓ Idioma: " + idioma + C.RESET + "\n")

    perfil = {
        "nombre":    nombre,
        "stack":     stack,
        "rol":       rol,
        "proyectos": proyectos,
        "idioma":    idioma,
    }
    guardar_perfil(perfil)

    limpiar_pantalla()
    print(BANNER_BIENVENIDA)
    print(C.GREEN + "  ✓ Perfil configurado. ¡Todo listo, " + nombre + "! 🚀" + C.RESET + "\n")
    time.sleep(1)
    return perfil


# ═══════════════════════════════════════════
#  SYSTEM PROMPT
# ═══════════════════════════════════════════
def construir_system_prompt(perfil, indice_proyecto, incluir_archivos=True):
    stack_str = ", ".join(perfil.get("stack", ["Python"]))
    idioma    = perfil.get("idioma", "español")
    nombre    = perfil.get("nombre", "Dev")
    rol       = perfil.get("rol", "Desarrollador")
    proyectos = perfil.get("proyectos", "Sin proyectos")
    # Solo incluir contenido de archivos si se solicita explicitamente
    if indice_proyecto and incluir_archivos:
        ctx = contexto_a_texto(indice_proyecto)
    elif indice_proyecto:
        # Solo mandar estructura, no el contenido
        ctx = "PROYECTO: " + indice_proyecto["ruta_base"] + "\n"
        ctx += "Estructura:\n" + "\n".join("  " + r for r in indice_proyecto["estructura"])
    else:
        ctx = "Sin proyecto activo."

    return (
        "Eres RYU, asistente personal de programacion de " + nombre + ".\n"
        "Rol: " + rol + ". Stack: " + stack_str + ". Proyectos: " + proyectos + ".\n"
        "Directo, preciso, sin rodeos. Senior dev experimentado.\n"
        "Responde siempre en " + idioma + ". Respuestas cortas salvo que se pida detalle.\n"
        "\n"
        "## Fecha actual\n"
        "Hoy es abril 2026. Usa siempre las versiones mas recientes y patrones modernos.\n"
        "\n"
        "## Stack moderno OBLIGATORIO (abril 2026)\n"
        "\n"
        "### JavaScript / React\n"
        "- React 18+: SIEMPRE createRoot, NUNCA ReactDOM.render\n"
        "- SIEMPRE functional components + hooks, NUNCA class components\n"
        "- Vite como bundler, NUNCA Create React App (obsoleto)\n"
        "- React Router v6+: useNavigate, Outlet, NUNCA history.push\n"
        "- Estado global: Zustand o Context API, NUNCA Redux para proyectos nuevos\n"
        "- Fetch API o Axios, NUNCA XMLHttpRequest\n"
        "- ESModules (import/export), NUNCA require() en frontend\n"
        "- TailwindCSS 3+ si hay estilos utilitarios\n"
        "\n"
        "### Python\n"
        "- Python 3.11+: type hints en todo, match/case cuando aplique\n"
        "- FastAPI: async/await, Pydantic v2 (model_validator, not validator)\n"
        "- NUNCA Flask para APIs nuevas, usar FastAPI\n"
        "- Pydantic v2: BaseModel, field_validator, model_config\n"
        "- SQLAlchemy 2.0+: sintaxis nueva con select(), NUNCA Query API legacy\n"
        "- uv o poetry para dependencias, NUNCA solo pip sin virtualenv\n"
        "\n"
        "### General\n"
        "- Node 20+ LTS\n"
        "- Git: conventional commits (feat:, fix:, chore:)\n"
        "- Variables de entorno: .env + python-dotenv o Vite env vars\n"
        "- NUNCA hardcodear secrets, NUNCA console.log en produccion\n"
        "\n"
        "## Reglas de comportamiento\n"
        "- Sin introducciones ni frases de relleno\n"
        "- Codigo directo con manejo de errores\n"
        "- Variables en ingles, comentarios en " + idioma + "\n"
        "- No agregar codigo extra que no se pidio\n"
        "- No hacer refactors no pedidos\n"
        "- Si hay ambiguedad en el pedido, PREGUNTAR antes de escribir codigo\n"
        "- Antes de modificar un archivo, confirmar que entiendes la estructura actual\n"
        "\n"
        "## IMPORTANTE\n"
        "Cuando hay un proyecto activo, trabajas EXCLUSIVAMENTE con los archivos de ese proyecto.\n"
        "No confundas archivos del proyecto con archivos de RYU u otros directorios.\n"
        "Siempre usa las rutas absolutas que se te proveen.\n"
        "\n"
        "## Modificar archivos\n"
        "Cuando el usuario pida modificar uno o VARIOS archivos, devuelve TODOS en la misma respuesta.\n"
        "Usa este formato por cada archivo (uno tras otro sin separacion):\n"
        "\n"
        "===ARCHIVO_MODIFICADO===\n"
        "RUTA: [ruta absoluta completa del archivo]\n"
        "```[extension]\n"
        "[contenido completo]\n"
        "```\n"
        "===FIN_ARCHIVO===\n"
        "\n"
        "REGLA CRITICA: Cuando te pidan arreglar o trabajar en multiples archivos,\n"
        "devuelve TODOS los archivos necesarios de una vez en la misma respuesta.\n"
        "PROHIBIDO: No digas voy a revisar, voy a trabajar, o cualquier frase sin codigo.\n"
        "PROHIBIDO: No hagas una tarea a la vez ni digas que continuaras despues.\n"
        "OBLIGATORIO: Cada respuesta que involucre cambios de codigo DEBE terminar\n"
        "con todos los bloques ===ARCHIVO_MODIFICADO=== necesarios.\n"
        "Si el problema requiere cambios en 5 archivos, devuelve los 5 en esta respuesta.\n"
        "\n"
        "## Crear proyectos\n"
        "Cuando pidan crear un proyecto nuevo, usa este formato:\n"
        "\n"
        "===CREAR_PROYECTO===\n"
        "RUTA_BASE: [ruta donde crear]\n"
        "\n"
        "ARCHIVO: [ruta/relativa/archivo.ext]\n"
        "```[extension]\n"
        "[contenido]\n"
        "```\n"
        "\n"
        "CARPETA: [carpeta/vacia]\n"
        "===FIN_PROYECTO===\n"
        "\n"
        "## Contexto del proyecto actual\n"
        + ctx

    )


# ═══════════════════════════════════════════
#  DETECCION DE RUTAS
# ═══════════════════════════════════════════
def limpiar_token(token):
    """Limpia comillas de un token."""
    t = token.strip()
    if len(t) >= 2 and t[0] == t[-1] and t[0] in ('"', "'"):
        t = t[1:-1]
    return t


def buscar_carpeta_en_texto(texto, excluir=None):
    """Busca una ruta de carpeta valida en el texto, soportando espacios."""
    tokens = texto.split()
    for start in range(len(tokens)):
        acum = ""
        for end in range(start, len(tokens)):
            if acum:
                acum = acum + " " + tokens[end]
            else:
                acum = tokens[end]
            candidato = limpiar_token(acum)
            try:
                r = Path(candidato)
                if r.exists() and r.is_dir():
                    if excluir is None or r != excluir:
                        return r
            except Exception:
                continue
    return None


def buscar_archivo_en_texto(texto, proyecto_activo=None):
    """Busca una ruta de archivo valida. Primero rutas absolutas, luego por nombre en proyecto."""
    tokens = texto.split()

    # 1. Buscar ruta absoluta (con posibles espacios)
    for start in range(len(tokens)):
        acum = ""
        for end in range(start, len(tokens)):
            if acum:
                acum = acum + " " + tokens[end]
            else:
                acum = tokens[end]
            candidato = limpiar_token(acum)
            try:
                r = Path(candidato)
                if r.exists() and r.is_file():
                    return r
            except Exception:
                continue

    # 2. Buscar por nombre de archivo dentro del proyecto activo
    if proyecto_activo and proyecto_activo.exists():
        pattern = r"[\w\-.]+\.(?:py|js|ts|dart|md|yaml|yml|json|html|css|txt|env|sql|java|go|rs|cpp|kt|swift|sh|bat|xml|csv)"
        nombres = re.findall(pattern, texto, re.IGNORECASE)
        for nombre in nombres:
            for candidata in proyecto_activo.rglob(nombre):
                if candidata.is_file():
                    return candidata

    return None


def leer_archivo(ruta):
    if ruta.suffix.lower() not in EXTENSIONES_PERMITIDAS:
        return None
    try:
        with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        return "Error al leer: " + str(e)


def preparar_mensaje(entrada, proyecto_activo, archivo_activo):
    ruta = buscar_archivo_en_texto(entrada, proyecto_activo)
    if ruta is None:
        return entrada

    contenido = leer_archivo(ruta)
    if contenido is None:
        return entrada + "\n\n[No puedo leer archivos '" + ruta.suffix + "']"

    archivo_activo["ruta"]      = ruta
    archivo_activo["contenido"] = contenido

    print("\n" + C.GREEN + "  ✓ Archivo cargado: " + C.BOLD + str(ruta) + C.RESET
          + " " + C.GRAY + "(" + str(len(contenido)) + " chars)" + C.RESET)

    return (
        entrada + "\n\n"
        "--- ARCHIVO CARGADO: " + str(ruta) + " ---\n"
        "```" + ruta.suffix.lstrip(".") + "\n"
        + contenido + "\n"
        "```\n"
        "--- FIN DEL ARCHIVO ---"
    )


# ═══════════════════════════════════════════
#  ESCRITURA CON CONFIRMACION
# ═══════════════════════════════════════════
def extraer_bloques_archivos(respuesta):
    """Extrae todos los bloques ARCHIVO_MODIFICADO de una respuesta."""
    bloques = []
    partes = respuesta.split("===ARCHIVO_MODIFICADO===")
    for parte in partes[1:]:  # saltear el primero que es texto antes
        if "===FIN_ARCHIVO===" not in parte:
            continue
        bloque = parte.split("===FIN_ARCHIVO===")[0]
        lineas = bloque.strip().split("\n")

        ruta_str = ""
        for linea in lineas:
            if linea.startswith("RUTA:"):
                ruta_str = linea.replace("RUTA:", "").strip()
                break

        codigo = re.search(r"```[\w]*\n(.*?)```", bloque, re.DOTALL)
        if not codigo or not ruta_str:
            continue

        bloques.append({
            "ruta":      Path(ruta_str),
            "contenido": codigo.group(1),
        })
    return bloques


def procesar_archivo_modificado(respuesta):
    if "===ARCHIVO_MODIFICADO===" not in respuesta:
        return False

    try:
        bloques = extraer_bloques_archivos(respuesta)
        if not bloques:
            return False

        total = len(bloques)

        # Mostrar resumen de todos los archivos que RYU quiere tocar
        print("\n" + C.YELLOW + "╔══════════════════════════════════════════════╗")
        if total == 1:
            print("║  RYU quiere modificar este archivo:          ║")
        else:
            print("║  RYU quiere modificar " + str(total) + " archivos:              ║")
        print("╚══════════════════════════════════════════════╝" + C.RESET)

        for i, b in enumerate(bloques, 1):
            lineas_total = len(b["contenido"].split("\n"))
            print("  " + C.CYAN + str(i) + "." + C.RESET + " " + C.WHITE + str(b["ruta"]) + C.RESET
                  + " " + C.GRAY + "(" + str(lineas_total) + " lineas)" + C.RESET)

        print()

        # Opciones de confirmacion
        if total > 1:
            print("  " + C.YELLOW + "s" + C.RESET + " → Guardar todos")
            print("  " + C.YELLOW + "n" + C.RESET + " → Descartar todos")
            print("  " + C.YELLOW + "1,2..." + C.RESET + " → Guardar archivos específicos (ej: 1,3)")
            print()

        confirmar = input("  " + C.YELLOW + "Guardar cambios? (s/n): " + C.RESET).strip().lower()

        # Determinar cuáles guardar
        if confirmar in ("s", "si", "y", "yes"):
            indices_guardar = list(range(total))
        elif confirmar in ("n", "no"):
            print("\n  " + C.GRAY + "✗ Cambios descartados" + C.RESET + "\n")
            return True
        else:
            # El usuario ingresó números específicos
            try:
                indices_guardar = [int(x.strip()) - 1 for x in confirmar.split(",")]
                indices_guardar = [i for i in indices_guardar if 0 <= i < total]
            except Exception:
                indices_guardar = []

        # Guardar los archivos seleccionados
        guardados = 0
        for i, b in enumerate(bloques):
            if i not in indices_guardar:
                print("  " + C.GRAY + "- Saltado: " + b["ruta"].name + C.RESET)
                continue

            # Mostrar preview antes de guardar
            print("\n" + C.GRAY + "  Preview: " + str(b["ruta"]) + C.RESET)
            preview = "\n".join(b["contenido"].split("\n")[:10])
            print(C.GREEN + preview + C.RESET)
            n_lineas = len(b["contenido"].split("\n"))
            if n_lineas > 10:
                print(C.GRAY + "  ... (" + str(n_lineas) + " lineas)" + C.RESET)

            b["ruta"].parent.mkdir(parents=True, exist_ok=True)
            with open(b["ruta"], "w", encoding="utf-8") as f:
                f.write(b["contenido"])
            print("  " + C.GREEN + "✓ Guardado: " + str(b["ruta"]) + C.RESET)
            guardados += 1

        print("\n  " + C.GREEN + "✓ " + str(guardados) + "/" + str(total) + " archivos guardados" + C.RESET + "\n")
        return True

    except Exception as e:
        print("\n  " + C.RED + "Error al procesar archivos: " + str(e) + C.RESET + "\n")
        return False


# ═══════════════════════════════════════════
#  CREACION DE PROYECTOS
# ═══════════════════════════════════════════
def procesar_crear_proyecto(respuesta):
    if "===CREAR_PROYECTO===" not in respuesta:
        return False
    try:
        bloque = respuesta.split("===CREAR_PROYECTO===")[1].split("===FIN_PROYECTO===")[0]
        lineas = bloque.strip().split("\n")

        ruta_base_str = ""
        for linea in lineas:
            if linea.startswith("RUTA_BASE:"):
                ruta_base_str = linea.replace("RUTA_BASE:", "").strip()
                break

        if not ruta_base_str:
            print("\n" + C.YELLOW + "  Donde quieres crear el proyecto?" + C.RESET)
            ruta_base_str = input("  " + C.WHITE + "Ruta completa: " + C.RESET).strip()

        ruta_base = Path(ruta_base_str)
        archivos  = []
        carpetas  = []
        i = 0

        while i < len(lineas):
            linea = lineas[i].strip()
            if linea.startswith("ARCHIVO:"):
                ruta_rel = linea.replace("ARCHIVO:", "").strip()
                contenido_lines = []
                i += 1
                en_bloque = False
                while i < len(lineas):
                    if lineas[i].strip().startswith("```") and not en_bloque:
                        en_bloque = True
                        i += 1
                        continue
                    elif lineas[i].strip() == "```" and en_bloque:
                        break
                    elif en_bloque:
                        contenido_lines.append(lineas[i])
                    i += 1
                archivos.append({"ruta": ruta_rel, "contenido": "\n".join(contenido_lines)})
            elif linea.startswith("CARPETA:"):
                carpetas.append(linea.replace("CARPETA:", "").strip())
            i += 1

        print("\n" + C.CYAN + "╔══════════════════════════════════════════════╗")
        print("║  RYU creara este proyecto:                   ║")
        print("╚══════════════════════════════════════════════╝" + C.RESET)
        print("\n  " + C.BOLD + "Ubicacion:" + C.RESET + " " + C.WHITE + str(ruta_base) + C.RESET + "\n")
        print("  " + C.YELLOW + "Archivos a crear:" + C.RESET)
        for arch in archivos:
            print("    " + C.GREEN + "+" + C.RESET + " " + arch["ruta"])
        for carp in carpetas:
            print("    " + C.CYAN + "+" + C.RESET + " " + carp + "/ (carpeta)")

        print()
        confirmar = input("  " + C.YELLOW + "Crear proyecto? (s/n): " + C.RESET).strip().lower()
        if confirmar not in ("s", "si", "y", "yes"):
            print("\n  " + C.GRAY + "✗ Proyecto cancelado" + C.RESET + "\n")
            return True

        for carp in carpetas:
            (ruta_base / carp).mkdir(parents=True, exist_ok=True)

        creados = 0
        for arch in archivos:
            ruta_arch = ruta_base / arch["ruta"]
            ruta_arch.parent.mkdir(parents=True, exist_ok=True)
            with open(ruta_arch, "w", encoding="utf-8") as f:
                f.write(arch["contenido"])
            print("  " + C.GREEN + "✓" + C.RESET + " " + arch["ruta"])
            creados += 1

        print("\n" + C.GREEN + "  ✓ Proyecto creado: " + str(creados) + " archivos en " + str(ruta_base) + C.RESET + "\n")
        return True
    except Exception as e:
        print("\n  " + C.RED + "Error al crear proyecto: " + str(e) + C.RESET + "\n")
        return False


# ═══════════════════════════════════════════
#  RESPUESTA FORMATEADA
# ═══════════════════════════════════════════
def imprimir_ryu(texto):
    texto_limpio = texto
    for tag in ["===ARCHIVO_MODIFICADO===", "===FIN_ARCHIVO===", "===CREAR_PROYECTO===", "===FIN_PROYECTO==="]:
        texto_limpio = texto_limpio.replace(tag, "")
    if not texto_limpio.strip():
        return

    print("\n" + C.CYAN + "─" * 50 + C.RESET)
    print(C.CYAN + C.BOLD + "RYU" + C.RESET + " " + C.GRAY + "→" + C.RESET + "\n")

    en_codigo = False
    for linea in texto_limpio.split("\n"):
        skip = any(linea.startswith(p) for p in ("RUTA:", "RUTA_BASE:", "ARCHIVO:", "CARPETA:"))
        if skip:
            continue
        if linea.startswith("```"):
            en_codigo = not en_codigo
            print(C.GREEN + linea + C.RESET)
        elif en_codigo:
            print(C.GREEN + linea + C.RESET)
        elif linea.startswith("#"):
            print(C.YELLOW + C.BOLD + linea + C.RESET)
        elif linea.startswith(("-", "*")):
            print(C.WHITE + "  " + linea + C.RESET)
        elif linea.strip() == "":
            print()
        else:
            print(C.WHITE + linea + C.RESET)

    print(C.CYAN + "─" * 50 + C.RESET)


# ═══════════════════════════════════════════
#  CHAT
# ═══════════════════════════════════════════
def llamar_api(client, system, mensajes, modelo, max_tokens=4096):
    """Llamada base a la API."""
    respuesta = client.messages.create(
        model=modelo,
        max_tokens=max_tokens,
        system=system,
        messages=mensajes,
    )
    texto = respuesta.content[0].text
    uso   = {
        "input":  respuesta.usage.input_tokens,
        "output": respuesta.usage.output_tokens,
        "total":  respuesta.usage.input_tokens + respuesta.usage.output_tokens,
    }
    return texto, uso


def chat(client, historial, mensaje, perfil, indice_proyecto, modelo_activo="claude-haiku-4-5-20251001"):
    """
    Pipeline completo antes de entregar respuesta:
    1. Entender el contexto
    2. Planificar que archivos tocar
    3. Generar codigo con stack moderno
    4. Verificar sintaxis
    5. Corregir si hay errores
    6. Entregar solo cuando esta limpio
    """
    uso_total = {"input": 0, "output": 0, "total": 0}

    # Limpiar historial inteligentemente
    # 1. Si supera 20 mensajes, mantener solo los ultimos 6
    if len(historial) > 20:
        historial[:] = historial[-6:]

    # 2. Comprimir respuestas largas de codigo en el historial
    # Las respuestas con ===ARCHIVO_MODIFICADO=== ya fueron guardadas en disco
    # No necesitamos mantener el codigo completo en el historial
    for i, msg in enumerate(historial):
        if msg["role"] == "assistant" and "===ARCHIVO_MODIFICADO===" in msg["content"]:
            # Reemplazar con resumen compacto
            n_archivos = msg["content"].count("===ARCHIVO_MODIFICADO===")
            historial[i] = {
                "role": "assistant",
                "content": "[CODIGO GENERADO Y GUARDADO: " + str(n_archivos) + " archivo(s) modificado(s). Contenido omitido para ahorrar contexto.]"
            }
        elif msg["role"] == "assistant" and "===CREAR_PROYECTO===" in msg["content"]:
            historial[i] = {
                "role": "assistant",
                "content": "[PROYECTO CREADO. Estructura generada y guardada en disco.]"
            }

    # ── PASO 1: Contexto ─────────────────────────────
    # Primeros 4 mensajes mandan archivos completos, despues solo estructura
    incluir_archivos = len(historial) < 4
    system = construir_system_prompt(perfil, indice_proyecto, incluir_archivos)

    # ── PASO 2 y 3: Planificar + Generar ─────────────
    # Si el mensaje pide crear/modificar codigo, primero planificar
    keywords_codigo = any(w in mensaje.lower() for w in [
        "crea", "crea ", "crear", "modifica", "modifica ",
        "arregla", "arregla ", "agrega", "agrega ", "añade",
        "implementa", "haz", "haz ", "fix", "fix ",
        "build", "make", "add", "update", "change",
        "seccion", "pagina", "componente", "endpoint",
        "funcion", "clase", "ruta", "route",
    ])

    historial_trabajo = historial.copy()
    historial_trabajo.append({"role": "user", "content": mensaje})

    if keywords_codigo and indice_proyecto:
        # PASO 2: Hacer que RYU planifique primero internamente
        print("  " + C.GRAY + "[ 1/4 ] Analizando proyecto..." + C.RESET, flush=True)

        plan_system = system + (
            "\n\nTAREA ACTUAL: " + mensaje + "\n"
            "\nPRIMERO determina si esta tarea es:\n"
            "A) NUEVA: pide algo diferente a lo anterior (nuevo componente, nueva seccion, nuevo color, etc)\n"
            "B) CONTINUACION: corrige o extiende exactamente lo que acabas de hacer\n"
            "\nResponde SOLO con este formato:\n"
            "TIPO: [NUEVA o CONTINUACION]\n"
            "ARCHIVOS_A_TOCAR: [lista de rutas absolutas]\n"
            "CAMBIOS: [descripcion breve de QUE cambiar]\n"
            "STACK: [tecnologias]\n"
            "Nada mas, sin codigo todavia."
        )

        plan_texto, uso_plan = llamar_api(client, plan_system, historial_trabajo, modelo_activo, max_tokens=512)
        uso_total["input"]  += uso_plan["input"]
        uso_total["output"] += uso_plan["output"]
        uso_total["total"]  += uso_plan["total"]

        print("  " + C.GRAY + "[ 2/4 ] Generando codigo..." + C.RESET, flush=True)

        # PASO 3: Generar codigo con el plan como contexto
        # Si el plan dice NUEVA, limpiar historial antes de generar
        es_tarea_nueva = "TIPO: NUEVA" in plan_texto.upper() or "TIPO:NUEVA" in plan_texto.upper().replace(" ", "")
        if es_tarea_nueva:
            # Limpiar historial — tarea completamente nueva
            historial.clear()
            historial_trabajo = []
            print("  " + C.GRAY + "  → Tarea nueva detectada, contexto limpiado" + C.RESET, flush=True)

        gen_system = system + (
            "\n\n[TAREA ACTUAL]\n"
            "Tarea: " + mensaje + "\n"
            "\nPLAN:\n" + plan_texto +
            "\n\nGenera SOLO los cambios de esta tarea. "
            "No toques archivos fuera del plan. "
            + ("No hay tareas anteriores relevantes." if es_tarea_nueva else "Continuacion de la tarea anterior.")
        )
        historial_trabajo_gen = historial_trabajo + [{"role": "user", "content": mensaje}]
        texto, uso_gen = llamar_api(client, gen_system, historial_trabajo_gen, modelo_activo, max_tokens=6144)
        uso_total["input"]  += uso_gen["input"]
        uso_total["output"] += uso_gen["output"]
        uso_total["total"]  += uso_gen["total"]

    else:
        # Para preguntas simples, respuesta directa
        print("  " + C.GRAY + "[ ... ] Procesando..." + C.RESET, flush=True)
        texto, uso_gen = llamar_api(client, system, historial_trabajo, modelo_activo, max_tokens=4096)
        uso_total["input"]  += uso_gen["input"]
        uso_total["output"] += uso_gen["output"]
        uso_total["total"]  += uso_gen["total"]

    # ── PASO 4: Verificar ─────────────────────────────
    if "===ARCHIVO_MODIFICADO===" in texto or "===CREAR_PROYECTO===" in texto:
        print("  " + C.GRAY + "[ 3/4 ] Verificando sintaxis..." + C.RESET, flush=True)
        errores = verificar_bloques_en_respuesta(texto)

        # ── PASO 5: Corregir si hay errores ──────────
        if errores:
            print("  " + C.YELLOW + "  → Errores encontrados, corrigiendo..." + C.RESET, flush=True)

            fix_msgs = historial_trabajo + [
                {"role": "assistant", "content": texto},
                {"role": "user", "content": (
                    "[SISTEMA] Errores de sintaxis encontrados:\n"
                    + "\n".join("- " + e["archivo"] + ": " + e["error"] for e in errores)
                    + "\nCorrige TODOS y devuelve los archivos completos."
                )}
            ]
            texto, uso_fix = llamar_api(client, system, fix_msgs, modelo_activo, max_tokens=6144)
            uso_total["input"]  += uso_fix["input"]
            uso_total["output"] += uso_fix["output"]
            uso_total["total"]  += uso_fix["total"]

            errores_v2 = verificar_bloques_en_respuesta(texto)
            if not errores_v2:
                print("  " + C.GREEN + "  ✓ Corregido" + C.RESET, flush=True)
            else:
                print("  " + C.YELLOW + "  ⚠ Revisa manualmente" + C.RESET, flush=True)
        else:
            print("  " + C.GREEN + "[ 4/4 ] Codigo verificado" + C.RESET, flush=True)

    # ── PASO 6: Guardar en historial y entregar ───────
    # ── Guardar resumen inteligente en historial ─────
    # En vez de guardar el codigo completo, guardamos un resumen
    # Asi el historial es liviano pero RYU recuerda todo lo que hizo

    historial.append({"role": "user", "content": mensaje})

    if "===ARCHIVO_MODIFICADO===" in texto:
        # Extraer qué archivos modificó y qué cambió
        archivos_mod = []
        for parte in texto.split("===ARCHIVO_MODIFICADO===")[1:]:
            if "===FIN_ARCHIVO===" not in parte:
                continue
            bloque = parte.split("===FIN_ARCHIVO===")[0]
            for linea in bloque.strip().split("\n"):
                if linea.startswith("RUTA:"):
                    archivos_mod.append(linea.replace("RUTA:", "").strip())
                    break
        texto_previo = texto.split("===ARCHIVO_MODIFICADO===")[0].strip()
        resumen = (
            "[TAREA COMPLETADA] " + mensaje + "\n"
            "[ARCHIVOS MODIFICADOS]:\n"
            + "\n".join("  - " + a for a in archivos_mod) + "\n"
            "[ESTADO: guardado en disco. Esta tarea ya esta terminada.]"
        )
        contenido_historial = (texto_previo + "\n" + resumen) if texto_previo else resumen
        historial.append({"role": "assistant", "content": contenido_historial})

    elif "===CREAR_PROYECTO===" in texto:
        texto_previo = texto.split("===CREAR_PROYECTO===")[0].strip()
        resumen = (
            "[TAREA COMPLETADA] " + mensaje + "\n"
            "[ACCION]: Proyecto creado y guardado en disco.\n"
            "[ESTADO: Esta tarea ya esta terminada.]"
        )
        contenido_historial = (texto_previo + "\n" + resumen) if texto_previo else resumen
        historial.append({"role": "assistant", "content": contenido_historial})

    else:
        # Respuesta normal — guardar completa pero truncar si es muy larga
        if len(texto) > 2000:
            historial.append({"role": "assistant", "content": texto[:2000] + "\n[...truncado para ahorrar tokens]"})
        else:
            historial.append({"role": "assistant", "content": texto})

    # Limpiar historial si se acumula demasiado (mantener ultimos 8 intercambios)
    # Pero preservar siempre el primer mensaje del proyecto como ancla de contexto
    if len(historial) > 16:
        ancla = historial[:2] if len(historial) >= 2 else []
        recientes = historial[-8:]
        historial.clear()
        historial.extend(ancla)
        historial.extend(recientes)

    return texto, uso_total


# ═══════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════
def main():
    perfil  = cargar_perfil()
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not perfil or not api_key:
        perfil = onboarding()
        load_dotenv(override=True)
        api_key = os.getenv("ANTHROPIC_API_KEY")

    try:
        client = anthropic.Anthropic(api_key=api_key)
    except Exception as e:
        print("\n" + C.RED + "  Error al conectar: " + str(e) + C.RESET + "\n")
        input("Presiona Enter para salir...")
        sys.exit(1)

    nombre = perfil.get("nombre", "Dev")
    limpiar_pantalla()

    print(
        "\n" + C.CYAN
        + "╔══════════════════════════════════════════════╗\n"
        + "║        ██████╗ ██╗   ██╗██╗   ██╗            ║\n"
        + "║        ██╔══██╗╚██╗ ██╔╝██║   ██║            ║\n"
        + "║        ██████╔╝ ╚████╔╝ ██║   ██║            ║\n"
        + "║        ██╔══██╗  ╚██╔╝  ██║   ██║            ║\n"
        + "║        ██║  ██║   ██║   ╚██████╔╝            ║\n"
        + "║        ╚═╝  ╚═╝   ╚═╝    ╚═════╝             ║\n"
        + "║                                              ║\n"
        + "║" + C.WHITE + "               ¡Hola, " + nombre + "!" + C.CYAN + "                   ║\n"
        + "║" + C.WHITE + "        ¿ En que trabajamos hoy ?" + C.CYAN + "             ║\n"
        + "╚══════════════════════════════════════════════╝"
        + C.RESET + "\n"
    )
    print(COMANDOS)

    historial        = []
    proyecto_activo  = None
    indice_proyecto  = None
    archivo_activo   = {}
    modelo_activo    = "claude-haiku-4-5-20251001"
    tokens_sesion    = {"input": 0, "output": 0, "mensajes": 0}

    while True:
        try:
            if proyecto_activo:
                prompt_str = "\n" + C.GRAY + "[" + proyecto_activo.name + "]" + C.RESET + " " + C.WHITE + ">" + C.RESET + " "
            else:
                prompt_str = "\n" + C.WHITE + ">" + C.RESET + " "

            entrada = input(prompt_str).strip()

            if not entrada:
                continue

            # ── Comandos ──────────────────────────────────────
            if entrada.lower() in ("/salir", "/exit", "/quit"):
                print("\n" + C.CYAN + "╔══════════════════════════════════╗")
                print("║    Hasta luego, " + nombre + "!           ║")
                print("╚══════════════════════════════════╝" + C.RESET + "\n")
                break

            elif entrada.lower() == "/limpiar":
                historial.clear()
                proyecto_activo = None
                indice_proyecto = None
                archivo_activo.clear()
                limpiar_pantalla()
                print(C.GRAY + "  Historial, proyecto e indice limpiados" + C.RESET + "\n")
                continue

            elif entrada.lower() == "/perfil":
                print("\n  " + C.BOLD + "Nombre:" + C.RESET + " " + str(perfil.get("nombre")))
                print("  " + C.BOLD + "Rol:" + C.RESET + "    " + str(perfil.get("rol")))
                print("  " + C.BOLD + "Stack:" + C.RESET + "  " + ", ".join(perfil.get("stack", [])))
                print("  " + C.BOLD + "Idioma:" + C.RESET + " " + str(perfil.get("idioma")) + "\n")
                continue

            elif entrada.lower() == "/proyecto":
                if proyecto_activo and indice_proyecto:
                    n = len(indice_proyecto["archivos_leidos"])
                    print("\n" + C.GREEN + "  Proyecto: " + C.BOLD + str(proyecto_activo) + C.RESET)
                    print("  " + C.GRAY + str(n) + " archivos indexados:" + C.RESET)
                    for arch in indice_proyecto["archivos_leidos"]:
                        print("    " + C.GRAY + "- " + arch["ruta"] + C.RESET)
                elif proyecto_activo:
                    print("\n" + C.YELLOW + "  Proyecto: " + str(proyecto_activo) + " (sin indexar)" + C.RESET)
                else:
                    print("\n" + C.YELLOW + "  Sin proyecto activo" + C.RESET)
                continue

            elif entrada.lower() == "/reindexar":
                if proyecto_activo:
                    indice_proyecto = indexar_proyecto(proyecto_activo)
                    print("  " + C.GREEN + "✓ Proyecto reindexado" + C.RESET + "\n")
                else:
                    print("  " + C.YELLOW + "Sin proyecto activo" + C.RESET + "\n")
                continue

            elif entrada.lower() == "/tokens":
                haiku_in  = tokens_sesion["input"]  * 0.80 / 1_000_000
                haiku_out = tokens_sesion["output"] * 4.00 / 1_000_000
                costo_total = haiku_in + haiku_out
                print("\n" + C.YELLOW + "╔══════════════════════════════════════════════╗")
                print("║  USO DE TOKENS — SESION ACTUAL               ║")
                print("╚══════════════════════════════════════════════╝" + C.RESET)
                print("  " + C.BOLD + "Mensajes:" + C.RESET + "      " + str(tokens_sesion["mensajes"]))
                print("  " + C.BOLD + "Input:" + C.RESET + "         " + f'{tokens_sesion["input"]:,}' + " tokens")
                print("  " + C.BOLD + "Output:" + C.RESET + "        " + f'{tokens_sesion["output"]:,}' + " tokens")
                print("  " + C.BOLD + "Total:" + C.RESET + "         " + f'{tokens_sesion["input"] + tokens_sesion["output"]:,}' + " tokens")
                print("  " + C.BOLD + "Costo aprox:" + C.RESET + "   $" + f"{costo_total:.5f}" + " USD\n")
                continue

            elif entrada.lower() == "/sonnet":
                modelo_activo = "claude-sonnet-4-6"
                print("  " + C.MAGENTA + "✓ Modo Sonnet activado (tareas complejas, mas tokens)" + C.RESET + "\n")
                continue

            elif entrada.lower() == "/haiku":
                modelo_activo = "claude-haiku-4-5-20251001"
                print("  " + C.CYAN + "✓ Modo Haiku activado (rapido, menos tokens)" + C.RESET + "\n")
                continue

            elif entrada.lower() == "/ayuda":
                print(COMANDOS)
                continue

            # ── Detectar carpeta de proyecto ──────────────────
            nueva_carpeta = buscar_carpeta_en_texto(entrada, excluir=proyecto_activo)
            if nueva_carpeta:
                proyecto_activo = nueva_carpeta
                indice_proyecto = indexar_proyecto(nueva_carpeta)
                n_arch = len(indice_proyecto["archivos_leidos"])
                lista_arch = "\n".join("  " + a["ruta_abs"] for a in indice_proyecto["archivos_leidos"])
                ctx_msg = (
                    "[SISTEMA] Proyecto activo cambiado.\n"
                    "Ruta: " + str(nueva_carpeta) + "\n"
                    "Nombre: " + nueva_carpeta.name + "\n"
                    "Archivos indexados (" + str(n_arch) + "):\n"
                    + lista_arch + "\n"
                    "IMPORTANTE: Trabaja EXCLUSIVAMENTE con archivos de esta ruta. "
                    "No uses archivos de RYU ni de ninguna otra carpeta."
                )
                historial.append({"role": "user", "content": ctx_msg})
                historial.append({
                    "role": "assistant",
                    "content": "Entendido. Proyecto " + nueva_carpeta.name + " cargado con "
                               + str(n_arch) + " archivos indexados. Listo para trabajar."
                })
                print("  " + C.CYAN + "Proyecto listo: " + C.BOLD + nueva_carpeta.name + C.RESET + "\n")

            # ── Preparar y enviar ──────────────────────────────
            mensaje_final = preparar_mensaje(entrada, proyecto_activo, archivo_activo)
            respuesta, uso = chat(client, historial, mensaje_final, perfil, indice_proyecto, modelo_activo)

            # Acumular tokens de la sesion
            tokens_sesion["input"]    += uso["input"]
            tokens_sesion["output"]   += uso["output"]
            tokens_sesion["mensajes"] += 1

            # Calcular costo aproximado (Haiku: $0.80/1M input, $4/1M output)
            # Sonnet: $3/1M input, $15/1M output
            if "haiku" in modelo_activo:
                costo = (uso["input"] * 0.80 + uso["output"] * 4.0) / 1_000_000
                costo_sesion = (tokens_sesion["input"] * 0.80 + tokens_sesion["output"] * 4.0) / 1_000_000
            else:
                costo = (uso["input"] * 3.0 + uso["output"] * 15.0) / 1_000_000
                costo_sesion = (tokens_sesion["input"] * 3.0 + tokens_sesion["output"] * 15.0) / 1_000_000

            modifico = procesar_archivo_modificado(respuesta)
            creo     = procesar_crear_proyecto(respuesta)

            if not modifico and not creo:
                imprimir_ryu(respuesta)
            else:
                parte_texto = respuesta.split("===")[0].strip()
                if parte_texto:
                    imprimir_ryu(parte_texto)

            # Mostrar uso de tokens
            modelo_short = "Haiku" if "haiku" in modelo_activo else "Sonnet"
            print(
                C.GRAY
                + "  ↑ " + str(uso["input"]) + " tokens input"
                + "  ↓ " + str(uso["output"]) + " tokens output"
                + "  ~$" + f"{costo:.5f}"
                + "  [sesion: $" + f"{costo_sesion:.4f}"
                + " / " + str(tokens_sesion["mensajes"]) + " msgs"
                + " | " + modelo_short + "]"
                + C.RESET
            )

        except KeyboardInterrupt:
            print("\n\n" + C.CYAN + "╔══════════════════════════════════╗")
            print("║        Hasta luego, " + nombre + "!        ║")
            print("╚══════════════════════════════════╝" + C.RESET + "\n")
            break
        except anthropic.APIError as e:
            print("\n" + C.RED + "  Error de API: " + str(e) + C.RESET + "\n")
        except Exception as e:
            print("\n" + C.RED + "  Error inesperado: " + str(e) + C.RESET + "\n")


if __name__ == "__main__":
    main()