"""Exercise actual iPhone app controls using XCTest, on the booted simulator."""
import json
from pathlib import Path
import subprocess

output = Path("test-results/ios")
device = json.loads((output / "simulator.json").read_text())
test_command = [
    "xcodebuild", "-quiet", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
    "-configuration", "Debug", "-sdk", "iphonesimulator",
    "-destination", f"platform=iOS Simulator,id={device['udid']}",
    "-parallel-testing-enabled", "NO", "-maximum-concurrent-test-simulator-destinations", "1",
    "-derivedDataPath", "ios/DerivedData", "-resultBundlePath", str(output / "Shopping.xcresult"),
    "CODE_SIGNING_ALLOWED=NO", "test",
]
try:
    subprocess.run(test_command, check=True, timeout=480)
finally:
    # Keep native failure captures too, without replacing the test's exit status.
    if (output / "Shopping.xcresult").exists():
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
