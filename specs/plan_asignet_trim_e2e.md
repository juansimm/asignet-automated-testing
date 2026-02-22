# Plan: Asignet TRIM E2E

## Purpose
Implement a stable Playwright end-to-end test that performs a real ticket creation in TRIM and verifies it appears in Order Status. This run is opt-in and meant to execute only inside the Asignet private VM.

## Files to produce
- `playwright/tests/asignet-trim-e2e.spec.ts` — executable Playwright test (skipped unless `RUN_IDE_ASIGNET_E2E=1`).

## Environment
- `IDE_BASE_URL` (example: `https://ide.asignet.com/`)
- `IDE_ASIGNET_USERNAME`, `IDE_ASIGNET_PASSWORD`
- `RUN_IDE_ASIGNET_E2E=1` (must be set to run)
- Optional: `IDE_TRIM_HOME_URL` to jump directly to TRIM project.

## Strategy
1. Navigate to `${IDE_BASE_URL}sso.ashx`.
2. If session exists, continue; otherwise, detect the login form and perform login with provided credentials.
3. Ensure TRIM header `TRIM - Telecom Resources Information Management` is visible.
4. Navigate to `Service Orders`, perform a minimal create flow and click the `OK` button in the footer.
5. Go to `Order Status` and assert the newly created ticket appears in the recent rows.

## Test robustness / flakiness mitigation
- Use explicit navigation waits and `getByRole`/`getByText` where possible.
- Use multiple fallback selectors for legacy inputs.
- Fail fast with clear error messages if a required selector is missing — this makes fix iterations quicker.

## Acceptance criteria
- The test completes without unexpected timeouts when executed in the Asignet VM with correct env vars.
- The test verifies ticket creation by finding either the new ticket ID in the recent rows or a new row associated to the logged-in user.

## Run locally (developer)
Set env vars and run:
```
export RUN_IDE_ASIGNET_E2E=1
export IDE_BASE_URL="https://ide.asignet.com/"
export IDE_ASIGNET_USERNAME="..."
export IDE_ASIGNET_PASSWORD="..."
npx playwright test playwright/tests/asignet-trim-e2e.spec.ts -g "TRIM"
```

Notes:
- The test is intentionally conservative about automatic clicks that create tickets in production: `RUN_IDE_ASIGNET_E2E` is required to opt-in.
# Plan: Asignet TRIM E2E

## Purpose
Implement a stable Playwright end-to-end test that performs a real ticket creation in TRIM and verifies it appears in Order Status. This run is opt-in and meant to execute only inside the Asignet private VM.

## Files to produce
- `playwright/tests/asignet-trim-e2e.spec.ts` — executable Playwright test (skipped unless `RUN_IDE_ASIGNET_E2E=1`).

## Environment
- `IDE_BASE_URL` (example: `https://ide.asignet.com/`)
- `IDE_ASIGNET_USERNAME`, `IDE_ASIGNET_PASSWORD`
- `RUN_IDE_ASIGNET_E2E=1` (must be set to run)
- Optional: `IDE_TRIM_HOME_URL` to jump directly to TRIM project.

## Strategy
1. Navigate to `${IDE_BASE_URL}sso.ashx`.
2. If session exists, continue; otherwise, detect the login form and perform login with provided credentials.
3. Ensure TRIM header `TRIM - Telecom Resources Information Management` is visible.
4. Navigate to `Service Orders`, perform a minimal create flow and click the `OK` button in the footer.
5. Go to `Order Status` and assert the newly created ticket appears in the recent rows.

## Test robustness / flakiness mitigation
- Use explicit navigation waits and `getByRole`/`getByText` where possible.
- Use multiple fallback selectors for legacy inputs.
- Fail fast with clear error messages if a required selector is missing — this makes fix iterations quicker.

## Acceptance criteria
- The test completes without unexpected timeouts when executed in the Asignet VM with correct env vars.
- The test verifies ticket creation by finding either the new ticket ID in the recent rows or a new row associated to the logged-in user.

## Run locally (developer)
Set env vars and run:
```
export RUN_IDE_ASIGNET_E2E=1
export IDE_BASE_URL="https://ide.asignet.com/"
export IDE_ASIGNET_USERNAME="..."
export IDE_ASIGNET_PASSWORD="..."
npx playwright test playwright/tests/asignet-trim-e2e.spec.ts -g "TRIM"
```

Notes:
- The test is intentionally conservative about automatic clicks that create tickets in production: `RUN_IDE_ASIGNET_E2E` is required to opt-in.
# Plan de Prueba E2E: Asignet TRIM

## Objetivo
Automatizar el flujo E2E en TRIM para:
1. Autenticarse en el portal IDE usando SSO o credenciales.
2. Crear un ticket en `Service Orders`.
3. Validar la creación del ticket en `Order Status`.

## Pasos Detallados

### 1. Preparación
- Configurar variables de entorno:
  - `IDE_BASE_URL`
  - `IDE_ASIGNET_USERNAME`
  - `IDE_ASIGNET_PASSWORD`
  - `RUN_IDE_ASIGNET_E2E=1`
- Verificar que el test se ejecuta en una VM Ubuntu conectada a la red privada Asignet.

### 2. Flujo de Autenticación
- Navegar a `${IDE_BASE_URL}/sso.ashx`.
- Si ya hay sesión activa:
  - Continuar al portal.
- Si no hay sesión:
  - Redirigir a `${IDE_BASE_URL}/login`.
  - Completar el formulario con `IDE_ASIGNET_USERNAME` y `IDE_ASIGNET_PASSWORD`.
  - Confirmar redirección exitosa a `/sso.ashx` o `/page.ashx`.

### 3. Entrada a TRIM
- Seleccionar la tarjeta `TRIM`.
- Validar que el header contiene `TRIM - Telecom Resources Information Management`.

### 4. Crear Ticket en `Service Orders`
- Navegar a la sección `Service Orders`.
- Hacer scroll hasta el footer.
- Confirmar la creación del ticket con el botón `OK`.

### 5. Validar en `Order Status`
- Volver a la página principal (`Home`).
- Navegar a `Order Status`.
- Validar que el ticket recién creado aparece en la lista:
  - Preferido: ID del ticket visible.
  - Fallback: Detectar nueva fila respecto al baseline + verificar usuario actual.

### 6. Limpieza
- Asegurar que el test no deja datos residuales en el entorno.

## Reglas y Restricciones
- No hardcodear credenciales.
- Usar locators robustos y estables.
- Manejar esperas explícitas para evitar flakiness.
- Encapsular el test en un archivo dedicado.

## Archivos Relacionados
- Test Playwright: `playwright/tests/asignet-trim-e2e.spec.ts`
- Archivo semilla: `playwright/tests/seed.spec.ts`

## Criterio de Aceptación
- El flujo completo pasa en la VM privada.
- Se confirma la creación del ticket en `Order Status`.
- El test falla con mensajes claros si no se cumple algún paso.