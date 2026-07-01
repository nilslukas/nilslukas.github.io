#!/usr/bin/env bash
# Regenerate assets/pdfs/cv_nils_lukas.pdf from cv.html (the single source of truth).
# cv.html?pdf disables the paged.js preview so Chrome's own print engine + the
# @page / @media print rules produce a clean, multi-page PDF.
#
# Usage:  ./build-cv-pdf.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/assets/pdfs/cv_nils_lukas.pdf"

# Locate a Chromium-family browser.
CHROME=""
for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "$(command -v google-chrome 2>/dev/null || true)" \
  "$(command -v chromium 2>/dev/null || true)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then CHROME="$c"; break; fi
done

if [ -z "$CHROME" ]; then
  echo "error: could not find Chrome/Chromium/Edge to render the PDF." >&2
  exit 1
fi

TMP="$(mktemp -t cv_nils_lukas).pdf"

echo "Rendering cv.html -> $OUT"
"$CHROME" \
  --headless --disable-gpu --no-sandbox \
  --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=10000 \
  --print-to-pdf="$TMP" \
  "file://$DIR/cv.html?pdf"

# Chrome stamps files it writes with macOS quarantine / com.apple.macl extended
# attributes, which make the PDF unreadable over file:// (ERR_ACCESS_DENIED).
# Copy without xattrs (-X) and clear anything that remains so local preview works.
/bin/cp -X "$TMP" "$OUT"
xattr -cr "$OUT" 2>/dev/null || true
rm -f "$TMP"

echo "Done. $(du -h "$OUT" | cut -f1) written."
