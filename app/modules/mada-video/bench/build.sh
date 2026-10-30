#!/bin/bash
# Builds the render bench for the Mac from the app's own Swift files (Mac Catalyst, so UIKit is there).
# Needs Xcode. Usage: app/modules/mada-video/bench/build.sh  → app/modules/mada-video/bench/.build/bench
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .build
SDK=$(xcrun --sdk macosx --show-sdk-path)
ARCH=$(uname -m)
xcrun swiftc -O -target "$ARCH-apple-ios17.0-macabi" -sdk "$SDK" \
  -Fsystem "$SDK/System/iOSSupport/System/Library/Frameworks" -L "$SDK/System/iOSSupport/usr/lib" \
  -o .build/bench main.swift ../ios/Model.swift ../ios/Composer.swift ../ios/Compositor.swift ../ios/Overlay.swift
echo ".build/bench prêt"
