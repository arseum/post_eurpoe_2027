#!/bin/sh
VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "dev")
echo "const VERSION = '$VERSION';" > js/version.js
