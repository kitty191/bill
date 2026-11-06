"""Publication guard tests use fake APK bytes and never access signing material."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from android_inputs import filter_android_changes, PAGER, NATIVE_PAGER

spec = importlib.util.spec_from_file_location('release_android', Path(__file__).resolve().parents[1]/'scripts/release_android.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class ReleaseGuards(unittest.TestCase):
    def test_only_the_known_web_pager_is_shadowed_by_a_preserved_native_variant(self):
        self.assertEqual(filter_android_changes([PAGER],True,True),[])
        self.assertEqual(filter_android_changes([PAGER,NATIVE_PAGER],True,True),[NATIVE_PAGER])
        self.assertEqual(filter_android_changes([PAGER],True,False),[PAGER])
        self.assertEqual(filter_android_changes(['src/storage/ledgerStore.ts'],True,True),['src/storage/ledgerStore.ts'])
    def test_signer_version_integrity_and_release_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory)/'fixture.apk'; apk.write_bytes(b'fake standalone test APK')
            old = {'version_code': 20, 'signer_certificate_sha256': 'original'}
            good = {'version_code': 21, 'signer_certificate_sha256': 'original', 'signature_verified': True, 'zip_alignment_16k_verified': True, 'zip_crc_verified': True, 'benchmark_instrumentation_absent': True, 'debuggable': False, 'architectures': ['arm64-v8a'], 'bytes': apk.stat().st_size, 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest()}
            release.verify_artifact(good, old, apk)
            for field, value in [('version_code',20),('signer_certificate_sha256','new signer'),('signature_verified',False),('debuggable',True),('architectures',['x86_64']),('sha256','wrong'),('bytes',1)]:
                with self.subTest(field=field), self.assertRaises(release.ReleaseError):
                    release.verify_artifact({**good,field:value},old,apk)
            apk.write_bytes(b'tampered')
            with self.assertRaises(release.ReleaseError): release.verify_artifact(good,old,apk)

if __name__ == '__main__': unittest.main()
