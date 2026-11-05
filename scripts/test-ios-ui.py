"""Exercise actual iPhone app controls using XCTest, on the booted simulator."""
import json
from pathlib import Path
import subprocess

output = Path("test-results/ios")
device = json.loads((output / "simulator.json").read_text())
test_runs = list(Path("ios/DerivedData/Build/Products").glob("*.xctestrun"))
if len(test_runs) != 1:
    raise SystemExit(f"Expected one precompiled XCTest manifest, found {len(test_runs)}. Run build-for-testing first.")
test_command = [
    "xcodebuild", "-quiet", "-xctestrun", str(test_runs[0]),
    "-destination", f"platform=iOS Simulator,id={device['udid']}",
    "-parallel-testing-enabled", "NO", "-maximum-concurrent-test-simulator-destinations", "1",
    "-resultBundlePath", str(output / "Shopping.xcresult"),
    "test-without-building",
]
try:
    subprocess.run(test_command, check=True, timeout=480)
finally:
    # Capture resource/launch failures too. Diagnostics never replace the real
    # XCTest exit code and do not start the app or any provider interaction.
    diagnostics = {
        "host-memory.txt": ["vm_stat"],
        "host-processes.txt": ["ps", "-axo", "pid,ppid,%cpu,%mem,comm"],
        "simulator-launch.log": ["xcrun", "simctl", "spawn", device["udid"], "log", "show", "--last", "10m", "--style", "compact", "--predicate", 'process == "runningboardd" OR process == "SpringBoard" OR eventMessage CONTAINS[c] "com.gymdrobe"'],
    }
    for name, command in diagnostics.items():
        try:
            with (output / name).open("w") as destination:
                subprocess.run(command, stdout=destination, stderr=subprocess.STDOUT, check=False, timeout=20)
        except (subprocess.TimeoutExpired, OSError) as error:
            print(f"Diagnostic {name} unavailable: {type(error).__name__}")
    # Keep native failure captures too, without replacing the test's exit status.
    if (output / "Shopping.xcresult").exists():
        for report in ("summary", "tests"):
            try:
                with (output / f"native-test-{report}.json").open("w") as destination:
                    result = subprocess.run([
                        "xcrun", "xcresulttool", "get", "test-results", report,
                        "--path", str(output / "Shopping.xcresult"),
                    ], stdout=destination, check=False, timeout=30)
                if result.returncode:
                    print(f"XCTest {report} export failed; inspect the result bundle.")
            except subprocess.TimeoutExpired:
                print(f"XCTest {report} export timed out; inspect the result bundle.")
        try:
            export = subprocess.run([
                "xcrun", "xcresulttool", "export", "attachments", "--path", str(output / "Shopping.xcresult"),
                "--output-path", str(output / "ui-screenshots"),
            ], check=False, timeout=60)
            if export.returncode:
                print("XCTest attachment export failed; inspect the result bundle.")
        except subprocess.TimeoutExpired:
            print("XCTest attachment export failed; inspect the result bundle.")
print("Native iPhone tab navigation tests passed. Screenshots exported from XCTest.")
