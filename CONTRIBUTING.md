# Guía de Contribución — SecureSupply

Gracias por tu interés en contribuir a SecureSupply. Este documento describe el proceso para contribuir al proyecto.

## Convenciones

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <descripción>

[tipo](<ámbito>): <descripción en español>
```

Tipos permitidos:

- `feat` — Nueva funcionalidad
- `fix` — Corrección de bug
- `chore` — Tareas de mantenimiento
- `docs` — Documentación
- `refactor` — Refactorización
- `test` — Tests
- `ci` — Infraestructura de CI/CD
- `style` — Cambios de formato (no funcionales)

Ejemplos:

```
feat(api): agregar endpoint de health check
fix(worker): corregir manejo de errores en clone
docs(readme): agregar instrucciones de Docker
```

### Ramas (Branches)

Usar el formato `<tipo>/<descripción>`:

```
feat/scan-status-endpoint
fix/clone-timeout
docs/update-readme
```

### Pull Requests

1. Crear una rama desde `main`
2. Desarrollar y commiterar siguiendo las convenciones
3. Abrir un Pull Request contra `main`
4. Asegurarse de que el CI pase (typecheck, lint, tests, build)
5. Solicitar revisión

## Requisitos para PRs

Antes de abrir un PR, verificar:

- [ ] `pnpm -r typecheck` pasa sin errores
- [ ] `pnpm -r lint` pasa sin errores
- [ ] `pnpm test` pasa (todos los tests)
- [ ] No hay secrets ni credenciales en el diff
- [ ] Variables de entorno nuevas documentadas en `.env.example`
- [ ] Código nuevo tiene tests
- [ ] Comentarios en español
- [ ] Versiones exactas (sin ^ ni ~) en package.json
- [ ] `pnpm install --frozen-lockfile` se mantiene actualizado

## Entorno de Desarrollo

Ver [README.md](README.md) para instrucciones de setup.

## Código de Conducta

Sé respetuoso, constructivo y profesional. Las contribuciones deben enfocarse en el código, no en las personas.
