
import sys
import json
import contextlib
import io

def main():
    # The first line contains the student's source code as JSON.
    # The second line contains the test input as JSON.
    try:
        source = json.loads(sys.stdin.readline())
        test_input = json.loads(sys.stdin.readline())
    except Exception:
        print("Invalid runner input", file=sys.stderr)
        sys.exit(2)

    if not isinstance(source, str) or not isinstance(test_input, str):
        print("Invalid runner input", file=sys.stderr)
        sys.exit(2)

    # Make input() read from the supplied test data.
    sys.stdin = io.StringIO(test_input)

    # Keep program output separate from diagnostic errors.
    try:
        exec(compile(source, "<student-code>", "exec"), {"__name__": "__main__"})
    except Exception as exc:
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
