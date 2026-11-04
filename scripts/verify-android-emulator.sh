#!/usr/bin/env bash
# Run as ONE command: android-emulator-runner executes each script line separately.
set -Eeuo pipefail
results_dir="${GYMDROBE_ANDROID_RESULTS:-test-results/android}"
baseline_apk="${GYMDROBE_ANDROID_BASELINE_APK:-/tmp/gymdrobe-baseline/GymDrobe-debug.apk}"
mkdir -p "$results_dir"
collect_diagnostics() {
  local result=$?
  timeout 20s adb logcat -d -t 1000 > "$results_dir/emulator-logcat.txt" 2>/dev/null || true
  exit "$result"
}
trap collect_diagnostics EXIT

# Missing or broken historical software cannot establish a valid comparison.
# It must never prevent the current APK from being tested.
if [[ -f "$baseline_apk" ]]; then
  if timeout 60s adb install -r "$baseline_apk" && timeout 180s node scripts/measure-android-startup.mjs "$results_dir/startup-before.json"; then
    :
  else
    printf '%s\n' 'Historical APK comparison unavailable: install or startup measurement failed.' > "$results_dir/baseline-unavailable.txt"
    rm -f "$results_dir/startup-before.json"
    timeout 20s adb logcat -d -t 600 > "$results_dir/baseline-emulator-logcat.txt" 2>/dev/null || true
    timeout 30s adb shell am force-stop com.gymdrobe.app
  fi
else
  printf '%s\n' 'Historical APK artifact unavailable; no before comparison can be claimed.' > "$results_dir/baseline-unavailable.txt"
fi

# Every current-build command is mandatory. Preserve failures through the EXIT trap.
printf '%s\n' 'ANDROID_VERIFY current-install'
timeout 60s adb install -r "$results_dir/GymDrobe-debug.apk"
printf '%s\n' 'ANDROID_VERIFY current-startup'
timeout 240s node scripts/measure-android-startup.mjs "$results_dir/startup-after.json"
timeout 20s adb logcat -c
timeout 60s adb shell am start -W -n com.gymdrobe.app/.MainActivity
sleep "${GYMDROBE_ANDROID_SETTLE_SECONDS:-8}"
printf '%s\n' 'ANDROID_VERIFY current-smoke'
timeout 120s bash scripts/smoke-android.sh
