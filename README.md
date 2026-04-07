# RYU — Asistente de Programación CLI

Asistente de programación personal en terminal, construido sobre la API de Anthropic.
Se configura automáticamente la primera vez que lo abres.

```
╔══════════════════════════════════════════════╗
║        ██████╗ ██╗   ██╗██╗   ██╗            ║
║        ██╔══██╗╚██╗ ██╔╝██║   ██║            ║
║        ██████╔╝ ╚████╔╝ ██║   ██║            ║
║        ██╔══██╗  ╚██╔╝  ██║   ██║            ║
║        ██║  ██║   ██║   ╚██████╔╝            ║
║        ╚═╝  ╚═╝   ╚═╝    ╚═════╝             ║
║                                              ║
║           ¡Hola, [tu nombre]!                ║
║        ¿ En qué trabajamos hoy ?             ║
╚══════════════════════════════════════════════╝
```

## Primera vez

Al abrirlo por primera vez RYU te guía paso a paso:

1. Pide tu **API Key** de Anthropic y verifica que funcione
2. Pregunta tu **nombre**
3. Registra tu **stack** de tecnologías
4. Registra tu **rol**
5. Anota tus **proyectos activos**
6. Elige el **idioma** de las respuestas

Todo queda guardado en `perfil.json`. Las próximas veces abre directo con tu nombre.

## Requisitos

- Python 3.8+
- API Key de Anthropic → [console.anthropic.com](https://console.anthropic.com)

> La API Key se guarda localmente en tu `.env`. Nunca se sube al repo.

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Straaizo/ryu.git
cd ryu

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Ejecutar — el onboarding es automático
python ryu.py
```

**Windows:** doble click en `RYU.bat`

## Comandos

| Comando | Acción |
|---|---|
| `/salir` | Cerrar RYU |
| `/limpiar` | Limpiar historial y proyecto activo |
| `/perfil` | Ver tu perfil configurado |
| `/proyecto` | Ver proyecto activo |
| `/ayuda` | Ver todos los comandos |

## Trabajar con archivos

Dile a RYU en qué proyecto vas a trabajar y podrá leer archivos automáticamente:

```
> trabajemos en C:\Users\TuNombre\Desktop\mi-proyecto
> revisa el archivo C:\Users\TuNombre\Desktop\mi-proyecto\main.py
```

Extensiones soportadas: `.py` `.js` `.ts` `.jsx` `.tsx` `.html` `.css` `.json` `.md` `.dart` `.java` `.sql` `.yaml` `.xml` `.csv`

## Estructura del proyecto

```
ryu/
├── ryu.py            ← script principal
├── perfil.json       ← tu perfil (se crea automáticamente, no se sube)
├── .env              ← tu API key (no se sube)
├── .env.example      ← plantilla de referencia
├── .gitignore        ← excluye .env y perfil.json
├── requirements.txt  ← dependencias
├── RYU.bat           ← acceso directo Windows
└── README.md
```

## Stack usado

- Python 3
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python)
- python-dotenv

---

Desarrollado por [Enzo Sabattini](https://github.com/Straaizo)
