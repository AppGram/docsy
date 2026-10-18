:::note[Estás en la versión de demostración]
Este artículo independiente sirve para probar las versiones y los idiomas de Docsy. No representa una versión publicada ni una promesa de futuras funciones.
:::

## Qué cambia en esta versión

La guía Current explica cómo crear un proyecto de documentación. Esta guía Preview es un espacio de pruebas. Su título, descripción y contenido proceden de `content/preview/es/getting-started.md`, registrado con `version: preview` y `locale: es` en YAML.

El slug común `getting-started` permite conservar la página al cambiar de versión. Los demás artículos se comparten entre versiones mientras no se declare una variante específica.

## Probar el cambio de versión

:::steps
1. **Selecciona Current.** Verás la guía de creación de proyectos en español.

2. **Selecciona Preview (demo).** Volverás a este espacio de pruebas con el aviso de demostración.

3. **Selecciona English o Français.** Preview seguirá seleccionado y cambiará el idioma del artículo.
:::

## Probar el idioma alternativo

Con Español seleccionado, abre **Configuración YAML**. Esa guía no tiene traducción al español de forma intencionada: se muestra en inglés y un aviso explica por qué. Los selectores siguen en Preview y Español.

## Probar la búsqueda y las exportaciones

Busca **espacio de pruebas** y compara los resultados con Current. La búsqueda respeta el contexto seleccionado. El menú Markdown y el enlace JSON también apuntan a esta variante, no a la guía Current.

```text
/docsy/agent/pages/versions/preview/es/guides/getting-started.json
```

:::tip[Los proyectos nuevos siguen siendo sencillos]
Estas variantes pertenecen únicamente al portal de Docsy. El generador sigue creando proyectos con una sola versión y su idioma predeterminado.
:::
