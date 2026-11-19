#!/usr/bin/env bash
# render.sh <docx> <outdir> <fontsdir> : PDF through LibreOffice with David mapped to David Libre, then PNG pages in <outdir>/png
# fontsdir holds DavidLibre-Regular.ttf and DavidLibre-Bold.ttf (github.com/google/fonts, ofl/davidlibre).
set -eu
docx=$1; out=$2; fd=$(cd "$3" && pwd)
cat > "$fd/fonts.conf" <<XML
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>$fd</dir>
  <match target="pattern"><test qual="any" name="family"><string>David</string></test>
    <edit name="family" mode="assign" binding="same"><string>David Libre</string></edit></match>
</fontconfig>
XML
P=$(mktemp -d)
FONTCONFIG_FILE=$fd/fonts.conf soffice -env:UserInstallation=file://$P --headless --convert-to pdf --outdir "$out" "$docx" >/dev/null 2>&1
pdf="$out/$(basename "${docx%.docx}").pdf"
pdfinfo "$pdf" | grep Pages; pdffonts "$pdf" | tail -n +3 | awk '{print $1}'
mkdir -p "$out/png"; rm -f "$out/png/"*.png; pdftoppm -r 80 -png "$pdf" "$out/png/p"
