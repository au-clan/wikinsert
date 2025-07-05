#!/bin/bash
docker-compose down --remove-orphans || true

# Help message
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --populate         Run the database population service"
  echo "  --api              Run the API service"
  echo "  --all              Run both database and API services"
  echo "  --background       Run services in the background (detached mode)"
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
RUN_BACKGROUND=false

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
    --background)
      RUN_BACKGROUND=true
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

  # If populator is running and not in background mode, add the --abort-on-container-exit flag
  if ! $RUN_BACKGROUND; then
    DOCKER_CMD+=" --abort-on-container-exit python-populator"
  fi
elif $RUN_POPULATOR; then
  echo "Starting database and populator services..."
  DOCKER_CMD+=" --profile populator up"

  # Add the --abort-on-container-exit flag for the populator only if not in background mode
  if ! $RUN_BACKGROUND; then
    DOCKER_CMD+=" --abort-on-container-exit"
  fi
elif $RUN_API; then
  echo "Starting database and API services..."
  DOCKER_CMD+=" --profile api up"
fi

# Add detached mode if background option is selected
if $RUN_BACKGROUND; then
  DOCKER_CMD+=" -d"
  echo "Running in background mode (detached)..."
fi

# Print the command for debugging
echo "Executing: $DOCKER_CMD"

# Execute the command
eval $DOCKER_CMD

# If running in background mode, show status
if $RUN_BACKGROUND; then
  echo ""
  echo "Services started in background. Use 'docker-compose ps' to check status."
  echo "Use 'docker-compose logs -f' to view logs."
  echo "Use 'docker-compose down' to stop services."
fi