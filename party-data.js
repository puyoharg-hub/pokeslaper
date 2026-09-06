// party-data.js
// 依存（先に読み込むこと）: typechart.js, data.js, champions_move_ability_data.js
//   typechart.js                 -> TYPE_CHART, ALL_TYPES
//   data.js                      -> POKEMON_LIST, ITEM_LIST
//   champions_move_ability_data.js -> MOVE_LIST, ABILITY_LIST, POKEMON_MOVES_ABILITIES
//
// このファイルではデータを新しく作らず、上記の共通データを slug で結合するだけ。

// ===== スプライトURL（全ポケモン共通の3段階フォールバック） =====
// 段階0: Smogon Dex（Pokemon Showdown素材のミラー。xy世代＝メガも含む）のアニメGIF
// 段階1: Pokemon Showdown本体の静止アイコン（同じslug命名規則の別ホスト。
//         メガ/通常/リージョンフォームを問わず同じ規則で存在するため、
//         「メガだけ推測URLを組み立てる」旧実装よりも一般性が高い）
// 段階2: どちらも失敗したら壊れた画像アイコンのままにせず、プレースホルダーに差し替える
const SPRITE_URL = slug => `https://www.smogon.com/dex/media/sprites/xy/${slug}.gif`;
const SPRITE_FALLBACK_URL = slug => `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`;

function handleSpriteError(imgEl, slug) {
  const stage = Number(imgEl.dataset.fallbackStage || '0');

  if (stage === 0) {
    imgEl.dataset.fallbackStage = '1';
    imgEl.src = SPRITE_FALLBACK_URL(slug);
    return;
  }

  // 最終段階：これ以上リトライしない。ブラウザの「壊れた画像」アイコンを
  // 出したままにせず、既存の np-sprite の「?」表示と同じ見た目のプレース
  // ホルダーに差し替える。
  imgEl.dataset.fallbackStage = '2';
  imgEl.onerror = null;
  imgEl.style.display = 'none';
  const holder = imgEl.parentElement;
  if (holder && !holder.querySelector('.sprite-placeholder')) {
    const ph = document.createElement('div');
    ph.className = 'sprite-placeholder';
    ph.textContent = '?';
    holder.appendChild(ph);
  }
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

// 段階1フォールバック：同じpokespriteリポジトリの通常版（アウトラインなし）。
// "items-outline" -> "items" に差し替えるだけで、サブフォルダ・ファイル名の
// 規則は完全に同一（公式READMEのitems/evo-item/thunder-stone.png と
// items-outline/evo-item/thunder-stone.png の対応表より確認済み）なので、
// カテゴリ別のswitchをもう一度書く必要がなく道具・カテゴリを問わず効く。
const POKESPRITE_BASE_FALLBACK = 'https://raw.githubusercontent.com/msikma/pokesprite/master/items';
const ITEM_SPRITE_FALLBACK_URL = (slug, category) =>
  ITEM_SPRITE_URL(slug, category).replace(POKESPRITE_BASE, POKESPRITE_BASE_FALLBACK);

// 段階2：どちらも失敗したら壊れた画像アイコンを出さず、SVGの「?」プレースホルダーに
// 差し替える。img要素はそのまま(=既存のwidth/height/object-fit指定を使い回せる)。
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

// ===== タイプの表示色（typechart.jsにはデータが無いためUI用に別管理） =====
const TYPE_COLORS = {
  "ノーマル":"#9CA3AF","ほのお":"#F87171","みず":"#60A5FA","でんき":"#FBBF24","くさ":"#4ADE80",
  "こおり":"#7DD3FC","かくとう":"#FB923C","どく":"#C084FC","じめん":"#D9B26F","ひこう":"#93C5FD",
  "エスパー":"#F472B6","むし":"#A3E635","いわ":"#B8860B","ゴースト":"#8B5CF6","ドラゴン":"#818CF8",
  "あく":"#6B7280","はがね":"#94A3B8","フェアリー":"#F9A8D4"
};

// ===== 技・特性の slug -> 表示名 索引 =====
const ABILITY_NAME_BY_SLUG = Object.fromEntries(ABILITY_LIST.map(a => [a.slug, a.name]));
const MOVE_BY_SLUG = Object.fromEntries(MOVE_LIST.map(m => [m.slug, m]));
const CHAMPIONS_BY_SLUG = Object.fromEntries(POKEMON_MOVES_ABILITIES.map(p => [p.slug, p]));

// ===== POKEMON_LIST(タイプ等) と POKEMON_MOVES_ABILITIES(種族値/特性/技) を slug でマージ =====
// champions側にデータが無いポケモン(POKEMON_LIST側のみ)はパーティ編成の対象外（種族値が無いため）
const PARTY_POKEMON_DB = POKEMON_LIST
  .filter(p => CHAMPIONS_BY_SLUG[p.slug])
  .map(p => {
    const c = CHAMPIONS_BY_SLUG[p.slug];
    return {
      slug: p.slug,
      name: p.name,
      types: p.types,
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
    };
  });

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
