# SiteSignal — Plan para Challenge de Contra

## Resumen Ejecutivo

SiteSignal es un dashboard de monitoreo industrial que ya tiene una base sólida:
- React 19 + Vite + Express 5 + Drizzle/Postgres
- 3D con react-three-fiber
- Design system documentado
- Datos realistas precargados

**Objetivo**: Transformar este template en un producto completo y competitivo para el challenge de Contra.

---

## Estado Actual

### Lo que ya funciona
- Dashboard con KPIs, tabla de activos, alertas en tiempo real
- Vista detallada de activos con plano 3D interactivo
- Analytics con gráficas comparativas
- Design system vivo con tokens
- Condiciones ambientales por sitio (Open-Meteo)
- Base de datos embebida (PGlite) que arranca poblada

### Lo que falta (del README)
- ❌ Autenticación
- ❌ Roles y permisos
- ❌ Tests
- ❌ Multi-tenancy

---

## Plan de Mejoras para el Challenge

### Fase 1: Autenticación y Seguridad (Prioridad ALTA)

#### 1.1: Magic Link Authentication
**Objetivo**: Login sin contraseña como en sitesignal.ca

**Tareas**:
- [ ] Crear tabla `users` en schema (email, token, expires_at)
- [ ] Crear tabla `sessions` para managing tokens
- [ ] Implementar endpoint POST /api/auth/magic-link
- [ ] Implementar endpoint GET /api/auth/verify
- [ ] Crear middleware de autenticación
- [ ] Crear hook useAuth() en el cliente
- [ ] Crear página de login (/login)
- [ ] Proteger rutas API con auth middleware
- [ ] Agregar logout functionality

**Estimación**: 4-6 horas

#### 1.2: Rate Limiting y Seguridad
**Objetivo**: Prevenir abuso del sistema

**Tareas**:
- [ ] Agregar rate limiting a endpoints públicos
- [ ] Implementar CSRF protection
- [ ] Agregar headers de seguridad adicionales
- [ ] Validar y sanitizar todas las entradas

**Estimación**: 2-3 horas

---

### Fase 2: Multi-Tenancy (Prioridad ALTA)

#### 2.1: Estructura de Organizaciones
**Objetivo**: Soportar múltiples organizaciones

**Tareas**:
- [ ] Crear tabla `organizations`
- [ ] Crear tabla `organization_members` (user_id, org_id, role)
- [ ] Modificar schema existente para incluir org_id
- [ ] Actualizar queries para filtrar por organización
- [ ] Crear endpoints CRUD para organizaciones
- [ ] Crear selector de organización en UI

**Estimación**: 6-8 horas

#### 2.2: Roles y Permisos
**Objetivo**: Control de acceso granular

**Tareas**:
- [ ] Definir roles: admin, member, viewer
- [ ] Implementar middleware de autorización
- [ ] Proteger endpoints según rol
- [ ] Crear UI para gestión de miembros
- [ ] Agregar invitaciones por email

**Estimación**: 4-6 horas

---

### Fase 3: Tests (Prioridad ALTA)

#### 3.1: Tests de Unidad
**Objetivo**: Cobertura mínima del 80%

**Tareas**:
- [ ] Configurar Vitest para el proyecto
- [ ] Tests para utilidades (format.ts, utils.ts)
- [ ] Tests para hooks (useAuth, useSites, etc.)
- [ ] Tests para componentes UI (Button, Card, etc.)
- [ ] Tests para queries del servidor

**Estimación**: 6-8 horas

#### 3.2: Tests de Integración
**Objetivo**: Verificar flujos completos

**Tareas**:
- [ ] Tests para API endpoints
- [ ] Tests para autenticación completa
- [ ] Tests para multi-tenancy
- [ ] Tests para flujos de usuario

**Estimación**: 4-6 horas

#### 3.3: Tests E2E
**Objetivo**: Verificar UX completa

**Tareas**:
- [ ] Configurar Playwright
- [ ] Test de login/logout
- [ ] Test de navegación completa
- [ ] Test de crear/eliminar organizaciones
- [ ] Test de dashboard completo

**Estimación**: 4-6 horas

---

### Fase 4: UI/UX y Design System (Prioridad MEDIA)

#### 4.1: Mejoras de UI
**Objetivo**: Experiencia de usuario pulida

**Tareas**:
- [ ] Agregar modo oscuro/claro
- [ ] Mejorar responsive design
- [ ] Agregar animaciones de transición
- [ ] Crear componentes de feedback (toasts, spinners)
- [ ] Agregar empty states ilustrados
- [ ] Mejorar accesibilidad (WCAG AA)

**Estimación**: 6-8 horas

#### 4.2: Páginas Nuevas
**Objetivo**: Funcionalidad completa

**Tareas**:
- [ ] Página de configuración (/settings)
- [ ] Página de perfil de usuario (/profile)
- [ ] Página de gestión de activos (/assets/manage)
- [ ] Página de reportes (/reports)
- [ ] Página de notificaciones (/notifications)

**Estimación**: 8-10 horas

---

### Fase 5: Performance y DevOps (Prioridad MEDIA)

#### 5.1: Optimización de Performance
**Objetivo**: Carga rápida y fluida

**Tareas**:
- [ ] Implementar lazy loading por ruta
- [ ] Agregar Service Worker para cache offline
- [ ] Optimizar bundle size
- [ ] Implementar virtual scrolling para tablas grandes
- [ ] Agregar prefetching de datos

**Estimación**: 4-6 horas

#### 5.2: Docker y Despliegue
**Objetivo**: Despliegue fácil y consistente

**Tareas**:
- [ ] Crear Dockerfile multi-stage
- [ ] Crear docker-compose.yml
- [ ] Agregar health checks
- [ ] Configurar variables de entorno
- [ ] Crear script de deploy
- [ ] Agregar monitoreo básico

**Estimación**: 3-4 horas

---

### Fase 6: Documentación (Prioridad BAJA)

#### 6.1: Documentación Técnica
**Objetivo**: Código mantenible

**Tareas**:
- [ ] Actualizar README con guía completa
- [ ] Documentar API con OpenAPI/Swagger
- [ ] Crear guía de contribución
- [ ] Agregar ADRs para decisiones clave
- [ ] Documentar design system

**Estimación**: 4-6 horas

#### 6.2: Documentación de Usuario
**Objetivo**: Fácil de usar

**Tareas**:
- [ ] Crear guía de inicio rápido
- [ ] Crear tutorial de uso
- [ ] Agregar FAQs
- [ ] Crear video demo (opcional)

**Estimación**: 2-3 horas

---

## Resumen de Estimación

| Fase | Horas Estimadas | Prioridad |
|------|----------------|-----------|
| 1. Autenticación | 6-9 | ALTA |
| 2. Multi-Tenancy | 10-14 | ALTA |
| 3. Tests | 14-20 | ALTA |
| 4. UI/UX | 14-18 | MEDIA |
| 5. Performance | 7-10 | MEDIA |
| 6. Documentación | 6-9 | BAJA |
| **TOTAL** | **57-80 horas** | - |

---

## Orden de Ejecución Recomendado

1. **Fase 1** (Autenticación) - Base para todo lo demás
2. **Fase 2** (Multi-Tenancy) - Funcionalidad core
3. **Fase 3** (Tests) - Calidad y confiabilidad
4. **Fase 4** (UI/UX) - Experiencia de usuario
5. **Fase 5** (Performance) - Optimización
6. **Fase 6** (Documentación) - Pulido final

---

## Criterios de Éxito para el Challenge

### Mínimo Viable
- [ ] Autenticación funcional
- [ ] Multi-tenancy básico
- [ ] Tests unitarios > 80% cobertura
- [ ] UI pulida y responsive
- [ ] Docker funcional
- [ ] README completo

### Deseable
- [ ] Tests E2E
- [ ] Modo oscuro/claro
- [ ] API documentada
- [ ] Performance optimizada
- [ ] Reportes exportables

### Excelente
- [ ] Notificaciones en tiempo real
- [ ] Modo offline
- [ ] Video demo
- [ ] Guía de contributor

---

## Stack Tecnológico Propuesto

### Frontend
- React 19 + Vite
- Tailwind CSS v4
- TanStack Query
- React Router v8
- react-three-fiber (3D)
- Recharts (gráficas)
- Lucide React (iconos)

### Backend
- Express 5
- Drizzle ORM
- PostgreSQL (PGlite embebido)
- Zod (validación)

### Testing
- Vitest (unit + integration)
- Playwright (E2E)
- Testing Library (componentes)

### DevOps
- Docker + Docker Compose
- GitHub Actions CI/CD
- ESLint + Prettier

### Auth
- Custom magic link (sin dependencias externas)
- JWT para sesiones
- Rate limiting

---

## Próximos Pasos Inmediatos

1. **Hoy**: Configurar Vitest y empezar tests unitarios
2. **Mañana**: Implementar magic link authentication
3. **Día 3**: Multi-tenancy básico
4. **Día 4**: Tests de integración
5. **Día 5**: UI/UX improvements
6. **Día 6**: Docker y deploy
7. **Día 7**: Documentación y pulido

---

*Plan creado el 2026-08-07 para el challenge de Contra*
