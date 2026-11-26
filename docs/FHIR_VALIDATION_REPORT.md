# Reporte de Validación HL7 FHIR R4 — DeepHalo / ADLMS

**Fecha:** 2026-11-26  
**Herramienta:** HL7 FHIR Validator GUI (`https://validator.fhir.org/`)  
**Componente auditado:** `buildFhir()` en [`mvp_web/app.js`](../mvp_web/app.js)  
**Contexto:** Verificación de la métrica **Tasa de Integridad Sintáctica FHIR (TIS)** (umbral Fase 2: `TIS = 100%`, `0` errores).

---

## 1. Resumen de Hallazgos (Pre-corrección / Iteración 3)

Al validar el `Bundle` JSON generado por `mvp_web` en `https://validator.fhir.org/`, el validador oficial reportó **90 resultados** (errores estructurales, errores terminológicos y advertencias de buenas prácticas), por lo que en esta primera pasada **`TIS = 0%`** (requiere corrección antes del cierre de Iteración 4).

### 1.1. Errores Estructurales (`Bundle`)
- **Regla `bdl-15` — Ausencia de `fullUrl` en `Bundle.entry`:**
  - *Mensaje:* `Bundle resources where type is not transaction, transaction-response, batch, or batch-response or when the request is a POST SHALL have Bundle.entry.fullUrl populated`
  - *Mensaje:* `Relative Reference appears inside Bundle whose entry is missing a fullUrl`
  - *Causa:* Cada entrada en `Bundle.entry[]` carecía del campo `fullUrl` (ej. `urn:uuid:<id>`), y `DiagnosticReport.result` usaba referencias relativas sin `fullUrl` correspondiente.

### 1.2. Errores Terminológicos (`CodeSystem` / `display`)
- **Código SNOMED CT incorrecto en `DiagnosticReport.code`:**
  - *Valor actual:* `http://snomed.info/sct#70549008` (`"Antimicrobial susceptibility test"`).
  - *Mensaje:* `Wrong Display Name 'Antimicrobial susceptibility test' for http://snomed.info/sct#70549008. Valid display is one of 2 choices: 'Insertion of catheter for central venous pressure monitoring'`
  - *Causa:* El código `70549008` corresponde a inserción de catéter venoso central, no a pruebas de susceptibilidad antimicrobiana.
- **Display LOINC incorrecto en `DiagnosticReport.code`:**
  - *Valor actual:* `http://loinc.org#18769-0` con display `"Microbial susceptibility tests"`.
  - *Mensaje:* `Valid display is 'Microbial susceptibility tests Set'`.
- **Display de interpretación (`Observation.interpretation`):**
  - *Valor actual:* `http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#S` con display `"Sensible"`.
  - *Mensaje:* `Wrong Display Name 'Sensible' ... Valid display is 'Susceptible'`. (Lo mismo aplica para `I` → `Intermediate` y `R` → `Resistant`).
- **Display LOINC y WHO ATC en `Observation.code`:**
  - *Mensaje:* `Wrong Display Name 'Levofloxacino disk diffusion' for http://loinc.org#21367-8` y `Wrong Display Name 'Levofloxacino' for http://www.whocc.no/atc#J01MA12`.
  - *Causa:* Los nombres `display` en `coding[]` estaban en español o con sufijos no oficiales en lugar del término exacto del *CodeSystem* (o bien deben omitirse/moverse a `code.text` cuando no se dispone del *display* canónico en inglés).

### 1.3. Advertencias de Buenas Prácticas (Warnings)
- `dom-6`: Se recomienda incluir `text` (narrativa HTML) en `DomainResource` (`DiagnosticReport` / `Observation`).
- `Observation`: Se recomienda incluir `subject` y `performer` en las observaciones.

---

## 2. Plan de Corrección (Iteración 4)

1. Agregar `fullUrl: "urn:uuid:..."` único a cada `entry` del `Bundle` y alinear `DiagnosticReport.result[].reference`.
2. Corregir `DiagnosticReport.code`:
   - `http://loinc.org#18769-0` → `display: "Microbial susceptibility tests Set"`.
   - Eliminar el código erróneo `http://snomed.info/sct#70549008`.
3. Corregir `Observation.interpretation.coding`:
   - Usar los `display` oficiales en inglés (`"Susceptible"`, `"Intermediate"`, `"Resistant"`), manteniendo la etiqueta en español en `interpretation.text`.
4. En `Observation.code.coding` (LOINC y WHO ATC), omitir el `display` no canónico dentro de `coding[]` (conservando la descripción legible en español en `Observation.code.text`).
5. Re-validar el `Bundle` resultante con `fhir.resources` (R4) y en `https://validator.fhir.org/` (preset **R4**) para verificar `0` errores (`TIS = 100%`).
