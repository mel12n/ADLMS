# Criterios para Mejorar la Precisión de Medición de Halos (ADLMS / DeepHalo)

**Fuente de evidencia:** [Mediciones.csv](../Mediciones.csv) (15 mediciones en 3 placas comparando `app` vs `human` en mm).

---

## 1. Diagnóstico Observado

Al comparar las mediciones de la aplicación (`app`) contra la lectura manual (`human`):

- **Subestimación sistemática proporcional:** En **13 de 15** casos, la app mide **menos** que el humano (entre **-1.6 mm y -9.6 mm**, aproximadamente **12%–29% menos**).
  - Placa 1: `CTL` (27.7 vs 35), `CAZ` (25.4 vs 30), `CAL` (25.0 vs 30), `CTX` (28.0 vs 32).
  - Placa 2: `CIP` (10.4 vs 12), `F` (17.9 vs 20), `CFR` (13.6 vs 16), `CTX` (27.5 vs 32).
  - Placa 3: `ETP` (26.9 vs 33), `TZP` (23.4 vs 33), `MEM` (24.9 vs 30), `FEP` (25.1 vs 32), `IPM` (24.2 vs 28).
- **Piso físico correcto:** `SXT` = `6.0 mm` vs `6 mm` (sin halo, igual al diámetro físico del disco).
- **Outlier positivo:** `FOS` = `26.9 mm` vs `21 mm` (`+5.9 mm`), típico de solapamiento con un halo vecino o reflejo en el agar.

---

## 2. Criterios de Mejora (Priorizados)

### Criterio 1 — Calibración `px/mm` del disco de 6 mm (Prioridad Alta)
- **Problema:** Si el diámetro del disco detectado en píxeles incluye sombra o borde del papel, `px_per_mm = disc_px / 6.0` queda sobreestimado, reduciendo proporcionalmente todos los halos medidos.
- **Acción:**
  - Auditar cómo se calcula el diámetro en píxeles de los discos de `6 mm`.
  - Usar la mediana de los discos detectados en la placa y verificar que la máscara del disco no esté sobre-dilatada (evaluar erosión ligera o ajuste circular sobre el papel blanco del disco).

### Criterio 2 — Umbral de segmentación del halo (`maskThreshold`) (Prioridad Alta)
- **Problema:** El borde exterior del halo de inhibición es un gradiente suave donde inicia el crecimiento bacteriano; un umbral alto (`0.5`) recorta solo el centro más nítido y pierde 2–4 mm por radio.
- **Acción:**
  - Evaluar bajar el umbral de máscara del halo (p. ej. `0.35–0.40`) y medir el impacto en MAE contra `Mediciones.csv`.

### Criterio 3 — Refinamiento radial sobre imagen de alta resolución (Prioridad Media)
- **Problema:** `yolo11n_seg_416_fp32` produce máscaras de baja resolución (`~104×104`), donde 1 píxel de máscara equivale a ~1–1.5 mm.
- **Acción:**
  - Usar YOLO para ubicar el centro del disco y la región del halo, y calcular el radio final mediante **perfil radial de intensidad** sobre la imagen escalada (`<= 1024 px`).

### Criterio 4 — Robustez contra outliers por solapamiento (Prioridad Media)
- **Problema:** Casos como `FOS` (`26.9` vs `21`) ocurren cuando un halo vecino o reflejo infla el `bounding box` o el radio máximo.
- **Acción:**
  - Medir el radio en múltiples ángulos desde el centro del disco y usar la **mediana** (o percentil 50–60) en lugar del máximo o del ancho del `bounding box`.

### Criterio 5 — Validación / Calibración empírica (Prioridad Baja / Complementaria)
- **Acción:**
  - Usar un conjunto de placas anotadas más amplio para validar que, tras ajustar `px/mm` y `maskThreshold`, el MAE baje hacia `<= 0.50 mm` sin introducir sesgo positivo.
