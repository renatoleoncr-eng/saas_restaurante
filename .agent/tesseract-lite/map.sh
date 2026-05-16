#!/bin/bash
node .agent/tesseract-lite/analyzer.js
echo "----------------------------------------"
echo "Tesseract Lite: Code Map Updated!"
echo "Open the following file in your browser:"
echo "file://$(pwd)/.agent/tesseract-lite/viewer.html"
echo "----------------------------------------"
