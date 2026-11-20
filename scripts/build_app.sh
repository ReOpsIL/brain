#!/bin/bash
# Builds "Brain Spark.app" into ./build (release, ad-hoc signed, game files bundled).
# Usage: scripts/build_app.sh [--install]   (--install copies the app to /Applications and opens it)
set -euo pipefail
cd "$(dirname "$0")/.."
APP="build/Brain Spark.app"
swift build -c release
BIN="$(swift build -c release --show-bin-path)/BrainSpark"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/BrainSpark"
cp -R Resources/web "$APP/Contents/Resources/web"

# Icon
ICONSET="build/AppIcon.iconset"
rm -rf "$ICONSET"
swift scripts/make_icon.swift "$ICONSET" >/dev/null 2>&1 && iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns" || echo "warning: icon generation failed" >&2

VERSION="1.0.0"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Brain Spark</string>
  <key>CFBundleDisplayName</key><string>Brain Spark</string>
  <key>CFBundleIdentifier</key><string>local.brainspark.app</string>
  <key>CFBundleExecutable</key><string>BrainSpark</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.education</string>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP"
echo "Built: $APP"

if [ "${1:-}" = "--install" ]; then
  pkill -x BrainSpark 2>/dev/null || true
  rm -rf "/Applications/Brain Spark.app"
  cp -R "$APP" /Applications/
  echo "Installed to /Applications/Brain Spark.app"
  open "/Applications/Brain Spark.app"
fi
