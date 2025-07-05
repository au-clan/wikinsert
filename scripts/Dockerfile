FROM python:3.9-slim

WORKDIR /app

ENV PIP_CACHE_DIR=/pip-cache

# Install dependencies
COPY scripts/requirements.txt .
RUN --mount=type=cache,target=/pip-cache \
    pip install --no-cache-dir -r requirements.txt

# Copy scripts
COPY scripts/ /app/  

# Create entrypoint script
RUN echo '#!/bin/bash\n\
echo "Waiting for MongoDB to start..."\n\
MONGO_URI=${MONGO_URI:-mongodb://mongodb:27017/}\n\
until python -c "from pymongo import MongoClient; MongoClient(\"$MONGO_URI\").server_info()"; do\n\
  echo "MongoDB not available yet, waiting..."\n\
  sleep 2\n\
done\n\
echo "MongoDB is available, running data population script..."\n\
python wikinsert_main.py\n\
echo "Data population completed."\n\
' > /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
