# Engram Retrieval Benchmark Report

## Summary

| System | Recall@1 | Recall@5 | Recall@10 | p50 Latency | p95 Latency |
|--------|----------|----------|-----------|-------------|-------------|
| Engram | - | - | - | - | - |
| Pinecone | - | - | - | - | - |
| Weaviate | - | - | - | - | - |
| pgvector | - | - | - | - | - |

## Methodology

### Datasets
- **MSMARCO**: Microsoft MAchine Reading COmprehension dataset
- **NFCorpus**: Nutrition Facts Corpus for medical information retrieval
- **NQ**: Natural Questions from Google

### Metrics
- **Recall@K**: Proportion of relevant documents in top-K results
- **p50 Latency**: Median query latency
- **p95 Latency**: 95th percentile query latency

### Configuration
- **Top-K**: 10
- **Iterations**: 100 queries per system
- **Embedding Model**: text-embedding-ada-002 (1536 dimensions)

## Results

*To be updated after benchmark execution*

## Notes

- Engram uses decentralized storage with (k,n) erasure coding
- Latency includes network round-trip time
- All systems tested under same conditions
- Benchmarks run on public cloud instances

## Reproduction

```bash
# Install dependencies
pip install -r requirements.txt

# Run benchmark
python scripts/bench/benchmark.py --dataset data/msmarco_sample.json --systems engram pinecone weaviate pgvector

# Generate report
python scripts/bench/benchmark.py --output docs/benchmarks.md
```

## References

- [BEIR Benchmark](https://github.com/beir-cellar/beir)
- [MSMARCO Dataset](https://microsoft.github.io/msmarco/)
- [Engram Documentation](https://github.com/Dipraise1/Engram)
