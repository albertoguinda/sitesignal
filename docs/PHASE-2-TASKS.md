# Fase 2: Calidad del Código — Tareas Detalladas

## Estado: En Progreso

---

## Objetivo
Tener tests robustos, código limpio y cobertura > 80%.

---

## Tarea 2.1: Tests de unit para utilidades

### Subtarea 2.1.1: Tests para `format.ts`
**Effort**: S (1 hora)
**Archivo**: `src/lib/__tests__/format.test.ts`

**Estado**: ✅ Completado (12 tests pasando)

---

### Subtarea 2.1.2: Tests para `utils.ts`
**Effort**: XS (30 min)
**Archivo**: `src/lib/__tests__/utils.test.ts`

**Criterios de aceptación**:
- [ ] Test para `cn()` (class merger)
- [ ] Test para `sleep()`
- [ ] Cobertura > 90%

---

### Subtarea 2.1.3: Tests para `api.ts`
**Effort**: M (2 horas)
**Archivo**: `src/lib/__tests__/api.test.ts`

**Criterios de aceptación**:
- [ ] Mock de fetch global
- [ ] Test para `useSites()` con datos mock
- [ ] Test para `useOverview()` con datos mock
- [ ] Test para `useAssets()` con datos mock
- [ ] Test para `useAlerts()` con datos mock
- [ ] Manejo de errores de red
- [ ] Loading states

---

## Tarea 2.2: Tests para hooks

### Subtarea 2.2.1: Test para `useAuth`
**Effort**: M (2 horas)
**Archivo**: `src/lib/__tests__/auth.test.tsx`

**Criterios de aceptación**:
- [ ] Test para `requestMagicLink()`
- [ ] Test para `logout()`
- [ ] Test para `checkAuth()`
- [ ] Mock de fetch para cada escenario
- [ ] Estados de loading

---

### Subtarea 2.2.2: Tests para `useOrganizations`
**Effort**: M (2 horas)
**Archivo**: `src/lib/__tests__/organizations.test.ts`

**Criterios de aceptación**:
- [ ] Test para `useOrganizations()`
- [ ] Test para `useCreateOrganization()`
- [ ] Test para `useInviteMember()`
- [ ] Mock de API responses

---

## Tarea 2.3: Tests para endpoints API

### Subtarea 2.3.1: Test para `/api/auth/magic-link`
**Effort**: M (2 horas)
**Archivo**: `server/__tests__/auth.test.ts`

**Criterios de aceptación**:
- [ ] Test para email válido
- [ ] Test para email inválido
- [ ] Test para rate limiting
- [ ] Test para crear usuario nuevo
- [ ] Test para usuario existente

---

### Subtarea 2.3.2: Test para `/api/organizations`
**Effort**: M (2 horas)
**Archivo**: `server/__tests__/organizations.test.ts`

**Criterios de aceptación**:
- [ ] Test para crear organización
- [ ] Test para listar organizaciones
- [ ] Test para invitar miembro
- [ ] Test para permisos (admin vs member)

---

### Subtarea 2.3.3: Test para `/api/overview`
**Effort**: M (2 horas)
**Archivo**: `server/__tests__/overview.test.ts`

**Criterios de aceptación**:
- [ ] Test para overview sin filtro
- [ ] Test para overview con siteId
- [ ] Test para overview con orgId
- [ ] Test para KPIs calculados correctamente

---

## Tarea 2.4: Refactorizar código existente

### Subtarea 2.4.1: Eliminar código duplicado
**Effort**: M (2 horas)
**Archivos**: Múltiples

**Criterios de aceptación**:
- [ ] Identificar código duplicado
- [ ] Extraer a funciones compartidas
- [ ] Verificar que tests siguen pasando

---

### Subtarea 2.4.2: Extraer lógica compleja
**Effort**: M (2 horas)
**Archivos**: Múltiples

**Criterios de aceptación**:
- [ ] Funciones > 20 líneas → extraer helpers
- [ ] Naming descriptivo
- [ ] Single responsibility

---

### Subtarea 2.4.3: Verificar TypeScript estricto
**Effort**: S (1 hora)
**Archivos**: tsconfig.json

**Criterios de aceptación**:
- [ ] `strict: true` activado
- [ ] Zero `any` en código nuevo
- [ ] Type guards donde sea necesario

---

## Dependencias

```
2.1.1 (ya completado)
  ↓
2.1.2 → 2.1.3
  ↓
2.2.1 → 2.2.2
  ↓
2.3.1 → 2.3.2 → 2.3.3
  ↓
2.4.1 → 2.4.2 → 2.4.3
```

---

## Criterios de Aceptación Globales

- [ ] Todos los tests pasan
- [ ] Coverage > 80%
- [ ] Build sin warnings
- [ ] TypeScript strict mode
- [ ] Sin `any` en código nuevo
- [ ] Funciones < 20 líneas
- [ ] Naming descriptivo

---

*Fase 2 creada el 2026-08-07*
