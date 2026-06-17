# Manual breve — Carpeta `src/app`

Esta carpeta contiene el núcleo principal del frontend de Aurelius IDE.  
Acá se organiza el estado global, el arranque de la aplicación, los comandos, la sesión del layout, los iconos y utilidades reutilizables.

---

## `app.js`

Archivo principal de la aplicación.

Se encarga de:

- Inicializar Aurelius IDE.
- Cargar settings.
- Cargar preferencias de layout.
- Cargar proyectos recientes.
- Renderizar la estructura principal del IDE.
- Conectar eventos de botones, tabs, explorer, search, IA y command palette.
- Manejar acciones principales como abrir proyecto, crear archivo, guardar, buscar, abrir Git, abrir Settings y alternar paneles.

Es el orquestador general del frontend.

---

## `state.js`

Archivo de estado global.

Guarda toda la información viva de la app, por ejemplo:

- Proyecto abierto.
- Árbol de archivos.
- Archivo activo.
- Tabs abiertas.
- Estado dirty de archivos sin guardar.
- Panel activo de la Activity Bar.
- Layout visible u oculto.
- Tamaños de sidebar, panel derecho y bottom panel.
- Configuración del editor.
- Configuración de IA.
- Estado de búsqueda.
- Mensajes del chat IA.

También contiene funciones para modificar ese estado de forma ordenada.

---

## `app-command-actions.js`

Archivo donde viven los comandos disponibles de Aurelius.

Define acciones como:

- Abrir proyecto.
- Crear archivo.
- Crear carpeta.
- Guardar archivo.
- Cerrar pestaña activa.
- Abrir Explorer.
- Abrir Search.
- Abrir Source Control.
- Abrir IA.
- Abrir Settings.
- Mostrar u ocultar topbar.
- Mostrar u ocultar sidebar.
- Mostrar u ocultar terminal.
- Ejecutar diagnostics.
- Crear nueva terminal.
- Reiniciar terminal.
- Limpiar panel inferior.

Este archivo alimenta la Command Palette.

---

## `app-icons.js`

Archivo encargado de registrar los iconos de Lucide.

Se encarga de:

- Importar los iconos usados por la interfaz.
- Ejecutar `createIcons()`.
- Convertir los `<i data-lucide="..."></i>` en SVG reales.
- Mantener centralizado el listado de iconos disponibles.

Esto evita tener imports gigantes de iconos dentro de `app.js`.

---

## `app-session.js`

Archivo encargado de guardar y restaurar la sesión visual del IDE.

Maneja preferencias como:

- Panel activo.
- Topbar visible u oculta.
- Sidebar visible u oculto.
- Panel derecho visible u oculto.
- Bottom panel visible u oculto.
- Ancho del sidebar.
- Ancho del panel derecho.
- Alto del panel inferior.
- Panel derecho activo.
- Panel inferior activo.

Usa el servicio `session.service.js`, que se comunica con Rust/Tauri.

---

## `app-utils.js`

Archivo de utilidades reutilizables.

Contiene funciones pequeñas usadas por varias partes del frontend:

- Codificar paths.
- Decodificar paths.
- Obtener el nombre base de un archivo o carpeta.
- Convertir errores en mensajes legibles.
- Detectar si el usuario está escribiendo en un input.
- Detectar si hay un modal abierto.
- Limitar valores numéricos entre mínimo y máximo.
- Enfocar elementos por ID.

Sirve para mantener `app.js` más limpio.

---

## Resumen rápido

| Archivo | Función principal |
|---|---|
| `app.js` | Orquesta y renderiza la app principal |
| `state.js` | Guarda el estado global |
| `app-command-actions.js` | Define comandos de la Command Palette |
| `app-icons.js` | Registra iconos Lucide |
| `app-session.js` | Guarda/restaura layout y sesión visual |
| `app-utils.js` | Helpers reutilizables |






