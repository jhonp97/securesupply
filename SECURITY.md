# Política de Seguridad — SecureSupply

## Divulgación Responsable

SecureSupply se toma en serio la seguridad de la plataforma. Si encuentras una vulnerabilidad de seguridad, por favor repórtala de manera responsable para que podamos solucionarla antes de que sea divulgada públicamente.

## Proceso de Reporte

1. **NO** crees un issue público en GitHub.
2. Envía un correo a **security@securesupply.dev** con los siguientes detalles:
   - Descripción clara del problema
   - Pasos para reproducir la vulnerabilidad
   - Versión afectada (commit, rama, versión)
   - Impacto potencial
   - Sugerencia de mitigación (si aplica)

3. **Espera nuestra respuesta** en un plazo de 72 horas hábiles.
4. Trabajaremos contigo para:
   - Confirmar la vulnerabilidad
   - Determinar el alcance
   - Desarrollar un parche
   - Coordinar la divulgación

## Alcance

Los siguientes componentes están dentro del alcance de esta política:

- API REST (apps/api)
- Worker de análisis (apps/worker)
- Frontend web (apps/web)
- Configuración de infraestructura (Docker, CI/CD)
- Dependencias del proyecto

## Fuera de Alcance

Los siguientes NO están cubiertos por esta política:

- Ataques de denegación de servicio (DoS)
- Spam o ingeniería social
- Reportes automatizados sin verificación manual

## Reconocimiento

Damos crédito público a quienes reporten vulnerabilidades válidas en nuestro archivo `SECURITY.md` (a menos que soliciten anonimato) después de que el parche sea publicado.

## Versiones Soportadas

| Versión | Soportada          |
| ------- | ------------------ |
| 0.1.x   | ✅ (desarrollo activo) |
| < 0.1   | ❌                  |

## Actualizaciones

Esta política puede actualizarse periódicamente. Los cambios serán reflejados en este archivo.
