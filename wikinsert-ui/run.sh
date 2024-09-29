#!/bin/bash

PORT="${1?Port number is required. Usage: ./run.sh PORT}"

IMAGE_NAME=wikinsert-ui
IMAGE_TAG=$(git rev-parse --short HEAD)
CONTAINER_NAME=wikinsert-ui
docker kill "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -p $PORT:$PORT -e PORT=$PORT --name "$CONTAINER_NAME" "$IMAGE_NAME:$IMAGE_TAG"
