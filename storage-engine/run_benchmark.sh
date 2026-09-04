#!/bin/bash
set -e
export PATH="/home/shindeadi/.cargo/bin:$PATH"
cd /mnt/c/Users/Shind/OneDrive/Desktop/PS-005-GT/storage-engine
cargo run --release --bin storage_benchmark
