#!/bin/bash
echo "Running Checks..."

echo "1. Linting (ESLint)..."
npm run lint
if [ $? -ne 0 ]; then
    echo "Linting failed!"
    exit 1
fi

echo "2. Type Checking (TypeScript)..."
npm run type-check
if [ $? -ne 0 ]; then
    echo "Type checking failed!"
    exit 1
fi

echo "3. Formatting Check (Prettier)..."
npx prettier --check src/
if [ $? -ne 0 ]; then
    echo "Formatting check failed!"
    exit 1
fi

echo "4. Testing (Vitest)..."
npm run test
if [ $? -ne 0 ]; then
    echo "Tests failed!"
    exit 1
fi

echo "All checks passed!"
exit 0
