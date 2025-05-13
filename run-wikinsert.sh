#!/bin/bash

# Help message
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --populate         Run the database population service"
  echo "  --api              Run the API service"
  echo "  --all              Run both database and API services"
  echo "  --source PATH      Set the SOURCE_ARTICLES_PATH (for population)"
  echo "  --scored PATH      Set the SCORED_DATA_PATH (for population)"
  echo "  --mention PATH     Set the MENTION_MAP_PATH (for population)"
  echo "  --model-dir PATH   Set the MODEL_DIR (for population)"
  echo "  --help             Display this help message"
  exit 1
}

# Default to running all services if no arguments provided
if [ $# -eq 0 ]; then
  usage
fi

# Parse command line arguments
RUN_POPULATOR=false
RUN_API=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --populate)
      RUN_POPULATOR=true
      shift
      ;;
    --api)
      RUN_API=true
      shift
      ;;
    --all)
      RUN_POPULATOR=true
      RUN_API=true
      shift
      ;;
    --source)
      export SOURCE_ARTICLES_PATH="$2"
      shift 2
      ;;
    --scored)
      export SCORED_DATA_PATH="$2"
      shift 2
      ;;
    --mention)
      export MENTION_MAP_PATH="$2"
      shift 2
      ;;
    --model-dir)
      export MODEL_DIR="$2"
      shift 2
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# Construct docker-compose command based on selected services
DOCKER_CMD="docker-compose"

if $RUN_POPULATOR && $RUN_API; then
  echo "Starting both database populator and API services..."
  DOCKER_CMD+=" --profile populator --profile api up"

  # If populator is running, add the --abort-on-container-exit flag
  DOCKER_CMD+=" --abort-on-container-exit python-populator"
elif $RUN_POPULATOR; then
  echo "Starting database and populator services..."
  DOCKER_CMD+=" --profile populator up"

  # Add the --abort-on-container-exit flag for the populator
  DOCKER_CMD+=" --abort-on-container-exit"
elif $RUN_API; then
  echo "Starting database and API services..."
  DOCKER_CMD+=" --profile api up"
fi

# Print the command for debugging
echo "Executing: $DOCKER_CMD"

# Execute the command
eval $DOCKER_CMD