// These are shell-orchestration unit checks, not Android or device verification.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,chmodSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('Android verification tolerates unavailable history but preserves every current-build failure',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'gymdrobe-android-contract-'));
  const bin=path.join(dir,'bin'),results=path.join(dir,'results');mkdirSync(bin);mkdirSync(results);
  const baseline=path.join(dir,'baseline.apk'),trace=path.join(dir,'calls');
  writeFileSync(baseline,'fixture');writeFileSync(path.join(results,'GymDrobe-debug.apk'),'fixture');
  for(const command of ['adb','node','bash']) {
    const file=path.join(bin,command);
    writeFileSync(file,`#!/bin/sh
printf '%s\\n' '${command} '"$*" >> "$TRACE_PATH"
case "$TEST_MODE:${command}:$*" in
 baseline-install:adb:*baseline.apk*) exit 4;;
 baseline-startup:node:*startup-before.json*) exit 5;;
 current-install:adb:*GymDrobe-debug.apk*) exit 6;;
 current-startup:node:*startup-after.json*) exit 7;;
 current-smoke:bash:*smoke-android.sh*) exit 8;;
esac
exit 0
`);chmodSync(file,0o755);
  }
  try {
    for(const [mode,expected] of [['ok',0],['baseline-install',0],['baseline-startup',0],['missing-history',0],['current-install',6],['current-startup',7],['current-smoke',8]]) {
      writeFileSync(trace,'');
      const run=spawnSync('/bin/bash',['scripts/verify-android-emulator.sh'],{encoding:'utf8',env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,TEST_MODE:mode,TRACE_PATH:trace,GYMDROBE_ANDROID_RESULTS:results,GYMDROBE_ANDROID_BASELINE_APK:mode==='missing-history'?path.join(dir,'missing.apk'):baseline,GYMDROBE_ANDROID_SETTLE_SECONDS:'0'}});
      assert.equal(run.status,expected,mode+': '+run.stderr);
      const calls=readFileSync(trace,'utf8');
      assert.match(calls,/adb install -r .*GymDrobe-debug.apk/,mode);
      assert.match(calls,/adb logcat -d -t 1000/,mode+' must retain diagnostics');
      if(expected===0)assert.match(calls,/bash scripts\/smoke-android.sh/,mode+' must reach current smoke test');
      if(mode.startsWith('baseline-')||mode==='missing-history')assert.ok(existsSync(path.join(results,'baseline-unavailable.txt')));
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});
