const encoder=new TextEncoder();
const table=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=bytes=>{let c=0xFFFFFFFF;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
const u16=(v)=>[v&255,(v>>>8)&255];
const u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
// Store-only ZIP keeps ASCII STEP/DXF untouched and works without a CDN dependency.
export function zipFiles(files){
  const local=[],central=[];let offset=0;
  for(const {name,content} of files){
    const filename=encoder.encode(name),data=typeof content==='string'?encoder.encode(content):content,crc=crc32(data);
    const l=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(filename.length),...u16(0)]);
    local.push(l,filename,data);
    const c=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(filename.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
    central.push(c,filename);offset+=l.length+filename.length+data.length;
  }
  const dir=concat(central);
  const end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(dir.length),...u32(offset),...u16(0)]);
  return concat([...local,dir,end]);
}
