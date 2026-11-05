#!/usr/bin/env python3
"""Native Android smoke, keyboard, kill/reload and upgrade checks on a fresh emulator."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET

PACKAGE = 'com.kitty191.qingzhang'

class Device:
    def __init__(self, serial): self.command = ['adb'] + (['-s',serial] if serial else [])
    def call(self,*args, binary=False): return subprocess.check_output([*self.command,*args],text=not binary,stderr=subprocess.STDOUT)
    def shell(self,*args): return self.call('shell',*args)
    def tree(self):
        self.shell('uiautomator','dump','/sdcard/qingzhang-acceptance-ui.xml')
        return ET.fromstring(self.call('exec-out','cat','/sdcard/qingzhang-acceptance-ui.xml'))
    def find(self,label):
        for node in self.tree().iter('node'):
            if node.get('content-desc') == label or node.get('text') == label:
                bounds = [int(value) for value in re.findall(r'\d+',node.get('bounds',''))]
                if len(bounds)==4 and bounds[2]>bounds[0] and bounds[3]>bounds[1]: return node,bounds
        return None
    def wait(self,label,timeout=40):
        end = time.monotonic()+timeout
        while time.monotonic()<end:
            result = self.find(label)
            if result: return result
            time.sleep(.25)
        raise AssertionError('Native control did not appear: '+label)
    def tap(self,label):
        _,b = self.wait(label); self.shell('input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2))
    def launch(self):
        self.shell('am','force-stop',PACKAGE)
        result = self.shell('am','start','-W','-n',PACKAGE+'/.MainActivity')
        self.wait('记一笔',timeout=60)
        return result
    def data(self,folder):
        self.shell('am','force-stop',PACKAGE)
        path = self.shell('find','/data/user/0/'+PACKAGE,'-name','qingzhang.db').strip().splitlines()
        if len(path)!=1: raise AssertionError('Expected one native ledger database, found '+str(len(path)))
        database = folder/'qingzhang.db'
        for suffix in ['', '-wal', '-shm']:
            try: raw = self.call('exec-out','cat',path[0]+suffix,binary=True)
            except subprocess.CalledProcessError:
                if not suffix: raise
                continue
            (folder/('qingzhang.db'+suffix)).write_bytes(raw)
        with sqlite3.connect(database) as connection:
            payload = connection.execute('SELECT payload FROM ledger WHERE id = 1').fetchone()
            draft = connection.execute('SELECT payload FROM entry_draft WHERE id = 1').fetchone()
        return json.loads(payload[0]) if payload else None, json.loads(draft[0]) if draft else None

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline',type=Path,required=True)
    parser.add_argument('--candidate',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--serial',default=os.environ.get('ANDROID_SERIAL'))
    args=parser.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    device=Device(args.serial)
    # This destructive fixture workflow never targets a user's real phone.
    if device.shell('getprop','ro.kernel.qemu').strip()!='1': raise SystemExit('Acceptance fixtures require a fresh emulator; no real-phone data is modified.')
    if PACKAGE in device.shell('pm','list','packages',PACKAGE): raise SystemExit('Use a fresh emulator: the acceptance test will not erase existing app data.')
    device.call('root'); device.call('wait-for-device')
    device.shell('settings','put','secure','show_ime_with_hard_keyboard','1')
    results={'platform':'Android emulator; not a physical phone or 120 Hz FPS claim','checks':{}}
    try:
        device.call('install','-r',str(args.baseline.resolve()))
        results['baseline_start']=device.launch()
        device.tap('记一笔')
        for key in '12.34': device.tap('计算键'+key)
        device.tap('选择分类、账户和日期')
        for _ in range(5):
            if device.find('备注'): break
            device.shell('input','swipe','500','1400','500','700','250')
        device.tap('备注'); device.shell('input','text','upgrade-check')
        device.shell('input','keyevent','4')
        device.wait('记好了'); device.tap('记好了'); device.wait('记一笔')
        device.tap('记一笔')
        for key in '8+2': device.tap('计算键'+key)
        device.shell('input','keyevent','3'); time.sleep(1)
        with tempfile.TemporaryDirectory() as temporary:
            before,old_draft=device.data(Path(temporary))
        assert len(before['entries'])==1 and before['entries'][0]['amount']==1234 and before['entries'][0]['note']=='upgrade-check'
        assert old_draft['fields']['calculator']['expression']=='8+2'
        device.call('install','-r',str(args.candidate.resolve()))
        results['candidate_start']=device.launch()
        with tempfile.TemporaryDirectory() as temporary:
            after,new_draft=device.data(Path(temporary))
        assert after==before,'Upgrade changed persisted financial data'
        assert new_draft==old_draft,'Upgrade lost the unfinished calculator draft'
        results['checks']['upgrade_preserves_ledger_and_draft']=True
        device.launch(); device.tap('记一笔'); device.wait('放弃草稿，重新记一笔')
        device.tap('放弃草稿，重新记一笔')
        for key in '5': device.tap('计算键'+key)
        device.tap('选择分类、账户和日期')
        for _ in range(5):
            if device.find('备注'): break
            device.shell('input','swipe','500','1400','500','700','250')
        device.tap('备注'); device.shell('input','text','keyboard-check')
        # First hardware back hides the IME, without cancelling the draft.
        device.shell('input','keyevent','4'); device.wait('记好了')
        device.tap('记好了'); device.wait('记一笔')
        with tempfile.TemporaryDirectory() as temporary:
            final,draft=device.data(Path(temporary))
        assert len(final['entries'])==2 and sorted(item['amount'] for item in final['entries'])==[500,1234]
        assert draft is None
        results['checks']['calculator_restart_keyboard_save']=True
        device.launch(); device.shell('dumpsys','gfxinfo',PACKAGE,'reset')
        for label in ['账单','统计','账单','首页']: device.tap(label)
        dimensions = [int(value) for value in re.findall(r'\d+',device.shell('wm','size'))][-2:]
        width,height = dimensions
        for direction in ['left','left','right','right']*3:
            start,end = (int(width*.85),int(width*.15)) if direction=='left' else (int(width*.15),int(width*.85))
            device.shell('input','swipe',str(start),str(int(height*.45)),str(end),str(int(height*.45)),'240')
            time.sleep(.15)
        device.wait('记一笔')
        results['gfxinfo']=device.shell('dumpsys','gfxinfo',PACKAGE)
        results['checks']['navigation_controls']=True
        (args.output/'native-screen.png').write_bytes(device.call('exec-out','screencap','-p',binary=True))
        results['ledger_sha256']=hashlib.sha256(json.dumps(final,sort_keys=True).encode()).hexdigest()
        results['checks']['completed']=True
    finally:
        (args.output/'native-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
        (args.output/'logcat.txt').write_text(device.call('logcat','-d','-t','1500'))
        try: (args.output/'last-ui.xml').write_text(ET.tostring(device.tree(),encoding='unicode'))
        except Exception: pass
    print(json.dumps(results['checks'],indent=2))
if __name__=='__main__': main()
