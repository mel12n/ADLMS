# Phase 11: Pipeline Precision Upgrade & Fase 3 Report - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-27
**Phase:** 11-Pipeline Precision Upgrade & Fase 3 Report
**Areas discussed:** ROI automático -> CLAHE -> Inferencia, Calibración 6.0 mm y Sobel 36 rayos, Manejo de perspectiva / inclinación, XAI real (prototipos ONNX) y documentación Fase 3

---

## 1. ROI automático -> CLAHE -> Inferencia (Aislamiento ROI)

| Option | Description | Selected |
|--------|-------------|----------|
| Detección automática del ROI circular | JS puro en `mvp_web/` + OpenCV en Python con fallback seguro si la placa ya llena el encuadre (`>85%`) | ✓ |
| Recorte manual guiado | Usuario encuadra un círculo antes de inferir | |
| Automático + re-encuadre manual | Automático por defecto con ajuste manual opcional | |

**User's choice:** Detección automática del ROI circular con fallback seguro (`>85%`).

## 1b. ROI automático -> CLAHE -> Inferencia (Aplicación de CLAHE)

| Option | Description | Selected |
|--------|-------------|----------|
| ROI limpio para YOLO + ROI -> CLAHE para Sobel/visualización | Evita *domain shift* en `best.pt` y corrige `preprocess.py` / `streamlit_app.py` | ✓ |
| ROI -> CLAHE para ambos (YOLO y Sobel) | Sin reentrenar | |
| Evaluar ambos y elegir menor MAE | Comparación experimental | |

**User's choice:** ROI limpio para YOLO + `ROI -> CLAHE` para Sobel/refinamiento óptico y visualización.

---

## 2. Calibración 6.0 mm y Sobel 36 rayos

| Option | Description | Selected |
|--------|-------------|----------|
| Refinamiento híbrido | Ajustar disco `6.0 mm` en alta resolución + alerta Sobel `0.5 mm` radio (`1.0 mm` diámetro, Hombach 2014) + evaluar `maskThreshold` (`0.35–0.40`) | ✓ |
| Solo bajar umbral de alerta Sobel | `1.2 mm -> 0.5 mm` radio sin tocar diámetros de YOLO | |
| Reemplazar medición YOLO por Sobel | Usar Sobel como medición final cuando gradiente sea consistente | |

**User's choice:** Refinamiento híbrido (`6.0 mm` alta resolución + alerta Sobel `0.5 mm` radio / `1.0 mm` diámetro + evaluación de `maskThreshold`).

---

## 3. Manejo de perspectiva / inclinación

| Option | Description | Selected |
|--------|-------------|----------|
| Excentricidad elíptica + compensación liviana + alerta UI (`> ~5°`) | Compensar relación eje menor/mayor a círculo antes de inferir y alertar si inclinación supera `~5°` | ✓ |
| Solo detección y alerta visual | Sin transformar la imagen | |
| Homografía proyectiva completa | Corrección proyectiva completa antes del recorte ROI | |

**User's choice:** Detección de excentricidad elíptica + compensación geométrica liviana + alerta en UI (`> ~5°`).

---

## 4. XAI real (prototipos ONNX) y documentación Fase 3

| Option | Description | Selected |
|--------|-------------|----------|
| `sigmoid(coeffs @ protos)` real en vivo + fallback heurístico en presets | XAI neuronal genuino en inferencia ONNX `FP32` + documentación completa en `f3_s09cmelian_avance.md` | ✓ |
| Reemplazo total en todas las vistas | Sin fallback heurístico | |
| Mantener visualización actual | Solo documentar justificación | |

**User's choice:** `sigmoid(coeffs @ protos)` real en inferencia en vivo + fallback heurístico en placas precargadas + documentación completa en `f3_s09cmelian_avance.md`.

---

## the agent's Discretion
- Exact pure-JS circular/elliptical Petri dish boundary detector implementation (within `< 100 ms` TR6948 budget).
- Exact `tileGridSize` / `clipLimit` tuning for CLAHE post-ROI.

## Deferred Ideas
- Full 4-point projective homography / live `getUserMedia` AR reticle (Milestone 1.5 / Phase 2.8).
- Retraining `YOLO11n-seg` at `640x640` or migrating to native Android LiteRT/NCNN INT8.
