Los componentes de Docsy se escriben directamente en Markdown. La configuración sigue en YAML y el contenido permanece legible en tu repositorio y en las exportaciones para agentes. No necesitas un editor alojado ni fuentes tipográficas remotas.

## Avisos

:::note[La configuración pertenece a YAML]
Mantén la identidad del producto, la navegación, las fuentes y los permisos en `docsy.config.yaml`. Escribe las explicaciones aquí, en Markdown.
:::

:::tip[Valida antes de publicar]
Ejecuta `npm run validate` para detectar enlaces rotos, componentes inválidos y errores de importación antes de publicar.
:::

:::warning[Guarda los secretos fuera del repositorio]
Lee las credenciales privadas desde el entorno del servidor. Nunca las incluyas en YAML ni en ejemplos publicados.
:::

:::danger[Un sitio estático no puede proteger artículos privados]
Usa el servidor Node para la documentación bloqueada. Un control realizado únicamente en el navegador no puede proteger un archivo público.
:::

Cada tipo tiene su propio icono y un acento visual discreto. El título explica la situación y el cuerpo indica qué hacer. La distinción no depende solo del color.

```md
:::warning[Guarda los secretos fuera del repositorio]
Lee las credenciales privadas desde el entorno del servidor.
:::
```

## Pasos numerados

:::steps
1. **Genera un proyecto.** Empieza con la interfaz editable de Docsy.

2. **Configura las fuentes.** Declara los artículos, la especificación de la API y los metadatos del SDK en YAML.

3. **Valida y publica.** Revisa el resultado antes del despliegue.
:::

Coloca una lista ordenada de Markdown entre `:::steps` y `:::`. Cada paso puede incluir párrafos y bloques de código.

## Pestañas sincronizadas

Los grupos que comparten la clave `sync` recuerdan la misma etiqueta usando únicamente el almacenamiento local del navegador.

::::tabs{sync="package-manager"}
:::tab[npm]
```bash
npm run validate
npm run build
```
:::
:::tab[pnpm]
```bash
pnpm validate
pnpm build
```
:::
::::

Usa cuatro signos de dos puntos para el grupo `tabs` y tres para cada elemento `tab`. Puedes navegar con las flechas, Inicio y Fin. Sin JavaScript, todos los paneles siguen visibles.

## Grupos de código

Rodea los bloques de código con `:::code-group`. El texto que aparece después del lenguaje del bloque se convierte en la etiqueta de la pestaña.

:::code-group
```javascript JavaScript
console.log('Una documentación que te pertenece.');
```
```python Python
print('Una documentación que te pertenece.')
```
:::

## Explicaciones desplegables

:::accordion[¿Qué ocurre sin JavaScript?]
Todas las pestañas siguen siendo legibles y las secciones desplegables usan el elemento nativo `details` del navegador. La búsqueda indexa todos los paneles, no solo el seleccionado.
:::

## Fragmentos reutilizables

Declara los archivos Markdown en YAML:

```yaml
content:
  snippets:
    publicacionEs: content/snippets/publishing-checklist.es.md
```

Después, inserta `::include{src="publicacionEs"}` en su propia línea:

::include{src="publicacionEs"}

Los fragmentos se incorporan a los artículos, la búsqueda y las exportaciones Markdown y JSON. Los nombres desconocidos, las referencias circulares, las rutas fuera del proyecto y más de diez inclusiones anidadas hacen fallar la validación.

## Elegir los componentes permitidos

```yaml
content:
  components: [note, tip, warning, danger, steps, tabs, accordion, code-group, include]
```

Un componente desconocido, desactivado o mal formado impide la publicación. El componente `tab` siempre debe estar dentro de `tabs`.
