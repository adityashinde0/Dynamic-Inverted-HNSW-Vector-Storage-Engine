# PRD — PS-005 Dynamic Inverted-HNSW Vector Storage Engine

## 1. Problem Definition

### Problem Statement

PS-005 requires the design and implementation of a dedicated hybrid vector storage engine capable of handling high-throughput vector ingestion while simultaneously serving low-latency approximate nearest-neighbor search queries.

The target workload represents financial intelligence and real-time analytics systems ingesting continuously arriving news, filings, and market transcripts that are converted into dense vectors.

The central engineering challenge is:

> How can a vector storage engine accept continuous high-rate writes without allowing index updates/rebalancing to create unacceptable query latency spikes or service downtime?

The problem statement identifies HNSW index mutation and rebalancing as a production bottleneck and proposes an LSM-style architecture as the intended direction.

### Required Production Targets

The system must target:

- Write ingestion: **> 50,000 vectors/second**
- Concurrent query throughput: **2,000 queries/second**
- Search P99 latency: **< 15 ms**

These are **requirements/acceptance targets**, not achieved benchmark results.

Actual performance must be measured on the final implementation and benchmark environment.

---

## 2. Root Cause

A conventional mutable vector index can experience contention when new vectors are inserted directly into the searchable HNSW structure.

The problem statement specifically identifies index updates/rebalancing as a source of locking and latency spikes.

The proposed architecture therefore separates:

1. High-throughput ingestion
2. Durable write logging
3. Mutable in-memory state
4. Immutable searchable segments
5. Background segment creation/processing
6. Concurrent search
7. Background maintenance

This follows the general LSM principle of allowing new writes to accumulate in an active memory structure while immutable structures are processed asynchronously. RocksDB documents a similar MemTable → immutable MemTable → persistent-file pipeline with WAL-based recovery. citeturn0search0turn0search4

---

## 3. Core Value Proposition

The system provides a vector storage engine in which:

- Incoming vectors are accepted through a high-throughput ingestion path.
- Writes are persisted through an append-only WAL.
- New vectors become immediately searchable from the active memory layer.
- Full memory buffers are sealed instead of being modified during disk conversion.
- Immutable disk segments contain independently searchable vector indexes.
- Queries execute concurrently across active memory and immutable segments.
- Per-segment top-k results are merged into a global top-k result.
- Background processing performs expensive disk/index work without blocking the primary query path.
- Recovery reconstructs unflushed state from the WAL.

The key architectural idea is:

> **Separate the write path from immutable search structures instead of continuously mutating one global HNSW index.**

---

## 4. Requirements

## 4.1 Functional Requirements

### FR-01 — Vector Ingestion

The system shall accept dense vectors for storage.

Each vector should have:

- Unique vector identifier
- Fixed dimensionality
- Float32 input representation
- Associated vector payload
- Optional metadata if required by the implementation

The initial supplied dataset contains normalized dense float32 vectors.

---

### FR-02 — WAL Persistence

The storage engine shall maintain an append-only Write-Ahead Log.

A write must be represented in the WAL before being considered durably accepted under the selected durability mode.

The WAL shall support recovery of writes that have not yet been represented by a completed immutable segment.

---

### FR-03 — Active MemTable

New vectors shall initially enter an active in-memory storage structure.

The active structure must support concurrent ingestion and search.

The implementation should minimize global locks on the ingestion/query critical path.

---

### FR-04 — MemTable Rotation

When the active memory structure reaches a configured threshold:

1. Stop accepting new writes into that structure.
2. Seal it as immutable.
3. Create/activate a replacement MemTable.
4. Continue accepting new writes.
5. Schedule asynchronous segment construction.

New writes must not wait for the entire disk-segment construction process.

---

### FR-05 — Immutable Vector Segments

Sealed data shall eventually be transformed into immutable disk segments.

Each segment shall contain sufficient information to:

- Identify vectors
- Reconstruct/search vectors
- Execute approximate nearest-neighbor search
- Validate segment integrity
- Support recovery/loading

---

### FR-06 — HNSW Segment Index

Each immutable searchable vector segment shall have an HNSW-based approximate nearest-neighbor index.

HNSW uses hierarchical proximity graphs to perform approximate nearest-neighbor search. citeturn0academia24

The implementation must expose tunable HNSW parameters where practical, such as graph construction/search parameters.

Exact parameter values shall be determined through benchmarking rather than assumed optimal values.

---

### FR-07 — Quantized Segment Representation

Disk segments shall use a quantized representation as required by the problem statement's desired solution.

The implementation must preserve enough information to provide the required search quality.

Quantization accuracy/recall shall be measured against the supplied exact ground truth.

---

### FR-08 — Concurrent Search

Queries shall search all currently relevant searchable layers:

- Active MemTable
- Immutable in-memory MemTables
- Immutable disk segments

Search operations must be able to execute concurrently with ingestion.

---

### FR-09 — Top-K Merge

Each searchable segment shall produce candidate results.

The query coordinator shall merge candidates from all searchable layers and return the final global top-k results.

For the supplied benchmark, k=10 is the primary validation target.

---

### FR-10 — Recovery

After process restart/crash simulation, the engine shall:

1. Discover persisted segments.
2. Load/validate segment metadata.
3. Identify WAL records not represented by durable segments.
4. Replay applicable WAL records.
5. Reconstruct the active/in-memory state.
6. Resume ingestion and querying.

---

### FR-11 — Benchmarking

The system shall provide reproducible benchmark tooling capable of measuring:

- Write throughput
- Query throughput
- P50 latency
- P95 latency
- P99 latency
- Recall@10
- CPU utilization
- Memory consumption
- Storage consumption
- Segment flush time
- Recovery time

---

### FR-12 — Telemetry

The system shall expose telemetry sufficient to understand:

- Current ingestion rate
- Query rate
- Query latency
- P99 latency
- Active MemTable size
- Immutable segment count
- Flush queue depth
- WAL size
- Search fan-out
- Error count
- Recovery state

---

## 4.2 Non-Functional Requirements

### NFR-01 — Throughput

Target:

> >50,000 vector writes/second

This must be demonstrated experimentally.

---

### NFR-02 — Query Throughput

Target:

> 2,000 queries/second concurrently with ingestion

---

### NFR-03 — Query Latency

Target:

> P99 search latency strictly below 15 ms

The benchmark must report the measured P99 rather than only average latency.

---

### NFR-04 — Availability During Flush

Disk segment construction must not require stopping normal ingestion.

Search must continue against currently available searchable layers.

---

### NFR-05 — Durability

The WAL must allow recovery of accepted writes that have not yet reached an immutable durable segment.

---

### NFR-06 — Correctness

The system shall not:

- Lose successfully accepted writes within the defined durability contract
- Return invalid vector identifiers
- Corrupt segment metadata
- Produce malformed search results
- Violate vector dimensionality requirements
- Return duplicate vector IDs in a final result set

---

### NFR-07 — Reproducibility

The benchmark must be repeatable using documented configuration, dataset, workload, hardware, and software versions.

---

## 4.3 Explicit Constraints

From the problem statement:

- Storage engine: **Rust or C++**
- Query router: **Go**
- Telemetry/monitoring interface: **TypeScript**
- LSM-style architecture
- WAL
- In-memory write buffer/MemTable
- Immutable vector segments
- Quantized disk representation
- Concurrent search across active and immutable layers
- Dynamic top-k merging
- >50K vectors/s ingestion target
- 2K queries/s query target
- P99 <15 ms target

---

## 4.4 Evaluation Requirements

The implementation must demonstrate more than a functional API.

The evaluation should show:

1. Sustained write ingestion.
2. Concurrent search.
3. Query latency distribution.
4. P99 latency.
5. Search correctness/recall.
6. Recovery behavior.
7. Behavior during MemTable flush.
8. Resource utilization.
9. Comparison against an appropriate baseline.

---

## 5. Users / Actors

### Primary Actor — Ingestion Client

Produces vectors continuously.

Example:

```text
News/document → embedding → vector → ingestion API
```

The embedding-generation stage is outside the core PS-005 storage-engine requirement unless explicitly added as a demo adapter.

---

### Secondary Actor — Query Client

Sends nearest-neighbor queries.

Expected workflow:

```text
Query vector → router → storage engine → segment searches → top-k merge → results
```

---

### Operator

Uses the telemetry interface to observe:

- Throughput
- Latency
- Segment state
- Memory usage
- WAL state
- Errors
- Benchmark results

---

### Storage Engine

Responsible for:

- Durability
- Memory buffering
- Segment construction
- Search
- Recovery
- Background maintenance

---

## 6. Assumptions

### A-01

The primary vector distance metric is cosine similarity because the supplied vectors are normalized.

This must be verified against `DATASET_INFO.md` before implementation.

**Confidence:** Medium until the supplied dataset specification is inspected.

---

### A-02

The primary benchmark uses the supplied 64-dimensional dataset before moving to larger external datasets.

---

### A-03

The benchmark's exact ground truth is authoritative for validating Recall@10 on the supplied queries.

---

### A-04

The 50-query supplied ground truth is sufficient for functional correctness validation but is not sufficient alone to characterize production-scale performance.

Large workload generation will therefore be used for throughput/latency benchmarking.

---

### A-05

The core storage engine does not need to generate embeddings itself.

The storage engine accepts already-created dense vectors.

---

### A-06

Authentication and multi-user authorization are not core requirements unless additional problem-statement material introduces them.

---

## 7. MVP Scope

| Feature | Purpose | Requirement Satisfied | Judging Value | Owner |
|---|---|---|---|---|
| WAL | Durable ingestion/recovery | FR-02, FR-10 | High | Programmer 1 |
| Active MemTable | High-throughput writes/search | FR-03 | High | Programmer 1 |
| MemTable rotation | Non-blocking ingestion | FR-04 | High | Programmer 1 |
| Immutable segment format | Persistent vector storage | FR-05 | High | Programmer 1 |
| HNSW segment builder | ANN search | FR-06 | High | Programmer 1 |
| Quantized vectors | Storage/search efficiency | FR-07 | High | Programmer 1 |
| Segment search | Concurrent ANN search | FR-08 | High | Programmer 1 |
| Global top-k merge | Unified results | FR-09 | High | Programmer 1 |
| Go gRPC router | External service interface | Explicit language requirement | High | Programmer 2 |
| TypeScript telemetry | Operational visibility | Explicit language requirement | Medium/High | Programmer 3 |
| Benchmark harness | Acceptance evidence | FR-11 | Very High | Programmer 3 |
| Recovery test | Durability evidence | FR-10 | Very High | Programmer 1/3 |
| Ground-truth evaluator | Recall validation | FR-11 | Very High | Programmer 3 |
| Failure testing | Reliability evidence | NFR-06 | High | Programmer 3 |

---

## 8. Out of Scope

Unless explicitly required by additional problem-statement material:

- Embedding generation
- Financial-domain NLP
- LLM integration
- RAG
- Authentication
- Multi-tenancy
- Kubernetes
- Cloud deployment
- Distributed consensus
- Cross-region replication
- Automatic horizontal sharding
- Complex metadata filtering
- Full production-grade compaction scheduling across billions of vectors
- Enterprise billing
- User account management

These may be future extensions but should not compromise the core storage-engine implementation.

---

## 9. Success Metrics

### Mandatory Performance Metrics

| Metric | Target |
|---|---:|
| Write throughput | >50,000 vectors/s |
| Concurrent query throughput | 2,000 queries/s |
| P99 search latency | <15 ms |

### Correctness Metrics

| Metric | Measurement |
|---|---|
| Recall@10 | Compare against exact ground truth |
| Result validity | No malformed/unknown IDs |
| Duplicate rate | Expected 0 |
| Recovery loss | Must satisfy defined durability contract |

### Operational Metrics

- CPU utilization
- Memory usage
- WAL growth
- Segment count
- Segment flush duration
- Query fan-out
- Recovery duration
- Error rate

### Important

No performance improvement shall be claimed before benchmark results exist.

---

## 10. Risks

### R-01 — Performance Target Too Aggressive

The required throughput and latency targets may exceed what is achievable on the available hardware/configuration.

**Mitigation:** benchmark continuously and identify bottlenecks early.

---

### R-02 — Segment Fan-Out

Searching many immutable segments can increase query latency.

**Mitigation:**

- Segment lifecycle management
- Controlled segment size
- Background compaction/merging where justified
- Efficient candidate collection
- Parallel segment search where beneficial
- Benchmark-based tuning

---

### R-03 — Quantization Reduces Recall

Quantization may reduce nearest-neighbor accuracy.

**Mitigation:** measure Recall@10 against exact ground truth and compare against an unquantized baseline.

---

### R-04 — WAL Becomes Write Bottleneck

Durability synchronization may limit ingestion throughput.

**Mitigation:**

- Buffered append
- Batched writes
- Configurable durability mode
- Separate WAL writer path where appropriate
- Benchmark fsync/sync behavior

The exact implementation must respect the selected durability semantics.

---

### R-05 — Memory Pressure

Large active/immutable buffers can consume substantial RAM.

**Mitigation:**

- Configurable MemTable limits
- Flush backpressure
- Memory accounting
- Controlled segment lifecycle

---

### R-06 — Recovery Complexity

WAL and segment state can become inconsistent if crash boundaries are poorly defined.

**Mitigation:**

- Explicit sequence numbers
- Checksums
- Atomic metadata publication
- Recovery tests
- Crash simulation

---

### R-07 — Lock Contention

Poor concurrency design can recreate the bottleneck the architecture is intended to solve.

**Mitigation:**

- Avoid global locks on the hot path
- Immutable read structures
- Sharded/partitioned mutable state where beneficial
- Benchmark contention

---

## 11. Demo Strategy

The shortest compelling demonstration should be:

### Stage 1 — Load

Start the storage engine.

Show:

```text
WAL active
MemTable active
0/initial segments
```

### Stage 2 — Continuous Ingestion

Start a sustained vector ingestion workload.

Telemetry displays:

```text
Write Rate
Memory Usage
WAL Rate
MemTable Size
```

### Stage 3 — Automatic Rotation

Fill the MemTable.

Show:

```text
Active MemTable
      ↓
Immutable MemTable
      ↓
Background Segment Build
      ↓
Immutable HNSW Segment
```

Ingestion continues while the segment is being built.

### Stage 4 — Concurrent Queries

Run query traffic simultaneously.

Show:

- QPS
- P50
- P95
- P99
- Recall@10

### Stage 5 — Recovery

Simulate process termination/restart.

Show:

```text
Persisted segments discovered
        ↓
WAL replay
        ↓
MemTable reconstructed
        ↓
Search available
```

### Stage 6 — Final Benchmark

Present:

```text
Write throughput: measured value
Query throughput: measured value
P99 latency: measured value
Recall@10: measured value
```

If a target is not achieved, report the measured value honestly and identify the bottleneck rather than fabricating compliance.