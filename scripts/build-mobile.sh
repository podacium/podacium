#!/bin/bash
set -euo pipefail

echo "Building web app for Capacitor..."
cd apps/web
npm run build:standalone

echo "Copying web assets to native platforms..."
npx cap sync

echo "Mobile build complete."
echo "To open in Android Studio: cd apps/web && npx cap open android"
echo "To build APK: cd apps/web && npx cap build android"
