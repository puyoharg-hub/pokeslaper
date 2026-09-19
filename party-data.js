const BULBA_NAME_OVERRIDES = {
  'farfetchd-galar': "Farfetch'd-Galar",
  'sirfetchd': "Sirfetch'd",
  'toxtricity': 'Toxtricity-Amped',
  'toxtricity-low-key': 'Toxtricity-Low Key',
  'indeedee': 'Indeedee-Male',
  'basculegion': 'Basculegion-Male',
  'aegislash': 'Aegislash-Shield',
  'morpeko': 'Morpeko-Full',
  'pyroar': 'Pyroar-Male',
  // メガニャオニクスは性別違いも無印画像で統一
  'meowstic-mega-male': 'Meowstic-Mega',
  'meowstic-mega-female': 'Meowstic-Mega',
  // パンプジンはサイズ違いも無印画像で統一
  'gourgeist-small': 'Gourgeist',
  'gourgeist-large': 'Gourgeist',
  'gourgeist-super': 'Gourgeist',
};
const BULBA_REGIONS = ['galar', 'alola', 'paldea', 'hisui'];

function formatBulbaSpriteName(slug) {
  if (BULBA_NAME_OVERRIDES[slug]) return BULBA_NAME_OVERRIDES[slug];

  const parts = slug.split('-');
  const cap = w => (w.length <= 1 ? w : w.charAt(0).toUpperCase() + w.slice(1));

  // 性別違い: 末尾が female/male
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && (last === 'female' || last === 'male')) {
    const base = parts.slice(0, -1).map(cap).join('-');
    return `${base}-${cap(last)}`;
  }

  // Mr./Mrs. 系(ピリオド+スペース)
  if (parts[0] === 'mr' || parts[0] === 'mrs') {
    const title = parts[0] === 'mr' ? 'Mr.' : 'Mrs.';
    const rest = parts.slice(2).map(cap);
    return [`${title} ${cap(parts[1])}`, ...rest].join('-');
  }

  // メガX/Y/Z(既存ロジックを流用)
  if (parts.length >= 3 && parts[1] === 'mega' && ['x', 'y', 'z'].includes(parts[2])) {
    return [cap(parts[0]), `Mega_${parts[2].toUpperCase()}`, ...parts.slice(3).map(cap)].join('-');
  }

  // 地方フォーム+品種名(地方名の後はスペース区切り)
  if (parts.length >= 3 && BULBA_REGIONS.includes(parts[1])) {
    return `${cap(parts[0])}-${cap(parts[1])} ${parts.slice(2).map(cap).join(' ')}`;
  }

  return parts.map(cap).join('-');
}

function BULBA_SPRITE_URL(dex, slug) {
  const dexStr = String(dex).padStart(4, '0');
  return `https://archives.bulbagarden.net/wiki/Special:FilePath/${dexStr}${formatBulbaSpriteName(slug)}.png`;
}

const POKESPRITE_BASE = 'https://raw.githubusercontent.com/msikma/pokesprite/master/items-outline';
const ITEM_SPRITE_URL = (slug, category) => {
  switch (category) {
    case 'berry':      return `${POKESPRITE_BASE}/berry/${slug.replace('-berry', '')}.png`;
    case 'plate':      return `${POKESPRITE_BASE}/plate/${slug.replace('-plate', '')}.png`;
    case 'z-crystal':  return `${POKESPRITE_BASE}/z-crystals/${slug}--held.png`;
    case 'mega-stone': return `${POKESPRITE_BASE}/mega-stone/${slug}.png`;
    case 'evo-item':   return `${POKESPRITE_BASE}/evo-item/${slug}.png`;
    default:           return `${POKESPRITE_BASE}/hold-item/${slug}.png`;
  }
};

const POKESPRITE_BASE_FALLBACK = 'https://raw.githubusercontent.com/msikma/pokesprite/master/items';
const ITEM_SPRITE_FALLBACK_URL = (slug, category) =>
  ITEM_SPRITE_URL(slug, category).replace(POKESPRITE_BASE, POKESPRITE_BASE_FALLBACK);

const ITEM_SPRITE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E" +
  "%3Crect width='32' height='32' rx='6' fill='%23262f45'/%3E" +
  "%3Ctext x='16' y='22' font-size='18' font-family='sans-serif' fill='%2364748b' text-anchor='middle'%3E%3F%3C/text%3E%3C/svg%3E";

function handleItemSpriteError(imgEl, slug, category) {
  const stage = Number(imgEl.dataset.fallbackStage || '0');

  if (stage === 0) {
    imgEl.dataset.fallbackStage = '1';
    imgEl.src = ITEM_SPRITE_FALLBACK_URL(slug, category);
    return;
  }

  imgEl.dataset.fallbackStage = '2';
  imgEl.onerror = null;
  imgEl.src = ITEM_SPRITE_PLACEHOLDER;
}

// ===== タイプの表示色 =====
const TYPE_COLORS = {
  "ノーマル":"#a1a1a1","ほのお":"#d33a30","みず":"#4d78be","でんき":"#f1c43f","くさ":"#5d9d3a",
  "こおり":"#79cced","かくとう":"#f08832","どく":"#6d4c97","じめん":"#89532a","ひこう":"#8eb8e6",
  "エスパー":"#dc4d79","むし":"#95a235","いわ":"#adaa84","ゴースト":"#6c436e","ドラゴン":"#4d61a8",
  "あく":"#4d3f3f","はがね":"#76a2ba","フェアリー":"#b880b8"
};

// ===== タイプの表示アイコン(SVGファイル名) =====
const TYPE_ICON_FILE = {
  "ノーマル":"normal","ほのお":"fire","みず":"water","でんき":"electric","くさ":"grass",
  "こおり":"ice","かくとう":"fighting","どく":"poison","じめん":"ground","ひこう":"flying",
  "エスパー":"psychic","むし":"bug","いわ":"rock","ゴースト":"ghost","ドラゴン":"dragon",
  "あく":"dark","はがね":"steel","フェアリー":"fairy"
};
function TYPE_ICON_URL(type) {
  return `assets/icons/${TYPE_ICON_FILE[type] || 'normal'}.svg`;
}

// ===== 技・特性の slug -> 表示名 索引 =====
const ABILITY_NAME_BY_SLUG = Object.fromEntries(ABILITY_LIST.map(a => [a.slug, a.name]));
const MOVE_BY_SLUG = Object.fromEntries(MOVE_LIST.map(m => [m.slug, m]));
// ===== POKEMON_MOVES_ABILITIES(name/types/種族値/特性/技を統合済み)から直接生成 =====
const PARTY_POKEMON_DB = POKEMON_MOVES_ABILITIES.map(c => ({
  slug: c.slug,
  name: c.name,
  dex: c.dex,
  types: c.types,
  base: {
    hp:  c.base_stats.h,
    atk: c.base_stats.a,
    def: c.base_stats.b,
    spa: c.base_stats.c,
    spd: c.base_stats.d,
    spe: c.base_stats.s,
  },
  abilities: c.abilities.map(a => ({
    slug: a.slug,
    name: ABILITY_NAME_BY_SLUG[a.slug] || a.slug,
    hidden: a.hidden,
  })),
  moves: c.moves.map(slug => MOVE_BY_SLUG[slug]).filter(Boolean),
}));

const PARTY_POKEMON_BY_SLUG = Object.fromEntries(PARTY_POKEMON_DB.map(p => [p.slug, p]));

function findPokemonByName(name) {
  return PARTY_POKEMON_DB.find(p => p.name === name) || null;
}
function findItemByName(name) {
  return ITEM_LIST.find(it => it.name === name) || null;
}
function findMoveByName(name) {
  return MOVE_LIST.find(m => m.name === name) || null;
}
function isValidAbilityForPokemon(pokemon, name) {
  return !!pokemon && pokemon.abilities.some(a => a.name === name);
}
function isValidMoveForPokemon(pokemon, name) {
  return !!pokemon && pokemon.moves.some(m => m.name === name);
}
