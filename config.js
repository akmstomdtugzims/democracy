const CONFIG = {
  COLS: 6,
  ROWS: 5,
  TILE_SIZE: 60,
  MAX_TURNS: 20,
  MAX_OPPRESSION: 3000,
  MAX_PLAYER_HP: 100
};

const DROPS = {
  QUESTION: { bg: "#ffeb3b", border: "#fbc02d", symbol: "💬", name: "疑問", power: 10 },
  FAKE:     { bg: "#e0cffc", border: "#7952b3", symbol: "",   name: "虚偽", power: 0, penaltyDamage: 3 },
  REPORT:   { bg: "#fff3bf", border: "#fcc419", symbol: "📢", name: "報道", power: 10 },
  VERIFY:   { bg: "#ffadad", border: "#ff6b6b", symbol: "🔍", name: "検証", power: 15 },
  SIGN:     { bg: "#a0c4ff", border: "#4cc9f0", symbol: "📜", name: "署名", power: 10 },
  DEMO:     { bg: "#caffbf", border: "#52b788", symbol: "🪧", name: "デモ", power: 20 },
  DIALOGUE: { bg: "#ffc6ff", border: "#f72585", symbol: "🤝", name: "対話", heal: 12 }
};

const JOBS = [
  { id: "citizen", name: "市民", icons: ["🧑‍💼", "👨‍💼", "👩‍🍳", "🧑‍🌾", "🧑‍🎨"], desc: "市民の連帯: 人数増加で効果加算。" },
  { id: "lawyer", name: "弁護士", icons: ["👩‍⚖️", "👨‍⚖️"], desc: "社会正義の実現: 情報開示・虚偽訂正（毎ターン１マス）。" },
  { id: "reporter", name: "記者", icons: ["🕵️", "🕵️‍♂️"], desc: "報道の自由: 「報道」で「疑問」を「署名」へ変換。" },
  { id: "politician", name: "政治家", icons: ["👩‍💼", "👨‍💼"], desc: "公共の福祉: 「対話」効果UP。" },
  { id: "expert", name: "専門家", icons: ["👩‍💻", "🧑‍💻"], desc: "客観性の担保: 「検証」効果UP。" }
];
