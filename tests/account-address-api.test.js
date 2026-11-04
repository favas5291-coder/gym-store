import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getAddresses} from '../src/services/addressApi.js';

test('account summaries distinguish valid empty addresses, malformed responses and request failures', async () => {
  const original=globalThis.fetch;
  try {
    let status=200,body={addresses:[]};
    globalThis.fetch=async()=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
    assert.deepEqual(await getAddresses('fixture-token'),[]);
    body={addresses:[{id:'saved-address',isDefault:true}]};
    assert.equal((await getAddresses('fixture-token'))[0].id,'saved-address');
    body={success:true};
    await assert.rejects(()=>getAddresses('fixture-token'),/could not be loaded/);
    status=503;body={message:'Addresses are temporarily unavailable.'};
    await assert.rejects(()=>getAddresses('fixture-token'),error=>error.status===503&&/temporarily unavailable/.test(error.message));
  } finally {globalThis.fetch=original;}
});
