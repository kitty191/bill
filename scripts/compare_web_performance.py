#!/usr/bin/env python3
"""Paired historical/current web measurements with identical dependencies and fixtures."""
import argparse
import io
import json
from pathlib import Path
import statistics
import subprocess
import tarfile
import tempfile

ROOT=Path(__file__).resolve().parent.parent

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline',default='v0.6.1-android-preview')
    parser.add_argument('--current',type=Path,default=ROOT/'dist')
    parser.add_argument('--samples',type=int,default=3)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if not 1<=args.samples<=5: parser.error('Use 1–5 paired measurements')
    ref=subprocess.check_output(['git','rev-parse','--verify','--end-of-options',args.baseline+'^{commit}'],cwd=ROOT,text=True).strip()
    with tempfile.TemporaryDirectory(prefix='qingzhang-web-comparison-') as temporary:
        work=Path(temporary); baseline=work/'baseline'; baseline.mkdir()
        present=set(subprocess.check_output(['git','ls-tree','--name-only',ref],cwd=ROOT,text=True).splitlines())
        paths=[name for name in ['App.tsx','src','assets','app.json','package.json','package-lock.json','babel.config.js','index.ts','tsconfig.json'] if name in present]
        archive=subprocess.check_output(['git','archive','--format=tar',ref,'--',*paths],cwd=ROOT)
        with tarfile.open(fileobj=io.BytesIO(archive)) as data: data.extractall(baseline,filter='data')
        def packages(file):
            value=json.loads(file.read_text()); value.pop('version',None); value.get('packages',{}).get('',{}).pop('version',None); return value
        assert packages(baseline/'package-lock.json')==packages(ROOT/'package-lock.json'),'Use matching dependencies for a code comparison'
        (baseline/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
        (baseline/'metro.config.js').write_text("const { getDefaultConfig } = require('expo/metro-config'); const config=getDefaultConfig(__dirname); config.watchFolders=[...(config.watchFolders||[]),"+json.dumps(str(ROOT/'node_modules'))+"]; config.resolver.nodeModulesPaths=["+json.dumps(str(ROOT/'node_modules'))+"]; module.exports=config;\n")
        historical=work/'historical-web'
        subprocess.run(['node',str(ROOT/'node_modules/expo/bin/cli'),'export','--platform','web','--max-workers','2','--output-dir',str(historical)],cwd=baseline,check=True)
        results={'baseline':[],'candidate':[]}
        for index in range(args.samples):
            sequence=[('baseline',historical),('candidate',args.current.resolve())]
            if index%2: sequence.reverse()
            for name,directory in sequence:
                output=work/f'{name}-{index}.json'
                subprocess.run(['node',str(ROOT/'scripts/benchmark-ledger.cjs'),str(directory),str(output),'--check'],cwd=ROOT,check=True)
                results[name].append(json.loads(output.read_text()))
        keys=['startupMs','navigationMs','searchMs','clearMs','saveMs']
        report={'baseline_commit':ref,'candidate_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'samples_per_version':args.samples,'records':10000,'median_ms':{name:{key:statistics.median(item[key] for item in samples) for key in keys} for name,samples in results.items()},'raw':results,'platform':'Paired Chromium web measurements; not native FPS, physical-device startup or mobile storage timing'}
        args.output.parent.mkdir(parents=True,exist_ok=True); args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(report['median_ms'],indent=2))
if __name__=='__main__': main()
