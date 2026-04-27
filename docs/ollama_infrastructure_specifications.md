# PolicyBot Ollama Infrastructure Specifications

# PolicyBot Ollama Infrastructure Specifications

## Overview

This document provides infrastructure recommendations for achieving different response time targets when running PolicyBot with Ollama (Qwen 3.5 model) on Azure VMs with CPU-only access.

**Baseline Configuration:**
- Model: Qwen 3.5 0.8B
- Embedding: bge-m3 base
- Reranker: bge-m3
- Documents: 3 documents, 2983 chunks (800 chars each)
- Current Performance: 436 seconds for ~500 tokens

---

## Infrastructure Options by Response Time Target

| Target Response | vCPU | RAM | Model Size | Quantization | Storage Type | Est. Tokens/sec |
|-----------------|------|-----|------------|--------------|--------------|-----------------|
| **< 1 second** | 64+ | 128 GB | 0.3B | Q4_K_M | NVMe SSD | ~500+ |
| **10 seconds** | 16-32 | 32-64 GB | 0.5B | Q4_K_M | NVMe SSD | ~50 |
| **100 seconds** | 8 | 16 GB | 0.8B | Q4_K_M | NVMe SSD | ~5 |
| **436 seconds** | 2 | 4 GB | 0.8B | FP16 | HDD | ~1.15 |

---

## Storage Type Impact Analysis (NVMe SSD vs HDD)

| Target Response | NVMe SSD Performance | HDD Performance | Impact Assessment |
|-----------------|---------------------|-----------------|-------------------|
| **< 1 second** | Baseline (achievable) | +30-60s additional latency | **Impossible** — HDD becomes bottleneck for model loading/swapping |
| **10 seconds** | Baseline (achievable) | +5-15s additional latency | **Warning** — May push response to 15-25s; still near target |
| **100 seconds** | Baseline (achievable) | +2-5s additional latency | **Minor** — Remains within acceptable range |
| **436 seconds** | Baseline | +1-3s additional latency | **Negligible** — Impact minimal at this latency tier |

---

## Key Findings

### Performance Bottlenecks

1. **LLM Inference** — Accounts for 99.7% of total response time (434.9s of 436.1s)
2. **RAG Pipeline** — Already optimized at 1.1s (not a bottleneck)
3. **CPU Parallelization** — 2 vCPU insufficient for matrix multiplication workloads

### Storage Impact Summary

- **High-performance targets (<10s): NVMe SSD is mandatory** — HDD cannot support sub-10s response times due to model loading and KV cache swapping
- **Medium-performance targets (10-100s): NVMe SSD preferred** — HDD adds noticeable but acceptable latency
- **Low-performance targets (>100s): HDD acceptable** — Storage type has minimal impact

### Optimization Recommendations

1. **Use GGUF quantized models** (Q4_K_M or Q5_K_S) to reduce memory footprint
2. **Configure Ollama parameters:**
   - `num_gpu=0` (explicit CPU mode)
   - `num_thread` = vCPU count
   - `num_ctx=2048` (smaller context for faster inference)
3. **Prioritize RAM over vCPU** — Insufficient RAM causes KV cache swapping to disk

---

## Azure VM Recommendations

| Target | Recommended VM Series | Example SKU |
|--------|----------------------|-------------|
| < 1 second | NC-series (GPU) | NC4as_T4_v3 |
| 10 seconds | Edsv5-series | E4ds_v5 |
| 100 seconds | Ddsv5-series | D4ds_v5 |
| 436 seconds | Basic/A-series | Basic_A2_v2 |

---

## Notes

- All specifications assume CPU-only inference (no GPU)
- Model quantization significantly impacts performance; always use Q4 or lower
- Actual performance may vary based on workload patterns and concurrent requests
- Consider auto-scaling for production deployments

---

*Document generated for infrastructure planning purposes*
