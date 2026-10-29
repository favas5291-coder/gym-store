#!/usr/bin/env bash
# Keep diagnostics even if the native WebView assertion fails.
node scripts/smoke-android.mjs
smoke_result=$?
adb shell uiautomator dump /sdcard/gymdrobe-window.xml
adb pull /sdcard/gymdrobe-window.xml test-results/android/login-screen.xml
adb shell pidof com.gymdrobe.app
adb exec-out screencap -p > test-results/android/login-screen.png
adb logcat -d > test-results/android/device.log
adb logcat -d -s AndroidRuntime:E > test-results/android/android-runtime.log
if grep -q 'com.gymdrobe.app' test-results/android/android-runtime.log; then
  cat test-results/android/android-runtime.log
  exit 1
fi
exit "$smoke_result"
