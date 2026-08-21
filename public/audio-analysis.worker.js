let sampleRate=0,framesPerSecond=20,totalSamples=0,step=1,alpha=0,totalFrames=0;
let analysis=[],lowPass=0,previous=0,sum=0,lowSum=0,frameSamples=0,processed=0,frame=0,progressInterval=1;

function reset(config){
  sampleRate=config.sampleRate;framesPerSecond=config.framesPerSecond;totalSamples=config.totalSamples;
  step=Math.max(1,Math.floor(sampleRate/framesPerSecond));alpha=1-Math.exp(-2*Math.PI*180/sampleRate);
  totalFrames=Math.ceil(totalSamples/step);progressInterval=Math.max(1,Math.floor(totalFrames/100));
  analysis=[];lowPass=0;previous=0;sum=0;lowSum=0;frameSamples=0;processed=0;frame=0;
}

function completeFrame(){
  const overall=Math.min(1,Math.sqrt(sum/frameSamples)*3.3);
  const low=Math.min(1,Math.sqrt(lowSum/frameSamples)*5.5);
  const transient=Math.min(1,Math.max(0,overall-previous*.88)*4.5);
  analysis.push({overall,low,transient});previous=overall;sum=0;lowSum=0;frameSamples=0;
  if(frame%progressInterval===0)postMessage({type:'progress',value:Math.min(99,Math.round(frame/totalFrames*100))});
  frame++;
}

self.onmessage=event=>{
  const message=event.data;
  if(message.type==='start'){reset(message);return}
  if(message.type==='chunk'){
    const samples=new Float32Array(message.samples);
    for(let i=0;i<samples.length;i++){
      const sample=samples[i];lowPass+=alpha*(sample-lowPass);sum+=sample*sample;lowSum+=lowPass*lowPass;
      frameSamples++;processed++;
      if(frameSamples===step||processed===totalSamples)completeFrame();
    }
    postMessage({type:'chunk-complete'});return;
  }
  if(message.type==='end'){
    postMessage({type:'progress',value:100});postMessage({type:'complete',analysis});
  }
};
