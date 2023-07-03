#!/usr/bin/env bash

rm -rf dist
rm -rf build
mkdir -p dist
mkdir -p build/anya
cp -r README.md LICENSE images scripts manifest.json options.html ./build/anya
cd build
zip -r ../dist/anya.zip anya
