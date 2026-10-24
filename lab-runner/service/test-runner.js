
const { runPython, gradePython } = require("./runner");

async function main() {
  console.log("Test 1: Basic execution");
  console.log(await runPython('print("CloudLearn works")'));

  console.log("\nTest 2: Program reads input");
  console.log(
    await runPython(
      'number = int(input())\nprint(number * 2)',
      "21\n"
    )
  );

  console.log("\nTest 3: Input-based grading");
  console.log(
    await gradePython(
      'number = int(input())\nprint(number * 2)',
      [
        { input: "5\n", expected: "10" },
        { input: "21\n", expected: "42" }
      ]
    )
  );

  console.log("\nTest 4: Incorrect answer");
  console.log(
    await gradePython('print("wrong")', [
      { input: "", expected: "OK" }
    ])
  );
}

main().catch(console.error);
