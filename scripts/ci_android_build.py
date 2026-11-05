#!/usr/bin/env python3
"""Build emulator-only baseline/current APKs with one disposable CI signer."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent

def call(args, cwd=ROOT, env=None):
    subprocess.run(args, cwd=cwd, env=env, check=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', default='v0.6.1-android-preview')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--reuse-run', default='')
    args = parser.parse_args()
    output = args.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    ref = subprocess.check_output(['git','rev-parse','--verify','--end-of-options',args.baseline+'^{commit}'],cwd=ROOT,text=True).strip()
    if args.reuse_run:
        if not args.reuse_run.isdecimal(): raise SystemExit('Reuse run must be a numeric GitHub Actions run ID')
        with tempfile.TemporaryDirectory(prefix='qingzhang-apk-reuse-') as temporary:
            call(['gh','run','download',args.reuse_run,'--repo',os.environ.get('GITHUB_REPOSITORY','kitty191/bill'),'--pattern','emulator-only-apks-*','--dir',temporary])
            manifests=list(Path(temporary).rglob('test-builds.json'))
            if len(manifests)!=1: raise SystemExit('Expected one prior emulator build manifest')
            manifest=manifests[0]; metadata=json.loads(manifest.read_text())
            assert metadata['baseline_commit']==ref and metadata['architecture']=='x86_64'
            # Reuse only when every app/build input is identical. Test scripts,
            # workflow wiring and documentation may change independently.
            difference=subprocess.check_output(['git','diff',metadata['candidate_commit'],'HEAD','--','App.tsx','src','assets','app.json','package.json','package-lock.json','native-deps','babel.config.js','metro.config.js','index.ts','scripts/build_android.py','scripts/android-release.init.gradle'],cwd=ROOT,text=True)
            assert not difference,'App/build inputs changed; build fresh acceptance APKs'
            for name in ['baseline.apk','candidate.apk']:
                file=manifest.parent/name
                assert hashlib.sha256(file.read_bytes()).hexdigest()==metadata['files'][name]
                shutil.copy2(file,output/name)
            shutil.copy2(manifest,output/'test-builds.json')
            (output/'reused-build.json').write_text(json.dumps({'from_run':args.reuse_run,'app_source_commit':metadata['candidate_commit'],'acceptance_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()},indent=2)+'\n')
        print('Reused checksum-verified APKs with identical app/build inputs.')
        return
    with tempfile.TemporaryDirectory(prefix='qingzhang-ci-') as temporary:
        work = Path(temporary); baseline = work/'baseline'; baseline.mkdir()
        names = set(subprocess.check_output(['git','ls-tree','--name-only',ref],cwd=ROOT,text=True).splitlines())
        allowed = [name for name in ['App.tsx','src','assets','native-deps','scripts','app.json','package.json','package-lock.json','babel.config.js','metro.config.js','index.ts','tsconfig.json'] if name in names]
        archive = subprocess.check_output(['git','archive','--format=tar',ref,'--',*allowed],cwd=ROOT)
        with tarfile.open(fileobj=io.BytesIO(archive)) as files: files.extractall(baseline,filter='data')
        def dependencies(path):
            data = json.loads((path/'package-lock.json').read_text()); data.pop('version',None)
            data.get('packages',{}).get('',{}).pop('version',None)
            return data
        if dependencies(baseline) == dependencies(ROOT): (baseline/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
        else: call(['npm','ci','--no-audit','--no-fund'],cwd=baseline)
        # The helper is infrastructure only. Baseline app source, assets and
        # manifest are extracted unchanged from the selected historical commit.
        shutil.copyfile(ROOT/'scripts/build_android.py',baseline/'scripts/build_android.py')
        keystore = work/'test-only.keystore'
        call(['keytool','-genkeypair','-keystore',str(keystore),'-storepass','android','-keypass','android','-alias','ci-only','-keyalg','RSA','-keysize','2048','-validity','30','-dname','CN=Qingzhang disposable CI test'])
        selector = work/'signing.json'
        selector.write_text(json.dumps({'keystore':str(keystore),'storePassword':'android','keyPassword':'android','alias':'ci-only'}))
        env = {**os.environ,'QINGZHANG_SIGNING_CONFIG':str(selector),'EXPO_OFFLINE':'1','CI':'1'}
        for name,path in [('baseline',baseline),('candidate',ROOT)]:
            call(['python3',str(path/'scripts/build_android.py'),'--arch','x86_64','--output',str(output/f'{name}.apk')],cwd=path,env=env)
        (output/'test-builds.json').write_text(json.dumps({'baseline_commit':ref,'candidate_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'architecture':'x86_64','signing':'disposable CI key; not the production upgrade signer','files':{name:hashlib.sha256((output/name).read_bytes()).hexdigest() for name in ['baseline.apk','candidate.apk']}},indent=2)+'\n')
        print('Built emulator acceptance APKs. These are not production installation packages.')
if __name__ == '__main__': main()
