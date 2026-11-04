#!/usr/bin/env bash
# Run as ONE command: android-emulator-runner executes each script line separately.
set -Eeuo pipefail
results_dir="${GYMDROBE_ANDROID_RESULTS:-test-results/android}"
baseline_apk="${GYMDROBE_ANDROID_BASELINE_APK:-}"
mkdir -p "$results_dir"
collect_diagnostics() {
  local result=$?
  timeout 20s adb logcat -d -t 1000 > "$results_dir/emulator-logcat.txt" 2>/dev/null || true
  exit "$result"
}
trap collect_diagnostics EXIT

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

# Optional legacy probes run only after all mandatory current checks. CI leaves
# this unset: the observed legacy emulator failure requires an isolated run.
# Missing or broken historical software cannot establish a valid comparison.
# It must never prevent the current APK from being tested.
if [[ -f "$baseline_apk" ]]; then
  if timeout 60s adb install -r "$baseline_apk" && timeout 180s node scripts/measure-android-startup.mjs "$results_dir/startup-before.json"; then
    :
  else
    printf '%s\n' 'Historical APK comparison unavailable: install or startup measurement failed.' > "$results_dir/baseline-unavailable.txt"
    rm -f "$results_dir/startup-before.json"
    timeout 20s adb logcat -d -t 600 > "$results_dir/baseline-emulator-logcat.txt" 2>/dev/null || true
    timeout 30s adb shell am force-stop com.gymdrobe.app || true
  fi
else
  printf '%s\n' 'Historical comparison not run in this emulator; legacy startup failed in run 41921256178. No before comparison is claimed.' > "$results_dir/baseline-unavailable.txt"
fi

