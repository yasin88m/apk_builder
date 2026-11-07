#!/usr/bin/env bash
set -euo pipefail
sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$sdk_root" ]]; then echo "Android SDK is required" >&2; exit 1; fi
"$sdk_root/cmdline-tools/latest/bin/sdkmanager" "platforms;android-35" "build-tools;35.0.0" >/dev/null
build_tools="$sdk_root/build-tools/35.0.0"
android_jar="$sdk_root/platforms/android-35/android.jar"
mkdir -p .native-build/classes .native-build/dex .native-build/resources
node --input-type=module - <<'JS'
import {appIcon} from './src/zip.mjs';import {writeFileSync} from 'node:fs';
writeFileSync('android/res/drawable/icon.png',appIcon(512,'#ab8bff'));
JS
"$build_tools/aapt2" compile --dir android/res -o .native-build/compiled.zip
"$build_tools/aapt2" link -o .native-build/linked.apk -I "$android_jar" --manifest android/AndroidManifest.xml --min-sdk-version 24 --target-sdk-version 34 .native-build/compiled.zip
javac -source 8 -target 8 -classpath "$android_jar" -d .native-build/classes android/src/com/appbuilder/runtime/MainActivity.java
"$build_tools/d8" --lib "$android_jar" --min-api 24 --output .native-build/dex .native-build/classes/com/appbuilder/runtime/*.class
python3 - <<'PY'
import zipfile,hashlib,base64,json
from pathlib import Path
with zipfile.ZipFile('.native-build/linked.apk') as source,zipfile.ZipFile('.native-build/runtime.apk','w',compression=zipfile.ZIP_STORED) as target:
 for name in source.namelist(): target.writestr(name,source.read(name))
 target.write('.native-build/dex/classes.dex','classes.dex')
b=Path('.native-build/runtime.apk').read_bytes()
Path('public/android-runtime.json').write_text(json.dumps({'format':1,'minSdk':24,'targetSdk':34,'sha256':hashlib.sha256(b).hexdigest(),'apk':base64.b64encode(b).decode()}))
PY
if [[ -f scripts/sign-sample.mjs ]]; then
 node scripts/sign-sample.mjs
 "$build_tools/apksigner" verify --verbose --min-sdk-version 24 .native-build/sample.apk
 "$build_tools/apksigner" verify --verbose --min-sdk-version 24 .native-build/sample-updated.apk
 "$build_tools/aapt2" dump badging .native-build/sample.apk | head -15
 "$build_tools/zipalign" -c 4 .native-build/sample.apk
fi
