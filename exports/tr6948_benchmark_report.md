# TR6948 On-Device Benchmark Report

- **Device Serial:** `R01236I38026001913`
- **Package:** `cl.unab.adlms.deephalo`
- **Locked Variant:** `yolo11n_seg_416_fp32` (simd=0, MAE=0.4678 mm)
- **Within 2.0s TRT:** `False`
- **Hardware Delta Note:** TR6948 32-bit armeabi-v7a (968 MB RAM) warm ORT inference is 6010.33 ms vs ADR-001 64-bit <= 2000 ms TRT target.

| Variant | SIMD | MAE (mm) | Verdict | Runs | Cold 1st (ms) | Warm Mean (ms) | Warm ORT (ms) | Warm P95 (ms) | Peak PSS (MB) | Peak RSS (MB) | lmkd | Crashes |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `yolo11n_seg_320_fp32` | 1 | 1.0351 | NOT_SHIPPABLE | 10/10 | 15332.0 | 6767.33 | 6020.67 | 7119.0 | None | None | 0 | 0 |
| `yolo11n_seg_320_fp32` | 0 | 1.0351 | NOT_SHIPPABLE | 10/10 | 13447.0 | 6693.22 | 6015.89 | 6978.0 | None | None | 0 | 0 |
| `yolo11n_seg_320_qdq_int8` | 1 | 1.1958 | NOT_SHIPPABLE | 10/10 | 13323.0 | 6647.44 | 5988.22 | 7053.0 | None | None | 0 | 0 |
| `yolo11n_seg_320_qdq_int8` | 0 | 1.1958 | NOT_SHIPPABLE | 10/10 | 13052.0 | 6591.0 | 5928.78 | 6806.0 | None | None | 0 | 0 |
| `yolo11n_seg_416_fp32` | 1 | 0.4678 | SHIPPABLE | 10/10 | 14494.0 | 6675.11 | 6016.44 | 6937.0 | None | None | 0 | 0 |
| `yolo11n_seg_416_fp32` | 0 | 0.4678 | SHIPPABLE | 10/10 | 13253.0 | 6693.0 | 6010.33 | 6881.0 | None | None | 0 | 0 |
| `yolo11n_seg_416_qdq_int8` | 1 | 0.8197 | NOT_SHIPPABLE | 10/10 | 13390.0 | 6630.78 | 5985.44 | 6824.0 | None | None | 0 | 0 |
| `yolo11n_seg_416_qdq_int8` | 0 | 0.8197 | NOT_SHIPPABLE | 10/10 | 12756.0 | 6656.78 | 6000.22 | 6854.0 | None | None | 0 | 0 |
