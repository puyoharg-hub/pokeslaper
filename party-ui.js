
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('Service Workerの登録に失敗しました（画像キャッシュは無効になります）', err);
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STORAGE_KEY = 'partyEditor.allPresets';

function saveAllPresetsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allPresets));
  } catch (e) {
    console.error('localStorageへの保存に失敗しました', e);
  }
}

function loadAllPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3) return parsed;
    return null;
  } catch (e) {
    console.error('localStorageの読み込みに失敗しました', e);
    return null;
  }
}

const SAVED_PARTIES_KEY = 'partyEditor.savedParties';

function loadSavedPartiesFromStorage() {
  try {
    const raw = localStorage.getItem(SAVED_PARTIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('保存済みパーティの読み込みに失敗しました', e);
    return [];
  }
}

function saveSavedPartiesToStorage() {
  try {
    localStorage.setItem(SAVED_PARTIES_KEY, JSON.stringify(savedParties));
  } catch (e) {
    console.error('保存済みパーティの書き込みに失敗しました', e);
  }
}

let savedParties = loadSavedPartiesFromStorage();

let allPresets = loadAllPresetsFromStorage() || [
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
];
let currentPreset = 0;
let party = allPresets[currentPreset];

let editingSlot = null;
let editingMoveIdx = null;
let draft = null;

function emptyDraft() {
  return {
    pokemonSlug: null,
    ability: '',
    item: '',
    moves: ['', '', '', ''],
    ev: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    natureUp: null,
    natureDown: null,
  };
}

function renderGrid() {
  const grid = document.getElementById('slotGrid');
  grid.innerHTML = '';
  party.forEach((entry, i) => {
    if (!entry) {
      const el = document.createElement('div');
      el.className = 'slot-empty';
      el.addEventListener('click', () => {
        openModal(i);
      });
      grid.appendChild(el);
    } else {
      grid.appendChild(renderFilledCard(entry, i));
    }
  });
}

function renderFilledCard(entry, i) {
  const el = document.createElement('div');
  el.className = 'slot-filled';
  const p = PARTY_POKEMON_BY_SLUG[entry.pokemonSlug];
  if (!p) return el; // データ不整合ガード

  const typePills = p.types.map(t =>
    `<span class="type-pill" style="background:${TYPE_COLORS[t] || '#555'}">${t}</span>`).join('');

  let statRows = '';
  const entryEvTotal = sumEv(entry.ev);
  STAT_KEYS.forEach(k => {
    const ev = entry.ev[k];
    const nat = entry.natureUp === k ? 'up' : (entry.natureDown === k ? 'down' : null);
    const rv = calcRealStat(p.base[k], ev, k, nat);
    const cls = nat === 'up' ? 'stat-up' : (nat === 'down' ? 'stat-down' : '');
    const evDisplay = (ev === 0 && entryEvTotal >= EV_MAX_TOTAL) ? 'ー' : ev;
    statRows += `<tr><td class="row-label ${cls}">${STAT_LABELS[k]}</td><td class="sf-value-cell ${cls}">${rv}</td><td class="sf-ev-cell">${evDisplay}</td></tr>`;
  });

  const item = entry.item ? findItemByName(entry.item) : null;
  const itemHtml = item
    ? `<img src="${ITEM_SPRITE_URL(item.slug, item.category)}" alt="${item.name}" loading="lazy" onerror="handleItemSpriteError(this,'${item.slug}','${item.category}')"><span class="sf-item-name">${item.name}</span>`
    : '－';

  const movesHtml = entry.moves.map(mName => {
    const move = mName ? findMoveByName(mName) : null;
    const iconHtml = move ? `<img class="sf-move-type-icon" src="${TYPE_ICON_URL(move.type)}">` : '';
    return `<div class="sf-move-cell ${mName ? '' : 'empty'}">${iconHtml}${mName || ''}</div>`;
  }).join('');

  el.innerHTML = `
  <button class="slot-remove" data-remove="${i}">&times;</button>
  <div class="sf-sprite"><img src="${BULBA_SPRITE_URL(p.dex, p.slug)}" alt="${p.name}" referrerpolicy="no-referrer"></div>
  <div class="sf-left">
    <div class="sf-info">
      <div class="sf-row">
        <div class="sf-box sf-name-type-box">
          <span class="sf-name-text">${p.name}</span>
          <div class="sf-type-pills">${typePills}</div>
        </div>
      </div>
      <div class="sf-box sf-ability-box ${entry.ability ? '' : 'empty'}">${entry.ability || '－'}</div>
    </div>
    <table class="sf-stat-table"><tbody>${statRows}</tbody></table>
  </div>
  <div class="sf-right-wrap">
    <div class="sf-box sf-item-box ${item ? '' : 'empty'}">${itemHtml}</div>
    <div class="sf-moves-wrap">
      <div class="sf-moves-flex">${movesHtml}</div>
    </div>
  </div>
`;
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-remove]')) return;
    openModal(i);
  });
  el.querySelector('.slot-remove').addEventListener('click', (e) => {
    e.stopPropagation();
    party[i] = null;
    renderGrid();
    saveAllPresetsToStorage();
  });
  return el;
}

function openModal(i) {
  editingSlot = i;
  const existing = party[i];
  draft = existing ? JSON.parse(JSON.stringify(existing)) : emptyDraft();

  updateNameUI();
  updateAbilityUI();
  updateItemUI();
  updateMoveUI();
  renderStatTable();

  document.getElementById('editModal').classList.add('show');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('show');
  editingSlot = null;
  draft = null;
}

function saveAndClose() {
  if (draft.pokemonSlug) {
    party[editingSlot] = draft;
    renderGrid();
    saveAllPresetsToStorage();
  }
  closeModal();
}

function currentDraftPokemon() {
  return draft.pokemonSlug ? PARTY_POKEMON_BY_SLUG[draft.pokemonSlug] : null;
}

function updateNameUI() {
  const p = currentDraftPokemon();
  const nameEl = document.getElementById('npName');
  const spriteEl = document.getElementById('npSprite');
  const typesEl = document.getElementById('npTypes');

  if (p) {
    nameEl.textContent = p.name; nameEl.classList.remove('placeholder');
    spriteEl.innerHTML = `<img src="${BULBA_SPRITE_URL(p.dex, p.slug)}" alt="${p.name}" referrerpolicy="no-referrer">`;
    typesEl.innerHTML = p.types.map(t => `<span class="np-type-pill" style="background:${TYPE_COLORS[t]}">${t}</span>`).join('');
  } else {
    nameEl.textContent = 'ポケモンを選択'; nameEl.classList.add('placeholder');
    spriteEl.innerHTML = ''; typesEl.innerHTML = '';
  }
}

function updateAbilityUI() {
  const p = currentDraftPokemon();
  const combo = document.getElementById('abilityCombo');
  const input = document.getElementById('abilityInput');
  const panel = document.getElementById('abilityPanel');

  if (!p) {
    draft.ability = '';
    input.value = '';
    input.disabled = true;
    combo.classList.add('disabled');
    panel.innerHTML = '';
    return;
  }

  input.disabled = false;
  combo.classList.remove('disabled');

  // 今のポケモンで無効な特性(別のポケモンのものが残っている等)なら先頭にリセット
  if (!isValidAbilityForPokemon(p, draft.ability)) {
    draft.ability = p.abilities[0]?.name || '';
  }
  input.value = draft.ability;

  panel.innerHTML = p.abilities
    .filter(a => a.name !== draft.ability)
    .map(a => `<div class="ability-option" data-value="${a.name}">${a.name}</div>`)
    .join('');

  panel.querySelectorAll('.ability-option').forEach(el => {
    el.addEventListener('click', () => {
      draft.ability = el.dataset.value;
      updateAbilityUI();
      combo.classList.remove('open');
    });
  });
}

function updateItemUI() {
  const nameEl = document.getElementById('ipName');
  const iconEl = document.getElementById('ipIcon');
  const item = draft.item ? findItemByName(draft.item) : null;
  if (item) {
    nameEl.textContent = item.name; nameEl.classList.remove('placeholder');
    iconEl.innerHTML = `<img src="${ITEM_SPRITE_URL(item.slug, item.category)}" alt="${item.name}" loading="lazy" onerror="handleItemSpriteError(this,'${item.slug}','${item.category}')">`;
  } else {
    nameEl.textContent = 'ー'; nameEl.classList.add('placeholder'); iconEl.innerHTML = '－';
  }
}

function updateMoveUI() {
  for (let idx = 0; idx < 4; idx++) {
    const mName = draft.moves[idx];
    const nameEl = document.getElementById(`mpName${idx}`);
    const iconEl = document.getElementById(`mpIcon${idx}`);
    if (mName) {
      nameEl.textContent = mName;
      nameEl.classList.remove('placeholder');
      const move = findMoveByName(mName);
      if (move) {
        iconEl.src = TYPE_ICON_URL(move.type);
        iconEl.style.display = '';
      } else {
        iconEl.style.display = 'none';
      }
    } else {
      nameEl.textContent = 'ー';
      nameEl.classList.add('placeholder');
      iconEl.style.display = 'none';
    }
  }
}

function renderStatTable() {
  const body = document.getElementById('statTableBody');
  body.innerHTML = '';
  const p = currentDraftPokemon();
  const base = p ? p.base : { hp: '', atk: '', def: '', spa: '', spd: '', spe: '' };

  const total = sumEv(draft.ev);

  STAT_KEYS.forEach(k => {
    const ev = draft.ev[k];
    const nat = draft.natureUp === k ? 'up' : (draft.natureDown === k ? 'down' : null);
    const rv = p ? calcRealStat(base[k], ev, k, nat) : '';
    const nameCls = nat === 'up' ? 'stat-up' : (nat === 'down' ? 'stat-down' : '');
    const minusDisabled = !p || ev <= 0;
    const plusDisabled = !p || ev >= EV_MAX_EACH || total >= EV_MAX_TOTAL;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="stat-name-cell ${nameCls}" data-stat="${k}" title="左クリック：上昇補正／右クリック：下降補正">${STAT_LABELS[k]}</td>
      <td><span class="base-stat-box">${base[k]}</span></td>
      <td><span class="real-stat-val ${nat === 'up' ? 'up' : nat === 'down' ? 'down' : ''}">${rv}</span></td>
      <td><input type="number" class="ev-input" data-stat="${k}" value="${ev}" min="0" max="${EV_MAX_EACH}" ${!p ? 'disabled' : ''}></td>
      <td>
        <div class="ev-step-btns">
          <button data-stat="${k}" data-delta="-1" ${minusDisabled ? 'disabled' : ''}>－</button>
          <button data-stat="${k}" data-delta="1" ${plusDisabled ? 'disabled' : ''}>＋</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });

  document.getElementById('evTotal').textContent = total;
  document.getElementById('evRemain').textContent = EV_MAX_TOTAL - total;
  document.getElementById('evSummary').classList.toggle('over', total > EV_MAX_TOTAL);

  body.querySelectorAll('.ev-step-btns button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentDraftPokemon()) return;
      const k = btn.dataset.stat, d = +btn.dataset.delta;
      const cur = draft.ev[k];
      const total = sumEv(draft.ev);
      let nv = cur + d;
      if (nv < 0) nv = 0;
      if (nv > EV_MAX_EACH) nv = EV_MAX_EACH;
      if (d > 0 && total + d > EV_MAX_TOTAL) return;
      draft.ev[k] = nv;
      renderStatTable();
    });
  });
  body.querySelectorAll('.ev-input').forEach(input => {
    input.addEventListener('change', () => {
      if (!currentDraftPokemon()) return;
      const k = input.dataset.stat;
      const otherTotal = sumEv(draft.ev) - draft.ev[k];
      let nv = parseInt(input.value, 10);
      if (isNaN(nv) || nv < 0) nv = 0;
      if (nv > EV_MAX_EACH) nv = EV_MAX_EACH;
      if (nv > EV_MAX_TOTAL - otherTotal) nv = EV_MAX_TOTAL - otherTotal;
      draft.ev[k] = nv;
      renderStatTable();
      const restored = body.querySelector(`.ev-input[data-stat="${k}"]`);
      if (restored) restored.focus();
    });
    input.addEventListener('dblclick', () => {
      if (!currentDraftPokemon()) return;
      const k = input.dataset.stat;
      const otherTotal = sumEv(draft.ev) - draft.ev[k];
      const nv = draft.ev[k] === 0 ? Math.min(EV_MAX_EACH, EV_MAX_TOTAL - otherTotal) : 0;
      draft.ev[k] = nv;
      renderStatTable();
      const restored = body.querySelector(`.ev-input[data-stat="${k}"]`);
      if (restored) restored.focus();
    });
  });
  body.querySelectorAll('.stat-name-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      if (!currentDraftPokemon()) return;
      const k = cell.dataset.stat;
      if (k === 'hp') return;
      if (draft.natureDown === k) draft.natureDown = null;
      draft.natureUp = (draft.natureUp === k) ? null : k;
      if (draft.natureDown === draft.natureUp) draft.natureDown = null;
      renderStatTable();
    });
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!currentDraftPokemon()) return;
      const k = cell.dataset.stat;
      if (k === 'hp') return;
      if (draft.natureUp === k) draft.natureUp = null;
      draft.natureDown = (draft.natureDown === k) ? null : k;
      if (draft.natureDown === draft.natureUp) draft.natureUp = null;
      renderStatTable();
    });
  });
}

function renderPokemonGrid(filterText) {
  const grid = document.getElementById('pokemonGrid');
  const q = (filterText || '').trim();
  const list = q ? PARTY_POKEMON_DB.filter(p => p.name.includes(q)) : PARTY_POKEMON_DB;

  if (list.length === 0) {
    grid.innerHTML = `<div class="sub-empty-msg">該当するポケモンがいません</div>`;
    return;
  }
  grid.innerHTML = list.map(p => `
    <div class="sub-grid-item" data-slug="${p.slug}">
      <div class="sub-grid-sprite"><img src="${BULBA_SPRITE_URL(p.dex, p.slug)}" alt="${p.name}" referrerpolicy="no-referrer" loading="lazy"></div>
      <div class="sgi-name">${p.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.sub-grid-item').forEach(el => {
    el.addEventListener('click', () => {
      const p = PARTY_POKEMON_BY_SLUG[el.dataset.slug];

      draft.pokemonSlug = p.slug;
      draft.moves = draft.moves.map(m => (m && isValidMoveForPokemon(p, m)) ? m : '');
      updateMoveUI();
      updateNameUI();
      updateAbilityUI();
      renderStatTable();
      document.getElementById('pokemonOverlay').classList.remove('show');
    });
  });
}

function openPokemonOverlay() {
  const input = document.getElementById('pokemonSearchInput');
  input.value = '';
  renderPokemonGrid('');
  document.getElementById('pokemonOverlay').classList.add('show');
  input.focus();
}

function renderItemGrid(filterText) {
  const grid = document.getElementById('itemGrid');
  const q = (filterText || '').trim();
  const list = q ? ITEM_LIST.filter(it => it.name.includes(q)) : ITEM_LIST;

  if (list.length === 0) {
    grid.innerHTML = `<div class="sub-empty-msg">該当する道具がありません</div>`;
    return;
  }
  grid.innerHTML = list.map(it => `
    <div class="sub-grid-item" data-item="${it.name}">
      <div class="sub-grid-sprite"><img src="${ITEM_SPRITE_URL(it.slug, it.category)}" alt="${it.name}" loading="lazy" onerror="handleItemSpriteError(this,'${it.slug}','${it.category}')"></div>
      <div class="sgi-name">${it.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.sub-grid-item').forEach(el => {
    el.addEventListener('click', () => {
      draft.item = el.dataset.item;
      updateItemUI();
      document.getElementById('itemOverlay').classList.remove('show');
    });
  });
}

function openItemOverlay() {
  const input = document.getElementById('itemSearchInput');
  input.value = '';
  renderItemGrid('');
  document.getElementById('itemOverlay').classList.add('show');
  input.focus();
}

const TYPE_ORDER = [
  "ノーマル","ほのお","みず","でんき","くさ","こおり","かくとう","どく","じめん","ひこう",
  "エスパー","むし","いわ","ゴースト","ドラゴン","あく","はがね","フェアリー"
];

function renderMoveGrid(filterText) {
  const grid = document.getElementById('moveGrid');
  const q = (filterText || '').trim();
  const p = currentDraftPokemon();
  const source = p ? p.moves : MOVE_LIST;
  const filtered = q ? source.filter(m => m.name.includes(q)) : source;
  const list = [...filtered].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));

  if (list.length === 0) {
    grid.innerHTML = `<div class="sub-empty-msg">該当する技がありません</div>`;
    return;
  }
  grid.innerHTML = list.map(m => `
    <div class="sub-grid-item" data-move="${m.name}" style="background: ${TYPE_COLORS[m.type] || 'var(--bg)'}">
      <div class="sgi-name">${m.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.sub-grid-item').forEach(el => {
    el.addEventListener('click', () => {
      draft.moves[editingMoveIdx] = el.dataset.move;
      updateMoveUI();
      document.getElementById('moveOverlay').classList.remove('show');
    });
  });
}

function openMoveOverlay(idx) {
  editingMoveIdx = idx;
  const input = document.getElementById('moveSearchInput');
  input.value = '';
  renderMoveGrid('');
  document.getElementById('moveOverlay').classList.add('show');
  input.focus();
}

function renderSavedPartySprites(slots) {
  return slots.map(entry => {
    if (!entry) return `<div class="saved-party-sprite empty">－</div>`;
    const p = PARTY_POKEMON_BY_SLUG[entry.pokemonSlug];
    if (!p) return `<div class="saved-party-sprite empty">?</div>`;
    return `<div class="saved-party-sprite"><img src="${BULBA_SPRITE_URL(p.dex, p.slug)}" alt="${p.name}" referrerpolicy="no-referrer" loading="lazy"></div>`;
  }).join('');
}

function renderSavedPartyGrid() {
  const grid = document.getElementById('savedPartyGrid');

  if (savedParties.length === 0) {
    grid.innerHTML = `<div class="sub-empty-msg">保存済みのパーティがありません</div>`;
    return;
  }
  grid.innerHTML = savedParties.map(sp => `
    <div class="sub-grid-item saved-party-item" data-id="${sp.id}">
      <div class="saved-party-sprites">${renderSavedPartySprites(sp.slots)}</div>
      <div class="saved-party-memo">
        <span class="saved-party-memo-text" contenteditable="true" spellcheck="false" data-memo-id="${sp.id}">${escapeHtml(sp.memo || '')}</span>
      </div>
      <button class="saved-party-delete" data-delete-id="${sp.id}">&times;</button>
    </div>
  `).join('');

  grid.querySelectorAll('.saved-party-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-id]')) return;
      if (e.target.closest('.saved-party-memo')) return;
      const sp = savedParties.find(s => String(s.id) === el.dataset.id);
      if (!sp) return;
      allPresets[currentPreset] = JSON.parse(JSON.stringify(sp.slots));
      party = allPresets[currentPreset];
      renderGrid();
      saveAllPresetsToStorage();
      document.getElementById('loadOverlay').classList.remove('show');
    });
  });

  grid.querySelectorAll('.saved-party-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteId;
      savedParties = savedParties.filter(s => String(s.id) !== id);
      saveSavedPartiesToStorage();
      renderSavedPartyGrid();
    });
  });

  grid.querySelectorAll('.saved-party-memo-text').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    el.addEventListener('blur', () => {
      const id = el.dataset.memoId;
      const sp = savedParties.find(s => String(s.id) === id);
      if (!sp) return;
      sp.memo = el.textContent.trim();
      saveSavedPartiesToStorage();
      el.scrollLeft = 0;
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
    });
  });
}

function openLoadOverlay() {
  renderSavedPartyGrid();
  document.getElementById('loadOverlay').classList.add('show');
}

document.getElementById('namePickerBtn')?.addEventListener('click', openPokemonOverlay);
document.getElementById('itemPickerBtn')?.addEventListener('click', openItemOverlay);
document.querySelectorAll('.move-picker-btn').forEach(btn => {
  btn.addEventListener('click', () => openMoveOverlay(+btn.dataset.moveIdx));
});

document.getElementById('abilityInput')?.addEventListener('click', () => {
  document.getElementById('abilityCombo').classList.toggle('open');
});

document.addEventListener('click', (e) => {
  const combo = document.getElementById('abilityCombo');
  if (combo && !combo.contains(e.target)) {
    combo.classList.remove('open');
  }
});


document.getElementById('savedPartyClearBtn')?.addEventListener('click', () => {
  if (savedParties.length === 0) return;
  if (!window.confirm('保存済みのパーティを全て削除します。よろしいですか？')) return;
  savedParties = [];
  saveSavedPartiesToStorage();
  renderSavedPartyGrid();
});

document.getElementById('pokemonSearchInput')?.addEventListener('input', (e) => renderPokemonGrid(e.target.value));
document.getElementById('itemSearchInput')?.addEventListener('input', (e) => renderItemGrid(e.target.value));
document.getElementById('moveSearchInput')?.addEventListener('input', (e) => renderMoveGrid(e.target.value));

document.getElementById('pokemonOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'pokemonOverlay') { e.currentTarget.classList.remove('show'); }
});
document.getElementById('itemOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'itemOverlay') { e.currentTarget.classList.remove('show'); }
});
document.getElementById('moveOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'moveOverlay') e.currentTarget.classList.remove('show');
});
document.getElementById('loadOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'loadOverlay') e.currentTarget.classList.remove('show');
});

document.getElementById('editModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'editModal') saveAndClose();
});

// ===== サイドパネル：プリセット/保存/呼び出し/クリア/設定/モード切替 =====
function updatePresetBtnLabel() {
  const btn = document.getElementById('presetSwitchBtn');
  if (btn) btn.textContent = `プリセット ${currentPreset + 1}`;
  document.body.dataset.preset = currentPreset;
}

document.getElementById('presetSwitchBtn')?.addEventListener('click', () => {
  currentPreset = (currentPreset + 1) % allPresets.length;
  party = allPresets[currentPreset];
  updatePresetBtnLabel();
  renderGrid();
});
document.getElementById('saveBtn')?.addEventListener('click', () => {
  savedParties.push({
    id: Date.now(),
    slots: JSON.parse(JSON.stringify(party)),
    memo: '',
  });
  saveSavedPartiesToStorage();
});
document.getElementById('loadBtn')?.addEventListener('click', () => {
  openLoadOverlay();
});
document.getElementById('clearBtn')?.addEventListener('click', () => {
  allPresets[currentPreset] = [null, null, null, null, null, null];
  party = allPresets[currentPreset];
  renderGrid();
  saveAllPresetsToStorage();
});
document.getElementById('settingsBtn')?.addEventListener('click', () => {
  // TODO: 設定モーダルを開く（内容未定）
});

updatePresetBtnLabel();
renderGrid();
