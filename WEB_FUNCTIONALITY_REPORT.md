# Reporte de Validación y Consolidación de Funcionalidad Web — DeepHalo / Suite ADLMS

**Fecha:** 2026-11-26  
**Entorno:** `mvp_web/` (`http://localhost:8123/index.html`) sincronizado con `android/app/src/main/assets/mvp_web/`  
**Propósito:** Evidencia técnica de la dimensión **Funcionalidad Web** para el cierre de la Fase 3 (Iteraciones 3 y 4).

---

## 1. Tiempo Total de Respuesta ($\text{TRT}$) e Inferencia en el Borde

**Protocolo de prueba:** Ejecución automatizada mediante `?bench=10` (`runBenchmarkSuite` + `ADLMS_TELEMETRY_UI` en [`mvp_web/telemetry_ui.js`](mvp_web/telemetry_ui.js) y [`mvp_web/app.js`](mvp_web/app.js)), sobre las placas `gn_a`, `gp_a`, `gn_b` y `test_01` en navegador Chromium.

- **Modelo:** `yolo11n_seg_416_fp32`
- **Modo:** `edge-wasm` (`SIMD: true`)
- **Corridas:** $n = 10$ (`0` errores)

| Métrica | Mínimo | Máximo | Media | Mediana | Desv. Est. | Umbral Fase 2 | Estado |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Inferencia pura (`ortInferenceMs`)** | $292\text{ ms}$ | $420\text{ ms}$ | **$331.8\text{ ms}$** | **$326.0\text{ ms}$** | $37.3\text{ ms}$ | $< 800\text{ ms}$ | **Cumple** |
| **$\text{TRT}$ completo (`totalMs`, $n=10$)** | $365\text{ ms}$ | $1267\text{ ms}$ | **$505.9\text{ ms}$** | **$406.0\text{ ms}$** | $272.0\text{ ms}$ | $\le 2000\text{ ms}$ | **Cumple** |
| **$\text{TRT}$ *warm* ($n=9$, sin *cold start*)** | $365\text{ ms}$ | $533\text{ ms}$ | **$421.3\text{ ms}$** | **$402.0\text{ ms}$** | — | $\le 2000\text{ ms}$ | **Cumple** |

---

## 2. Tasa de Integridad Sintáctica HL7 FHIR ($\text{TIS}$)

### 2.1. Evolución entre Iteraciones (Iteración 3 → Iteración 4)
1. **Iteración 3 (Detección de brechas):** Al validar el `Bundle` inicial de `buildFhir()` en `https://validator.fhir.org/`, se detectaron errores estructurales (`bdl-15`: ausencia de `fullUrl` en `Bundle.entry`) y terminológicos (código SNOMED CT `70549008` erróneo, `display` no canónico en LOINC `18769-0`, `Observation.interpretation` y LOINC/ATC), además de `37` alertas de buenas prácticas (`dom-6`, `subject`, `performer`). Detalle completo en [`docs/FHIR_VALIDATION_REPORT.md`](docs/FHIR_VALIDATION_REPORT.md).
2. **Iteración 4 (Corrección y validación):** Se actualizó `buildFhir()` en [`mvp_web/app.js`](mvp_web/app.js):
   - Generación de `fullUrl: "urn:uuid:<uuid-v4>"` válido en minúsculas para cada `Bundle.entry` y referencias coherentes en `DiagnosticReport.result`.
   - Corrección de `http://loinc.org#18769-0` a `display: "Microbial susceptibility tests Set"` y eliminación del código SNOMED erróneo `70549008`.
   - Uso de `display` oficiales en `Observation.interpretation` (`Susceptible`, `Intermediate`, `Resistant`), manteniendo la etiqueta en español en `interpretation.text`.
   - Omisión de `display` no canónicos en `Observation.code.coding` (conservando la descripción en `code.text`).
   - Adición de narrativa HTML (`text.status = "generated"`), `subject` y `performer` en `DiagnosticReport` y `Observation` para eliminar las `37` alertas.
3. **Resultado final:**
   - Validación automática en `venv` con `fhir.resources` (`R4B`, `Bundle.model_validate`): **13 entradas válidas, 0 errores**.
   - Validación en `https://validator.fhir.org/` sobre [`docs/fhir_bundle_sample.json`](docs/fhir_bundle_sample.json): **$\text{TIS} = 100\%$ (`0` fatales, `0` errores)**.

---

## 3. Homologación Visual y Sincronización Web / APK Android

- **Unificación de interfaz:** Se actualizaron las reglas de [`mvp_web/style.css`](mvp_web/style.css) para aplicar en la versión web de escritorio el mismo layout continuo de la tablet/APK (flujo vertical entre **Placa** y **Resultados** + barra flotante inferior **Placa – Resultados – Capturar**).
- **Sincronización:** Se copiaron [`mvp_web/app.js`](mvp_web/app.js) y [`mvp_web/style.css`](mvp_web/style.css) hacia `android/app/src/main/assets/mvp_web/` verificando paridad exacta por hash.
