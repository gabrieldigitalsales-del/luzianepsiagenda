import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'
// Ajusta a logomarca real, sem redesenhar, para a tela inicial do iPhone.
const source=readFileSync(new URL('../public/logo-reabilitar.png',import.meta.url))
let pos=8,width=0,height=0,type=0,depth=0,palette=null;const parts=[]
while(pos<source.length){const len=source.readUInt32BE(pos),tag=source.toString('ascii',pos+4,pos+8),bytes=source.subarray(pos+8,pos+8+len);if(tag==='IHDR'){width=bytes.readUInt32BE(0);height=bytes.readUInt32BE(4);depth=bytes[8];type=bytes[9];}if(tag==='IDAT')parts.push(bytes);if(tag==='PLTE')palette=bytes;pos+=len+12;if(tag==='IEND')break}
if(depth!==8||![2,6].includes(type))throw Error('Formato PNG inesperado da logo')
const bpp=type===2?3:4,raw=inflateSync(Buffer.concat(parts)),stride=width*bpp,pixels=Buffer.alloc(height*stride)
let src=0
for(let y=0;y<height;y++){const filter=raw[src++];for(let x=0;x<stride;x++){const value=raw[src++],a=x>=bpp?pixels[y*stride+x-bpp]:0,b=y?pixels[(y-1)*stride+x]:0,c=y&&x>=bpp?pixels[(y-1)*stride+x-bpp]:0;let p=0;if(filter===1)p=a;else if(filter===2)p=b;else if(filter===3)p=(a+b)>>1;else if(filter===4){const q=a+b-c,da=Math.abs(q-a),db=Math.abs(q-b),dc=Math.abs(q-c);p=da<=db&&da<=dc?a:db<=dc?b:c;}else if(filter!==0)throw Error('Filtro PNG desconhecido');pixels[y*stride+x]=(value+p)&255}}
const dim=180,output=Buffer.alloc((dim*3+1)*dim,255),targetW=112,targetH=Math.round(height*targetW/width),offX=Math.floor((dim-targetW)/2),offY=Math.floor((dim-targetH)/2)
for(let y=0;y<dim;y++)output[y*(dim*3+1)]=0
for(let y=0;y<targetH;y++)for(let x=0;x<targetW;x++){
 const sx=Math.min(width-1,Math.floor(x*width/targetW)),sy=Math.min(height-1,Math.floor(y*height/targetH)),si=sy*stride+sx*bpp,di=(offY+y)*(dim*3+1)+1+(offX+x)*3,alpha=bpp===4?pixels[si+3]/255:1
 for(let k=0;k<3;k++)output[di+k]=Math.round(pixels[si+k]*alpha+255*(1-alpha))
}
const table=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0})
const crc=b=>{let c=0xffffffff;for(const v of b)c=table[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0}
const chunk=(tag,data)=>{const name=Buffer.from(tag),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,sum])}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(dim,0);ihdr.writeUInt32BE(dim,4);ihdr[8]=8;ihdr[9]=2
writeFileSync(new URL('../public/apple-touch-icon.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(output,{level:9})),chunk('IEND',Buffer.alloc(0))]))
console.log('Ícone de iPhone gerado: 180x180 com logo centralizada')
