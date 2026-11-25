# TR6948 On-Device Benchmark Report

- **Device Serial:** `R01236I38026001913`
- **Package:** `cl.unab.adlms.deephalo`
- **Locked Variant:** `None` (simd=None, MAE=None mm)
- **Within 2.0s TRT:** `False`
- **Hardware Delta Note:** No clinical-compliant (MAE <= 0.50 mm) zero-lmkd cell completed all runs.

| Variant | SIMD | MAE (mm) | Verdict | Runs | Cold 1st (ms) | Warm Mean (ms) | Warm ORT (ms) | Warm P95 (ms) | Peak PSS (MB) | Peak RSS (MB) | lmkd | Crashes |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `yolo11n_seg_320_fp32` | 1 | 1.0351 | NOT_SHIPPABLE | 20/10 | 0.0 | None | None | None | None | None | 0 | 0 |
| `yolo11n_seg_320_fp32` | 0 | 1.0351 | NOT_SHIPPABLE | 20/10 | 0.0 | None | None | None | None | None | 0 | 0 |
| `yolo11n_seg_320_qdq_int8` | 1 | 1.1958 | NOT_SHIPPABLE | 20/10 | 0.0 | None | None | None | None | None | 0 | 0 |
| `yolo11n_seg_320_qdq_int8` | 0 | 1.1958 | NOT_SHIPPABLE | 20/10 | 0.0 | None | None | None | None | None | 0 | 0 |
| `yolo11n_seg_416_fp32` | 1 | 0.4678 | SHIPPABLE | 20/10 | 0.0 | None | None | None | None | None | 0 | 0 |
| `yolo11n_seg_416_fp32` | 0 | 0.4678 | SHIPPABLE | 20/10 | 0.0 | None | None | None | None | None | 0 | 0 |
| `yolo11n_seg_416_qdq_int8` | 1 | 0.8197 | NOT_SHIPPABLE | 20/10 | 0.0 | None | None | None | None | None | 0 | 0 |
| `yolo11n_seg_416_qdq_int8` | 0 | 0.8197 | NOT_SHIPPABLE | 20/10 | 0.0 | None | None | None | None | None | 0 | 0 |
