
FROM python:3.12-alpine

WORKDIR /runner

COPY run.py /runner/run.py

RUN chmod 0444 /runner/run.py

USER 65534:65534

CMD ["python3", "-I", "-S", "/runner/run.py"]
