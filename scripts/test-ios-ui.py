"""Exercise actual iPhone app controls using XCTest, on the booted simulator."""
import json
from pathlib import Path
import subprocess

output = Path("test-results/ios")
device = json.loads((output / "simulator.json").read_text())
subprocess.run([
    "xcodebuild", "-quiet", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
    "-configuration", "Debug", "-sdk", "iphonesimulator",
    "-destination", f"platform=iOS Simulator,id={device['udid']}",
    "-parallel-testing-enabled", "NO", "-maximum-concurrent-test-simulator-destinations", "1",
    "-derivedDataPath", "ios/DerivedData", "-resultBundlePath", str(output / "Shopping.xcresult"),
    "CODE_SIGNING_ALLOWED=NO", "test",
], check=True, timeout=480)
subprocess.run([
    "xcrun", "xcresulttool", "export", "attachments", "--path", str(output / "Shopping.xcresult"),
    "--output-path", str(output / "ui-screenshots"),
], check=True, timeout=60)
print("Native iPhone tab navigation tests passed. Screenshots exported from XCTest.")
