#!/bin/bash

IMAGE_NAME=quotebank-ui
IMAGE_TAG=$(git rev-parse --short HEAD)

set -euo pipefail

if [ ! -e config.json ]; then
    echo "config.json not found"
    exit 1
fi

cd src && ln -s ../config.json 2> /dev/null || true
cd ../

docker build --build-arg BUILD_ID="$IMAGE_TAG" -t "$IMAGE_NAME:$IMAGE_TAG" .

# Clean up the intermediate image
docker image prune -f --filter label=build=$IMAGE_TAG
