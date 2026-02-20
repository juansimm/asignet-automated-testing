# Prompt Para Agente (Copilot + MCP)

Usá este prompt en Copilot Chat con modo agente.

## Precondiciones

- Repositorio abierto: `asignet-automated-testing`
- MCP Playwright activo (`bun run agents:mcp`)
- Request fuente: `specs/request_20260220_134552.md`

## Prompt (Planner)

```text
Actuá como `playwright-test-planner`.

Objetivo:
- Leer `specs/request_20260220_134552.md` y crear un plan de pruebas completo para el flujo privado de Asignet IDE/TRIM.

Requisitos:
- Guardar plan en `specs/test-plan_trim_private_network.md`.
- Incluir casos positivos, validaciones críticas, riesgos de flakiness y estrategia de locators estables.
- Considerar variantes de flujo:
  1) login -> sso -> Enter -> card TRIM
  2) login -> sso -> Enter -> redirect directo a portal/TRIM
  3) fallback con URL directa `IDE_TRIM_HOME_URL`
- Incluir assertions explícitas por paso y criterios de aceptación.

Antes de terminar, usá herramientas MCP de Playwright cuando aplique para validar navegación base.
```

## Prompt (Generator)

```text
Actuá como `playwright-test-generator`.

Objetivo:
- Usar `specs/test-plan_trim_private_network.md` para generar/ajustar tests ejecutables.

Requisitos:
- Trabajar sobre `playwright/tests/asignet-trim-service-orders.spec.ts`.
- No crear hardcode de credenciales.
- Usar envs: `IDE_BASE_URL`, `IDE_ASIGNET_USERNAME`, `IDE_ASIGNET_PASSWORD`, `RUN_IDE_ASIGNET_E2E`, `IDE_TRIM_HOME_URL`.
- Mantener robustez para:
  - pantalla `/sso.ashx` con botón Enter
  - card TRIM opcional
  - cambios de tab/page (popup o reemplazo de contexto)
- Mantener assertions claras de creación de ticket y verificación en Order Status.
```

## Prompt (Healer)

```text
Actuá como `playwright-test-healer`.

Objetivo:
- Ejecutar y estabilizar el flujo TRIM hasta que pase en VM Ubuntu privada.

Comandos:
- `npx playwright test playwright/tests/asignet-trim-service-orders.spec.ts --config=playwright/playwright.config.ts`

Requisitos:
- Corregir fallos reales sin romper el comportamiento esperado.
- Priorizar locators por role/label/text estable.
- Si falla por transición SSO/Enter o cambio de página, ajustar manejo de navegación/contexto.
- Mantener mensajes de error útiles para debug.

Criterio final:
- Test en verde y evidencia de que el ticket aparece en `Order Status`.
```

## Verificación MCP (Prompt corto)

```text
Antes de planificar, confirmá que MCP está operativo ejecutando tools Playwright:
1. listá tests (`playwright-test/test_list`)
2. navegá a https://example.com (`playwright-test/browser_navigate`)
Si no hay tools, avisame explícitamente que MCP no está conectado.
```

