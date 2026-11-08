// Doubles replace only external providers. Chrome runs real microphone capture,
// AudioWorklets, PCM playback, sentence batching, and the call alert interface.
export async function callFixture(page){
  await page.addInitScript(()=>{
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.capturedAudioTracks=[];
    navigator.mediaDevices.getUserMedia=async constraints=>{
      const media=await original(constraints);window.capturedAudioTracks.push(...media.getTracks());return media;
    };
  });
  let tokens=0;
  const sockets=[],requests=[],pcmFrames=[];
  await page.route('**/api/call',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(body.action==='token')return route.fulfill({json:{token:'test-token-'+(++tokens)}});
    if(body.action==='reply')return route.fulfill({json:{text:'A newly generated caller reply.'}});
    if(body.action==='speech'){
      const samples=new Int16Array(4800);for(let i=0;i<samples.length;i++)samples[i]=Math.sin(i*.12)*12000;
      return route.fulfill({contentType:'audio/pcm',body:Buffer.from(samples.buffer)});
    }
    return route.fulfill({json:{risk:'low',reasons:[],analysisSource:'hybrid',incomplete:false,sessionId:'test-session',sequence:body.sequence}});
  });
  await page.routeWebSocket('wss://api.elevenlabs.io/**',socket=>{
    sockets.push(socket);socket.onMessage(message=>{const value=JSON.parse(String(message));if(value.message_type==='input_audio_chunk')pcmFrames.push(value.audio_base_64);});
    socket.send(JSON.stringify({message_type:'session_started',session_id:'test-session'}));
  });
  return {
    requests,pcmFrames,
    say(text,speaker='contact'){
      const index=speaker==='user'?Math.max(0,sockets.length-2):sockets.length-1;
      if(!sockets[index])throw new Error('Transcription has not connected.');
      sockets[index].send(JSON.stringify({message_type:'committed_transcript',text}));
    },
    disconnect(){sockets.at(-1)?.close();},
  };
}
