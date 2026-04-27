# PolicyBot Ollama Infrastructure Specifications

## Overview

This document provides infrastructure recommendations for achieving different response time targets when running PolicyBot with Ollama (Qwen 3.5 model). It covers both CPU-only configurations and GPU-accelerated options on Azure VMs.

**Baseline Configuration (CPU-only):**
- Model: Qwen 3.5 0.8B
- Embedding: bge-m3 base
- Reranker: bge-m3
- Documents: 3 documents, 2983 chunks (800 chars each)
- Current Performance: 436 seconds for ~500 tokens (~1.15 tokens/sec)

---

## CPU-Only Infrastructure Options by Response Time Target

| Target Response | vCPU | RAM | Model Size | Quantization | Storage Type | Est. Tokens/sec |
|-----------------|------|-----|------------|--------------|--------------|-----------------|
| **< 1 second** | 64+ | 128 GB | 0.3B | Q4_K_M | NVMe SSD | ~500+ |
| **10 seconds** | 16-32 | 32-64 GB | 0.5B | Q4_K_M | NVMe SSD | ~50 |
| **100 seconds** | 8 | 16 GB | 0.8B | Q4_K_M | NVMe SSD | ~5 |
| **436 seconds** | 2 | 4 GB | 0.8B | FP16 | HDD | ~1.15 |

---

## GPU-Accelerated Infrastructure Options

### Performance Gains with H100/A100 GPUs

Adding GPU acceleration fundamentally transforms performance characteristics:

| Target Response | GPU | vCPU | RAM | Model Size | Quantization | Est. Tokens/sec | Notes |
|-----------------|-----|------|-----|------------|--------------|-----------------|-------|
| **2-3 seconds** | H100 | 8-16 | 64 GB | 3.5B+ | FP16 | 200-300 | Native precision possible |
| **3-5 seconds** | A100 | 8-16 | 64 GB | 3.5B | FP16 | 150-200 | Cost-optimized alternative |
| **5-10 seconds** | H100/A100 | 4-8 | 32 GB | 7B | Q4 | 100-150 | Larger models viable |
| **10-15 seconds** | A100 | 4 | 16 GB | 7B | Q4 | 50-100 | Budget option |

### Key Improvements with GPU

1. **Performance**: 175x-260x improvement over CPU-only (436s → 2-5s)
2. **Model Capacity**: Run 3.5B-7B parameter models vs 0.3B-0.8B with CPU
3. **Concurrent Requests**: Support 2-5 parallel requests via batching
4. **Storage Requirements**: Standard SSD sufficient (NVMe no longer critical)
5. **CPU Requirements**: Dramatically reduced (4-8 vCPU vs 16-64 vCPU)

---

## Storage Type Impact Analysis (NVMe SSD vs HDD)

### CPU-Only Scenarios

| Target Response | NVMe SSD Performance | HDD Performance | Impact Assessment |
|-----------------|---------------------|-----------------|-------------------|
| **< 1 second** | Baseline (achievable) | +30-60s additional latency | **Impossible** — HDD becomes bottleneck for model loading/swapping |
| **10 seconds** | Baseline (achievable) | +5-15s additional latency | **Warning** — May push response to 15-25s; still near target |
| **100 seconds** | Baseline (achievable) | +2-5s additional latency | **Minor** — Remains within acceptable range |
| **436 seconds** | Baseline | +1-3s additional latency | **Negligible** — Impact minimal at this latency tier |

### GPU Scenarios

- **With GPU**: Standard SSD (not NVMe) is sufficient; model loading is no longer the critical path
- **Storage cost savings**: ~40-60% reduction vs NVMe requirements

---

## Key Findings

### Performance Bottlenecks (CPU-Only)

1. **LLM Inference** — Accounts for 99.7% of total response time (434.9s of 436.1s)
2. **RAG Pipeline** — Already optimized at 1.1s (not a bottleneck)
3. **CPU Parallelization** — 2 vCPU insufficient for matrix multiplication workloads

### Storage Impact Summary (CPU-Only)

- **High-performance targets (<10s): NVMe SSD is mandatory** — HDD cannot support sub-10s response times due to model loading and KV cache swapping
- **Medium-performance targets (10-100s): NVMe SSD preferred** — HDD adds noticeable but acceptable latency
- **Low-performance targets (>100s): HDD acceptable** — Storage type has minimal impact

### Optimization Recommendations

#### CPU-Only Configurations

1. **Use GGUF quantized models** (Q4_K_M or Q5_K_S) to reduce memory footprint
2. **Configure Ollama parameters:**
   - `num_gpu=0` (explicit CPU mode)
   - `num_thread` = vCPU count
   - `num_ctx=2048` (smaller context for faster inference)
3. **Prioritize RAM over vCPU** — Insufficient RAM causes KV cache swapping to disk

#### GPU Configurations

1. **Enable GPU acceleration:**
   - `num_gpu=-1` (use all available VRAM)
   - `num_thread` = 4-8 (CPU threads for support tasks)
   - `num_ctx=4096+` (larger context windows now feasible)
2. **Model selection**: Use higher-parameter models (3.5B-7B) for better quality
3. **Batching**: Enable request batching for concurrent processing

---

## Cost Comparison: Buying vs Renting GPU Hardware

### H100 GPU Options

| Option | Hardware Cost | Cloud Rental (per month) | Cloud Rental (per year) | Break-even | Best For |
|--------|---------------|------------------------|-----------------------|------------|----------|
| **Purchase H100** | $40,000 | — | — | ~12-18 months | Production, 24/7 workloads |
| **Rent on Azure** | — | $24,000 | $288,000 | — | Temporary/testing, variable load |
| **Rent on Lambda Labs** | — | $18,000-22,000 | $216,000-264,000 | — | Quick deployment, no capex |
| **Rent on CoreWeave** | — | $15,000-18,000 | $180,000-216,000 | — | Specialized ML workloads |

### A100 GPU Options

| Option | Hardware Cost | Cloud Rental (per month) | Cloud Rental (per year) | Break-even | Best For |
|--------|---------------|------------------------|-----------------------|------------|----------|
| **Purchase A100** | $12,000-15,000 | — | — | ~8-12 months | Production, balanced cost/perf |
| **Rent on Azure** | — | $12,000-14,000 | $144,000-168,000 | — | Enterprise, compliance requirements |
| **Rent on Lambda Labs** | — | $8,000-10,000 | $96,000-120,000 | — | Research, development |
| **Rent on CoreWeave** | — | $6,000-8,000 | $72,000-96,000 | — | Cost-optimized production |

### Decision Matrix

| Scenario | Recommendation | Rationale |
|----------|---|---|
| **Proof-of-Concept (< 3 months)** | Rent A100 on Lambda Labs | Minimal upfront cost (~$24K-30K total) |
| **Development/Testing (3-6 months)** | Rent A100 on CoreWeave | Lower monthly cost (~$6-8K), easy to scale |
| **Production (24/7, > 12 months)** | Purchase A100 | Break-even at ~10 months, then profitable |
| **Enterprise Production (> 18 months)** | Purchase H100 or A100 | Best ROI; H100 for throughput, A100 for cost-efficiency |
| **Variable Workload (unpredictable)** | Rent with auto-scaling | Pay only for what you use |
| **Air-gapped/Local Deployment** | Purchase hardware | Required for offline operation; no cloud option |

---

## Azure VM Recommendations

### CPU-Only Deployments

| Target | Recommended VM Series | Example SKU | Est. Monthly Cost |
|--------|----------------------|-------------|-------------------|
| < 1 second | NC-series (GPU) | NC4as_T4_v3 | $2,500-3,000 |
| 10 seconds | Edsv5-series | E32s_v5 (32 vCPU) | $2,800-3,200 |
| 100 seconds | Ddsv5-series | D16ds_v5 (16 vCPU) | $1,800-2,000 |
| 436 seconds | Basic/A-series | Basic_A2_v2 | $60-100 |

### GPU-Accelerated Deployments (Azure)

| Target | Recommended VM Series | Example SKU | GPU | Est. Monthly Cost |
|--------|----------------------|-------------|-----|-------------------|
| 2-3 seconds | NCv4-series | Standard_ND100s_v4 | H100 x 8 | $24,000-28,000 |
| 3-5 seconds | NCv3-series | Standard_ND40s_v2 | A100 x 8 | $12,000-14,000 |
| 5-10 seconds | NCv3-series | Standard_ND96asr_v4 | A100 x 8 (single) | $12,000-14,000 |

---

## Practical Recommendations by Deployment Type

### For Local/Air-gapped Deployments

- **Recommended**: Purchase A100 GPU ($12-15K) + mid-range CPU server ($3-5K)
- **Total investment**: ~$15-20K
- **Performance**: 2-5 second responses
- **ROI**: Immediate for 24/7 operation; no cloud dependencies

### For Cloud-based Development

- **Recommended**: Rent A100 on CoreWeave ($6-8K/month)
- **Flexibility**: Scale up/down as needed
- **No capex**: Reduces initial investment

### For Enterprise Production

- **Recommended**: Purchase A100 ($12-15K) if > 12-month runway
- **Alternative**: Hybrid approach—purchase for stable workloads, rent for variable load spikes

---

## Notes

- CPU-only specifications assume no GPU acceleration
- GPU specifications assume H100 (80 GB HDD) or A100 (80 GB HDD) with full VRAM access
- Model quantization significantly impacts performance; always use Q4 or lower for CPU
- Actual performance may vary based on workload patterns and concurrent requests
- Cloud rental prices are approximate and subject to regional variation and provider discounts
- GPU purchase prices reflect 2024-2026 market rates; check current vendor pricing
- Consider total cost of ownership (TCO) including power consumption for on-premises hardware:
  - H100: ~700W TDP (~$5,000-6,000/year in electricity at $0.10/kWh)
  - A100: ~250W TDP (~$2,000/year in electricity at $0.10/kWh)

---

*Document generated for infrastructure planning purposes. Last updated: 2026-04-27 19:45:43*