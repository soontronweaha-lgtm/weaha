const $ = (id) => document.getElementById(id);
const state = { songs: [], index: 0, zoom: Number(localStorage.getItem('songbookZoom') || 1), favorites: new Set(JSON.parse(localStorage.getItem('songbookFavorites') || '[]')), scrolling: false, timer: null, installPrompt: null, transpose: 0, originalView: false };
const NOTES_SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTES_FLAT=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const NOTE_INDEX={C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,'E#':5,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
const KEY_NAMES=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];

function normalize(value) { return value.toLocaleLowerCase('th').replace(/[\s\-–—_.]+/g, ''); }
function currentSong() { return state.songs[state.index]; }
function saveFavorites() { localStorage.setItem('songbookFavorites', JSON.stringify([...state.favorites])); }
function youtubeSearch(suffix='') { const song=currentSong(); return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${suffix}`.trim())}`; }

function renderSelect() {
  $('songSelect').innerHTML = state.songs.map((song,i)=>`<option value="${i}">${song.number}. ${song.title}</option>`).join('');
}
function renderCatalog() {
  const favoritesOnly = $('favoritesOnlyButton').classList.contains('active');
  const rows = state.songs.map((song,i)=>({song,i})).filter(({song})=>!favoritesOnly || state.favorites.has(song.number));
  $('catalogList').innerHTML = rows.length ? rows.map(({song,i})=>`<button class="catalog-item" data-index="${i}"><span class="catalog-index">${song.number}</span><span>${song.title}</span><span class="catalog-star">${state.favorites.has(song.number)?'★':''}</span></button>`).join('') : '<p class="status">ยังไม่มีเพลงโปรด</p>';
}
function showSong(index, updateHistory=true) {
  stopScroll();
  state.index = (index + state.songs.length) % state.songs.length;
  const song = currentSong();
  $('songNumber').textContent = `เพลงที่ ${song.number} · ${state.index+1}/${state.songs.length}`;
  $('songTitle').textContent = song.title;
  $('songSelect').value = state.index;
  $('lyricImage').src = song.image;
  $('lyricImage').alt = `เนื้อเพลงพร้อมคอร์ด ${song.title}`;
  state.transpose=0; state.originalView=false; renderTranspose();
  $('status').hidden = true;
  const favored = state.favorites.has(song.number);
  $('favoriteButton').textContent = favored ? '★' : '☆';
  $('favoriteButton').classList.toggle('active', favored);
  $('favoriteButton').setAttribute('aria-pressed', String(favored));
  document.title = `${song.title} | หนังสือเพลง`;
  if (updateHistory) history.replaceState(null,'',`#song=${song.number}`);
  window.scrollTo({top:0,behavior:'smooth'});
}
function transposeChord(chord,steps) {
  const targetName=KEY_NAMES[Number($('keySelect').value)];
  const notes=['Db','Eb','F','Ab','Bb'].includes(targetName)?NOTES_FLAT:NOTES_SHARP;
  return chord.replace(/([A-G](?:#|b)?)/g,(root)=>{ const i=NOTE_INDEX[root]; return i===undefined?root:notes[(i+steps+120)%12]; });
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])); }
function renderPositionedLine(pattern) {
  const parts=[]; const matcher=/\[([^\]]+)\]([^\[]*)/g; let match;
  while((match=matcher.exec(pattern))!==null) {
    parts.push(`<span class="chord-unit"><span class="chord-name">${escapeHtml(transposeChord(match[1],state.transpose))}</span><span class="lyric-fragment">${escapeHtml(match[2])||'&nbsp;'}</span></span>`);
  }
  return `<div class="chord-flow">${parts.join('')}</div>`;
}
function renderTranspose() {
  const sample=(window.TRANSPOSE_SAMPLES||{})[currentSong()?.number];
  if(!sample || state.originalView) { $('transposeView').hidden=true; $('lyricImage').hidden=false; $('textViewButton').hidden=!sample; return; }
  $('lyricImage').hidden=true; $('textViewButton').hidden=true; $('transposeView').hidden=false;
  const original=NOTE_INDEX[sample.key];
  const current=(original+state.transpose+120)%12;
  $('keySelect').value=String(current);
  $('keyNote').textContent=`${sample.note} · กำลังแสดง Key ${KEY_NAMES[current]}`;
  $('chordSheet').innerHTML=sample.sections.map(section=>`<section class="song-section"><h3>${section.name}</h3>${section.lines.map(line=>`<div class="song-line">${line.p?renderPositionedLine(line.p):`<div class="chord-row">${line.c.split(/\s+/).filter(Boolean).map(c=>`<span>${transposeChord(c,state.transpose)}</span>`).join('')}</div><div class="lyric-row">${line.t||''}</div>`}</div>`).join('')}</section>`).join('');
  $('originalViewButton').textContent='ดูภาพต้นฉบับ';
}
function setTranspose(steps) { state.transpose=((steps+6)%12+12)%12-6; renderTranspose(); }
function searchSongs(query) {
  const q = normalize(query);
  if (!q) { $('searchResults').hidden=true; return; }
  const results = state.songs.map((song,i)=>({song,i})).filter(({song})=>normalize(`${song.number}${song.title}`).includes(q)).slice(0,18);
  $('searchResults').innerHTML = results.length ? results.map(({song,i})=>`<button class="result-button" data-index="${i}"><b>${song.number}.</b> ${song.title}</button>`).join('') : '<div class="status">ไม่พบชื่อเพลง</div>';
  $('searchResults').hidden=false;
}
function setZoom(value) { state.zoom=Math.min(1.8,Math.max(1,value)); document.documentElement.style.setProperty('--zoom',state.zoom); localStorage.setItem('songbookZoom',state.zoom); }
function stopScroll() { state.scrolling=false; clearInterval(state.timer); state.timer=null; $('autoScrollButton').textContent='▶ เลื่อน'; }
function toggleScroll() {
  if (state.scrolling) return stopScroll();
  state.scrolling=true; $('autoScrollButton').textContent='■ หยุด';
  const tick=()=>{ const step=Number($('speedRange').value); window.scrollBy(0,step); if (innerHeight+scrollY>=document.documentElement.scrollHeight-8) stopScroll(); };
  state.timer=setInterval(tick,42);
}
function openCatalog() { renderCatalog(); $('catalogDialog').showModal(); }

async function init() {
  try {
    state.songs=window.SONGBOOK_SONGS || []; if(!state.songs.length) throw new Error('ไม่พบข้อมูลเพลง'); renderSelect(); setZoom(state.zoom);
    const requested=Number(new URLSearchParams(location.hash.replace('#','')).get('song'));
    const found=state.songs.findIndex(s=>s.number===requested); showSong(found>=0?found:0,false); renderCatalog();
  } catch (error) { $('status').textContent='ไม่สามารถโหลดรายชื่อเพลงได้ กรุณาลองเปิดหน้าใหม่'; console.error(error); }
}

$('searchInput').addEventListener('input',e=>searchSongs(e.target.value));
$('searchInput').addEventListener('keydown',e=>{ if(e.key==='Escape') $('searchResults').hidden=true; });
$('searchResults').addEventListener('click',e=>{ const b=e.target.closest('[data-index]'); if(!b)return; showSong(Number(b.dataset.index)); $('searchResults').hidden=true; $('searchInput').value=''; });
$('songSelect').addEventListener('change',e=>showSong(Number(e.target.value)));
$('prevButton').addEventListener('click',()=>showSong(state.index-1));
$('nextButton').addEventListener('click',()=>showSong(state.index+1));
$('tocButton').addEventListener('click',openCatalog);
$('closeDialogButton').addEventListener('click',()=>$('catalogDialog').close());
$('catalogList').addEventListener('click',e=>{ const b=e.target.closest('[data-index]'); if(!b)return; showSong(Number(b.dataset.index)); $('catalogDialog').close(); });
$('favoriteButton').addEventListener('click',()=>{ const n=currentSong().number; state.favorites.has(n)?state.favorites.delete(n):state.favorites.add(n); saveFavorites(); showSong(state.index,false); renderCatalog(); });
$('favoritesOnlyButton').addEventListener('click',()=>{ $('favoritesOnlyButton').classList.toggle('active'); openCatalog(); });
$('zoomInButton').addEventListener('click',()=>setZoom(state.zoom+.15));
$('zoomOutButton').addEventListener('click',()=>setZoom(state.zoom-.15));
$('autoScrollButton').addEventListener('click',toggleScroll);
$('keyDownButton').addEventListener('click',()=>setTranspose(state.transpose-1));
$('keyUpButton').addEventListener('click',()=>setTranspose(state.transpose+1));
$('resetKeyButton').addEventListener('click',()=>setTranspose(0));
$('keySelect').addEventListener('change',e=>{ const sample=(window.TRANSPOSE_SAMPLES||{})[currentSong().number]; setTranspose(Number(e.target.value)-NOTE_INDEX[sample.key]); });
$('originalViewButton').addEventListener('click',()=>{ state.originalView=true; renderTranspose(); });
$('textViewButton').addEventListener('click',()=>{ state.originalView=false; renderTranspose(); });
$('lyricImage').addEventListener('dblclick',()=>{ if((window.TRANSPOSE_SAMPLES||{})[currentSong().number]){ state.originalView=false; renderTranspose(); } });
$('soundButton').addEventListener('click',()=>open(youtubeSearch(),'_blank','noopener'));
$('drumButton').addEventListener('click',()=>open(youtubeSearch('drum backing track'),'_blank','noopener'));
$('bassButton').addEventListener('click',()=>open(youtubeSearch('bass backing track'),'_blank','noopener'));
document.addEventListener('click',e=>{ if(!e.target.closest('.app-header')) $('searchResults').hidden=true; });
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); state.installPrompt=e; $('installButton').hidden=false; });
$('installButton').addEventListener('click',async()=>{ if(!state.installPrompt)return; await state.installPrompt.prompt(); state.installPrompt=null; $('installButton').hidden=true; });
KEY_NAMES.forEach((name,index)=>$('keySelect').add(new Option(name,String(index))));
if ('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
init();
