
FROM eclipse-temurin:21-jdk-alpine

WORKDIR /runner

RUN mkdir -p /work && chown 65534:65534 /work

USER 65534:65534

WORKDIR /work

CMD ["sh", "-c", "javac Main.java && java Main"]
