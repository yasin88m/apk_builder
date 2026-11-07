#!/usr/bin/env bash
set -euo pipefail
package_name=ir.apkb.a0123456789abcdef0123456789abcdef
adb install .native-build/sample.apk
adb shell svc wifi disable
adb shell svc data disable
adb logcat -c
adb shell am start -W -n "$package_name/com.appbuilder.runtime.MainActivity"
ready=0
for attempt in $(seq 1 12); do
 adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
 adb pull /sdcard/window.xml .native-build/device-ui.xml >/dev/null 2>&1 || true
 if grep -q 'منتخبِ مجموعه' .native-build/device-ui.xml; then ready=1; break; fi
 sleep 2
done
adb exec-out screencap -p > .native-build/sample-screen.png
adb logcat -d -s AndroidRuntime chromium > .native-build/device-log.txt
if [[ "$ready" != 1 ]]; then cat .native-build/device-ui.xml; cat .native-build/device-log.txt; exit 1; fi
adb install -r .native-build/sample-updated.apk
adb shell am force-stop "$package_name"
adb shell am start -W -n "$package_name/com.appbuilder.runtime.MainActivity"
for template in servly eduboss sport; do
 adb install -r ".native-build/$template.apk"
 adb shell am force-stop "$package_name"
 adb shell am start -W -n "$package_name/com.appbuilder.runtime.MainActivity"
 ready=0
 case "$template" in servly) marker='چه کمکی نیاز داری؟';; eduboss) marker='دوره‌های منتخب';; sport) marker='برای تمرین بعدی تو';; esac
 for attempt in $(seq 1 12); do
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window.xml ".native-build/$template-ui.xml" >/dev/null 2>&1 || true
  if grep -q "$marker" ".native-build/$template-ui.xml"; then ready=1; break; fi
  sleep 2
 done
 adb exec-out screencap -p > ".native-build/$template-screen.png"
 if [[ "$ready" != 1 ]]; then cat ".native-build/$template-ui.xml"; exit 1; fi
done
echo 'Android installation, offline rendering and in-place update succeeded.'
