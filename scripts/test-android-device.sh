#!/usr/bin/env bash
set -euo pipefail
package_name=ir.apkb.a0123456789abcdef0123456789abcdef
capture_failure() {
 if [[ "$?" != 0 ]]; then
  timeout 10s adb exec-out screencap -p > .native-build/failure-screen.png || true
  timeout 10s adb logcat -d -v time > .native-build/device-log.txt || true
 fi
}
trap capture_failure EXIT
wait_for_ui() {
 local marker="$1" output="$2"
 for attempt in $(seq 1 8); do
  timeout 12s adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  timeout 10s adb pull /sdcard/window.xml "$output" >/dev/null 2>&1 || true
  if [[ -f "$output" ]] && grep -q "$marker" "$output"; then return 0; fi
  sleep 2
 done
 [[ ! -f "$output" ]] || cat "$output"
 return 1
}
start_app() {
 timeout 15s adb shell am force-stop "$package_name"
 # -W can hang in the emulator after replacement installs; actual UI below is the readiness check.
 timeout 20s adb shell am start -n "$package_name/com.appbuilder.runtime.MainActivity"
}
timeout 40s adb install .native-build/sample.apk
timeout 15s adb shell svc wifi disable
timeout 15s adb shell svc data disable
adb logcat -c
start_app
wait_for_ui 'منتخبِ مجموعه' .native-build/device-ui.xml
adb exec-out screencap -p > .native-build/sample-screen.png
adb logcat -d -v time > .native-build/device-log.txt
timeout 40s adb install -r .native-build/sample-updated.apk
adb shell dumpsys package "$package_name" | grep -q 'versionCode=101'
start_app
wait_for_ui 'منتخبِ مجموعه' .native-build/updated-ui.xml
for template in servly eduboss sport; do
 timeout 40s adb install -r ".native-build/$template.apk"
 start_app
 case "$template" in servly) marker='شاپ‌کارت';; eduboss) marker='برو اند بلیس';; sport) marker='سویم‌شاپ';; esac
 wait_for_ui "$marker" ".native-build/$template-ui.xml"
 adb exec-out screencap -p > ".native-build/$template-screen.png"
done
echo 'Android installation, offline rendering of all four templates and in-place update succeeded.'
