"""Exercise actual iPhone app controls using XCTest, on the booted simulator."""
from contextlib import suppress
import json
import os
from pathlib import Path
import re
import signal
import subprocess

output = Path("test-results/ios")
device = json.loads((output / "simulator.json").read_text())
test_runs = list(Path("ios/DerivedData/Build/Products").glob("*.xctestrun"))
if len(test_runs) != 1:
    raise SystemExit(f"Expected one precompiled XCTest manifest, found {len(test_runs)}. Run build-for-testing first.")

def run_xctest(directory):
    bundle = directory / "Shopping.xcresult"
    log = directory / "xcodebuild.log"
    command = [
        "xcodebuild", "-xctestrun", str(test_runs[0]),
        "-destination", f"platform=iOS Simulator,id={device['udid']}",
        "-parallel-testing-enabled", "NO", "-maximum-concurrent-test-simulator-destinations", "1",
        "-resultBundlePath", str(bundle),
        "test-without-building",
    ]
    print(f"Running native shopping tests. Output: {log}", flush=True)
    with log.open("w") as destination:
        with subprocess.Popen(command, stdout=destination, stderr=subprocess.STDOUT, start_new_session=True) as process:
            try:
                try:
                    status = process.wait(timeout=150)
                except subprocess.TimeoutExpired:
                    if not did_xctest_start(directory):
                        raise
                    status = process.wait(timeout=210)
            except subprocess.TimeoutExpired:
                # Stop the xcodebuild process group before rebooting the simulator.
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    with suppress(ProcessLookupError):
                        os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                raise
    if status:
        raise subprocess.CalledProcessError(status, command)


def did_xctest_start(directory):
    bundle = directory / "Shopping.xcresult"
    log = (directory / "xcodebuild.log").read_text(errors="replace")
    return (
        (bundle / "Info.plist").is_file()
        or "Test Case '" in log
        or any(
            path.stat().st_size > 0
            for path in bundle.glob("Staging/**/StandardOutputAndStandardError.txt")
        )
    )


def collect_diagnostics(directory):
    log = directory / "xcodebuild.log"
    if log.exists():
        print("\n".join(log.read_text(errors="replace").splitlines()[-80:]), flush=True)
    diagnostics = {
        "host-memory.txt": ["vm_stat"],
        "host-processes.txt": ["ps", "-axo", "pid,ppid,%cpu,%mem,comm"],
        "simulator-launch.log": ["xcrun", "simctl", "spawn", device["udid"], "log", "show", "--last", "10m", "--style", "compact", "--predicate", 'process == "runningboardd" OR process == "SpringBoard" OR eventMessage CONTAINS[c] "com.gymdrobe"'],
    }
    for name, command in diagnostics.items():
        try:
            with (directory / name).open("w") as destination:
                subprocess.run(command, stdout=destination, stderr=subprocess.STDOUT, check=False, timeout=10)
        except (subprocess.TimeoutExpired, OSError) as error:
            print(f"Diagnostic {name} unavailable: {type(error).__name__}")
    try:
        trace = subprocess.run(
            ["xcrun", "simctl", "spawn", device["udid"], "log", "show", "--last", "10m",
             "--style", "compact", "--predicate", 'eventMessage CONTAINS "GymDrobe secure session"'],
            capture_output=True, text=True, timeout=15, check=False,
        )
        events = [
            {"operation": match[0], "os_status": int(match[1])}
            for match in re.findall(r"GymDrobe secure session (read|write|clear) failed, OSStatus=(-?\d+)", trace.stdout)
        ]
        (directory / "session-diagnostics.json").write_text(json.dumps({
            "capture_status": "available" if trace.returncode == 0 else "unavailable",
            "events": events[-20:],
        }, indent=2))
    except (subprocess.TimeoutExpired, OSError) as error:
        print(f"Keychain diagnostics unavailable: {type(error).__name__}")
    bundle = directory / "Shopping.xcresult"
    # A partial bundle has runner logs, but xcresulttool cannot read it yet.
    if (bundle / "Info.plist").is_file():
        for report in ("summary", "tests"):
            try:
                with (directory / f"native-test-{report}.json").open("w") as destination:
                    result = subprocess.run([
                        "xcrun", "xcresulttool", "get", "test-results", report,
                        "--path", str(bundle),
                    ], stdout=destination, check=False, timeout=10)
                if result.returncode:
                    print(f"XCTest {report} export failed; inspect the result bundle.")
            except (subprocess.TimeoutExpired, OSError) as error:
                print(f"XCTest {report} export unavailable: {type(error).__name__}")
        try:
            export = subprocess.run([
                "xcrun", "xcresulttool", "export", "attachments", "--path", str(bundle),
                "--output-path", str(directory / "ui-screenshots"),
            ], check=False, timeout=20)
            if export.returncode:
                print("XCTest attachment export failed; inspect the result bundle.")
        except (subprocess.TimeoutExpired, OSError) as error:
            print(f"XCTest attachment export unavailable: {type(error).__name__}")


try:
    try:
        run_xctest(output)
    except subprocess.TimeoutExpired:
        if did_xctest_start(output):
            raise
        print("::warning::XCTest runner timed out before a test started. Rebooting the test simulator once.", flush=True)
        first_attempt = output / "runner-startup-timeout"
        first_attempt.mkdir()
        for name in ("Shopping.xcresult", "xcodebuild.log"):
            path = output / name
            if path.exists():
                path.rename(first_attempt / name)
        collect_diagnostics(first_attempt)
        simulator = ["xcrun", "simctl"]
        subprocess.run([*simulator, "shutdown", device["udid"]], check=True, timeout=20)
        subprocess.run([*simulator, "boot", device["udid"]], check=True, timeout=30)
        subprocess.run([*simulator, "bootstatus", device["udid"], "-b"], check=True, timeout=90)
        run_xctest(output)
finally:
    collect_diagnostics(output)
print("Native iPhone tab navigation tests passed.")
