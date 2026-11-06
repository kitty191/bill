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
        end=time.monotonic()+30
        previous=None
        while time.monotonic()<end:
            node,b = self.wait(label)
            if node.get('enabled','true')!='false' and b==previous:
                self.shell('input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2)); return
            previous=b
            time.sleep(.2)
        raise AssertionError('Native control remained disabled: '+label)
    def input_value(self,label,value,timeout=15):
        end=time.monotonic()+timeout; observed=None
        while time.monotonic()<end:
            result=self.find(label)
            if result:
                observed=result[0].get('text')
                if observed==value: return
            time.sleep(.2)
        raise AssertionError(f'Native input {label}: expected {value!r}, observed {observed!r}')
    def launch(self):
        self.shell('am','force-stop',PACKAGE)
        result = self.shell('am','start','-W','-n',PACKAGE+'/.MainActivity')
        try: self.wait('记一笔',timeout=60)
        except AssertionError as error:
            crashes=self.call('logcat','-d','-b','crash')
            raise AssertionError('Application launch failed: '+result+'\n'+crashes[-18000:]) from error
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

    def contains(self, text, timeout=40):
        end=time.monotonic()+timeout
        while time.monotonic()<end:
            for node in self.tree().iter('node'):
                if text in node.get('text','') or text in node.get('content-desc',''): return
            time.sleep(.25)
        raise AssertionError('Native text did not appear: '+text)
    def tap_any(self, labels, timeout=30):
        end=time.monotonic()+timeout
        while time.monotonic()<end:
            for node in self.tree().iter('node'):
                if any(node.get('text','').casefold()==value.casefold() or node.get('content-desc','').casefold()==value.casefold() for value in labels):
                    b=[int(value) for value in re.findall(r'\d+',node.get('bounds',''))]
                    if len(b)==4 and b[2]>b[0] and b[3]>b[1]: self.shell('input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2)); return
            time.sleep(.25)
        raise AssertionError('Native picker control missing: '+str(labels))
    def scroll_to(self,label):
        for _ in range(10):
            if self.find(label): return
            self.shell('input','swipe','500','1400','500','650','250')
        self.wait(label)
    def storage_gate(self, mode):
        self.shell('am','force-stop',PACKAGE)
        location=self.shell('find','/data/user/0/'+PACKAGE,'-name','qingzhang.db').strip().splitlines()
        if len(location)!=1: raise AssertionError('Native fixture database missing')
        remote=location[0]
        owner=self.shell('stat','-c','%u:%g',remote).strip()
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary)
            for suffix in ['', '-wal','-shm']:
                try: (folder/('qingzhang.db'+suffix)).write_bytes(self.call('exec-out','cat',remote+suffix,binary=True))
                except subprocess.CalledProcessError:
                    if not suffix: raise
            file=folder/'qingzhang.db'
            with sqlite3.connect(file) as connection:
                connection.execute('DROP TRIGGER IF EXISTS qingzhang_ci_storage_gate')
                if mode=='fail': connection.execute("CREATE TRIGGER qingzhang_ci_storage_gate BEFORE INSERT ON ledger BEGIN SELECT RAISE(ABORT, 'ci-storage-failure'); END")
                if mode=='delay': connection.execute("CREATE TRIGGER qingzhang_ci_storage_gate BEFORE INSERT ON ledger BEGIN SELECT sum(x) FROM (WITH RECURSIVE numbers(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM numbers WHERE x<100000000) SELECT x FROM numbers); END")
                connection.commit(); connection.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            self.call('push',str(file),'/data/local/tmp/qingzhang-ci-ledger.db')
            self.shell('rm','-f',remote+'-wal',remote+'-shm')
            self.shell('cp','/data/local/tmp/qingzhang-ci-ledger.db',remote)
            self.shell('chown',owner,remote); self.shell('chmod','600',remote)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline',type=Path,required=True)
    parser.add_argument('--candidate',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--serial',default=os.environ.get('ANDROID_SERIAL'))
    args=parser.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    sdk=Path(os.environ.get('ANDROID_HOME',os.environ.get('ANDROID_SDK_ROOT','')))
    binaries=sdk/'build-tools'/os.environ.get('QINGZHANG_BUILD_TOOLS_VERSION','37.0.0')
    def apk_info(file):
        info=subprocess.check_output([str(binaries/'aapt'),'dump','badging',str(file.resolve())],text=True)
        package=re.search(r"package: name='([^']+)' versionCode='(\d+)'",info)
        assert package and package.group(1)==PACKAGE,'Acceptance APK package differs'
        signature=subprocess.check_output([str(binaries/'apksigner'),'verify','--print-certs',str(file.resolve())],text=True)
        certificate=re.search(r'certificate SHA-256 digest: (\S+)',signature).group(1)
        assert 'application-debuggable' not in info,'Acceptance requires a standalone release build'
        return int(package.group(2)),certificate
    old_version,old_certificate=apk_info(args.baseline)
    new_version,new_certificate=apk_info(args.candidate)
    assert new_version>old_version,'Candidate must be a newer installed version'
    assert old_certificate==new_certificate,'Baseline and candidate upgrade signatures must match'
    device=Device(args.serial)
    # This destructive fixture workflow never targets a user's real phone.
    if device.shell('getprop','ro.kernel.qemu').strip()!='1': raise SystemExit('Acceptance fixtures require a fresh emulator; no real-phone data is modified.')
    if PACKAGE in device.shell('pm','list','packages',PACKAGE): raise SystemExit('Use a fresh emulator: the acceptance test will not erase existing app data.')
    device.call('root'); device.call('wait-for-device')
    device.call('logcat','-G','16M')
    device.shell('settings','put','secure','show_ime_with_hard_keyboard','1')
    results={'platform':'Android emulator; not a physical phone or 120 Hz FPS claim','baseline_version_code':old_version,'candidate_version_code':new_version,'same_test_signer':True,'checks':{}}
    try:
        device.call('install','-r',str(args.baseline.resolve()))
        results['baseline_start']=device.launch()
        device.tap('记一笔')
        for key in '12.34': device.tap('计算键'+key)
        device.input_value('金额','12.34')
        device.tap('选择分类、账户和日期')
        for _ in range(5):
            if device.find('备注'): break
            device.shell('input','swipe','500','1400','500','700','250')
        device.tap('备注'); device.shell('input','text','upgrade-check')
        device.input_value('备注','upgrade-check')
        device.shell('input','keyevent','4')
        device.wait('记好了'); device.tap('记好了'); device.wait('记一笔')
        device.tap('隐藏金额')
        device.tap('记一笔')
        for key in '8+2': device.tap('计算键'+key)
        device.input_value('金额','8+2')
        (args.output/'baseline-draft-screen.png').write_bytes(device.call('exec-out','screencap','-p',binary=True))
        device.shell('input','keyevent','3'); time.sleep(1)
        with tempfile.TemporaryDirectory() as temporary:
            before,old_draft=device.data(Path(temporary))
        results['baseline_draft']=old_draft
        results['baseline_ledger']=before
        assert len(before['entries'])==1 and before['entries'][0]['amount']==1234 and before['entries'][0]['note']=='upgrade-check',before
        assert old_draft['fields']['calculator']['expression']=='8+2',old_draft
        device.call('install','-r',str(args.candidate.resolve()))
        results['candidate_start']=device.launch()
        device.wait('显示金额')
        results['checks']['upgrade_preserves_privacy_preference']=True
        with tempfile.TemporaryDirectory() as temporary:
            after,new_draft=device.data(Path(temporary))
        assert after==before,'Upgrade changed persisted financial data'
        assert new_draft==old_draft,'Upgrade lost the unfinished calculator draft'
        results['checks']['upgrade_preserves_ledger_and_draft']=True
        device.launch(); device.tap('显示金额'); device.tap('记一笔'); device.wait('放弃草稿，重新记一笔')
        device.tap('放弃草稿，重新记一笔')
        for key in '5': device.tap('计算键'+key)
        device.input_value('金额','5')
        device.tap('选择分类、账户和日期')
        for _ in range(5):
            if device.find('备注'): break
            device.shell('input','swipe','500','1400','500','700','250')
        device.tap('备注'); device.shell('input','text','keyboard-check')
        device.input_value('备注','keyboard-check')
        # First hardware back hides the IME, without cancelling the draft.
        device.shell('input','keyevent','4'); device.wait('记好了')
        device.tap('记好了'); device.wait('记一笔')
        with tempfile.TemporaryDirectory() as temporary:
            final,draft=device.data(Path(temporary))
        assert len(final['entries'])==2 and sorted(item['amount'] for item in final['entries'])==[500,1234]
        assert draft is None
        results['checks']['calculator_restart_keyboard_save']=True
        before_failure=final
        device.storage_gate('fail'); device.launch(); device.tap('记一笔'); device.tap('计算键9'); device.tap('记好了')
        device.contains('ci-storage-failure')
        with tempfile.TemporaryDirectory() as temporary: unchanged,retry_draft=device.data(Path(temporary))
        assert unchanged==before_failure and retry_draft['fields']['calculator']['expression']=='9'
        device.storage_gate(None); device.launch(); device.tap('记一笔'); device.wait('放弃草稿，重新记一笔'); device.tap('记好了'); device.wait('记一笔')
        with tempfile.TemporaryDirectory() as temporary: before_kill,_=device.data(Path(temporary))
        assert len(before_kill['entries'])==3
        results['checks']['native_write_failure_preserves_ledger_and_retry_draft']=True
        device.storage_gate('delay'); device.launch(); device.tap('记一笔'); device.tap('计算键7'); device.tap('记好了'); device.wait('正在保存…')
        device.shell('am','force-stop',PACKAGE)
        with tempfile.TemporaryDirectory() as temporary: unchanged,killed_draft=device.data(Path(temporary))
        assert unchanged==before_kill and killed_draft['fields']['calculator']['expression']=='7'
        device.storage_gate(None); device.launch(); device.tap('记一笔'); device.tap('记好了'); device.wait('记一笔')
        with tempfile.TemporaryDirectory() as temporary: final,draft=device.data(Path(temporary))
        assert len(final['entries'])==4 and draft is None
        results['checks']['process_kill_during_native_transaction_rolls_back']=True
        device.launch(); device.tap('打开设置'); device.tap('隐私与备份提醒')
        device.scroll_to('选择自动备份目录')
        device.shell('mkdir','-p','/sdcard/Documents/QingzhangBackupTest')
        device.tap('选择自动备份目录'); device.tap_any(['QingzhangBackupTest'])
        device.tap_any(['USE THIS FOLDER','使用此文件夹']); device.tap_any(['ALLOW','允许'])
        device.tap('每天备份')
        end=time.monotonic()+30
        archives=[]
        while time.monotonic()<end:
            archives=[name for name in device.shell('ls','/sdcard/Documents/QingzhangBackupTest').splitlines() if name.endswith('.json')]
            if archives: break
            time.sleep(.3)
        assert archives,'Native automatic backup file was not created'
        archived=json.loads(device.call('exec-out','cat','/sdcard/Documents/QingzhangBackupTest/'+archives[-1]))
        assert archived==final
        device.launch(); device.tap('打开设置'); device.tap('隐私与备份提醒'); device.scroll_to('立即生成自动备份'); device.tap('立即生成自动备份')
        end=time.monotonic()+30
        while time.monotonic()<end:
            archives=[name for name in device.shell('ls','/sdcard/Documents/QingzhangBackupTest').splitlines() if name.endswith('.json')]
            if len(archives)>=2: break
            time.sleep(.3)
        assert len(archives)>=2,'Directory grant did not survive a process restart'
        results['checks']['native_automatic_backup_and_persisted_directory_grant']=True
        device.scroll_to('允许系统后台备份'); device.tap('允许系统后台备份')
        device.contains('已加入系统后台调度')
        before_background=set(archives)
        jobs=device.shell('dumpsys','jobscheduler')
        (args.output/'scheduled-jobs.txt').write_text(jobs)
        job_ids=re.findall(r'JOB #[^/\s]+/(\d+):[^\n]*'+re.escape(PACKAGE)+r'/androidx\.work\.impl\.background\.systemjob\.SystemJobService',jobs)
        assert job_ids,'System WorkManager job was not registered'
        # Background the app and kill its cached process without force-stopping
        # the package. Force-stop intentionally prevents Android background jobs.
        device.shell('input','keyevent','3'); time.sleep(1)
        device.shell('am','kill',PACKAGE)
        launch_job=device.shell('cmd','jobscheduler','run','-f','-u','0',PACKAGE,job_ids[-1])
        results['background_job_trigger']=launch_job
        assert 'Running job' in launch_job,launch_job
        end=time.monotonic()+120
        restored=[]
        while time.monotonic()<end:
            candidates=[name for name in device.shell('ls','/sdcard/Documents/QingzhangBackupTest').splitlines() if name.endswith('.json') and name not in before_background]
            for name in candidates:
                try:
                    payload=json.loads(device.call('exec-out','cat','/sdcard/Documents/QingzhangBackupTest/'+name))
                    if payload==final: restored.append(name)
                except (json.JSONDecodeError,subprocess.CalledProcessError): pass
            if restored: break
            time.sleep(.5)
        assert restored,'Headless WorkManager did not produce a verified copy of the committed ledger'
        time.sleep(1)
        device.launch(); device.tap('打开设置'); device.tap('隐私与备份提醒'); device.scroll_to('允许系统后台备份')
        tree=device.tree()
        labels=' '.join(node.get('text','')+' '+node.get('content-desc','') for node in tree.iter('node'))
        assert '最近后台成功' in labels and '最近后台成功：尚无成功记录' not in labels,labels
        (args.output/'background-backup-screen.png').write_bytes(device.call('exec-out','screencap','-p',binary=True))
        device.tap('允许系统后台备份'); device.contains('后台备份尚未启用')
        results['checks']['headless_background_backup_after_cached_process_kill']=True
        results['checks']['background_opt_out']=True
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
        (args.output/'logcat.txt').write_text(device.call('logcat','-d'))
        (args.output/'crashes.txt').write_text(device.call('logcat','-d','-b','crash'))
        try: (args.output/'last-ui.xml').write_text(ET.tostring(device.tree(),encoding='unicode'))
        except Exception: pass
    print(json.dumps(results['checks'],indent=2))
if __name__=='__main__': main()
