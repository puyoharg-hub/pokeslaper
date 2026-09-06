
let party = [null, null, null, null, null, null];
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
      el.innerHTML = `<img class="slot-number" src="assets/number_${i + 1}.svg" alt="${i + 1}">`;
      el.addEventListener('click', () => openModal(i));
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
    statRows += `<tr><td class="row-label ${cls}">${STAT_LABELS[k]}</td><td class="${cls}">${rv}</td><td class="sf-ev-cell">${evDisplay}</td></tr>`;
  });

  const item = entry.item ? findItemByName(entry.item) : null;
  const itemHtml = item
    ? `<img src="${ITEM_SPRITE_URL(item.slug, item.category)}" alt="${item.name}" loading="lazy" onerror="handleItemSpriteError(this,'${item.slug}','${item.category}')">${item.name}`
    : '道具未設定';

  const movesHtml = entry.moves.map(mName =>
    `<div class="sf-move-cell ${mName ? '' : 'empty'}">${mName || '－'}</div>`
  ).join('');

  el.innerHTML = `
  <span class="slot-idx">${i + 1}</span>
  <button class="slot-remove" data-remove="${i}">&times;</button>
  <div class="sf-sprite"><img src="${SPRITE_URL(p.slug)}" alt="${p.name}" referrerpolicy="no-referrer" onerror="handleSpriteError(this,'${p.slug}')"></div>
  <div class="sf-left">
    <div class="sf-info">
      <div class="sf-row">
        <div class="sf-box sf-name-type-box">
          <span class="sf-name-text">${p.name}</span>
          <div class="sf-type-pills">${typePills}</div>
        </div>
      </div>
      <div class="sf-box sf-ability-box">${entry.ability || '特性未設定'}</div>
      <div class="sf-box sf-item-box">${itemHtml}</div>
    </div>
    <table class="sf-stat-table"><tbody>${statRows}</tbody></table>
  </div>
  <div class="sf-moves-wrap">
    <div class="sf-moves-flex">${movesHtml}</div>
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
  });
  return el;
}

function openModal(i) {
  editingSlot = i;
  const existing = party[i];
  draft = existing ? JSON.parse(JSON.stringify(existing)) : emptyDraft();

  document.getElementById('abilityInput').value = draft.ability;

  updateNameUI();
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
    draft.ability = document.getElementById('abilityInput')?.value.trim() ?? '';
    party[editingSlot] = draft;
    renderGrid();
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
  const abilityHint = document.getElementById('abilityHint');
  const abilityList = document.getElementById('abilityList');

  if (p) {
    nameEl.textContent = p.name; nameEl.classList.remove('placeholder');
    spriteEl.innerHTML = `<img src="${SPRITE_URL(p.slug)}" alt="${p.name}" referrerpolicy="no-referrer" onerror="handleSpriteError(this,'${p.slug}')">`;
    typesEl.innerHTML = p.types.map(t => `<span class="type-pill" style="background:${TYPE_COLORS[t]}">${t}</span>`).join('');
    abilityList.innerHTML = p.abilities.map(a => `<option value="${a.name}">`).join('');
    abilityHint.textContent = `候補: ${p.abilities.map(a => a.name).join(' / ')}`;
  } else {
    nameEl.textContent = 'タップして選択'; nameEl.classList.add('placeholder');
    spriteEl.innerHTML = '?'; typesEl.innerHTML = '';
    abilityList.innerHTML = ABILITY_LIST.map(a => `<option value="${a.name}">`).join('');
    abilityHint.textContent = 'ポケモンを選択すると候補が絞り込まれます';
  }
}

function updateItemUI() {
  const nameEl = document.getElementById('ipName');
  const iconEl = document.getElementById('ipIcon');
  const item = draft.item ? findItemByName(draft.item) : null;
  if (item) {
    nameEl.textContent = item.name; nameEl.classList.remove('placeholder');
    iconEl.innerHTML = `<img src="${ITEM_SPRITE_URL(item.slug, item.category)}" alt="${item.name}" loading="lazy" onerror="handleItemSpriteError(this,'${item.slug}','${item.category}')">`;
  } else {
    nameEl.textContent = 'タップして選択'; nameEl.classList.add('placeholder'); iconEl.innerHTML = '－';
  }
}

function updateMoveUI() {
  for (let idx = 0; idx < 4; idx++) {
    const mName = draft.moves[idx];
    const nameEl = document.getElementById(`mpName${idx}`);
    if (mName) {
      nameEl.textContent = mName;
      nameEl.classList.remove('placeholder');
    } else {
      nameEl.textContent = 'タップして選択';
      nameEl.classList.add('placeholder');
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
  body.querySelectorAll('.stat-name-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      if (!currentDraftPokemon()) return;
      const k = cell.dataset.stat;
      if (draft.natureDown === k) draft.natureDown = null; // 下降補正だったら解除
      draft.natureUp = (draft.natureUp === k) ? null : k;   // トグル
      if (draft.natureDown === draft.natureUp) draft.natureDown = null;
      renderStatTable();
    });
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // ブラウザの右クリックメニューを止める
      if (!currentDraftPokemon()) return;
      const k = cell.dataset.stat;
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
      <div class="sub-grid-sprite"><img src="${SPRITE_URL(p.slug)}" alt="${p.name}" referrerpolicy="no-referrer" loading="lazy" onerror="handleSpriteError(this,'${p.slug}')"></div>
      <div class="sgi-name">${p.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.sub-grid-item').forEach(el => {
    el.addEventListener('click', () => {
      const p = PARTY_POKEMON_BY_SLUG[el.dataset.slug];
      draft.pokemonSlug = p.slug;
      if (!isValidAbilityForPokemon(p, draft.ability)) draft.ability = '';
      draft.moves = draft.moves.map(m => (m && isValidMoveForPokemon(p, m)) ? m : '');
      document.getElementById('abilityInput').value = draft.ability;
      updateMoveUI();
      updateNameUI();
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

function renderMoveGrid(filterText) {
  const grid = document.getElementById('moveGrid');
  const q = (filterText || '').trim();
  const p = currentDraftPokemon();
  const source = p ? p.moves : MOVE_LIST;
  const list = q ? source.filter(m => m.name.includes(q)) : source;

  if (list.length === 0) {
    grid.innerHTML = `<div class="sub-empty-msg">該当する技がありません</div>`;
    return;
  }
  grid.innerHTML = list.map(m => `
    <div class="sub-grid-item" data-move="${m.name}">
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

document.getElementById('namePickerBtn')?.addEventListener('click', openPokemonOverlay);
document.getElementById('itemPickerBtn')?.addEventListener('click', openItemOverlay);
document.querySelectorAll('.move-picker-btn').forEach(btn => {
  btn.addEventListener('click', () => openMoveOverlay(+btn.dataset.moveIdx));
});

document.getElementById('pokemonOverlayClose')?.addEventListener('click', () => document.getElementById('pokemonOverlay')?.classList.remove('show'));
document.getElementById('itemOverlayClose')?.addEventListener('click', () => document.getElementById('itemOverlay')?.classList.remove('show'));
document.getElementById('moveOverlayClose')?.addEventListener('click', () => document.getElementById('moveOverlay')?.classList.remove('show'));

document.getElementById('pokemonSearchInput')?.addEventListener('input', (e) => renderPokemonGrid(e.target.value));
document.getElementById('itemSearchInput')?.addEventListener('input', (e) => renderItemGrid(e.target.value));
document.getElementById('moveSearchInput')?.addEventListener('input', (e) => renderMoveGrid(e.target.value));

document.getElementById('pokemonOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'pokemonOverlay') e.currentTarget.classList.remove('show');
});
document.getElementById('itemOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'itemOverlay') e.currentTarget.classList.remove('show');
});
document.getElementById('moveOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'moveOverlay') e.currentTarget.classList.remove('show');
});

document.getElementById('editModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'editModal') saveAndClose();
});

renderGrid();
