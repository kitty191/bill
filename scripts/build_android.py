#!/usr/bin/env python3
"""Build a standalone, privately signed ARM64 preview APK; never commit keys."""
import hashlib
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.parse

ROOT = Path(__file__).resolve().parent.parent
TOOLS = Path(os.environ.get('QINGZHANG_TOOLCHAINS', '/workspace/shared/qingzhang-toolchains'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--arch', choices=['arm64-v8a', 'x86_64'])
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    env = os.environ.copy()
    if not env.get('JAVA_HOME') and (TOOLS / 'java-home.txt').exists():
        env['JAVA_HOME'] = (TOOLS / 'java-home.txt').read_text().strip()
    if not env.get('ANDROID_HOME') and (TOOLS / 'android-sdk').exists():
        env['ANDROID_HOME'] = str(TOOLS / 'android-sdk')
    for name in ['JAVA_HOME', 'ANDROID_HOME', 'QINGZHANG_SIGNING_CONFIG']:
        if not env.get(name):
            sys.exit('Set ' + name + ' before building (see docs/android-build.md).')
    env['PATH'] = str(Path(env['JAVA_HOME']) / 'bin') + os.pathsep + env['PATH']
    env['ANDROID_SDK_ROOT'] = env['ANDROID_HOME']
    env['EXPO_OFFLINE'] = '1'
    env['CI'] = '1'
    env['GRADLE_USER_HOME'] = env.get('GRADLE_USER_HOME', str(TOOLS / 'gradle-home'))
    signing = json.loads(Path(env['QINGZHANG_SIGNING_CONFIG']).read_text())
    for variable, key in [('QINGZHANG_KEYSTORE', 'keystore'), ('QINGZHANG_STORE_PASSWORD', 'storePassword'), ('QINGZHANG_KEY_ALIAS', 'alias'), ('QINGZHANG_KEY_PASSWORD', 'keyPassword')]:
        env[variable] = signing[key]
    if not Path(env['QINGZHANG_KEYSTORE']).is_file():
        sys.exit('The configured signing keystore is missing.')

    subprocess.run(['npx', 'expo', 'prebuild', '--platform', 'android', '--no-install', '--no-clean'], cwd=ROOT, env=env, check=True)
    (ROOT / 'android/local.properties').write_text('sdk.dir=' + env['ANDROID_HOME'] + '\n')
    notices = ROOT / 'android/app/src/main/assets/third-party'
    notices.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / 'node_modules/react-native-pager-view/LICENSE', notices / 'react-native-pager-view-LICENSE.txt')

    # A predownloaded official Gradle archive is usable only with its checksum.
    archive = TOOLS / 'gradle-9.4.1-bin.zip'
    checksum_file = TOOLS / 'gradle-9.4.1.sha256'
    if archive.exists() and checksum_file.exists():
        expected = checksum_file.read_text().strip()
        if hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest() != expected:
            sys.exit('Cached Gradle archive checksum mismatch.')
        wrapper = ROOT / 'android/gradle/wrapper/gradle-wrapper.properties'
        lines = [line for line in wrapper.read_text().splitlines() if not line.startswith(('distributionUrl=', 'distributionSha256Sum='))]
        lines += ['distributionUrl=' + archive.resolve().as_uri(), 'distributionSha256Sum=' + expected]
        wrapper.write_text('\n'.join(lines) + '\n')

    architecture = args.arch or env.get('QINGZHANG_ARCHITECTURES', 'arm64-v8a')
    gradle = [str(ROOT / 'android/gradlew'), ':app:assembleRelease', '--no-daemon', '--max-workers=2',
              '-PreactNativeArchitectures=' + architecture,
              '-Porg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m',
              '-I', str(ROOT / 'scripts/android-release.init.gradle')]
    installations = [str(path) for path in (TOOLS / 'java').glob('jdk-*') if path.is_dir()]
    installations += [value for value in env.get('QINGZHANG_JAVA_INSTALLATIONS', '').split(os.pathsep) if value and Path(value).is_dir()]
    if installations:
        gradle += ['-Porg.gradle.java.installations.paths=' + ','.join(installations),
                   '-Porg.gradle.java.installations.auto-download=false']
    proxy = urllib.parse.urlsplit(env.get('HTTPS_PROXY', env.get('https_proxy', '')))
    if proxy.hostname:
        for protocol in ['http', 'https']:
            gradle += ['-D' + protocol + '.proxyHost=' + proxy.hostname, '-D' + protocol + '.proxyPort=' + str(proxy.port or 8080)]
        gradle += ['-Dhttp.nonProxyHosts=localhost|127.*']
    # Use the platform's trusted CA store without disabling TLS checks.
    trust = Path(env.get('QINGZHANG_JAVA_TRUSTSTORE', '/etc/ssl/certs/java/cacerts'))
    if trust.exists():
        gradle += ['-Djavax.net.ssl.trustStore=' + str(trust)]
        env['JAVA_TOOL_OPTIONS'] = (env.get('JAVA_TOOL_OPTIONS', '') + ' -Djavax.net.ssl.trustStore=' + str(trust)).strip()
    subprocess.run(gradle, cwd=ROOT / 'android', env=env, check=True)
    version = json.loads((ROOT / 'app.json').read_text())['expo']['version']
    suffix = 'arm64' if architecture == 'arm64-v8a' else architecture
    output = args.output or ROOT / f'downloads/qingzhang-v{version}-android-{suffix}.apk'
    output.parent.mkdir(exist_ok=True)
    shutil.copy2(ROOT / 'android/app/build/outputs/apk/release/app-release.apk', output)
    digest = hashlib.file_digest(output.open('rb'), 'sha256').hexdigest()
    output.with_suffix('.apk.sha256').write_text(digest + '  ' + output.name + '\n')
    print('APK created:', output)
    print('SHA-256:', digest)


if __name__ == '__main__':
    main()
