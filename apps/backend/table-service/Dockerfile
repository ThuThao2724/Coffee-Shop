FROM gradle:8-jdk17-alpine AS builder
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon -x test

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
# Run as an unprivileged system user (the service only writes to /tmp).
RUN addgroup -S app && adduser -S -G app app
# The file logger writes to ./logs: create it for the unprivileged user.
RUN mkdir -p /app/logs && chown app:app /app/logs
USER app
EXPOSE 3003
ENTRYPOINT ["java", "-jar", "app.jar"]

