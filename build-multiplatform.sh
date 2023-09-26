#!/usr/bin/env bash

PROJECT_NAME="beter-feed-consumer"
PROJECT_VERSION="1.0.0"
DOCKER_HUB_REPO_NAME="dmenshikov"
DOCKER_BUILDER_NAME="beter-feed-consumer-builder"
DOCKER_BUILD_PLATFORMS="linux/arm64,linux/amd64"

docker login
docker buildx create --name "${DOCKER_BUILDER_NAME}" --use;

echo "Building ${PROJECT_NAME}:${PROJECT_VERSION} for platforms ${DOCKER_BUILD_PLATFORMS}";
docker buildx build \
  -t "${DOCKER_HUB_REPO_NAME}/${PROJECT_NAME}:${PROJECT_VERSION}" \
  -t "${DOCKER_HUB_REPO_NAME}/${PROJECT_NAME}:latest" \
  --ssh default="$SSH_AUTH_SOCK" \
  --platform "$DOCKER_BUILD_PLATFORMS" \
  --push \
  . \
;

echo "Inspecting ${PROJECT_NAME}:${PROJECT_VERSION}";
docker buildx imagetools inspect "${DOCKER_HUB_REPO_NAME}/${PROJECT_NAME}:${PROJECT_VERSION}";

docker buildx stop "${DOCKER_BUILDER_NAME}";
docker buildx rm "${DOCKER_BUILDER_NAME}";
