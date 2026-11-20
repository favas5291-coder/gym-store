set -euo pipefail
trap 'adb exec-out screencap -p > evidence/last.png || true; adb shell dumpsys input_method | grep -E "mInputShown|mImeWindowVis|mCurMethodId" > evidence/keyboard-last.log || true' EXIT
adb shell wm size 780x1688
adb shell wm density 320
adb shell settings put secure show_ime_with_hard_keyboard 1
adb shell settings put system font_scale 1
adb reverse tcp:4183 tcp:4183
adb shell pm list packages | grep -i chrome | tee evidence/chrome-package.log
adb shell am set-debug-app --persistent com.android.chrome
adb shell 'echo "chrome --no-first-run --disable-fre --disable-field-trial-config --disable-default-apps --disable-popup-blocking --disable-default-browser-promo --ignore-certificate-errors" > /data/local/tmp/chrome-command-line'
adb shell am start -a android.intent.action.VIEW -d http://localhost:4183/ -p com.android.chrome
adb shell pm grant com.android.chrome android.permission.POST_NOTIFICATIONS || true
adb shell settings put global anr_show_background 0
adb forward tcp:9222 localabstract:chrome_devtools_remote
python3 -u .qa-keyboard/probe.py
