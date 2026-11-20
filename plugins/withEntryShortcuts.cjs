const fs = require('node:fs/promises');
const path = require('node:path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');

module.exports = function withEntryShortcuts(config) {
  config = withAndroidManifest(config, (mod) => {
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    main['meta-data'] ??= [];
    if (
      !main['meta-data'].some(
        (node) => node.$['android:name'] === 'android.app.shortcuts',
      )
    ) {
      main['meta-data'].push({
        $: {
          'android:name': 'android.app.shortcuts',
          'android:resource': '@xml/qingzhang_shortcuts',
        },
      });
    }
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const appId = mod.android?.package;
      if (!appId || !/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/.test(appId))
        throw new Error('Android application ID is invalid');
      const resources = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/res',
      );
      await fs.mkdir(path.join(resources, 'xml'), { recursive: true });
      await fs.mkdir(path.join(resources, 'values'), { recursive: true });
      const kinds = [
        ['expense', '记支出'],
        ['income', '记收入'],
      ];
      const shortcuts = kinds
        .map(
          ([
            kind,
          ]) => `  <shortcut android:shortcutId="record_${kind}" android:enabled="true" android:shortcutShortLabel="@string/qingzhang_shortcut_${kind}">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${appId}" android:targetClass="${appId}.MainActivity" android:data="qingzhang-app://record/${kind}" />
  </shortcut>`,
        )
        .join('\n');
      const labels = kinds
        .map(
          ([kind, label]) =>
            `  <string name="qingzhang_shortcut_${kind}">${label}</string>`,
        )
        .join('\n');
      await fs.writeFile(
        path.join(resources, 'xml/qingzhang_shortcuts.xml'),
        `<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${shortcuts}\n</shortcuts>\n`,
      );
      await fs.writeFile(
        path.join(resources, 'values/qingzhang_shortcuts.xml'),
        `<resources>\n${labels}\n</resources>\n`,
      );
      return mod;
    },
  ]);
};
