/* ═══════════════════════════════════════════
   YT.PLAY — app.js  (ES module)
   ═══════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, doc,
  onSnapshot, addDoc, deleteDoc, updateDoc,
  query, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Config ─────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDJ_f3zk9YJ16HXNzJ_vWl6HM9Kwhv3B_Y",
  authDomain:        "appp-b7a7e.firebaseapp.com",
  databaseURL:       "https://appp-b7a7e-default-rtdb.firebaseio.com",
  projectId:         "appp-b7a7e",
  storageBucket:     "appp-b7a7e.firebasestorage.app",
  messagingSenderId: "640176848506",
  appId:             "1:640176848506:web:215d9a48f18f08cb5b45c3",
};

// 로컬: 'http://localhost:5000/api/resolve'
// 배포: Railway URL로 교체
const API = 'http://localhost:5000/api/resolve';

// ── Firebase init ───────────────────────────
const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);
const playlistCol = collection(db, 'playlist');

// ── DOM refs ────────────────────────────────
const fbStatus    = document.getElementById('fbStatus');
const videoEl     = document.getElementById('videoEl');
const emptyPlayer = document.getElementById('emptyPlayer');
const urlInput    = document.getElementById('urlInput');
const addBtn      = document.getElementById('addBtn');
const statusBar   = document.getElementById('statusBar');
const queueList   = document.getElementById('queueList');
const queueCount  = document.getElementById('queueCount');
const npTitle     = document.getElementById('npTitle');
const npChannel   = document.getElementById('npChannel');
const npThumbEl   = document.getElementById('npThumb');
const autoplayBtn = document.getElementById('autoplayBtn');
const loopBtn     = document.getElementById('loopBtn');
const playPauseBtn= document.getElementById('playPauseBtn');

// ── State ───────────────────────────────────
let queue       = [];   // { firestoreId, id, title, channel, thumbnail, stream_url, order, addedAt }
let currentIdx  = -1;
let autoplay    = true;
let loopMode    = false;

// ── Drag state ──────────────────────────────
let dragSrcIdx  = null;

// ── Firestore realtime ──────────────────────
const q = query(playlistCol, orderBy('order', 'asc'));
onSnapshot(q,
  snapshot => {
    fbStatus.textContent = '● 연결됨';
    fbStatus.className   = 'fb-status ok';

    const currentVideoId = queue[currentIdx]?.id ?? null;

    queue = snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));

    // restore current index
    if (currentVideoId) {
      const found = queue.findIndex(i => i.id === currentVideoId);
      currentIdx = found >= 0 ? found : -1;
    }

    renderQueue();
    queueCount.textContent = queue.length + '개';

    // auto-play first item on initial load
    if (currentIdx === -1 && queue.length > 0 && autoplay) {
      playAt(0);
    }
  },
  err => {
    fbStatus.textContent = '● Firebase 오류';
    fbStatus.className   = 'fb-status err';
    console.error('Firestore:', err);
  }
);

// ── Add URL ─────────────────────────────────
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addUrl(); });
document.getElementById('addBtn').addEventListener('click', addUrl);

async function addUrl() {
  const url = urlInput.value.trim();
  if (!url) return;

  urlInput.value  = '';
  addBtn.disabled = true;
  fbStatus.textContent = '● 저장 중...';
  fbStatus.className   = 'fb-status sync';
  setStatus('영상 정보 가져오는 중...', '');

  try {
    const res  = await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url })
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus('오류: ' + data.error, 'error');
      return;
    }

    // order = max existing order + 1  (so new items go to the end)
    const maxOrder = queue.reduce((m, i) => Math.max(m, i.order ?? 0), 0);

    await addDoc(playlistCol, {
      id:         data.id,
      title:      data.title,
      channel:    data.channel    ?? '',
      thumbnail:  data.thumbnail  ?? '',
      stream_url: data.stream_url,
      duration:   data.duration   ?? 0,
      order:      maxOrder + 1,
      addedAt:    serverTimestamp(),
    });

    setStatus(`"${data.title}" 저장됨`, 'ok');

  } catch (err) {
    setStatus('서버에 연결할 수 없습니다. server.py를 실행했는지 확인하세요.', 'error');
    console.error(err);
  } finally {
    addBtn.disabled = false;
  }
}

// ── Remove ──────────────────────────────────
async function removeAt(idx) {
  const item = queue[idx];
  if (!item?.firestoreId) return;

  if (idx === currentIdx) stopPlayback();

  await deleteDoc(doc(db, 'playlist', item.firestoreId));
}

function stopPlayback() {
  videoEl.pause();
  videoEl.src = '';
  videoEl.style.display = 'none';
  emptyPlayer.style.display = 'flex';
  currentIdx = -1;
  npTitle.textContent = '재생 중인 영상 없음';
  npTitle.classList.add('empty');
  npChannel.textContent = '—';
  npThumbEl.style.display = 'none';
  document.title = 'YT.PLAY';
  updatePlayPauseBtn();
}

// ── Play ────────────────────────────────────
function playAt(idx) {
  if (idx < 0 || idx >= queue.length) return;
  const item = queue[idx];
  if (!item?.stream_url) return;

  currentIdx = idx;

  videoEl.src = item.stream_url;
  videoEl.style.display = 'block';
  emptyPlayer.style.display = 'none';
  videoEl.load();
  videoEl.play().catch(() => {});

  npTitle.textContent = item.title;
  npTitle.classList.remove('empty');
  npChannel.textContent = item.channel;

  if (item.thumbnail) {
    npThumbEl.src = item.thumbnail;
    npThumbEl.style.display = 'block';
  } else {
    npThumbEl.style.display = 'none';
  }

  document.title = item.title + ' — YT.PLAY';
  setStatus('', '');
  renderQueue();
  updatePlayPauseBtn();
}

// ── Render queue ─────────────────────────────
function renderQueue() {
  queueCount.textContent = queue.length + '개';

  if (!queue.length) {
    queueList.innerHTML = `<div class="empty-queue">아직 영상이 없어요.<br>위에서 YouTube 링크를 추가하세요.</div>`;
    return;
  }

  queueList.innerHTML = queue.map((item, idx) => {
    const isActive = idx === currentIdx;
    const numOrDot = isActive
      ? `<div class="playing-dot"></div>`
      : `<span class="qi-num">${idx + 1}</span>`;
    const thumbEl = item.thumbnail
      ? `<img class="qi-thumb" src="${escHtml(item.thumbnail)}" loading="lazy" draggable="false">`
      : `<div class="qi-thumb-ph"></div>`;

    return `
      <div
        class="queue-item${isActive ? ' active' : ''}"
        id="qi_${idx}"
        draggable="true"
        data-idx="${idx}"
      >
        <span class="drag-handle" title="드래그로 순서 변경">⠿</span>
        ${numOrDot}
        ${thumbEl}
        <div class="qi-info" onclick="window._playAt(${idx})">
          <div class="qi-title">${escHtml(item.title)}</div>
          <div class="qi-channel">${escHtml(item.channel)}</div>
        </div>
        <button class="qi-del" onclick="window._removeAt(${idx})" title="삭제">✕</button>
      </div>
    `;
  }).join('');

  // scroll active item into view
  const activeEl = document.getElementById(`qi_${currentIdx}`);
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  // attach drag listeners
  attachDragListeners();
}

// ── Drag & Drop reorder ──────────────────────
function attachDragListeners() {
  const items = queueList.querySelectorAll('.queue-item');

  items.forEach(el => {
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragover',  onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop',      onDrop);
    el.addEventListener('dragend',   onDragEnd);
  });

  queueList.addEventListener('dragover', onListDragOver);
  queueList.addEventListener('dragleave', onListDragLeave);
  queueList.addEventListener('drop',     onListDrop);
}

function onDragStart(e) {
  dragSrcIdx = parseInt(e.currentTarget.dataset.idx);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcIdx);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  if (parseInt(el.dataset.idx) !== dragSrcIdx) {
    queueList.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
    el.classList.add('drag-over');
  }
  queueList.classList.remove('drag-end-indicator');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  const targetIdx = parseInt(e.currentTarget.dataset.idx);
  if (dragSrcIdx !== null && dragSrcIdx !== targetIdx) {
    reorderQueue(dragSrcIdx, targetIdx);
  }
  cleanupDrag();
}

function onDragEnd() { cleanupDrag(); }

// handle drop below last item
function onListDragOver(e) {
  const last = queueList.querySelector('.queue-item:last-child');
  if (last) {
    const rect = last.getBoundingClientRect();
    if (e.clientY > rect.bottom) {
      queueList.classList.add('drag-end-indicator');
      queueList.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
    }
  }
}
function onListDragLeave() { queueList.classList.remove('drag-end-indicator'); }
function onListDrop(e) {
  if (queueList.classList.contains('drag-end-indicator') && dragSrcIdx !== null) {
    reorderQueue(dragSrcIdx, queue.length - 1);
    cleanupDrag();
  }
}

function cleanupDrag() {
  dragSrcIdx = null;
  queueList.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging'));
  queueList.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
  queueList.classList.remove('drag-end-indicator');
}

/**
 * Reorder: move item at `fromIdx` to position `toIdx`.
 * Then write new `order` values back to Firestore (batch).
 */
async function reorderQueue(fromIdx, toIdx) {
  if (fromIdx === toIdx) return;

  // build new order locally
  const newQueue = [...queue];
  const [moved]  = newQueue.splice(fromIdx, 1);
  newQueue.splice(toIdx, 0, moved);

  // optimistic UI
  const currentVideoId = queue[currentIdx]?.id ?? null;
  queue = newQueue;
  if (currentVideoId) {
    currentIdx = queue.findIndex(i => i.id === currentVideoId);
  }
  renderQueue();

  // write back to Firestore
  try {
    const batch = writeBatch(db);
    newQueue.forEach((item, idx) => {
      const ref = doc(db, 'playlist', item.firestoreId);
      batch.update(ref, { order: idx });
    });
    await batch.commit();
  } catch (err) {
    console.error('순서 저장 실패:', err);
    setStatus('순서 저장 실패', 'error');
  }
}

// ── Controls ─────────────────────────────────
function prevTrack() {
  if (!queue.length) return;
  const prev = loopMode ? currentIdx : Math.max(0, currentIdx - 1);
  playAt(prev);
}

function nextTrack() {
  if (!queue.length) return;
  let next = loopMode ? currentIdx : currentIdx + 1;
  if (!loopMode && next >= queue.length) next = 0;
  playAt(next);
}

function toggleAutoplay() {
  autoplay = !autoplay;
  autoplayBtn.textContent = `자동재생 ${autoplay ? 'ON' : 'OFF'}`;
  autoplayBtn.classList.toggle('active', autoplay);
}

function toggleLoop() {
  loopMode      = !loopMode;
  videoEl.loop  = loopMode;
  loopBtn.textContent = `반복 ${loopMode ? 'ON' : 'OFF'}`;
  loopBtn.classList.toggle('active', loopMode);
}

function togglePlayPause() {
  videoEl.paused ? videoEl.play() : videoEl.pause();
  updatePlayPauseBtn();
}

function setVolume(v) { videoEl.volume = parseFloat(v); }

function updatePlayPauseBtn() {
  playPauseBtn.textContent = videoEl.paused ? '▶ 재생' : '⏸ 일시정지';
}

function setStatus(msg, type) {
  statusBar.textContent = msg;
  statusBar.className   = 'status-bar' + (type ? ' ' + type : '');
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Video events ──────────────────────────────
videoEl.addEventListener('ended', () => {
  if (loopMode) return;
  if (autoplay) {
    const next = currentIdx + 1;
    if (next < queue.length) playAt(next);
  }
  updatePlayPauseBtn();
});
videoEl.addEventListener('pause', updatePlayPauseBtn);
videoEl.addEventListener('play',  updatePlayPauseBtn);
videoEl.addEventListener('error', () => {
  setStatus('스트림 재생 오류. URL이 만료됐을 수 있습니다. 다시 추가해보세요.', 'error');
});

// ── Expose to HTML onclick ────────────────────
window._playAt   = playAt;
window._removeAt = removeAt;
window._prevTrack        = prevTrack;
window._nextTrack        = nextTrack;
window._toggleAutoplay   = toggleAutoplay;
window._toggleLoop       = toggleLoop;
window._togglePlayPause  = togglePlayPause;
window._setVolume        = setVolume;

// ── Init ──────────────────────────────────────
autoplayBtn.classList.add('active');
updatePlayPauseBtn();
