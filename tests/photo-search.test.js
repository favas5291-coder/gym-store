import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePhoto,MAX_BYTES} from '../src/components/photo-search/photo.js';
test('photo validation rejects unsupported formats, empty and oversized images',()=>{
 for(const type of ['image/jpeg','image/png','image/webp'])assert.doesNotThrow(()=>validatePhoto({type,size:1024}));
 for(const f of [null,{type:'image/svg+xml',size:100},{type:'image/heic',size:100},{type:'image/jpeg',size:0},{type:'image/png',size:MAX_BYTES+1}])assert.throws(()=>validatePhoto(f));
});
