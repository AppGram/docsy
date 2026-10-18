Este portal ofrece dos versiones (**Current** y **Preview (demo)**) y tres idiomas (**English**, **Français** y **Español**). Los selectores situados encima del artículo cambian el contexto y conservan la página cuando existe en el destino.

:::note[Una demostración, no una nueva versión del producto]
Preview contiene una guía de inicio diferente para comprobar las variantes. Los demás artículos se comparten entre versiones. No anuncia futuras funciones.
:::

## Probar las combinaciones

1. Abre **Primeros pasos** con Current y Español seleccionados.
2. Elige **Preview (demo)**: cambian el título y el contenido de la guía.
3. Elige **English** o **Français**: Preview sigue seleccionado, pero cambia el idioma.
4. Vuelve a **Current** y **Español** para recuperar la guía actual en español.

| Contexto | Ruta |
| --- | --- |
| Current / English | `/docsy/guides/getting-started` |
| Current / Español | `/docsy/versions/current/es/guides/getting-started` |
| Preview / Español | `/docsy/versions/preview/es/guides/getting-started` |

## Configurar versiones e idiomas

```yaml
versions:
  default: current
  items:
    - id: current
      label: Current
    - id: preview
      label: Preview (demo)
      status: beta
localization:
  defaultLocale: en
  fallback: true
  locales:
    - code: en
      label: English
    - code: fr
      label: Français
    - code: es
      label: Español
```

La combinación predeterminada conserva las URL habituales. Las demás usan `/versions/{version}/{locale}` después de la ruta base del sitio. Un idioma también puede declarar `dir: rtl` para una escritura de derecha a izquierda.

## Registrar variantes de un artículo

```yaml
content:
  articles:
    - slug: getting-started
      source: content/getting-started.md
      title: Get started with Docsy
    - slug: getting-started
      locale: es
      source: content/es/getting-started.md
      title: Primeros pasos con Docsy
    - slug: getting-started
      version: preview
      locale: es
      source: content/preview/es/getting-started.md
      title: Primeros pasos — espacio de demostración
```

Sin `version`, un artículo se comparte entre versiones. Sin `locale`, pertenece al idioma predeterminado. Para cada artículo, Docsy selecciona primero las variantes específicas de la versión, o las compartidas si no existen. Después busca el idioma solicitado y, si se permite, el idioma predeterminado.

## Comprobar el contenido alternativo en inglés

Con Español seleccionado, abre **Configuración YAML** o **Búsqueda y API para agentes**. Estos artículos todavía no tienen traducción al español. El cuerpo sigue en inglés y un aviso lo explica. La navegación y los selectores conservan el contexto español.

Con `fallback: false`, los artículos sin traducción dejan de aparecer en ese idioma en lugar de mostrar el texto inglés.

## Traducir la interfaz y consultar las exportaciones

Las etiquetas de navegación usan `titles.es`; la portada usa `home.translations.es`; los textos de la interfaz usan `localization.messages.es`. Las traducciones se escriben en el repositorio. Docsy no envía los artículos a un servicio externo de traducción.

Las exportaciones Markdown y JSON corresponden a la versión y al idioma seleccionados. Si un artículo usa el contenido alternativo en inglés, `contentLocale` indica `en` e `isFallback` vale `true`. La búsqueda solo incluye registros del contexto seleccionado.
