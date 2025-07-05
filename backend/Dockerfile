# Stage 1: Build the application using Gradle
FROM gradle:8.4-jdk17-jammy as build

# Copy the necessary files to the build context
WORKDIR /app

COPY . .

# Build the fat JAR
RUN chmod +x ./gradlew
RUN ./gradlew clean buildFatJar

# Stage 2: Create the final image to run the application
FROM openjdk:17
EXPOSE 8080

# Create app directory
WORKDIR /app

# Copy the fat JAR from the build stage to the runtime image
COPY --from=build /app/build/libs/*.jar /app/wikinsert-api-server.jar

# Set the memory limit and run the JAR
ENTRYPOINT ["java", "-jar", "-Xmx2G", "/app/wikinsert-api-server.jar", "-port","8080","-host","0.0.0.0"]