# Stage 1: Build the application using Gradle
FROM gradle:8.4-jdk17-jammy as build

# Copy the necessary files to the build context
RUN mkdir /app

WORKDIR /app

COPY . .

# Build the fat JAR
RUN ./gradlew :ds-api-server:buildFatJar

# Stage 2: Create the final image to run the application
FROM openjdk:17
EXPOSE 8080:8080

# Create app directory
RUN mkdir /app

# Copy the fat JAR from the build stage to the runtime image
COPY --from=build /app/wikinsert-api-server/build/libs/wikinsert-api-server.jar /app/wikinsert-api-server.jar

# Set the memory limit and run the JAR
ENTRYPOINT ["java","-jar","-Xmx2G","/app/wikinsert-api-server.jar"]
