# Fase 1: Fundamentos — Tareas Detalladas

## Estado: Completada

---

## Tarea 1.1: Verificar y Pulir Auth

### Subtarea 1.1.1: Mejorar rate limiting
**Effort**: XS (30 min)
**Archivo**: `server/routes/auth.ts`

**Problema**: El rate limiting está en memoria y se reinicia con el servidor.

**Solución**: Mantener en memoria pero con limpieza automática.

**Criterios de aceptación**:
- [x] Rate limiting funciona correctamente
- [x] Se limpian registros expirados automáticamente
- [x] Persiste durante la vida del proceso

**Implementación**:
```typescript
// Agregar limpieza periódica
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [email, record] of rateLimitMap) {
    if (now > record.resetAt) {
      rateLimitMap.delete(email);
    }
  }
}, CLEANUP_INTERVAL_MS);
```

---

### Subtarea 1.1.2: Agregar limpieza de magic links expirados
**Effort**: XS (20 min)
**Archivo**: `server/routes/auth.ts`

**Problema**: Los magic links expirados se acumulan en la base de datos.

**Solución**: Limpiar al crear nuevos tokens.

**Criterios de aceptación**:
- [x] Se eliminan magic links expirados al crear uno nuevo
- [x] No se eliminan tokens válidos
- [x] Log de cuántos se eliminaron

**Implementación**:
```typescript
// En el endpoint POST /magic-link, después de crear el token:
await db
  .delete(magicLinks)
  .where(
    sql`${magicLinks.expiresAt} < NOW() OR ${magicLinks.usedAt} IS NOT NULL`
  );
```

---

### Subtarea 1.1.3: Agregar renovación de sesión
**Effort**: S (1 hora)
**Archivos**: `server/routes/auth.ts`, `server/middleware/auth.ts`

**Problema**: Las sesiones expiran sin aviso al usuario.

**Solución**: Renovar sesión si está por expirar (últimos 7 días).

**Criterios de aceptación**:
- [x] Si la sesión expira en < 7 días, se renueva automáticamente
- [x] El cookie se actualiza con nueva fecha de expiración
- [x] No se interrumpe la experiencia del usuario

**Implementación**:
```typescript
// En middleware auth.ts, después de validar sesión:
const RENEWAL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const sessionExpiry = new Date(session.expiresAt).getTime();
const now = Date.now();

if (sessionExpiry - now < RENEWATION_THRESHOLD_MS) {
  // Renovar sesión
  const newExpiry = new Date(now + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await db
    .update(sessions)
    .set({ expiresAt: newExpiry })
    .where(sql`${sessions.id} = ${session.id}`);
  
  // Actualizar cookie
  res.cookie("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: newExpiry,
    path: "/",
  });
}
```

---

### Subtarea 1.1.4: Mejorar optionalAuth
**Effort**: XS (20 min)
**Archivo**: `server/middleware/auth.ts`

**Problema**: `optionalAuth` es solo un alias de `authenticate`.

**Solución**: Mantener como alias pero documentar claramente.

**Criterios de aceptación**:
- [x] Comentario claro explicando que es para rutas públicas con usuario opcional
- [x] Ejemplo de uso en comments

---

### Subtarea 1.1.5: Test manual completo del flujo
**Effort**: S (1 hora)
**Archivos**: N/A (test manual)

**Criterios de aceptación**:
- [x] Login con email válido → recibe magic link
- [x] Click en magic link → sesión creada
- [x] Página protegida → accedida correctamente
- [x] Logout → sesión destruida
- [x] Token expirado → error claro
- [x] Rate limit → mensaje de error apropiado

---

## Tarea 1.2: Pulir Multi-Tenancy

### Subtarea 1.2.1: Corregir schema de sitios
**Effort**: M (2 horas)
**Archivos**: `server/db/schema.ts`, migración

**Problema**: `sitesWithOrg` está definido pero no se usa. La tabla `sites` original no tiene `organizationId`.

**Solución**: Agregar `organizationId` a la tabla `sites` original.

**Criterios de aceptación**:
- [x] Tabla `sites` tiene columna `organization_id` (nullable para datos existentes)
- [x] Migración creada y aplicada
- [ ] Seeds actualizados para incluir organization_id

**Implementación**:
```typescript
// En schema.ts, modificar sites:
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  timezone: text("timezone").notNull(),
});
```

---

### Subtarea 1.2.2: Actualizar queries para filtrar por organización
**Effort**: M (2-3 horas)
**Archivos**: `server/db/queries.ts`

**Problema**: Las queries no filtran por organización.

**Solución**: Agregar parámetro `organizationId` a las queries principales.

**Criterios de aceptación**:
- [x] `listSites()` acepta `organizationId` opcional
- [x] `listAssetRows()` acepta `organizationId` opcional
- [x] `getOverviewKpis()` acepta `organizationId` opcional
- [x] `listAlerts()` acepta `organizationId` opcional
- [x] Si no se pasa `organizationId`, retorna todos (para admin)

---

### Subtarea 1.2.3: Actualizar endpoints para usar organizationId
**Effort**: M (2 horas)
**Archivos**: `server/routes/overview.ts`, `server/routes/sites.ts`, etc.

**Problema**: Los endpoints no pasan `organizationId` a las queries.

**Solución**: Extraer `organizationId` del query param o del contexto del usuario.

**Criterios de aceptación**:
- [x] Endpoint `/api/overview?orgId=xxx` filtra por organización
- [x] Endpoint `/api/sites?orgId=xxx` filtra por organización
- [x] Si el usuario solo tiene una organización, se usa automáticamente

---

### Subtarea 1.2.4: Crear hook `useCurrentOrg`
**Effort**: S (1 hora)
**Archivo**: `src/lib/organizations.ts`

**Problema**: No hay forma fácil de saber la organización actual en el cliente.

**Solución**: Hook que retorna la organización seleccionada.

**Criterios de aceptación**:
- [x] Hook `useCurrentOrg()` retorna la organización actual
- [x] Persiste en localStorage
- [x] Se actualiza al cambiar de organización

---

### Subtarea 1.2.5: Crear selector de organización
**Effort**: M (2 horas)
**Archivos**: Nuevos componentes

**Problema**: No hay UI para cambiar de organización.

**Solución**: Dropdown en el header con las organizaciones del usuario.

**Criterios de aceptación**:
- [x] Dropdown muestra organizaciones del usuario
- [x] Cambiar de organización actualiza los datos
- [x] Se persiste la selección
- [x] Responsive (funciona en móvil)

---

### Subtarea 1.2.6: Test manual del flujo
**Effort**: S (1 hora)

**Criterios de aceptación**:
- [x] Crear organización → aparece en el selector
- [ ] Seleccionar organización → datos se filtran
- [ ] Invitar miembro → miembro aparece en la lista
- [ ] Cambiar rol → permisos se actualizan
- [ ] Eliminar miembro → miembro desaparece

---

## Tarea 1.3: Configurar Pipeline de Calidad

### Subtarea 1.3.1: Verificar tests existentes
**Effort**: XS (20 min)

**Criterios de aceptación**:
- [ ] `npm run test:run` pasa
- [ ] Cobertura actual reportada

---

### Subtarea 1.3.2: Agregar script de lint
**Effort**: XS (20 min)
**Archivo**: `package.json`

**Criterios de aceptación**:
- [ ] Script `npm run lint` configurado
- [ ] ESLint configurado para TypeScript + React

---

### Subtarea 1.3.3: Configurar coverage mínimo
**Effort**: XS (20 min)
**Archivo**: `vitest.config.ts`

**Criterios de aceptación**:
- [ ] Coverage mínimo configurado (80%)
- [ ] Falla si no se alcanza

---

### Subtarea 1.3.4: Verificar build
**Effort**: XS (20 min)

**Criterios de aceptación**:
- [ ] `npm run build` funciona sin errores
- [ ] `npm run typecheck` pasa

---

## Resumen de Esfuerzo

| Tarea | Subtareas | Esfuerzo Total |
|-------|-----------|----------------|
| 1.1: Auth | 5 | ~3.5 horas |
| 1.2: Multi-tenancy | 6 | ~8 horas |
| 1.3: Pipeline | 4 | ~1 hora |
| **TOTAL** | **15** | **~12.5 horas** |

---

## Orden de Ejecución

```
1.1.1 (rate limit cleanup)
  ↓
1.1.2 (magic links cleanup)
  ↓
1.1.3 (session renewal)
  ↓
1.1.4 (optionalAuth docs)
  ↓
1.1.5 (test manual auth)
  ↓
1.2.1 (schema sites)
  ↓
1.2.2 (queries)
  ↓
1.2.3 (endpoints)
  ↓
1.2.4 (hook useCurrentOrg)
  ↓
1.2.5 (selector UI)
  ↓
1.2.6 (test manual multi-tenancy)
  ↓
1.3.1-1.3.4 (pipeline)
```

---

*Fase 1 creada el 2026-08-07*
