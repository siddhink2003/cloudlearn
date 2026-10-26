
import sys
import json
import io
import builtins

def main():
    try:
        source = json.loads(sys.stdin.readline())
        test_input = json.loads(sys.stdin.readline())
    except Exception:
        print("Invalid runner input", file=sys.stderr)
        sys.exit(2)

    if not isinstance(source, str) or not isinstance(test_input, str):
        print("Invalid runner input", file=sys.stderr)
        sys.exit(2)

    input_stream = io.StringIO(test_input)

    # Ensure input() reads from the supplied custom input.
    original_input = builtins.input

    def custom_input(prompt=""):
        if prompt:
            print(prompt, end="", flush=True)
        line = input_stream.readline()
        if line == "":
            raise EOFError("No more input available")
        return line.rstrip("\n").rstrip("\r")

    builtins.input = custom_input

    try:
        exec(
            compile(source, "<student-code>", "exec"),
            {"__name__": "__main__"}
        )
    except Exception as exc:
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        builtins.input = original_input
        input_stream.close()

if __name__ == "__main__":
    main()
