export const h=(value='')=>String(value ?? '').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths={
  menu:'M4 6h16 M4 12h16 M4 18h16',
  close:'m6 6 12 12 M18 6 6 18',
  shield:'M12 3 20 6v6c0 5-4 8-8 10-4-2-8-5-8-10V6Z M8 12l3 3 5-6',
  home:'m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8',
  phone:'M7 3H4a1 1 0 0 0-1 1c0 9 8 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2Z',
  message:'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z M8 10h8 M8 14h5',
  person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M4 22v-3a8 8 0 0 1 16 0v3',
  book:'M12 6c-3-3-6-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2Z M12 6v15',
  clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M12 6v6l4 2',
  settings:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
  arrow:'M5 12h14 M13 6l6 6-6 6',
  chevron:'m9 5 7 7-7 7',
  check:'m5 12 4 4L19 6',
  alert:'m12 3 10 18H2Z M12 9v5 M12 17h.01',
  lock:'M6 10V7a6 6 0 0 1 12 0v3 M4 10h16v12H4Z M12 14v4',
  heart:'M20 4c-3-2-6 0-8 2-2-2-5-4-8-2-5 4-1 10 8 17 9-7 13-13 8-17Z',
  spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
  plus:'M12 5v14 M5 12h14',
  external:'M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7',
  play:'m8 4 12 8-12 8Z',
  pause:'M8 4v16 M16 4v16',
  stop:'M5 5h14v14H5Z',
  refresh:'M20 7V2 M20 7h-5 M20 7a9 9 0 1 0 1 8',
  logout:'M9 3H3v18h6 M13 7l5 5-5 5 M7 12h14',
  info:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M12 11v6 M12 7h.01',
  headphones:'M3 14v-3a9 9 0 0 1 18 0v3 M3 12h4v8H3Z M17 12h4v8h-4Z',
  trash:'M3 6h18 M8 6V3h8v3 M5 6l1 16h12l1-16 M10 10v8 M14 10v8',
};
export function icon(name,className='') {return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.shield}"/></svg>`;}
export function date(value,withTime=false) {
  if(!value)return 'Not yet analyzed';
  const when=new Date(value);
  if(Number.isNaN(when.getTime()))return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',...(withTime?{hour:'numeric',minute:'2-digit'}:{})}).format(when);
}
export const riskLabels={low:'No clear warning signs',unknown:'More information needed',caution:'Pause and verify',high:'High-risk warning'};
export function badge(risk='low') {return `<span class="risk-badge ${h(risk)}">${icon(risk==='high'||risk==='caution'?'alert':risk==='unknown'?'info':'check')}${h(riskLabels[risk]||riskLabels.unknown)}</span>`;}
export function highlight(text,reasons=[]) {
  const ranges=[];
  for(const reason of reasons){
    if(!reason.evidence)continue;
    const start=text.indexOf(reason.evidence);
    if(start>=0)ranges.push([start,start+reason.evidence.length]);
  }
  ranges.sort((a,b)=>a[0]-b[0]);
  let output='',end=0;
  for(const [start,finish] of ranges){if(start<end)continue;output+=h(text.slice(end,start))+'<mark>'+h(text.slice(start,finish))+'</mark>';end=finish;}
  return output+h(text.slice(end));
}
export function contactAction(contact) {
  return contact ? `<a class="button secondary" href="tel:${h(contact.phone.replace(/[^+\d]/g,''))}">${icon('phone')}Call ${h(contact.name)}</a>` : `<a class="button secondary" href="#/settings">${icon('plus')}Add a trusted contact</a>`;
}
