# Publicación de Radar RSS en GitHub

## 1. Crear repositorio

En [github.com/new](https://github.com/new), crear un repositorio público `radar-rss-publico`. No es necesario incluir README ni `.gitignore` porque el paquete ya los contiene.

## 2. Subir el código completo

Descomprimir `Radar_RSS_Publico_GitHub_V1_2026-10-17.zip`. Abrir la carpeta `radar-rss-publico` y cargar su contenido al repositorio, manteniendo `.github/workflows/deploy.yml` y el resto de las rutas. Si tu explorador no muestra la carpeta oculta `.github`, usar Git Bash o la línea de comandos.

```bash
cd radar-rss-publico
git init
git branch -M main
git add .
git commit -m "Iniciar Radar RSS publico"
git remote add origin https://github.com/TU-USUARIO/radar-rss-publico.git
git push -u origin main
```

Sustituir `TU-USUARIO` por tu cuenta de GitHub. No pegar tokens en archivos del repositorio.

## 3. Activar el sitio

En GitHub, abrir **Settings → Pages** y seleccionar **GitHub Actions** como fuente de publicación. Ir a **Actions → Actualizar noticias y publicar → Run workflow** (rama `main`).

El proceso instalará dependencias, verificará el OPML, descargará noticias, generará JSON y publicará la web. Puedes verificar el resultado en la pestaña Actions.

## 4. Abrir la aplicación

Abrir la dirección de **Settings → Pages**, normalmente:

`https://TU-USUARIO.github.io/radar-rss-publico/`

Esta dirección es un ejemplo, no un sitio actualmente desplegado.

## 5. Mantenimiento

- Modificar `sources/feeds.opml` para añadir, reemplazar o quitar fuentes.
- Los contenidos se intentarán actualizar cada 3 horas. Algunas consultas RSS pueden devolver 403, 429 u otros errores: revisar `web/data/status.json` generado durante Actions y el resumen mostrado en la web.
- GitHub puede retrasar tareas programadas y desactivarlas si el repositorio público no registra actividad durante 60 días. Revisar periódicamente Actions.
- Las noticias se guardan como JSON desplegado, no como commits individuales en la rama principal. La caché temporal entre ejecuciones no es garantía de histórico permanente.
- Para sincronizar favoritos entre dispositivos o publicar cada pocos minutos, la siguiente versión requerirá almacenamiento persistente y posiblemente otro servicio de programación.

## Qué no hace esta versión

No existe aún cuenta de usuario, editor web de OPML, resúmenes automáticos con IA, base de datos propia, notificaciones push ni histórico permanente. Se priorizó un lector público operativo y sencillo de mantener.