#!/usr/bin/env python3
"""Build and verify the update path for the already distributed Android app."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = 'com.kitty191.qingzhang.app'
CERTIFICATE = 'e245b2b5b5e667d864213234ab101572c97b95e511169b06093f1b0dcc0851b0'
FIRST_SUPPORTED_BASELINE = 23


def run(executable, *args):
    return subprocess.check_output([str(executable), *map(str, args)], text=True)


def inspect_apk(build_tools, apk):
    badging = run(build_tools / 'aapt2', 'dump', 'badging', apk)
    package = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging)
    if not package or package[1] != PACKAGE or 'application-debuggable' in badging:
        raise ValueError('APK must be a Release build of the distributed application ID')
    if not re.search(r"^(?:sdkVersion|minSdkVersion):'24'", badging, re.M):
        raise ValueError('Minimum Android API changed')
    for low, high in ((24, 27), (28, 36)):
        signature = run(build_tools / 'apksigner', 'verify', '--print-certs',
                        '--min-sdk-version', low, '--max-sdk-version', high, apk)
        certs = set(re.findall(r'certificate sha-256 digest: ([a-f0-9]{64})', signature.lower()))
        if certs != {CERTIFICATE}:
            raise ValueError('APK signing certificate differs from 清账新版')
    run(build_tools / 'zipalign', '-c', '-P', '16', '4', apk)
    with zipfile.ZipFile(apk) as archive:
        architectures = {entry.split('/')[1] for entry in archive.namelist()
                         if entry.startswith('lib/') and entry.endswith('.so')}
        if architectures != {'arm64-v8a'} or archive.testzip() is not None:
            raise ValueError('APK must be an intact standalone ARM64 package')
    with apk.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    return {'package': package[1], 'version_code': int(package[2]), 'version': package[3], 'sha256': digest}


def verify_update(previous, candidate, app):
    if previous['version_code'] < FIRST_SUPPORTED_BASELINE:
        raise ValueError('Use the distributed v0.8.2 APK or a newer distribution as the baseline')
    if candidate['version_code'] <= previous['version_code']:
        raise ValueError('Update versionCode must increase')
    if candidate['version_code'] != app['android']['versionCode'] or candidate['version'] != app['version']:
        raise ValueError('Candidate version does not match the source configuration')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous', type=Path, required=True, help='previously distributed signed APK')
    parser.add_argument('--output', type=Path, required=True, help='directory for verified artifacts')
    parser.add_argument('--build-tools', type=Path, help='Android SDK build-tools directory')
    parser.add_argument('--verify-only', type=Path, metavar='APK', help='verify an existing candidate from this version')
    args = parser.parse_args()
    tools_root = Path(os.environ.get('QINGZHANG_TOOLCHAINS', '/workspace/shared/qingzhang-toolchains'))
    sdk = Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or tools_root / 'android-sdk')
    build_tools = args.build_tools or sdk / 'build-tools' / os.environ.get('QINGZHANG_BUILD_TOOLS_VERSION', '37.0.0')
    if any(not (build_tools / name).is_file() for name in ('aapt2', 'apksigner', 'zipalign')):
        raise ValueError('Android SDK build tools are missing')
    app = json.loads((ROOT / 'app.json').read_text())['expo']
    if app['android']['package'] != PACKAGE or app['version'] != json.loads((ROOT / 'package.json').read_text())['version']:
        raise ValueError('Source package and version do not match the Android update configuration')
    previous = inspect_apk(build_tools, args.previous.resolve())
    if not FIRST_SUPPORTED_BASELINE <= previous['version_code'] < app['android']['versionCode']:
        raise ValueError('Baseline is outside the supported upgrade range')
    directory = args.output.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"qingzhang-v{app['version']}-android-arm64.apk"
    output = directory / filename
    checksum = output.with_suffix('.apk.sha256')
    receipt = output.with_suffix('.verification.json')
    if any(path.exists() for path in (output, checksum, receipt)):
        raise ValueError('Use a fresh output directory')
    with tempfile.TemporaryDirectory(dir=directory) as work:
        apk = Path(work) / filename
        source_commit = None
        if args.verify_only:
            shutil.copyfile(args.verify_only.resolve(), apk)
        else:
            if not run('git', '-C', ROOT, 'status', '--porcelain').strip():
                source_commit = run('git', '-C', ROOT, 'rev-parse', 'HEAD').strip()
            subprocess.run([sys.executable, str(ROOT / 'scripts/build_android.py'),
                            '--arch', 'arm64-v8a', '--output', str(apk)], cwd=ROOT, check=True)
        candidate = inspect_apk(build_tools, apk)
        verify_update(previous, candidate, app)
        manifest = run(build_tools / 'aapt2', 'dump', 'xmltree', '--file', 'AndroidManifest.xml', apk)
        if 'android.app.shortcuts' not in manifest:
            raise ValueError('Candidate is missing Android launcher shortcuts')
        apk.replace(output)
        checksum.write_text(f"{candidate['sha256']}  {filename}\n")
        receipt.write_text(json.dumps({
            'baseline': previous, 'candidate': candidate, 'certificate_sha256': CERTIFICATE,
            'source_commit': source_commit,
            'physical_device_acceptance': 'pending',
        }, indent=2) + '\n')
    print(output)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from error
