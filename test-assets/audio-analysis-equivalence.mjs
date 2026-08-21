import assert from 'node:assert/strict';

const sampleRate=44100,framesPerSecond=20,length=sampleRate*7+137,samples=new Float32Array(length);
for(let i=0;i<length;i++)samples[i]=Math.sin(i*.017)*.42+Math.sin(i*.0031)*.19+(i%997===0?.55:0);

function original(){
  const step=Math.max(1,Math.floor(sampleRate/framesPerSecond)),alpha=1-Math.exp(-2*Math.PI*180/sampleRate),analysis=[];
  let lowPass=0,previous=0;
  for(let i=0;i<samples.length;i+=step){let sum=0,lowSum=0;const end=Math.min(samples.length,i+step);for(let j=i;j<end;j++){const sample=samples[j];lowPass+=alpha*(sample-lowPass);sum+=sample*sample;lowSum+=lowPass*lowPass}const overall=Math.min(1,Math.sqrt(sum/(end-i))*3.3),low=Math.min(1,Math.sqrt(lowSum/(end-i))*5.5),transient=Math.min(1,Math.max(0,overall-previous*.88)*4.5);analysis.push({overall,low,transient});previous=overall}
  return analysis;
}

function chunked(){
  const step=Math.max(1,Math.floor(sampleRate/framesPerSecond)),alpha=1-Math.exp(-2*Math.PI*180/sampleRate),analysis=[];
  let lowPass=0,previous=0,sum=0,lowSum=0,frameSamples=0,processed=0;
  for(let offset=0;offset<samples.length;offset+=8191){const chunk=samples.subarray(offset,Math.min(samples.length,offset+8191));for(const sample of chunk){lowPass+=alpha*(sample-lowPass);sum+=sample*sample;lowSum+=lowPass*lowPass;frameSamples++;processed++;if(frameSamples===step||processed===samples.length){const overall=Math.min(1,Math.sqrt(sum/frameSamples)*3.3),low=Math.min(1,Math.sqrt(lowSum/frameSamples)*5.5),transient=Math.min(1,Math.max(0,overall-previous*.88)*4.5);analysis.push({overall,low,transient});previous=overall;sum=0;lowSum=0;frameSamples=0}}}
  return analysis;
}

assert.deepStrictEqual(chunked(),original());
console.log(`Equivalent: ${original().length} analysis frames`);
