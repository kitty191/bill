#!/usr/bin/env python3
"""Collect real Android frame diagnostics without installing, clearing or reading account data."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import time

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial',required=True,help='An explicit adb device serial avoids profiling the wrong phone')
    parser.add_argument('--seconds',type=int,default=20)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if not 5<=args.seconds<=60: parser.error('Use a 5–60 second measurement window')
    command=['adb','-s',args.serial,'shell']
    def shell(*parts): return subprocess.check_output([*command,*parts],text=True)
    package='com.kitty191.qingzhang'
    if package not in shell('pm','list','packages',package): raise SystemExit('Install and open the app on this device first')
    shell('dumpsys','gfxinfo',package,'reset')
    print('Use the open app normally: swipe pages, open the calculator, scroll and type. No data is exported.')
    time.sleep(args.seconds)
    raw=shell('dumpsys','gfxinfo',package,'framestats')
    emulator=shell('getprop','ro.kernel.qemu').strip()=='1'
    report={
      'recorded_at':datetime.now(timezone.utc).isoformat(),
      'platform':'Android emulator' if emulator else 'Physical Android device',
      'model':shell('getprop','ro.product.model').strip(),
      'android_api':shell('getprop','ro.build.version.sdk').strip(),
      'duration_seconds':args.seconds,
      'total_frames':int(re.search(r'Total frames rendered:\s*(\d+)',raw).group(1)) if re.search(r'Total frames rendered:\s*(\d+)',raw) else None,
      'janky_frames':int(re.search(r'Janky frames:\s*(\d+)',raw).group(1)) if re.search(r'Janky frames:\s*(\d+)',raw) else None,
      'raw_gfxinfo':raw,
      'notes':'Android renderer diagnostics, not a guaranteed FPS measurement. No ledger, draft, screenshot or UI hierarchy is collected.',
    }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('Frame diagnostics saved:',args.output)
if __name__=='__main__': main()
