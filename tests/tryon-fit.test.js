import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFit, chartProblem, convertMeasurement } from '../src/utils/fit.js';
import { photoFileProblem } from '../src/utils/tryonPhoto.js';
import { chart } from './fixtures/fit-chart.js';
const sizes=['S','M','L','XL'];
test('fit refuses missing or unverified charts and garment dimensions',()=>{
  assert.equal(assessFit(null,{}).status,'unavailable');
  assert.equal(assessFit({...chart,verified:false},{}).status,'unavailable');
  assert.equal(assessFit({...chart,basis:'garment'},{}).status,'unavailable');
  assert.ok(chartProblem({...chart,source:''}));
});
test('fit uses all required measurements, not chest alone',()=>{
  assert.equal(assessFit(chart,{chest:98,waist:82},'cm','regular',sizes).recommended,'M');
  assert.equal(assessFit(chart,{chest:98,waist:94},'cm','regular',sizes).status,'no-match');
  const outside=assessFit(chart,{chest:140,waist:130});assert.equal(outside.recommended,null);assert.equal(outside.matches.length,0);
});
test('inches and centimetres select the same supplier ranges',()=>{
  const result=assessFit(chart,{chest:98/2.54,waist:82/2.54},'in');assert.equal(result.recommended,'M');
  assert.equal(convertMeasurement(1,'in','cm'),2.54);
});
test('empty, nonfinite and invalid measurements never return a size',()=>{
  for(const v of ['',null,Infinity,-1,'abc'])assert.equal(assessFit(chart,{chest:v,waist:82}).status,'invalid');
  assert.equal(assessFit(chart,{chest:98}).status,'invalid');assert.equal(assessFit(chart,{chest:98,waist:82},'feet').status,'invalid');
});
test('preference only ranks matching sizes without inventing fit',()=>{
  const overlap={...chart,sizes:[{label:'S',body:{chest:[90,102],waist:[76,88]}},{label:'M',body:{chest:[94,108],waist:[80,94]}}]};
  assert.equal(assessFit(overlap,{chest:99,waist:84},'cm','closer').recommended,'S');
  assert.equal(assessFit(overlap,{chest:99,waist:84},'cm','roomier').recommended,'M');
  assert.equal(assessFit(chart,{chest:130,waist:110},'cm','roomier').matches.length,0);
});
test('chart labels and ranges must be consistent with the product',()=>{
  assert.ok(chartProblem(chart,['6','7','8']));
  assert.ok(chartProblem({...chart,sizes:[{label:'M',body:{chest:[100,90],waist:[80,90]}}]}));
  assert.ok(chartProblem({...chart,sizes:[chart.sizes[0],chart.sizes[0]]}));
});
test('photo input rejects unsupported and excessive files',()=>{
  assert.ok(photoFileProblem({type:'image/svg+xml',size:50}));assert.ok(photoFileProblem({type:'image/jpeg',size:9*1024*1024}));
  assert.equal(photoFileProblem({type:'image/png',size:1024}),'');
});