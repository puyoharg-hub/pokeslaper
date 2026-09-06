// party-stats.js
// ポケモンチャンピオンズ仕様の実数値計算
//
// - 個体値は廃止。常に31固定（6V相当）
// - レベルは50固定
// - 能力P（努力値相当）: 1ステータス上限32 / 合計上限66
// - 能力Pは性格補正の内側（掛け算の前）に加算し、性格補正後に切り捨て
//
// 計算式:
//   HP以外 = floor((floor((種族値×2+31)×50/100) + 5 + 能力P) × 補正倍率)
//   HP     = floor((種族値×2+31)×50/100) + 60 + 能力P
//   補正倍率: 上昇=1.1 / 下降=0.9 / 無補正=1.0

const LEVEL = 50;
const IV = 31;
const EV_MAX_EACH = 32;
const EV_MAX_TOTAL = 66;

const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];
const STAT_LABELS = { hp: "HP", atk: "攻撃", def: "防御", spa: "特攻", spd: "特防", spe: "素早" };

/**
 * 実数値を計算する
 * @param {number} base  種族値
 * @param {number} ev    能力P (0〜32)
 * @param {string} key   STAT_KEYSのいずれか
 * @param {?string} nature  'up' | 'down' | null
 */
function calcRealStat(base, ev, key, nature) {
  const preNature = Math.floor((base * 2 + IV) * LEVEL / 100);
  if (key === "hp") {
    return preNature + LEVEL + 10 + ev;
  }
  let val = preNature + 5 + ev;
  if (nature === "up") val = Math.floor(val * 1.1);
  else if (nature === "down") val = Math.floor(val * 0.9);
  return val;
}

/** party.js の ev オブジェクト { hp,atk,def,spa,spd,spe } から合計値を返す */
function sumEv(evObj) {
  return STAT_KEYS.reduce((s, k) => s + (evObj[k] || 0), 0);
}
