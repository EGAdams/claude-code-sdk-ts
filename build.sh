#!/bin/bash

# Navigate to the project root directory
SCRIPT_DIR=$(unset CDPATH && cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null && pwd)
cd "$SCRIPT_DIR"

echo "Building project in $PWD..."

# Run the build command
npm run build

if [ $? -eq 0 ]; then
    echo "Project built successfully!"
else
    echo "Project build failed."
    exit 1
fi