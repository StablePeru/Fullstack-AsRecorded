# AsRecorded — Documento de Objetivos Unificado

> Versión: 1.1 • Última actualización: 2025-08-28

---

## 0) Resumen ejecutivo

AsRecorded es una aplicación web para gestionar guiones de doblaje con jerarquía **Series → Capítulos → Takes → Intervenciones**. La nueva versión integra la **planificación diaria de Odoo** mediante **Convocatorias**: Odoo planifica, AsRecorded ejecuta, y los cambios vuelven a Odoo. Se añade gestión **FX** a nivel de intervención o por personaje y se formaliza la gestión de **Actores** y repartos.

---

## 1) Alcance y objetivos

**Objetivo principal:** Centralizar y controlar la ejecución en sala a partir de convocatorias de Odoo, registrando progreso, timecodes y marcas FX, con exportación fiable de deltas a Odoo.

**Incluye:**

*   Autenticación y autorización por rol.
*   Vista de trabajo diario por sala (**Hoy en tu sala**).
*   Importación XLSX tradicional de Series, Actores, Repartos e Intervenciones.
*   Integración Odoo: import de convocatorias y export de resultados.
*   Marcado **FX** con nota obligatoria y trazabilidad.
*   Auditoría, métricas y tareas programadas.

**Queda fuera:** Gestión de mezclas dentro de AsRecorded. Se coordina desde Odoo usando los datos exportados.

---

## 2) Roles y permisos

| Rol          | Capacidades clave                                                                                         |
| :----------- | :-------------------------------------------------------------------------------------------------------- |
| **admin**    | Acceso total. Gestión usuarios. Configuración I/O y tareas. Cierre/reapertura de convocatorias. Métricas. |
| **director** | Edición de diálogos. Marcaje de intervenciones y TC. Cierre de convocatoria si se autoriza.               |
| **tecnico**  | Ejecución en sala. Marcaje de intervenciones y FX. Cierre de convocatoria si se autoriza.                 |
| **supervisor** | **Acceso de solo lectura a convocatorias, progreso y métricas. Sin capacidad de edición.**               |

---

## 3) Modelo de dominio

### 3.1 Entidades

*   **Serie**(id, nombre, referencia, **fps decimal(5,3)**, created\_at, updated\_at)
*   **Capitulo**(id, serie\_id, numero, titulo, created\_at, updated\_at)
*   **Take**(id, capitulo\_id, numero, descripcion, created\_at, updated\_at)
*   **Actor**(id, nombre, created\_at, updated\_at)
*   **Personaje**(id, nombre, **actor\_id**, created\_at, updated\_at)
*   **Intervencion**(id, take\_id, personaje\_id, orden, estado enum('pendiente','realizado','omitido'), **estado\_nota text**, dialogo, tc\_in, tc\_out,
    needs\_fx bool default false, fx\_note varchar(120), fx\_source enum('manual','personaje\_default','odoo'), fx\_marked\_by user\_id, fx\_marked\_at timestamptz,
    **realizado\_por\_usuario\_id user\_id**, **realizado\_at timestamptz**,
    created\_at, updated\_at, version int)
*   **PersonajeEnCapitulo**(id, capitulo\_id, personaje\_id, fx\_default bool, fx\_default\_note varchar(120), created\_at, updated\_at)
*   **Sala**(id, nombre, codigo)
*   **Convocatoria**(id, sala\_id, fecha date, turno text, estado enum('no\_importada','importada','en\_curso','cerrada','reabierta'), odoo\_batch\_id text, created\_at, updated\_at)
*   **ConvocatoriaItem**(id, convocatoria\_id, serie\_id, capitulo\_id, take\_id, odoo\_item\_id text unique, estado\_planificado text, created\_at, updated\_at)
*   **Usuario**(id, nombre, email, rol enum('admin','director','tecnico', **'supervisor'**), activo bool, created\_at, updated\_at)
*   **Auditoria**(id, entidad, entidad\_id, usuario\_id, accion, payload jsonb, created\_at)
*   **JobConfig**(id, tipo enum('import','export'), sala\_id?, schedule text, activo bool, config jsonb, updated\_at)

### 3.2 Relaciones

*   Serie 1—N Capitulo. Capitulo 1—N Take. Take 1—N Intervencion.
*   **Actor 1—N Personaje.**
*   Capitulo N—N Personaje a través de PersonajeEnCapitulo.
*   Convocatoria 1—N ConvocatoriaItem. ConvocatoriaItem → Take.
    *Aclaracion: La convocatoria es por takes, pero en realidad, cada intervencion es una tarea. Por lo tanto, aunque se muestren takes, lo que hay que completar son las diferentes intervenciones.*

### 3.3 Índices sugeridos

*   `intervencion(capitulo_id, personaje_id, needs_fx)`
*   `convocatoria(sala_id, fecha)`
*   `convocatoria_item(odoo_item_id)` único
*   `take(capitulo_id, numero)`

---

## 4) Flujos de trabajo

### 4.1 Convocatorias Odoo

1.  **Import**: Odoo entrega lote con fecha, sala, turno, items por take y `odoo_item_id` estables.
2.  **Selección de sala** al login. Se carga la convocatoria del día.
3.  **Ejecución**: marcado de intervenciones (**realizado, omitido con nota obligatoria**), edición de TC y diálogos, marcado FX con nota.
4.  **Cierre**: se cierra la convocatoria. Se genera y envía **delta** a Odoo. Reintentos si falla.
5.  **Reapertura**: posible con permisos de admin.

**Estados**: `no_importada → importada → en_curso → cerrada → (reabierta)`.

**Concurrencia**: bloqueo optimista con `version` o `updated_at` en Intervencion y ETag HTTP.

### 4.2 Modo manual (fallback)

Acceso clásico a **Series/Capítulos** para trabajos ad-hoc o correcciones fuera de convocatoria.

---

## 5) Requisitos funcionales

*   Login, logout y refresco seguro de sesión. Protección de rutas por rol.
*   `/admin/user`: lista, búsqueda, cambio de rol.
*   **Import XLSX** de Series, Actores, Repartos e Intervenciones.
*   `/repartos`: **Gestión centralizada de actores y su asignación a personajes por serie.**
*   **Hoy en tu sala**: vista central con pendientes, progreso, filtros, y navegación **Siguiente pendiente**.
*   **Tabla de intervenciones**: estado, personaje, diálogo, tc\_in, tc\_out, **FX**, **y campo para nota de estado si está 'omitido'**.
*   **Acciones rápidas**: marcar realizado, saltar a siguiente pendiente.
*   **Búsqueda por personaje** con autocompletado y salto a siguiente pendiente de ese personaje.
*   **Edición in-line** de diálogo y TC con UI optimista.
*   **FX**: checkbox `needs_fx` y `fx_note` obligatorio 3–120 chars. Trazabilidad `fx_marked_by/at` y `fx_source`.
*   **FX masivo**: aplicar por personaje del capítulo respetando `personaje_en_capitulo.fx_default`.

---

## 6) UX/UI

*   Tema oscuro y claro. Tailwind. Componentes reutilizables.
*   Columna **FX** con checkbox y icono de nota con tooltip. Indicador visible si `fx_note` falta.
*   Estados visuales: pendiente, realizado, omitido. Animación breve al completar.
*   Navegación rápida entre takes y filtro por personaje.
*   **Aunque el volumen por convocatoria es moderado, se considerarán técnicas de renderizado eficiente (ej. virtualización de listas) en la tabla de intervenciones para garantizar una experiencia de usuario siempre fluida.**

---

## 7) Integración técnica con Odoo

### 7.1 Entrada (Import)

*   Mecanismo: API REST o fichero CSV/XLSX por sala y fecha.
*   **Campos mínimos por item**: sala, fecha, turno, serie\_ref, capitulo\_numero, take\_numero, `odoo_item_id`, personal asignado.
*   Idempotencia: repetir import con el mismo `odoo_batch_id` no duplica.

### 7.2 Salida (Export)

*   Trigger: cierre de convocatoria o manual admin.
*   Payload por `odoo_item_id` con **delta** desde última exportación: estado, tc\_in, tc\_out, needs\_fx, fx\_note, fx\_source, fx\_marked\_at, usuario.
*   Reintentos con backoff. Registro en **Bitácora I/O**.

### 7.3 Estrategia de Errores y Resiliencia

*   **Importación Atómica**: La importación de un lote de convocatoria (`odoo_batch_id`) debe ser transaccional. O se importan todos los `ConvocatoriaItem` correctamente, o no se importa ninguno y la operación falla en su conjunto (rollback). Esto previene estados inconsistentes.
*   **Registro de Errores**: Cualquier fallo en la importación (ej. `serie_ref` no encontrada, datos malformados) debe ser registrado de forma detallada en la **Bitácora I/O**, asociándolo al `odoo_batch_id` para que un **admin** pueda diagnosticar y resolver el problema.

---

## 8) API (borrador)

> Prefijo backend: `/api`

**Convocatorias**
*   `POST /convocatorias/import` Admin/Sistema. Cuerpo: { sala\_id, fecha, turno, odoo\_batch\_id, items\[] }
*   `GET /salas/{id}/convocatoria?fecha=YYYY-MM-DD`
*   `POST /convocatorias/{id}/close`
*   `POST /convocatorias/{id}/export`

**Intervenciones**
*   `PATCH /intervenciones/{id}/fx` Body: { needs\_fx: bool, fx\_note: string, fx\_source?: 'manual'|'personaje\_default'|'odoo' } 412 si ETag inválido.
*   `PATCH /intervenciones/{id}/timecode` Body: { tc\_in?, tc\_out? }
*   `PATCH /intervenciones/{id}/dialogo` Body: { dialogo }
*   `PATCH /intervenciones/{id}/estado` Body: { estado: 'pendiente'|'realizado'|'omitido', **estado\_nota?: string** }

**FX masivo**
*   `POST /fx/bulk` Body: { capitulo\_id, personaje\_id?, intervencion\_ids?, apply: { needs\_fx, fx\_note, fx\_source: 'personaje\_default'|'manual' } }

**Actores y Repartos**
*   `GET /actores`
*   `GET /series/{id}/reparto`
*   `POST /series/{id}/reparto` Body: { personaje\_id, actor\_id }

**Admin I/O**
*   `GET/POST /admin/io-management/config` CRUD config APScheduler
*   `POST /admin/export/now` forzar export

**Usuarios**
*   `GET /users/me`
*   `GET /admin/user` listar, `PATCH /admin/user/{id}` cambiar rol

**Errores estándar**: 400 validación, 401 no autenticado, 403 sin permisos, 404 no existe, 409 conflicto lógico, 412 ETag, 429 rate limit, 500 genérico.

---

## 9) Validaciones clave

*   `fx_note` obligatorio si `needs_fx=true`, longitud 3–120.
*   **`estado_nota` obligatorio si `estado='omitido'`**.
*   TC formato `HH:MM:SS:FF` validado en backend según **`serie.fps`**.
*   ETag obligatorio en PATCH de recursos sensibles.

---

## 10) Seguridad y auditoría

*   Hash de contraseñas, sesiones seguras, CSRF en formularios mutantes.
*   Scope por sala y fecha en consultas por defecto.
*   **Auditoria** en cambios de FX, **estado de intervención**, y cierres/reaperturas.

---

## 11) Métricas y trazabilidad

*   % completado por sala y día.
*   Convocado vs ejecutado por proyecto.
*   Volumen y tipo de FX por proyecto/personaje.
*   Tiempo medio por take. Frecuencia de reaperturas.
*   Bitácora import/export con éxitos, errores y reintentos.

---

## 12) Tareas programadas

*   Backend con **APScheduler** y **SQLAlchemyJobStore**.
*   Jobs: `import_convo_diario`, `export_convo_cierre`, `export_reintentos`.
*   Persistencia de jobs y reintentos con backoff exponencial.

---

## 13) Migraciones BD

1.  Añadir columnas FX, **de estado y trazabilidad (`realizado_por`, `realizado_at`, `estado_nota`)** en **intervencion**.
2.  Crear tablas **Actor** y **PersonajeEnCapitulo**. Modificar **Personaje** para incluir `actor_id`.
3.  Crear **convocatoria** y **convocatoria\_item**.
4.  Backfill `needs_fx=false` y valores por defecto.
5.  Índices e integridad referencial.

---

## 14) Tech stack

*   **DB**: PostgreSQL
*   **Backend**: Python Flask, Flask-CORS, Flask-Bcrypt, Flask-APScheduler.
*   **Frontend**: Remix + React + TypeScript, Tailwind CSS, UI optimista.
*   **Contenedores**: Docker y Docker Compose.

---

## 15) Roadmap

*   **F0 Contrato de datos Odoo**: campos y formatos cerrados. Criterio: import y export con objetos de prueba.
*   **F1 Modelo Convocatoria + Import**: entidades y carga al login. Criterio: ver convocatoria del día por sala.
*   **F2 Hoy en tu sala & Gestión de Reparto**: tabla con estado, TC y FX. Acciones rápidas, búsqueda por personaje y **UI para gestionar actores**. Criterio: ejecutar un capítulo completo.
*   **F3 Export a Odoo**: envío de deltas con idempotencia. Criterio: Odoo refleja cambios tras cierre.
*   **F4 Métricas y auditoría**. Criterio: dashboard con KPIs y bitácora.

---

## 16) Especificaciones de I/O

### 16.1 Import XLSX clásico

*   Hojas: `series`, `actores`, `capitulos`, `takes`, `intervenciones`.
*   `series` columnas mínimas: serie\_ref, nombre, **fps**.
*   `actores` columnas mínimas: nombre\_actor.
*   `intervenciones` columnas mínimas: serie\_ref, capitulo\_numero, take\_numero, personaje, **nombre\_actor**, orden, dialogo, tc\_in?, tc\_out?

### 16.2 Import Convocatorias desde Odoo (CSV/XLSX opcional)

*   Campos: sala, fecha, turno, serie\_ref, capitulo\_numero, take\_numero, odoo\_item\_id, asignados.

### 16.3 Export a Odoo (JSON por API)

```json
{
  "odoo_batch_id": "2025-08-28_SALA2_M",
  "convocatoria_id": 123,
  "items": [
    {
      "odoo_item_id": "OD-XY-001",
      "estado": "realizado",
      "estado_nota": null,
      "tc_in": "00:12:10:08",
      "tc_out": "00:12:14:03",
      "needs_fx": true,
      "fx_note": "Robot con reverberación",
      "fx_source": "manual",
      "fx_marked_at": "2025-08-28T09:32:12Z",
      "usuario_ejecucion": "tecnico.jm",
      "realizado_at": "2025-08-28T09:31:50Z"
    },
    {
      "odoo_item_id": "OD-XY-002",
      "estado": "omitido",
      "estado_nota": "El actor no se ha presentado a la convocatoria.",
      "tc_in": null,
      "tc_out": null,
      "needs_fx": false,
      "fx_note": null,
      "fx_source": null,
      "fx_marked_at": null,
      "usuario_ejecucion": "director.ana",
      "realizado_at": "2025-08-28T10:15:00Z"
    }
  ]
}
´´´

---

## 17) Interacción de UI destacada

*   **TimecodeInput** con entrada por dígito, validación diferida, undo con Backspace y cancelación con Escape.
*   **Búsqueda por personaje** con autocompletado, salto al siguiente pendiente, resaltado de pendientes en naranja y completadas en verde.
*   **FX masivo** desde panel del personaje del capítulo.

---

## 18) Pruebas y calidad

*   Tests unitarios backend: validación FX, TC, deltas export.
*   Tests e2e frontend: flujo completo de ejecución y cierre de convocatoria.
*   Semillas de datos y fixtures para salas, proyectos y convocatorias.

---

## 19) Decisiones y notas

*   `turno`: texto libre inicial, opcional normalizar a enum `mañana|tarde|noche`.
*   **FPS por proyecto se almacena a nivel de `Serie` para validar TC.**
*   ETag obligatorio para PATCH de **Interencion** y **Convocatoria**.

---

## 20) Glosario

*   **Convocatoria**: Plan de trabajo diario por sala proveniente de Odoo.
*   **Delta**: Cambios desde la última exportación.
*   **FX**: Marcaje de intervención que requiere efectos especiales en mezclas.

---

## 21) Consideraciones y Mejoras Futuras

*   **Notificaciones**: Implementar un sistema de notificaciones (en la app, por email, etc.) para enviar resúmenes previos al turno, avisos durante la jornada (ej. "80% completado"), y confirmaciones post-cierre.