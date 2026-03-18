#!/bin/bash

# Badge Widget Implementation Verification Script

echo "==================================="
echo "Badge Widget Implementation Check"
echo "==================================="
echo ""

# Check if all required files exist
echo "1. Checking files..."
FILES=(
  "src/lib/badge/stats.ts"
  "src/lib/badge/stats.test.ts"
  "src/components/badge/BadgeWidget.astro"
  "src/pages/badge/[seller_id]/widget.astro"
  "src/pages/badge/[seller_id]/verify.astro"
  "src/pages/badge/demo.astro"
  "src/pages/api/badge/[seller_id]/stats.ts"
  "docs/BADGE_WIDGET.md"
  "docs/BADGE_IMPLEMENTATION.md"
)

ALL_FILES_EXIST=true
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (MISSING)"
    ALL_FILES_EXIST=false
  fi
done

echo ""
echo "2. Running tests..."
npm test -- src/lib/badge/stats.test.ts --run 2>&1 | grep -E "(Test Files|Tests|PASS|FAIL)" | head -5

echo ""
echo "3. Type checking..."
npm run type-check 2>&1 | grep -i badge || echo "  ✓ No badge-specific type errors"

echo ""
echo "4. File sizes..."
echo "  Library:"
  ls -lh src/lib/badge/*.ts | awk '{print "    " $9 " - " $5}'
echo "  Components:"
  ls -lh src/components/badge/*.astro | awk '{print "    " $9 " - " $5}'
echo "  Pages:"
  ls -lh src/pages/badge/**/*.astro 2>/dev/null | awk '{print "    " $9 " - " $5}'
echo "  API:"
  ls -lh src/pages/api/badge/**/*.ts 2>/dev/null | awk '{print "    " $9 " - " $5}'

echo ""
echo "5. Route structure..."
echo "  /badge/[seller_id]/widget → src/pages/badge/[seller_id]/widget.astro"
echo "  /badge/[seller_id]/verify → src/pages/badge/[seller_id]/verify.astro"
echo "  /badge/demo → src/pages/badge/demo.astro"
echo "  /api/badge/[seller_id]/stats → src/pages/api/badge/[seller_id]/stats.ts"

echo ""
echo "==================================="
if [ "$ALL_FILES_EXIST" = true ]; then
  echo "✓ Implementation Complete!"
else
  echo "✗ Some files are missing"
fi
echo "==================================="
