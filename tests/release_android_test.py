"""Publication guard tests use fake APK bytes and never access signing material."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys
from unittest.mock import patch
import zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from android_inputs import filter_android_changes, PAGER, NATIVE_PAGER
import prepare_android_update as update

spec = importlib.util.spec_from_file_location('release_android', Path(__file__).resolve().parents[1]/'scripts/release_android.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class ReleaseGuards(unittest.TestCase):
    def test_update_locks_signer_on_old_and_new_android_and_checks_source_version(self):
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / 'example.apk'
            with zipfile.ZipFile(apk, 'w') as archive:
                archive.writestr('lib/arm64-v8a/example.so', b'emulator fixture')
            badging = (f"package: name='{update.PACKAGE}' versionCode='24' versionName='0.8.3'\n"
                       "minSdkVersion:'24'\n")
            signature = f'V2 Signer: certificate SHA-256 digest: {update.CERTIFICATE}\n'
            with patch.object(update, 'run', side_effect=[badging, signature, signature, '']):
                candidate = update.inspect_apk(Path(directory), apk)
            previous = {**candidate, 'version_code': 23, 'version': '0.8.2'}
            app = {'version': '0.8.3', 'android': {'versionCode': 24}}
            update.verify_update(previous, candidate, app)
            with self.assertRaisesRegex(ValueError, 'increase'):
                update.verify_update(candidate, candidate, app)
            with patch.object(update, 'run', side_effect=[badging, signature, signature.replace(update.CERTIFICATE, '0' * 64)]):
                with self.assertRaisesRegex(ValueError, 'certificate'):
                    update.inspect_apk(Path(directory), apk)

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
