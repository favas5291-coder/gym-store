import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url));

test('native opening uses the approved wordmark and the Android launcher palette', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  const background = config.plugins.SplashScreen.backgroundColor;
  assert.equal(config.plugins.SplashScreen.launchShowDuration, 0);
  assert.equal(config.plugins.SplashScreen.showSpinner, false);
  assert.equal(config.ios.backgroundColor, background);
  assert.equal(config.android.backgroundColor, background);
  assert.ok(read('android/app/src/main/res/values/ic_launcher_background.xml').toString().includes(background));
  assert.match(read('android/app/src/main/res/values/styles.xml').toString(), /windowSplashScreenBackground">@color\/ic_launcher_background/);
  assert.deepEqual(read('ios/App/App/Assets.xcassets/LaunchWordmark.imageset/wordmark.png'), read('public/brand/gymdrobe-wordmark-cream.png'));
  const storyboard = read('ios/App/App/Base.lproj/LaunchScreen.storyboard').toString();
  assert.match(storyboard, /contentMode="scaleAspectFit" image="LaunchWordmark"/);
});
