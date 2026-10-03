#!/bin/bash
# Build the CUDA release binary inside a container (podman or docker).
#
# Usage:
#   ./scripts/build-cuda-container.sh
#
# Output: target/container/release/mojovoice
#
# Environment variables:
#   CUDA_COMPUTE_CAP - Target compute capability (default: 80; PTX JIT-compiles
#                      forward, so 80 covers RTX 30-series and newer)
#   CONTAINER_ENGINE - podman or docker (default: podman if installed)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="mojovoice-cuda-build:12.8"
ENGINE="${CONTAINER_ENGINE:-$(command -v podman >/dev/null && echo podman || echo docker)}"

"$ENGINE" build -t "$IMAGE" -f "$REPO_ROOT/scripts/cuda-build.Containerfile" "$REPO_ROOT/scripts"

"$ENGINE" run --rm \
    -v "$REPO_ROOT:/src:Z" \
    -v mojovoice-cargo-registry:/usr/local/cargo/registry \
    -e CUDA_COMPUTE_CAP="${CUDA_COMPUTE_CAP:-80}" \
    -e CARGO_TARGET_DIR=/src/target/container \
    -e RUSTFLAGS="-L /usr/local/cuda/lib64/stubs" \
    "$IMAGE" \
    cargo build --release --features cuda

echo "Built: $REPO_ROOT/target/container/release/mojovoice"
