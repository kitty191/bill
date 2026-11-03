#!/usr/bin/env python3
"""Measure paging with fake data and temporary counters, never ship instrumentation."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='/tmp/qingzhang-paging-benchmark.json')
    args = parser.parse_args()
    screens = {name: ROOT / f'src/screens/{name}.tsx' for name in ['HomeScreen', 'EntriesScreen', 'StatsScreen']}
    original = {name: path.read_bytes() for name, path in screens.items()}
    with tempfile.TemporaryDirectory(prefix='qingzhang-paging-', dir='/tmp') as output:
        try:
            for name, path in screens.items():
                code = path.read_text()
                marker = '  const t = useTheme();'
                if code.count(marker) != 1:
                    raise RuntimeError('Screen instrumentation marker changed: ' + name)
                counter = f"  const perf = (globalThis as typeof globalThis & {{ __qingzhangRenders?: Record<string, number> }}).__qingzhangRenders;\n  if (perf) perf['{name}'] = (perf['{name}'] ?? 0) + 1;\n"
                path.write_text(code.replace(marker, counter + marker, 1))
            subprocess.run(['npm', 'run', 'export:web', '--', '--max-workers', '2', '--output-dir', output], cwd=ROOT, env={**os.environ, 'EXPO_OFFLINE': '1'}, check=True)
        finally:
            for name, path in screens.items():
                path.write_bytes(original[name])
        subprocess.run(['node', str(ROOT / 'scripts/benchmark-paging.cjs'), output, str(Path(args.output).resolve()), '--check'], cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
