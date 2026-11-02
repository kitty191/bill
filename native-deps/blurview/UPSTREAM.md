# BlurView 3.1.0

- Official source: https://github.com/Dimezis/BlurView
- Tag: `version-3.1.0`
- Verified commit: `15c9e3f0cc84621203abce813a1a7022ee88b6cb`
- Copyright / license: upstream authors, Apache-2.0; see `LICENSE.md`.

`upstream/java` and `upstream/res` are unmodified copies of `library/src/main/java` and `library/src/main/res` at that commit. The upstream license is also included in the APK assets at `third-party/BlurView-LICENSE.txt`.

Expo Blur 58.0.5 requests this exact upstream tag via JitPack. JitPack is unavailable in this cloud's network policy, so `scripts/android-release.init.gradle` substitutes this local Android library during the preview build. This keeps the same blur implementation without fetching a blocked artifact.

The small Gradle adapter uses the application's existing Android toolchain, omits upstream demo/test/publication plugins, and declares the namespace in Gradle rather than the manifest package attribute, as required by current AGP. No blur implementation code or resources have been changed. This vendored source is a dependency, not a separately managed project checkout.
