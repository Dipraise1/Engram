# Engram Benchmark Suite

Compares Engram retrieval against Pinecone, Weaviate, and pgvector.

## Quick Start

```bash
# 1. Start Engram Web API
cd /path/to/Engram
uvicorn engram-web.api.main:app --port 8000

# 2. Install deps
pip install -r scripts/bench/requirements.txt

# 3. Run benchmark
python scripts/bench/run.py --engram-only --dataset nfcorpus
python scripts/bench/run.py --all --output report.md
```

## Datasets

Uses BEIR subsets (nfcorpus, fiqa, scidocs) by default.
Falls back to synthetic data if BEIR is not installed.

## Output

Generates `bench_report.md` with recall@K and latency metrics.
