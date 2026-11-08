import test from 'node:test';
import assert from 'node:assert/strict';
import {ScribeStream} from '../src/live-audio.js';

class Socket {
  static instances=[];
  constructor(url){this.url=url;this.readyState=1;this.sent=[];Socket.instances.push(this);}
  send(value){this.sent.push(JSON.parse(value));}
  close(){this.readyState=3;this.onclose?.();}
  event(value){this.onmessage?.({data:JSON.stringify(value)});}
}
test('transcription sends actual PCM and delivers only committed speech once',async()=>{
  const transcripts=[];
  const stream=new ScribeStream({token:'one-use',WebSocketImpl:Socket,onTranscript:text=>transcripts.push(text),onError(){}});
  const ready=stream.start();const socket=Socket.instances.at(-1);
  assert.equal(new URL(socket.url).searchParams.get('commit_strategy'),'vad');
  socket.event({message_type:'session_started'});await ready;
  stream.send(new Uint8Array([0,0,255,127]));
  assert.equal(socket.sent[0].audio_base_64,'AAD/fw==');
  socket.event({message_type:'partial_transcript',text:'Unfinished'});
  socket.event({message_type:'committed_transcript',text:'Hello there.'});
  socket.event({message_type:'committed_transcript_with_timestamps',text:'Hello there.'});
  assert.deepEqual(transcripts,['Hello there.']);
  stream.stop();socket.event({message_type:'committed_transcript',text:'Late speech.'});
  assert.deepEqual(transcripts,['Hello there.']);
});
test('stopping a connection in progress cancels startup and ignores late session events',async()=>{
  const stream=new ScribeStream({token:'one-use',WebSocketImpl:Socket,onTranscript(){},onError(){}});
  const ready=stream.start();const socket=Socket.instances.at(-1);stream.stop();
  await assert.rejects(ready,error=>error.name==='AbortError');
  socket.event({message_type:'session_started'});
  assert.equal(socket.readyState,3);
});
test('unexpected transcription closure reports an outage instead of continuing fake detection',async()=>{
  let error;
  const stream=new ScribeStream({token:'one-use',WebSocketImpl:Socket,onTranscript(){},onError:value=>{error=value;}});
  const ready=stream.start();const socket=Socket.instances.at(-1);socket.event({message_type:'session_started'});await ready;
  socket.close();assert.match(error.message,/transcription.*disconnected/i);
});
test('two complete partial sentences request a final transcript on the next audio frame',async()=>{
  const stream=new ScribeStream({token:'one-use',WebSocketImpl:Socket,onTranscript(){},onError(){}});
  const ready=stream.start();const socket=Socket.instances.at(-1);socket.event({message_type:'session_started'});await ready;
  stream.send(new Uint8Array(64000));
  socket.event({message_type:'partial_transcript',text:'Hello there. We noticed activity.'});
  stream.send(new Uint8Array([0,0]));
  assert.equal(socket.sent.at(-1).commit,true);
  stream.send(new Uint8Array([0,0]));assert.notEqual(socket.sent.at(-1).commit,true,'Do not repeatedly commit the same partial.');
  stream.stop();
});
