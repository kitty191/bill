"""Conservative APK input comparison; the web pager has a native counterpart."""
import subprocess

APP_INPUTS = ['App.tsx', 'src', 'assets', 'native-deps', 'index.ts', 'app.json', 'package.json', 'package-lock.json', 'babel.config.js', 'metro.config.js', 'scripts/build_android.py', 'scripts/android-release.init.gradle']
PAGER = 'src/components/SwipePager.tsx'
NATIVE_PAGER = 'src/components/SwipePager.native.tsx'

def filter_android_changes(changes, native_before, native_after):
    # Only this known fallback is excluded. Removing/changing its .native
    # implementation and every other app/config/build change stay protected.
    return [path for path in changes if path != PAGER or not (native_before and native_after)]

def changed_android_inputs(root, source, target):
    paths = subprocess.check_output(['git','diff','--name-only',source,target,'--',*APP_INPUTS],cwd=root,text=True).splitlines()
    def present(ref):
        return subprocess.run(['git','cat-file','-e',f'{ref}:{NATIVE_PAGER}'],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0
    return filter_android_changes(paths,present(source),present(target))
