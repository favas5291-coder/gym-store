"""Launch the real bundled app. Does not authenticate or place orders."""
import json
from pathlib import Path
import subprocess
import time

OUTPUT = Path("test-results/ios")
OUTPUT.mkdir(parents=True, exist_ok=True)

def command(*args):
    return subprocess.check_output(args, text=True, timeout=120).strip()

devices = json.loads(command("xcrun", "simctl", "list", "devices", "available", "--json"))
phones = [(runtime, device) for runtime, rows in devices["devices"].items()
          for device in rows if "iPhone" in device["name"]]
if not phones:
    raise SystemExit("No iPhone simulator runtime is installed.")
runtime, phone = sorted(phones, key=lambda pair: (pair[0], "Pro Max" in pair[1]["name"], pair[1]["name"]), reverse=True)[0]
udid = phone["udid"]
subprocess.run(["xcrun", "simctl", "boot", udid], check=phone["state"] != "Booted", timeout=90)
subprocess.run(["xcrun", "simctl", "bootstatus", udid, "-b"], check=True, timeout=240)
app = "ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app"
subprocess.run(["xcrun", "simctl", "install", udid, app], check=True, timeout=120)
start = time.monotonic()
launch = command("xcrun", "simctl", "launch", "--stdout=" + str((OUTPUT / "runtime.log").resolve()), "--stderr=" + str((OUTPUT / "runtime-errors.log").resolve()), udid, "com.gymdrobe.app")
elapsed = round((time.monotonic() - start) * 1000)
time.sleep(18)
subprocess.run(["xcrun", "simctl", "io", udid, "screenshot", str(OUTPUT / "iphone-home.png")], check=True)
# UI tests tap the actual tab controls. A custom-link open can display iOS's
# confirmation alert, so a screenshot of that dialog does not verify routing.
subprocess.run(["xcodebuild", "-quiet", "-project", "ios/App/App.xcodeproj", "-scheme", "App", "-configuration", "Debug", "-destination", f"platform=iOS Simulator,id={udid}", "-derivedDataPath", "ios/DerivedData", "-resultBundlePath", str(OUTPUT / "Shopping.xcresult"), "CODE_SIGNING_ALLOWED=NO", "test"], check=True, timeout=360)
subprocess.run(["xcrun", "xcresulttool", "export", "attachments", "--path", str(OUTPUT / "Shopping.xcresult"), "--output-path", str(OUTPUT / "ui-screenshots")], check=True, timeout=60)
(OUTPUT / "simulator.json").write_text(json.dumps({"device": phone["name"], "runtime": runtime, "launch": launch, "launchCommandMs": elapsed, "note": "Launch command timing is not WebView FCP/LCP. Screenshots require visual review; no real login or transaction performed."}, indent=2))
print("iPhone simulator application installed, launched and captured.")
