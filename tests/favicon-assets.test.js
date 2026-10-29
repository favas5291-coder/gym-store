// Pixel-level favicon integrity regression. This catches an accidental JPEG
// rename, opaque black canvas, incorrect icon dimensions, and stale references.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { inflateSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root));
const signature = Buffer.from([137,80,78,71,13,10,26,10]);

function pngInfo(buffer) {
  assert.equal(buffer.subarray(0,8).equals(signature),true,"Expected actual PNG bytes");
  let at=8;
  let width=0,height=0,bitDepth=0,type=0;
  const idats=[];
  while(at<buffer.length) {
    const length=buffer.readUInt32BE(at);
    const chunk=buffer.toString("ascii",at+4,at+8);
    const data=buffer.subarray(at+8,at+8+length);
    if(chunk==="IHDR") {
      width=data.readUInt32BE(0);
      height=data.readUInt32BE(4);
      bitDepth=data[8];
      type=data[9];
    }
    if(chunk==="IDAT")idats.push(data);
    if(chunk==="IEND")break;
    at+=length+12;
  }
  assert.equal(bitDepth,8,"Expected 8-bit opacity fidelity");
  assert.equal(type,6,"PNG must be RGBA; palette/JPEG will not preserve alpha reliably");
  const bytes=inflateSync(Buffer.concat(idats));
  const stride=width*4;
  let offset=0,prev=new Uint8Array(stride);
  let minX=width,maxX=-1,minY=height,maxY=-1,alphaZero=0;
  const cornerAlpha=[];
  for(let y=0;y<height;y++) {
    const filter=bytes[offset++];
    const raw=bytes.subarray(offset,offset+stride);
    const row=new Uint8Array(stride);
    offset+=stride;
    for(let i=0;i<stride;i++) {
      const left=i>=4?row[i-4]:0;
      const up=prev[i]||0;
      const upperLeft=i>=4?prev[i-4]:0;
      let predictor=0;
      if(filter===0)predictor=0;
      else if(filter===1)predictor=left;
      else if(filter===2)predictor=up;
      else if(filter===3)predictor=Math.floor((left+up)/2);
      else if(filter===4) {
        const p=left+up-upperLeft;
        const pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upperLeft);
        predictor=pa<=pb&&pa<=pc?left:pb<=pc?up:upperLeft;
      }else throw new Error("Unexpected PNG row filter "+filter);
      row[i]=(raw[i]+predictor)&255;
    }
    for(let x=0;x<width;x++) {
      const alpha=row[x*4+3];
      if(alpha===0)alphaZero++;
      if((y===0||y===height-1)&&(x===0||x===width-1))cornerAlpha.push(alpha);
      if(alpha>10){
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);
        minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
    }
    prev=row;
  }
  return {width,height,cornerAlpha,alphaZero,coverage:
    Math.max(maxX-minX+1,maxY-minY+1)/Math.max(width,height)};
}

const sizes=[
  ["favicon-16x16.png",16],
  ["favicon-32x32.png",32],
  ["favicon-48x48.png",48],
  ["apple-touch-icon.png",180],
  ["android-chrome-192x192.png",192],
  ["android-chrome-512x512.png",512],
];
for(const [name,size] of sizes) {
  test(name+" contains correctly centered genuine transparency",()=>{
    const icon=pngInfo(read("public/"+name));
    assert.equal(icon.width,size);
    assert.equal(icon.height,size);
    assert.deepEqual(icon.cornerAlpha,[0,0,0,0],"Any background square is prohibited");
    assert.ok(icon.alphaZero>size*size*.2,"Canvas must have significant transparency");
    assert.ok(icon.coverage>=.82&&icon.coverage<=.94,JSON.stringify(icon));
  });
}
test("ICO carries three 16/32/48 alpha-capable PNG images",()=>{
  const ico=read("public/favicon.ico");
  assert.equal(ico.readUInt16LE(0),0);
  assert.equal(ico.readUInt16LE(2),1);
  assert.equal(ico.readUInt16LE(4),3);
  const list=Array.from({length:3},(_,i)=>{
    const x=6+i*16;
    const size=ico[x]||256;
    const length=ico.readUInt32LE(x+8);
    const offset=ico.readUInt32LE(x+12);
    assert.ok(offset+length<=ico.length);
    const png=ico.subarray(offset,offset+length);
    const info=pngInfo(png);
    assert.equal(info.width,size);
    assert.ok(info.alphaZero>0);
    return size;
  });
  assert.deepEqual(list,[16,32,48]);
});
test("browser favicons stay transparent and PWA also offers a separate maskable icon",()=>{
  const index=read("index.html").toString();
  const manifest=JSON.parse(read("public/site.webmanifest").toString());
  assert.doesNotMatch(index,/href="\/favicon\.jpeg"/);
  for(const name of ["favicon-16x16.png","favicon-32x32.png","favicon-48x48.png","favicon.ico","apple-touch-icon.png","site.webmanifest"]){
    assert.ok(index.includes("/"+name+"?v=2"),name);
  }
  const transparent = manifest.icons.filter(i=>i.purpose==="any");
  assert.deepEqual(transparent.map(i=>i.sizes),["192x192","512x512"]);
  assert.ok(transparent.every(i=>i.src.endsWith("?v=2")));
  assert.equal(manifest.icons.filter(i=>i.purpose==="maskable").length,1);
  assert.ok(manifest.icons.every(i=>existsSync(new URL("public/"+i.src.slice(1).split("?")[0],root))));
});
