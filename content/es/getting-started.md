Docsy es una herramienta de documentación para personas y agentes de programación. Tus lectores consultan guías y referencias de API o SDK en un portal de documentación. Tus agentes pueden leer el mismo contenido en Markdown y ayudarte a mantener los artículos, la configuración YAML y la interfaz Astro.

:::tip[Prueba los dos selectores]
Estás leyendo la traducción al español de la guía actual. Selecciona **Preview (demo)** para abrir un artículo distinto y después **English** o **Français** para cambiar de idioma sin salir de esta página.
:::

## Ejecutar este portal

Usa Node 22.22 o una versión posterior y clona el repositorio:

```bash
git clone https://github.com/AppGram/docsy.git
cd docsy
npm ci
npm run dev
```

Abre `http://localhost:4321/docsy/`. Los artículos, la configuración y el código de la interfaz están en tu repositorio.

## Generar un proyecto independiente

Este comando crea un proyecto Astro editable con la interfaz predeterminada y una guía inicial:

```bash
npm run create -- ../acme-docs \
  --name "Acme API" \
  --base /docs
```

Si quieres generar también una referencia de la API, proporciona una especificación OpenAPI:

```bash
npm run create -- ../acme-docs \
  --name "Acme API" \
  --openapi https://api.example.com/openapi.json \
  --api-base https://api.example.com \
  --base /docs
```

## Organizar el contenido

| Ubicación | Responsabilidad |
| --- | --- |
| `docsy.config.yaml` | Identidad, navegación, artículos, fuentes, idiomas, versiones y permisos |
| `content/` y `sources/` | Artículos Markdown y metadatos de API o SDK |
| `src/` | Interfaz Astro y estilos que puedes modificar |

Usa YAML para la configuración y Markdown para las explicaciones. Edita Astro o CSS cuando necesites cambiar la propia interfaz. Tu agente puede trabajar en los mismos archivos, siguiendo las instrucciones de `AGENTS.md` y `DOCSY_BRIEF.md`.

## Validar y publicar

```bash
npm run validate
npm run build
```

El modo abierto con `agent.query: false` genera un sitio estático compatible con GitHub Pages. El modo bloqueado o `agent.query: true` requiere el servidor Node para comprobar permisos o ejecutar búsquedas en cada solicitud.

:::warning[No publiques tus secretos]
Los artículos y los ejemplos de un sitio estático son públicos. Guarda las credenciales privadas en el entorno del servidor, nunca en archivos Markdown o YAML publicados.
:::

## Probar las traducciones

Las guías **Primeros pasos**, **Artículos enriquecidos** y **Versiones e idiomas** están traducidas al español. Abre **Configuración YAML** para comprobar el contenido alternativo: la navegación sigue en español, pero un aviso explica que el artículo se muestra en inglés porque aún no tiene traducción.

La búsqueda respeta el idioma y la versión seleccionados. Prueba a buscar **avisos** para encontrar la sección correspondiente de los artículos enriquecidos.
