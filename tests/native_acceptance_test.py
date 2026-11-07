"""JobScheduler formats from API 35 diagnostics and older Android releases."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('native_acceptance',Path(__file__).resolve().parents[1]/'scripts/native_acceptance.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)

class ScheduledJobs(unittest.TestCase):
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
