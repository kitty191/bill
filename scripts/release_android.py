#!/usr/bin/env python3
"""Build, verify and publish an original-signer Android preview in one command.

Signing uses an existing private QINGZHANG_SIGNING_CONFIG selector. No key or
password is copied into the repository or uploaded to GitHub Secrets.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
import socket
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
from android_inputs import changed_android_inputs

ROOT = Path(__file__).resolve().parent.parent
REPOSITORY = 'kitty191/bill'
AUTHOR = {'GIT_AUTHOR_NAME': 'kitty191', 'GIT_AUTHOR_EMAIL': '265797658+kitty191@users.noreply.github.com', 'GIT_COMMITTER_NAME': 'Codex', 'GIT_COMMITTER_EMAIL': 'codex@openai.com'}
APP_INPUTS = ['App.tsx', 'src', 'assets', 'native-deps', 'index.ts', 'app.json', 'package.json', 'package-lock.json', 'babel.config.js', 'metro.config.js', 'scripts/build_android.py', 'scripts/android-release.init.gradle']
REQUIRED = {'typecheck', 'unit', 'web-export', 'browser', 'ios-export', 'apk-build', 'apk-verify'}

class ReleaseError(RuntimeError):
    pass

def run(args, **kwargs):
    return subprocess.check_output(args, cwd=ROOT, text=True, **kwargs).strip()

def git(*args):
    return run(['git', *args])

def context():
    app = json.loads((ROOT/'app.json').read_text())['expo']
    package = json.loads((ROOT/'package.json').read_text())
    if package['version'] != app['version']:
        raise ReleaseError('package.json and app.json versions differ')
    if git('branch', '--show-current') != 'main':
        raise ReleaseError('Publish from the reviewed main branch')
    return app, git('rev-parse', 'HEAD')

def check_source(source, head):
    subprocess.run(['git', 'merge-base', '--is-ancestor', source, head], cwd=ROOT, check=True)
    if git('diff', source, head, '--', *APP_INPUTS):
        raise ReleaseError('App/build inputs changed after verification; prepare a new APK')

def verify_artifact(meta, previous, apk):
    if meta['version_code'] <= previous['version_code']:
        raise ReleaseError('Android versionCode must increase')
    if meta['signer_certificate_sha256'] != previous['signer_certificate_sha256']:
        raise ReleaseError('Original signing certificate changed; refuse publication')
    for field in ['signature_verified', 'zip_alignment_16k_verified', 'zip_crc_verified', 'benchmark_instrumentation_absent']:
        if meta.get(field) is not True:
            raise ReleaseError('Missing APK verification: '+field)
    if meta.get('debuggable') is not False or meta.get('architectures') != ['arm64-v8a']:
        raise ReleaseError('Publish only a standalone ARM64 Release APK')
    with apk.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if apk.stat().st_size != meta['bytes'] or digest != meta['sha256']:
        raise ReleaseError('Prepared APK bytes/checksum differ from verification')

def native_receipt(head):
    runs = json.loads(run(['gh', 'run', 'list', '--repo', REPOSITORY, '--workflow', 'android-acceptance.yml', '--branch', 'main', '--limit', '30', '--json', 'databaseId,headSha,conclusion']))
    for item in runs:
        if item['conclusion'] == 'success' and not changed_android_inputs(ROOT, item['headSha'], head):
            return {'run': item['databaseId'], 'app_source_commit': item['headSha'], 'url': f"https://github.com/{REPOSITORY}/actions/runs/{item['databaseId']}"}
    raise ReleaseError('No successful native acceptance run matches these app/build inputs; wait for CI')

def generated(version):
    base = f'qingzhang-v{version}-android-arm64'
    return [f'downloads/{base}.apk', f'downloads/{base}.apk.sha256', f'downloads/{base}-verification.json', f'downloads/{base}-validation.json', 'downloads/README.md']

def previous_metadata(code):
    values = [json.loads(path.read_text()) for path in (ROOT/'downloads').glob('*-verification.json')]
    older = [value for value in values if value['version_code'] < code]
    if not older:
        raise ReleaseError('An earlier verified original-signer release is required')
    return max(older, key=lambda value: value['version_code'])

def check_dirty(allowed=()):
    changed = set(filter(None, git('diff', '--name-only').splitlines()+git('diff', '--cached', '--name-only').splitlines()+git('ls-files', '--others', '--exclude-standard').splitlines()))
    if changed - set(allowed):
        raise ReleaseError('Commit reviewed source first; unexpected files: '+', '.join(sorted(changed-set(allowed))))

def prepare(app, head, notes, wait_native=0):
    check_dirty()
    selector = os.environ.get('QINGZHANG_SIGNING_CONFIG', '')
    if not selector or not Path(selector).is_file():
        raise ReleaseError('Select the existing private QINGZHANG_SIGNING_CONFIG file; no new signer is generated')
    logs = Path(tempfile.mkdtemp(prefix='qingzhang-release-'))
    steps = [
        ('typecheck', ['npm', 'run', 'typecheck']),
        ('unit', ['npm', 'test', '--', '--maxWorkers=2']),
        ('web-export', ['npm', 'run', 'export:web', '--', '--max-workers', '2']),
        ('browser', ['npm', 'run', 'test:e2e', '--', '--workers=1', '--output', str(logs/'browser-results')]),
        ('ios-export', ['npx', 'expo', 'export', '--platform', 'ios', '--output-dir', str(logs/'ios'), '--max-workers', '2']),
        ('apk-build', ['npm', 'run', 'build:apk']),
        ('apk-verify', ['python3', 'scripts/verify_android.py']),
    ]
    completed = []
    # An interrupted Playwright run may leave its detached server alive. Use a
    # fresh port instead of connecting to an unrelated/stale process.
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        test_port = str(probe.getsockname()[1])
    for name, command in steps:
        print(f'Running {name}; log: {logs/name}', flush=True)
        with (logs/name).open('w') as output:
            result = subprocess.run(command, cwd=ROOT, env={**os.environ, 'EXPO_OFFLINE': '1', 'QINGZHANG_E2E_PORT': test_port}, stdout=output, stderr=subprocess.STDOUT)
        if result.returncode:
            raise ReleaseError(f'{name} failed; publication stopped. See {logs/name}')
        completed.append(name)
    check_source(head, git('rev-parse', 'HEAD'))
    version = app['version']; paths = generated(version)
    meta = json.loads((ROOT/paths[2]).read_text())
    verify_artifact(meta, previous_metadata(app['android']['versionCode']), ROOT/paths[0])
    deadline = time.monotonic() + wait_native * 60
    while True:
        try:
            native = native_receipt(meta['source_commit'])
            break
        except ReleaseError:
            if time.monotonic() >= deadline:
                raise
            print('Waiting for matching native acceptance CI; APK checks are complete.', flush=True)
            time.sleep(30)
    check_source(head, git('rev-parse', 'HEAD'))
    receipt = {'version': version, 'source_commit': meta['source_commit'], 'checked_source_commit': head, 'completed_checks': completed, 'native_acceptance': native, 'apk_sha256': meta['sha256'], 'prepared_at': datetime.now(timezone.utc).isoformat()}
    (ROOT/paths[3]).write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
    url = f'https://github.com/{REPOSITORY}/raw/refs/tags/v{version}-android-preview/{paths[0]}'
    (ROOT/'downloads/README.md').write_text(f'''# 清账 Android 预览版

[下载 v{version} APK]({url}) · [版本说明](https://github.com/{REPOSITORY}/releases/tag/v{version}-android-preview)

版本 {version} / versionCode {app['android']['versionCode']}，{meta['bytes']:,} 字节，约 {meta['bytes']/1024/1024:.1f} MB。
ARM64、Android 7.0+，独立安装包；沿用 v{previous_metadata(app['android']['versionCode'])['version']} 原签名，可直接覆盖安装，无需卸载。

{notes.read_text().strip()}

类型检查、单元 / 组件测试、完整浏览器回归、网页 / iOS 资源导出、Android Release 构建及 APK 验证均通过。
[原生验收]({native['url']}) 覆盖相同应用 / 构建输入；模拟器不代表真机帧率，iOS 导出不代表已生成 IPA。

SHA-256：`{meta['sha256']}`

[APK 校验记录]({Path(paths[2]).name}) · [自动发布验收记录]({Path(paths[3]).name}) · [校验和]({Path(paths[1]).name})。
签名材料保留在私有构建环境。
''')
    check_dirty(paths)
    return meta

def publish(app, notes):
    version = app['version']; paths = generated(version)
    check_dirty(paths)
    meta = json.loads((ROOT/paths[2]).read_text()); receipt = json.loads((ROOT/paths[3]).read_text())
    if meta['version'] != version or meta['version_code'] != app['android']['versionCode'] or receipt['version'] != version:
        raise ReleaseError('Prepared release version differs from source')
    if set(receipt['completed_checks']) != REQUIRED or receipt['source_commit'] != meta['source_commit'] or receipt['apk_sha256'] != meta['sha256']:
        raise ReleaseError('Prepared validation receipt does not match this APK')
    check_source(meta['source_commit'], git('rev-parse', 'HEAD'))
    verify_artifact(meta, previous_metadata(meta['version_code']), ROOT/paths[0])
    subprocess.run(['git', 'add', '--', *paths], cwd=ROOT, check=True)
    if git('diff', '--cached', '--name-only'):
        subprocess.run(['git', 'commit', '-m', f'release: publish verified v{version} Android preview', '-m', 'Co-authored-by: Codex <codex@openai.com>'], cwd=ROOT, env={**os.environ, **AUTHOR}, check=True)
    head = git('rev-parse', 'HEAD')
    subprocess.run(['git', 'push', 'origin', 'main'], cwd=ROOT, check=True)
    if git('ls-remote', 'origin', 'refs/heads/main').split()[0] != head:
        raise ReleaseError('Remote main moved during publication; inspect before continuing')
    tag = f'v{version}-android-preview'
    url = f'https://github.com/{REPOSITORY}/raw/refs/tags/{tag}/{paths[0]}'
    existing = subprocess.run(['gh', 'release', 'view', tag, '--repo', REPOSITORY, '--json', 'url,isDraft,isPrerelease,targetCommitish'], cwd=ROOT, capture_output=True, text=True)
    if existing.returncode:
        if 'not found' not in existing.stderr.lower():
            raise ReleaseError(existing.stderr)
        with tempfile.TemporaryDirectory(prefix='qingzhang-public-notes-') as folder:
            body = Path(folder)/'release.md'
            body.write_text(notes.read_text().strip()+f"\n\n[下载 v{version} APK]({url}) · [完整审查](https://github.com/{REPOSITORY}/blob/main/docs/review-v{version}.md)\n\n约 {meta['bytes']/1024/1024:.1f} MB，ARM64 / Android 7.0+，沿用原签名，可直接覆盖安装。\n\nSHA-256：`{meta['sha256']}`\n")
            subprocess.run(['gh', 'release', 'create', tag, '--repo', REPOSITORY, '--target', head, '--title', f'清账 v{version} · Android 预览版', '--prerelease', '--notes-file', str(body)], cwd=ROOT, check=True)
    info = json.loads(run(['gh', 'release', 'view', tag, '--repo', REPOSITORY, '--json', 'url,isDraft,isPrerelease']))
    if info['isDraft'] or not info['isPrerelease']:
        raise ReleaseError('Expected a published preview prerelease')
    url = f'https://github.com/{REPOSITORY}/raw/refs/tags/{tag}/{paths[0]}'
    checksum = hashlib.sha256(); size = 0
    with urllib.request.urlopen(url, timeout=60) as response:
        while block := response.read(1024*1024):
            checksum.update(block); size += len(block)
    if size != meta['bytes'] or checksum.hexdigest() != meta['sha256']:
        raise ReleaseError('Published download differs from the verified original-signer APK')
    print(json.dumps({'commit': head, 'release': info['url'], 'download': url, 'sha256': checksum.hexdigest(), 'bytes': size, 'anonymous_download_verified': True}, ensure_ascii=False, indent=2))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--prepare-only', action='store_true', help='Run all checks/build/verification and leave reviewed artifacts locally')
    mode.add_argument('--publish-prepared', action='store_true', help='Resume publication of previously validated artifacts without rebuilding')
    parser.add_argument('--notes', type=Path)
    parser.add_argument('--wait-native-minutes', type=int, default=0, help='Wait up to 0–90 minutes for matching native acceptance')
    args = parser.parse_args()
    if not 0 <= args.wait_native_minutes <= 90:
        parser.error('Use a 0–90 minute native acceptance wait')
    app, head = context()
    notes = (args.notes or ROOT/f"docs/release-v{app['version']}.md").resolve()
    if not notes.is_file():
        raise ReleaseError('Create reviewed release notes first: '+str(notes))
    if not args.publish_prepared:
        prepare(app, head, notes, args.wait_native_minutes)
    if not args.prepare_only:
        publish(app, notes)

if __name__ == '__main__':
    try:
        main()
    except (ReleaseError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
