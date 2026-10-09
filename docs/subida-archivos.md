# Subida continua de documentos

`src/lib/subida.ts` envía un archivo por solicitud HTTP, como cuerpo binario, y mantiene el avance de XMLHttpRequest. La URL contiene únicamente metadatos (nombre, tamaño, tipo y sesión).

`src/app/api/archivos/route.ts` verifica formato, sesión y permisos antes de leer el cuerpo. Luego utiliza `src/lib/archivo-continuo.ts`, que no depende de Next.js ni de la base de datos.

El almacenamiento sigue estos pasos:

1. Escribir por bloques en `archivos/.temporales/<UUID completo>.part`.
2. Regular la recepción según la velocidad del disco mediante `pipeline`.
3. Verificar que los bytes recibidos coincidan con el tamaño anunciado.
4. Mover el archivo completo a su carpeta final, en el mismo volumen.
5. Crear el documento en PostgreSQL. Si el registro falla, eliminar el archivo final.

Los documentos académicos usan `archivos/ARQ/1.1/1.1.2/M1/S1/<UUID corto>-<archivo>` (o PUN). El material de fechas programadas conserva sus carpetas por programación. Los tamaños se registran como `bigint` y se utilizan como números seguros en JavaScript.

Las interrupciones y errores de escritura eliminan el temporal. Un apagado abrupto del servidor puede dejar un `.part`: no figura en el repositorio ni se puede descargar por ID. Con el servidor detenido, esos temporales pueden eliminarse; no son documentos finales. No borrar temporales mientras hay transferencias activas.

No hay límite de 50/300 MB. El espacio disponible, la duración de la conexión y los límites del alojamiento/proxy siguen siendo relevantes. `/api/archivos` está excluido del proxy de Next.js para evitar que clone y acumule el cuerpo. La configuración de Server Actions no controla este endpoint.

Este método no reanuda subidas: una interrupción requiere volver a enviar el archivo. No proporciona durabilidad frente a apagados repentinos entre la escritura del archivo y el registro en la base de datos.

Pruebas: `node_modules/.bin/tsx --test src/lib/archivo-continuo.test.ts`. Incluyen una transferencia sintética de más de 1 GiB, validación de bytes, memoria acotada e interrupciones. Usan una carpeta aislada y la eliminan al terminar.
