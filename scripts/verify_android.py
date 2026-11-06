#!/usr/bin/env python3
"""Verify the current signed APK without accessing private signing material."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
TOOLS = Path(os.environ.get('QINGZHANG_TOOLCHAINS', '/workspace/shared/qingzhang-toolchains'))


def main():
    app = json.loads((ROOT / 'app.json').read_text())['expo']
    version, code = app['version'], app['android']['versionCode']
    apk = ROOT / f'downloads/qingzhang-v{version}-android-arm64.apk'
    binaries = TOOLS / 'android-sdk/build-tools/37.0.0'
    env = os.environ.copy()
    if (TOOLS / 'java-home.txt').is_file():
        env['JAVA_HOME'] = (TOOLS / 'java-home.txt').read_text().strip()
        env['PATH'] = str(Path(env['JAVA_HOME']) / 'bin') + os.pathsep + env['PATH']
    signature = subprocess.check_output([str(binaries / 'apksigner'), 'verify', '--verbose', '--print-certs', str(apk)], text=True, env=env)
    assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in signature
    certificate = re.search(r'certificate SHA-256 digest: (\S+)', signature).group(1)
    previous = [json.loads(path.read_text()) for path in (ROOT / 'downloads').glob('*-verification.json')]
    previous = max((item for item in previous if item['version_code'] < code), key=lambda item: item['version_code'])
    assert certificate == previous['signer_certificate_sha256'], 'Upgrade signing certificate changed'
    subprocess.run([str(binaries / 'zipalign'), '-c', '-P', '16', '4', str(apk)], check=True)
    badging = subprocess.check_output([str(binaries / 'aapt'), 'dump', 'badging', str(apk)], text=True)
    assert f"name='{app['android']['package']}'" in badging
    assert f"versionCode='{code}'" in badging and f"versionName='{version}'" in badging
    assert "sdkVersion:'24'" in badging and 'application-debuggable' not in badging
    assert "android.permission.USE_BIOMETRIC" in badging, 'System biometric permission missing'
    for permission in app['android']['blockedPermissions']:
        assert permission not in badging, 'Blocked permission remains: ' + permission
    with zipfile.ZipFile(apk) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        architectures = sorted({name.split('/')[1] for name in names if name.startswith('lib/') and name.endswith('.so')})
        assert architectures == ['arm64-v8a']
        bundles = [name for name in names if name.startswith('assets/') and name.endswith('.bundle')]
        assert bundles and all(b'__qingzhangRenders' not in archive.read(name) for name in bundles), 'Benchmark instrumentation leaked'
        assert any(b'RNCViewPager' in archive.read(name) for name in names if name.endswith('.dex')), 'Native pager implementation missing'
        for module in [b'ExpoLocalAuthentication', b'ExpoSecureStore']:
            assert any(module in archive.read(name) for name in names if name.endswith('.dex')), 'Native privacy module missing: ' + module.decode()
        for module in [b'ExpoBackgroundTask', b'ExpoTaskManager']:
            assert any(module in archive.read(name) for name in names if name.endswith('.dex')), 'Native background module missing: ' + module.decode()
        assert 'assets/third-party/BlurView-LICENSE.txt' in names
        assert archive.read('assets/third-party/react-native-pager-view-LICENSE.txt') == (ROOT / 'node_modules/react-native-pager-view/LICENSE').read_bytes()
        icons = {}
        for icon in ['ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher_foreground.webp']:
            native = ROOT / 'android/app/src/main/res/mipmap-xxxhdpi' / icon
            expected = hashlib.sha256(native.read_bytes()).hexdigest()
            matching = [name for name in names if name.endswith('.webp') and hashlib.sha256(archive.read(name)).hexdigest() == expected]
            assert matching, 'Launcher resource missing: ' + icon
            icons[icon] = matching
    digest = hashlib.sha256(apk.read_bytes()).hexdigest()
    mapping = (ROOT / 'android/app/build/outputs/mapping/release/mapping.txt').read_text()
    section = re.search(r'^androidx\.work\.impl\.WorkDatabase_Impl -> [^\n]+\n((?:[ \t#].*\n)*)', mapping, re.M)
    assert section and re.search(r'void <init>\(\)', section.group(1)), 'WorkManager reflective database constructor was removed by R8'
    packages = re.search(r'^expo\.modules\.ExpoModulesPackageList -> expo\.modules\.ExpoModulesPackageList:\n((?:[ \t#].*\n)*)', mapping, re.M)
    assert packages and re.search(r'getPackageList\(\).* -> getPackageList', packages.group(1)), 'Headless task service reflective entry was removed or renamed by R8'
    assert apk.with_suffix('.apk.sha256').read_text().split()[0] == digest
    metadata = {
        'same_signer_as': previous['version'], 'file': apk.name, 'bytes': apk.stat().st_size, 'sha256': digest,
        'package': app['android']['package'], 'version': version, 'version_code': code,
        'min_android_api': 24, 'architectures': architectures, 'debuggable': False,
        'signature_verified': True, 'signer_certificate_sha256': certificate,
        'zip_alignment_16k_verified': True, 'zip_crc_verified': True, 'standalone_bundles': bundles,
        'native_pager_dex_verified': True, 'benchmark_instrumentation_absent': True,
        'native_authentication_and_secure_store_dex_verified': True, 'biometric_permission_verified': True,
        'native_background_modules_dex_verified': True,
        'work_manager_constructor_mapping_verified': True,
        'headless_package_list_mapping_verified': True,
        'pager_license_verified': True, 'new_launcher_resources_verified': icons,
        'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'verified_at': datetime.now(timezone.utc).isoformat(), 'device_installation_tested': False,
    }
    apk.with_name(f'qingzhang-v{version}-android-arm64-verification.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
