#!/bin/bash
# Wrapper to run dev-voice CUDA binary with Ollama's CUDA 12 libraries
#
# Usage:
#   ./scripts/run-cuda12-ollama.sh daemon
#   ./scripts/run-cuda12-ollama.sh start --duration 10

# Add Ollama's CUDA 12 libs to library path
export LD_LIBRARY_PATH=/usr/local/lib/ollama${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}

# Run dev-voice with all arguments passed through
exec ./dev-voice "$@"
