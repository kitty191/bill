"""JobScheduler formats from API 35 diagnostics and older Android releases."""
import importlib.util
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('native_acceptance',Path(__file__).resolve().parents[1]/'scripts/native_acceptance.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)

class ScheduledJobs(unittest.TestCase):
    def test_restart_requires_the_new_success_filename_and_an_idle_control(self):
        def tree(filename,enabled):
            return ET.fromstring(f'<hierarchy><node text="{filename}"/><node content-desc="立即生成自动备份" enabled="{enabled}"/></hierarchy>')
        self.assertFalse(native.backup_ui_complete(tree('old.json','true'),'new.json'))
        self.assertFalse(native.backup_ui_complete(tree('new.json','false'),'new.json'))
        self.assertTrue(native.backup_ui_complete(tree('new.json','true'),'new.json'))
    def test_namespaced_job_zero_and_legacy_job_are_both_addressable(self):
        dump = '''
  JOB #u0a130/5: 48a49c6 com.google.android.apps.safetyhub/androidx.work.impl.background.systemjob.SystemJobService
  JOB androidx.work.systemjobscheduler:u0a210/0: 1246430 @androidx.work.systemjobscheduler@com.kitty191.qingzhang/androidx.work.impl.background.systemjob.SystemJobService
      Service: com.kitty191.qingzhang/androidx.work.impl.background.systemjob.SystemJobService
  JOB #u0a210/9: 123abcd com.kitty191.qingzhang/androidx.work.impl.background.systemjob.SystemJobService
  JOB #u0a210/10: 123abce com.kitty191.qingzhang/some.other.Service
'''
        self.assertEqual(native.backup_system_jobs(dump),[('androidx.work.systemjobscheduler','0'),(None,'9')])
        self.assertEqual(native.backup_system_jobs('No registered jobs'),[])

if __name__ == '__main__': unittest.main()
