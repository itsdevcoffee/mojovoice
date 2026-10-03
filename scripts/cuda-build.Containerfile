# Build environment for the CUDA release binary.
#
# Ubuntu 22.04 sidesteps nvcc/glibc header conflicts on newer distros (e.g.
# CUDA 13 vs glibc 2.42 on Fedora 43) and links against glibc 2.35, so the
# binary runs on most current distros. No GPU is needed to build.
#
# Used by scripts/build-cuda-container.sh.
FROM docker.io/nvidia/cuda:12.8.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential pkg-config curl ca-certificates git \
        libasound2-dev libclang-dev libxkbcommon-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
RUN curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable

WORKDIR /src
