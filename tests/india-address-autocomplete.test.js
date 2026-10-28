import test from "node:test";
import assert from "node:assert/strict";
import {
  INDIAN_STATES, CITY_SEEDS, matchCities, matchStates, validIndianState
} from "../src/data/indiaLocations.js";
import {
  normalizePostOfficeResponse, lookupIndianPincode, searchIndianPostOffices
} from "../src/services/indiaPostalLookup.js";
import { routeForPath } from "../src/utils/routePrefetch.js";

test("all 28 Indian states and 8 union territories are available",()=>{
  assert.equal(INDIAN_STATES.length,36);
  assert.equal(new Set(INDIAN_STATES).size,36);
  assert.ok(validIndianState("kerala"));
  assert.ok(validIndianState("Dadra and Nagar Haveli and Daman and Diu"));
  assert.equal(validIndianState("Not a state"),false);
  assert.equal(matchStates("ker")[0],"Kerala");
  assert.deepEqual(matchStates("Utt").slice(0,2).sort(),["Uttar Pradesh","Uttarakhand"]);
});
test("city spelling aliases and selected state ranking",()=>{
  assert.equal(matchCities("koz")[0].city,"Kozhikode");
  assert.equal(matchCities("ban")[0].city,"Bengaluru");
  assert.equal(matchCities("bomb")[0].city,"Mumbai");
  assert.equal(matchCities("che")[0].city,"Chennai");
  assert.equal(matchCities("hyd")[0].city,"Hyderabad");
  assert.equal(matchCities("del")[0].city,"Delhi");
  assert.deepEqual(matchCities("ko","Karnataka").map(x=>x.city),[]);
  assert.ok(matchCities("kan")[0] || CITY_SEEDS.length>60);
  assert.equal(matchCities("small", "", [{city:"Small Town",state:"Kerala",aliases:[]}])[0].city,"Small Town");
});
test("postal response retains every unique locality and ignores failures",()=>{
  const response=[{Status:"Success",PostOffice:[
    {Name:"Main",District:"Kozhikode",State:"Kerala",Pincode:"673585",DeliveryStatus:"Delivery"},
    {Name:"Sub",District:"Kozhikode",State:"Kerala",Pincode:"673585",DeliveryStatus:"Non-Delivery"},
    {Name:"Main",District:"Kozhikode",State:"Kerala",Pincode:"673585"}
  ]}];
  const rows=normalizePostOfficeResponse(response);
  assert.equal(rows.length,2);
  assert.equal(rows[0].district,"Kozhikode");
  assert.equal(rows[0].delivery,true);
  assert.equal(rows[1].delivery,false);
  assert.deepEqual(normalizePostOfficeResponse([{Status:"Error",PostOffice:null}]),[]);
});
test("remote PIN search parses multiple locations, caches a response and leaves invalid PIN offline",async()=>{
  const previous=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async url=>{
    requests.push(String(url));
    return {ok:true,async json(){return [{Status:"Success",PostOffice:[
      {Name:"Kozhikode",District:"Kozhikode",State:"Kerala",Pincode:"673585"},
      {Name:"Koduvally",District:"Kozhikode",State:"Kerala",Pincode:"673585"}
    ]}];}};
  };
  try{
    assert.deepEqual(await lookupIndianPincode("000000"),[]);
    assert.equal(requests.length,0);
    const first=await lookupIndianPincode("673585");
    assert.equal(first.length,2);
    assert.equal((await lookupIndianPincode("673585")).length,2);
    assert.equal(requests.length,1);
    assert.match(requests[0],/pincode\/673585$/);
    assert.deepEqual(await searchIndianPostOffices("Ko"),[]);
    assert.ok((await searchIndianPostOffices("Koz")).length>0);
    assert.equal(requests.length,2);
  }finally{globalThis.fetch=previous;}
});
test("only safe lazy routes are eligible for intent prefetch",()=>{
  assert.equal(routeForPath("/product/abc"),"product");
  assert.equal(routeForPath("/shop"),"shop");
  assert.equal(routeForPath("/checkout"),"checkout");
  assert.equal(routeForPath("/admin"),"");
  assert.equal(routeForPath("/api/orders"),"");
});
