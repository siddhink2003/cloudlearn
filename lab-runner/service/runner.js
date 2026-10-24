
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const IMAGE = "cloudlearn-python-runner:local";
const TIMEOUT_MS = 10000;
const MAX_OUTPUT_BYTES = 16 * 1024;
const MAX_CODE_BYTES = 32 * 1024;
const MAX_INPUT_BYTES = 4 * 1024;

function docker(args) {
  return spawn("docker", args, {
    windowsHide: true,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"]
  });
}

function removeContainer(name) {
  return new Promise((resolve) => {
    const cleanup = docker(["rm", "-f", name]);
    let settled = false;
    let timer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    timer = setTimeout(() => {
      cleanup.kill();
      finish(false);
    }, 3000);

    cleanup.on("error", () => finish(false));
    cleanup.on("close", (code) => finish(code === 0));
  });
}

function runPython(source, input = "") {
  return new Promise((resolve) => {
    if (
      typeof source !== "string" ||
      Buffer.byteLength(source, "utf8") > MAX_CODE_BYTES
    ) {
      resolve({
        success: false,
        error: "Code must be text and no larger than 32 KB."
      });
      return;
    }

    if (
      typeof input !== "string" ||
      Buffer.byteLength(input, "utf8") > MAX_INPUT_BYTES
    ) {
      resolve({
        success: false,
        error: "Input must be text and no larger than 4 KB."
      });
      return;
    }

    const name = `cloudlearn-python-${randomUUID()}`;
    let output = "";
    let outputBytes = 0;
    let finished = false;
    let stopReason = "";
    let timer;
    let cleanupPromise;

    const child = docker([
      "run",
      "--name", name,
      "-i",
      "--network", "none",
      "--memory", "128m",
      "--cpus", "0.5",
      "--pids-limit", "64",
      "--read-only",
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--user", "65534:65534",
      IMAGE
    ]);

    function collect(chunk) {
      if (finished) return;

      const remaining = MAX_OUTPUT_BYTES - outputBytes;
      const accepted = chunk.subarray(0, Math.max(0, remaining));

      output += accepted.toString("utf8");
      outputBytes += accepted.length;

      if (chunk.length > remaining) {
        stopReason = "Output limit exceeded.";
        stop();
      }
    }

    async function stop() {
      if (cleanupPromise) return cleanupPromise;

      cleanupPromise = (async () => {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.destroy();
        }

        child.kill();

        let removed = false;
        for (let attempt = 0; attempt < 4 && !removed; attempt++) {
          removed = await removeContainer(name);
          if (!removed && attempt < 3) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        clearTimeout(timer);
        finished = true;

        resolve({
          success: false,
          error: stopReason || "Execution stopped.",
          output,
          cleanupConfirmed: removed
        });
      })();

      return cleanupPromise;
    }

    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);

    child.on("error", async () => {
      if (finished) return;
      clearTimeout(timer);
      const removed = await removeContainer(name);
      finished = true;
      resolve({
        success: false,
        error: "Could not start Docker. Check Docker Desktop.",
        cleanupConfirmed: removed
      });
    });

    child.on("close", async (code) => {
      if (finished || cleanupPromise) return;

      clearTimeout(timer);
      const removed = await removeContainer(name);
      finished = true;

      resolve({
        success: code === 0,
        output,
        ...(code === 0 ? {} : { error: "Execution failed." }),
        cleanupConfirmed: removed
      });
    });

    timer = setTimeout(() => {
      stopReason = "Execution timed out.";
      stop();
    }, TIMEOUT_MS);

    // run.py reads two JSON lines: source, then test input.
    child.stdin.end(
      JSON.stringify(source) + "\n" +
      JSON.stringify(input) + "\n"
    );
  });
}

function normalizeOutput(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

async function gradePython(source, testCases) {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return {
      success: false,
      error: "No test cases are configured."
    };
  }

  if (testCases.length > 20) {
    return {
      success: false,
      error: "Too many test cases."
    };
  }

  const results = [];

  for (const test of testCases) {
    if (
      !test ||
      typeof test.expected !== "string" ||
      (test.input !== undefined && typeof test.input !== "string")
    ) {
      return {
        success: false,
        error: "Invalid test case configuration."
      };
    }

    const run = await runPython(source, test.input || "");

    if (!run.success || run.cleanupConfirmed !== true) {
      return {
        success: false,
        error: run.error || "Execution cleanup could not be confirmed.",
        results
      };
    }

    results.push({
      passed:
        normalizeOutput(run.output) === normalizeOutput(test.expected)
    });
  }

  return {
    success: true,
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    results
  };
}

module.exports = { runPython, gradePython, runJava, gradeJava };


async function runJava(source, input = "") {
  if (
    typeof source !== "string" ||
    Buffer.byteLength(source, "utf8") > MAX_CODE_BYTES
  ) {
    return { success: false, error: "Java code must be text and no larger than 32 KB." };
  }

  if (
    typeof input !== "string" ||
    Buffer.byteLength(input, "utf8") > MAX_INPUT_BYTES
  ) {
    return { success: false, error: "Input must be text and no larger than 4 KB." };
  }

  const name = `cloudlearn-java-${randomUUID()}`;

  return new Promise((resolve) => {
    const encoded = Buffer.from(source, "utf8").toString("base64");
    const encodedInput = Buffer.from(input, "utf8").toString("base64");

    const child = docker([
      "run", "--name", name, "-i",
      "--network", "none",
      "--memory", "256m",
      "--cpus", "0.5",
      "--pids-limit", "64",
      "--read-only",
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m",
      "--tmpfs", "/work:rw,exec,nosuid,size=32m,uid=65534,gid=65534",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--user", "65534:65534",
      "--entrypoint", "sh",
      "cloudlearn-java-runner:local",
      "-c",
      "base64 -d > /work/Main.java && javac -d /tmp /work/Main.java && java -cp /tmp Main"
    ]);

    let output = "";
    let settled = false;

    const finish = async (code, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const removed = await removeContainer(name);

      resolve({
        success: code === 0 && removed,
        output: output.slice(0, MAX_OUTPUT_BYTES),
        ...(error ? { error } : {}),
        cleanupConfirmed: removed
      });
    };

    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) {
        child.kill();
      }
    });

    child.stderr.on("data", (chunk) => {
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) {
        child.kill();
      }
    });

    child.on("error", () => finish(null, "Could not start Docker."));
    child.on("close", (code) => finish(code, code === 0 ? undefined : "Java compilation or execution failed."));

    const timer = setTimeout(() => {
      child.kill();
      finish(null, "Java execution timed out.");
    }, TIMEOUT_MS);

    child.stdin.end(encoded + "\n" + encodedInput + "\n");
  });
}

async function gradeJava(source, testCases) {
  if (!Array.isArray(testCases) || testCases.length === 0 || testCases.length > 20) {
    return { success: false, error: "Provide between 1 and 20 test cases." };
  }

  const results = [];

  for (const test of testCases) {
    if (!test || typeof test.expected !== "string" ||
        (test.input !== undefined && typeof test.input !== "string")) {
      return { success: false, error: "Invalid test case configuration." };
    }

    const run = await runJava(source, test.input || "");

    if (!run.success || run.cleanupConfirmed !== true) {
      return { success: false, error: run.error || "Java execution failed.", results };
    }

    results.push({
      passed: normalizeOutput(run.output) === normalizeOutput(test.expected)
    });
  }

  return {
    success: true,
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    results
  };
}
