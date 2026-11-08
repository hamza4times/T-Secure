import tests from './recorded-tests-data.json';
import {h,icon} from './ui.js';
import './recorded-tests.css';

const asset=name=>`/recorded-tests/${encodeURIComponent(name)}`;
const time=value=>{
  const minutes=Math.floor(value/60),seconds=Math.floor(value%60);
  const fraction=Number.isInteger(value)?'':'.'+Math.round((value%1)*100).toString().padStart(2,'0');
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}${fraction}`;
};

function player(name,role){
  return `<div class="recorded-player"><h3>${role==='target'?'Target recording':'Reference recording'}</h3>
    <audio id="recorded-${role}" aria-label="${role==='target'?'Target recording':'Reference recording'}" controls preload="none" src="${asset(name)}">Your browser does not support this recording. Use the download link below.</audio>
    <a class="recorded-download" href="${asset(name)}" download>${icon('headphones')}Download ${role} audio</a></div>`;
}

function resultTable(segments,model){
  return `<table class="recorded-results" data-model="${model}"><caption class="sr-only">${model==='gemini'?'Gemini':'Nemotron'} recorded classifications. Activate a timestamp to play the target.</caption>
    <thead><tr><th scope="col">Listen from</th><th scope="col">Reported tone</th><th scope="col">Confidence</th><th scope="col">${model==='gemini'?'Acoustic observations':'Run source'}</th></tr></thead>
    <tbody>${segments.map(segment=>`<tr data-segment-start="${segment.start}" data-segment-end="${segment.end}">
      <td><button class="recorded-timestamp" data-recorded-seek="${segment.start}" aria-label="Play target from ${time(segment.start)} to ${time(segment.end)}">${icon('play')}<span>${time(segment.start)} <span class="recorded-range-end">to ${time(segment.end)}</span></span></button></td>
      <td data-label="Reported tone"><strong>${h(segment.label)}</strong></td>
      <td data-label="Confidence">${h(segment.confidence||'Not supplied')}</td>
      <td data-label="${model==='gemini'?'Acoustic observations':'Run source'}">${h(segment.detail)}</td>
    </tr>`).join('')}</tbody></table>`;
}

export function recordedTests(id){
  const selected=tests.find(test=>test.id===id)||tests[0];
  return `<div class="page-intro recorded-intro"><div><h1>Recorded tests</h1><p>Listen to the examples. Follow how the models described each change in tone.</p></div></div>
    <p class="recorded-context">These are saved experiments supplied with the recordings. Tone labels describe perceived vocal delivery and do not establish a speaker’s feelings or scam risk.</p>
    <div class="recorded-layout">
      <nav class="recorded-index" aria-label="Recorded test examples">${tests.map(test=>`<a href="#/recorded-tests/${test.id}" class="recorded-test-link ${test.id===selected.id?'is-selected':''}" ${test.id===selected.id?'aria-current="true"':''}><span>Test ${test.id}</span><strong>${h(test.title)}</strong><small>${h(test.kind)}</small></a>`).join('')}</nav>
      <article id="recorded-test-detail" class="recorded-detail" data-test-id="${selected.id}">
        <header class="recorded-heading"><h2>Test ${selected.id}: ${h(selected.title)}</h2><p>${h(selected.description)}</p></header>
        <section class="recorded-listening" aria-label="Recordings for this test">${player(selected.target,'target')}${selected.reference?player(selected.reference,'reference'):''}
          <p id="recorded-audio-error" class="recorded-audio-error" role="status" hidden></p>
          <p class="recorded-now" id="recorded-now">Choose a timestamp below to hear that part of the target.</p>
        </section>
        <div class="recorded-finding ${selected.id==='4'?'recorded-caution':''}"><p>${h(selected.finding)}</p>${selected.notes.map(note=>`<p>${h(note)}</p>`).join('')}</div>
        <section class="recorded-model" aria-labelledby="recorded-gemini-title"><h3 id="recorded-gemini-title">Gemini results</h3><p class="recorded-model-note">Saved response · ${selected.segments.length} reported segments · Timestamps follow the supplied results.</p>${resultTable(selected.segments,'gemini')}</section>
        ${selected.comparison?`<section class="recorded-comparison" aria-labelledby="recorded-comparison-title"><h3 id="recorded-comparison-title">Compare with Nemotron</h3><p>The archive reports <strong>57.3% time agreement with Gemini</strong> (156.5 of 273 seconds). This measures agreement between two model outputs; intended script labels are available below.</p><p class="recorded-model-note">NVIDIA-Nemotron-3.5-Transcribe-30B-A4B via DeepInfra, as identified in the supplied notes. The table combines two runs.</p><details><summary>View Nemotron segments</summary>${resultTable(selected.comparison.segments,'nemotron')}</details></section>`:''}
        <div class="recorded-documentation">
          <details><summary>Scripts and intended labels</summary><div id="recorded-scripts"><p>These are the supplied written scripts and intended delivery labels. They are not audio-derived transcripts.</p>${selected.scripts.reference?`<h3>Reference script</h3><pre class="recorded-source-text">${h(selected.scripts.reference)}</pre>`:''}<h3>Target script</h3><pre class="recorded-source-text">${h(selected.scripts.target)}</pre></div></details>
          <details><summary>Submitted prompt</summary><div id="recorded-prompt"><p>The prompt is preserved as experiment data.</p><pre class="recorded-source-text">${h(selected.prompt)}</pre>${selected.comparisonPrompt?`<h3>Nemotron comparison prompt</h3><pre class="recorded-source-text">${h(selected.comparisonPrompt)}</pre>`:''}</div></details>
          <details><summary>Full recorded response</summary><h3>Gemini</h3><pre class="recorded-source-text">${h(selected.response)}</pre>${selected.comparison?`<h3>Nemotron</h3><pre class="recorded-source-text">${h(selected.comparison.response)}</pre>`:''}</details>
          <details><summary>Source files</summary><div id="recorded-source-files"><p>Original files from the supplied test bundle. The notes identify Gemini runs as “Gemini 3.8 Flash” in Google AI Studio, with medium thinking and search grounding off.</p><ul>${[['results.txt','All recorded results'],['prompts.txt','All submitted prompts and run settings'],['references.txt','All scripts and intended labels'],['gen_audio_scrambled.mp3','Additional generated audio (unused in Tests 1–6)']].map(([file,label])=>`<li><a href="${asset(file)}" download>${h(label)}</a></li>`).join('')}</ul><p>The additional generated recording has no confirmed script mapping or recorded result in this bundle.</p></div></details>
        </div>
      </article>
    </div>`;
}

// Reuse the selected article across shell renders (for example, opening the
// mobile menu) so the native player keeps its position and playback state.
export function mountRecordedTests(previous){
  let detail=document.querySelector('#recorded-test-detail');
  if(previous&&detail?.dataset.testId===previous.dataset.testId){detail.replaceWith(previous);return;}
  previous?.querySelectorAll('audio').forEach(audio=>audio.pause());
  if(!detail)return;
  const target=detail.querySelector('#recorded-target');
  const reference=detail.querySelector('#recorded-reference');
  const error=detail.querySelector('#recorded-audio-error');
  const now=detail.querySelector('#recorded-now');
  const showError=()=>{error.hidden=false;error.textContent='This recording could not be played. Try its download link, or reload the page and try again.';};
  for(const audio of [target,reference].filter(Boolean)){
    audio.addEventListener('play',()=>{
      for(const other of [target,reference].filter(Boolean))if(other!==audio)other.pause();
      error.hidden=true;
    });
    audio.addEventListener('error',showError);
  }
  detail.addEventListener('click',event=>{
    const button=event.target.closest('[data-recorded-seek]');
    if(!button)return;
    const start=Number(button.dataset.recordedSeek);
    if(!target.readyState)target.addEventListener('loadedmetadata',()=>{target.currentTime=start;},{once:true});
    else target.currentTime=start;
    target.play().catch(error=>{if(error.name!=='AbortError')showError();});
  });
  target.addEventListener('timeupdate',()=>{
    let currentLabel='Between reported segments';
    for(const row of detail.querySelectorAll('[data-segment-start]')){
      const active=target.currentTime>=Number(row.dataset.segmentStart)&&target.currentTime<Number(row.dataset.segmentEnd);
      row.classList.toggle('is-current',active);
      const button=row.querySelector('button');
      if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
      if(active&&row.closest('[data-model]').dataset.model==='gemini')currentLabel=row.querySelector('strong').textContent;
    }
    now.textContent=`${time(Math.floor(target.currentTime))} · ${currentLabel}`;
  });
}
