// Cloudflare Worker: gojuon checklist (click-to-learn with strikethrough)
// Single-page UI, D1 single-user shared state, no build step.
// v2: hiragana + katakana with independent learning state.

const HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>五十音図学習</title>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
  body { font-family: -apple-system, "Hiragino Sans", "Yu Gothic", sans-serif; }
  .kana { font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif; }
</style>
</head>
<body class="bg-slate-50 min-h-screen">
<div id="root"></div>
<script type="text/babel">
const { useState, useEffect, useCallback } = React;

// ========== Kana grids (hiragana) ==========
const SEION = [
  ['',  ['あ','い','う','え','お']],
  ['k', ['か','き','く','け','こ']],
  ['s', ['さ','し','す','せ','そ']],
  ['t', ['た','ち','つ','て','と']],
  ['n', ['な','に','ぬ','ね','の']],
  ['h', ['は','ひ','ふ','へ','ほ']],
  ['m', ['ま','み','む','め','も']],
  ['y', ['や',null,'ゆ',null,'よ']],
  ['r', ['ら','り','る','れ','ろ']],
  ['w', ['わ',null,null,null,'を']],
  ['',  ['ん',null,null,null,null]],
];

const DAKUON = [
  ['g', ['が','ぎ','ぐ','げ','ご']],
  ['z', ['ざ','じ','ず','ぜ','ぞ']],
  ['d', ['だ','ぢ','づ','で','ど']],
  ['b', ['ば','び','ぶ','べ','ぼ']],
  ['p', ['ぱ','ぴ','ぷ','ぺ','ぽ']],
];

const YOUON = [
  ['k', ['きゃ','きゅ','きょ']],
  ['s', ['しゃ','しゅ','しょ']],
  ['t', ['ちゃ','ちゅ','ちょ']],
  ['n', ['にゃ','にゅ','にょ']],
  ['h', ['ひゃ','ひゅ','ひょ']],
  ['m', ['みゃ','みゅ','みょ']],
  ['r', ['りゃ','りゅ','りょ']],
  ['g', ['ぎゃ','ぎゅ','ぎょ']],
  ['z', ['じゃ','じゅ','じょ']],
  ['b', ['びゃ','びゅ','びょ']],
  ['p', ['ぴゃ','ぴゅ','ぴょ']],
];

// Hiragana -> Katakana mapping (104 entries: 46 seion + 25 dakuon/handakuon + 33 youon).
// Hardcoded for clarity and to avoid Unicode-offset edge cases (e.g. ぢ づ).
const H2K = {
  // seion (46)
  'あ':'ア','い':'イ','う':'ウ','え':'エ','お':'オ',
  'か':'カ','き':'キ','く':'ク','け':'ケ','こ':'コ',
  'さ':'サ','し':'シ','す':'ス','せ':'セ','そ':'ソ',
  'た':'タ','ち':'チ','つ':'ツ','て':'テ','と':'ト',
  'な':'ナ','に':'ニ','ぬ':'ヌ','ね':'ネ','の':'ノ',
  'は':'ハ','ひ':'ヒ','ふ':'フ','へ':'ヘ','ほ':'ホ',
  'ま':'マ','み':'ミ','む':'ム','め':'メ','も':'モ',
  'や':'ヤ','ゆ':'ユ','よ':'ヨ',
  'ら':'ラ','り':'リ','る':'ル','れ':'レ','ろ':'ロ',
  'わ':'ワ','を':'ヲ',
  'ん':'ン',
  // dakuon + handakuon (25)
  'が':'ガ','ぎ':'ギ','ぐ':'グ','げ':'ゲ','ご':'ゴ',
  'ざ':'ザ','じ':'ジ','ず':'ズ','ぜ':'ゼ','ぞ':'ゾ',
  'だ':'ダ','ぢ':'ヂ','づ':'ヅ','で':'デ','ど':'ド',
  'ば':'バ','び':'ビ','ぶ':'ブ','べ':'ベ','ぼ':'ボ',
  'ぱ':'パ','ぴ':'ピ','ぷ':'プ','ぺ':'ペ','ぽ':'ポ',
  // youon (33)
  'きゃ':'キャ','きゅ':'キュ','きょ':'キョ',
  'しゃ':'シャ','しゅ':'シュ','しょ':'ショ',
  'ちゃ':'チャ','ちゅ':'チュ','ちょ':'チョ',
  'にゃ':'ニャ','にゅ':'ニュ','にょ':'ニョ',
  'ひゃ':'ヒャ','ひゅ':'ヒュ','ひょ':'ヒョ',
  'みゃ':'ミャ','みゅ':'ミュ','みょ':'ミョ',
  'りゃ':'リャ','りゅ':'リュ','りょ':'リョ',
  'ぎゃ':'ギャ','ぎゅ':'ギュ','ぎょ':'ギョ',
  'じゃ':'ジャ','じゅ':'ジュ','じょ':'ジョ',
  'びゃ':'ビャ','びゅ':'ビュ','びょ':'ビョ',
  'ぴゃ':'ピャ','ぴゅ':'ピュ','ぴょ':'ピョ'
};

const VOWELS_5 = ['a','i','u','e','o'];
const VOWELS_3 = ['ya','yu','yo'];
const TOTAL = (46 + 25 + 33) * 2; // 208 (hiragana + katakana)

// ========== API ==========
async function api(method, path, body) {
  const opts = { method };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(method + ' ' + path + ' -> ' + r.status);
  return r.json();
}

// ========== KanaCell ==========
// Each cell displays hiragana and katakana inline as "あ/ア".
// The "あ" and "ア" are independent clickable buttons with their own
// learned state and line-through. The slash is a decorative
// non-clickable separator. Visually a single compact cell, internally
// two independent click targets.
function KanaCell({ kana, learned, onToggle }) {
  if (kana === null) {
    return <div style={{aspectRatio: '2 / 1'}}></div>;
  }
  const kataKana = H2K[kana];
  const hLearned = learned.has('h:' + kana);
  const kLearned = learned.has('k:' + kataKana);

  const btnBase = 'kana px-1 bg-transparent border-0 cursor-pointer transition-colors';
  const hCls = hLearned
    ? btnBase + ' text-slate-400 line-through'
    : btnBase + ' text-slate-900 font-bold hover:text-blue-600';
  const kCls = kLearned
    ? btnBase + ' text-slate-400 line-through'
    : btnBase + ' text-slate-900 font-bold hover:text-blue-600';

  return (
    <div
      style={{aspectRatio: '2 / 1'}}
      className="flex items-center justify-center rounded-lg bg-white shadow-sm text-xl hover:bg-slate-50 transition-colors"
    >
      <button
        type="button"
        onClick={() => onToggle('h', kana)}
        className={hCls}
      >
        {kana}
      </button>
      <span className="text-slate-300 mx-0.5 select-none">/</span>
      <button
        type="button"
        onClick={() => onToggle('k', kataKana)}
        className={kCls}
      >
        {kataKana}
      </button>
    </div>
  );
}

// ========== KanaTable ==========
function KanaTable({ title, grid, vowels, learned, onToggle }) {
  const cols = vowels.length;
  const gridStyle = { gridTemplateColumns: '2rem repeat(' + cols + ', 1fr)' };
  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold mb-2 text-slate-700">{title}</h2>
      <div className="bg-white rounded-xl p-3 shadow-sm">
        <div className="grid gap-1.5 mb-1" style={gridStyle}>
          <div></div>
          {vowels.map(v => (
            <div key={v} className="text-center text-xs text-slate-400 font-mono pb-1">
              {v}
            </div>
          ))}
        </div>
        {grid.map(([label, kanas], idx) => (
          <div key={idx} className="grid gap-1.5 mb-1.5" style={gridStyle}>
            <div className="text-xs text-slate-400 font-mono flex items-center justify-end pr-1">
              {label}
            </div>
            {kanas.map((kana, i) => (
              <KanaCell
                key={i}
                kana={kana}
                learned={learned}
                onToggle={onToggle}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ========== App ==========
function App() {
  const [learned, setLearned] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('GET', '/api/learned')
      .then(data => {
        const set = new Set();
        (data.learned || []).forEach(item => {
          set.add(item.type + ':' + item.kana);
        });
        setLearned(set);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const handleToggle = useCallback(async (type, kana) => {
    const key = type + ':' + kana;
    const wasLearned = learned.has(key);
    setLearned(prev => {
      const next = new Set(prev);
      if (wasLearned) next.delete(key); else next.add(key);
      return next;
    });
    try {
      await api('POST', wasLearned ? '/api/unlearn' : '/api/learn', { kana, type });
    } catch (e) {
      console.error(e);
      setLearned(prev => {
        const next = new Set(prev);
        if (wasLearned) next.add(key); else next.delete(key);
        return next;
      });
      alert('同步失败: ' + e.message);
    }
  }, [learned]);

  const handleReset = useCallback(async () => {
    if (!window.confirm('确定清空所有学习记录？此操作无法撤销。')) return;
    try {
      await api('POST', '/api/reset');
      setLearned(new Set());
    } catch (e) {
      alert('重置失败: ' + e.message);
    }
  }, []);

  const count = learned.size;
  const percent = Math.round(count / TOTAL * 100);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-800">五十音図</h1>
          <p className="text-sm text-slate-500 mt-1">点击假名标记已学，再点取消</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-500">已学</div>
          <div className="text-2xl font-bold text-blue-600 leading-tight">
            {count}<span className="text-base text-slate-400">/{TOTAL}</span>
          </div>
          <div className="text-xs text-slate-400">{percent}%</div>
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-red-500 mt-2 underline"
          >
            重置全部
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-center text-slate-400 py-12">加载中...</div>
      ) : (
        <>
          <KanaTable title="清音 Seion" grid={SEION} vowels={VOWELS_5} learned={learned} onToggle={handleToggle} />
          <KanaTable title="浊音 Dakuon" grid={DAKUON} vowels={VOWELS_5} learned={learned} onToggle={handleToggle} />
          <KanaTable title="拗音 Youon" grid={YOUON} vowels={VOWELS_3} learned={learned} onToggle={handleToggle} />
        </>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
</script>
</body>
</html>`;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      if (pathname === '/' || pathname === '/index.html') {
        return new Response(HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      if (pathname === '/api/learned' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT kana, type FROM learned_kana ORDER BY learned_at'
        ).all();
        return json({
          learned: (results || []).map(r => ({ kana: r.kana, type: r.type }))
        });
      }

      if (pathname === '/api/learn' && method === 'POST') {
        const { kana, type } = await request.json();
        if (!kana || !type) return json({ error: 'missing kana or type' }, 400);
        if (type !== 'h' && type !== 'k') return json({ error: 'invalid type' }, 400);
        await env.DB.prepare(
          "INSERT INTO learned_kana (kana, type, learned_at) VALUES (?1, ?2, datetime('now')) ON CONFLICT(kana, type) DO NOTHING"
        ).bind(kana, type).run();
        return json({ ok: true });
      }

      if (pathname === '/api/unlearn' && method === 'POST') {
        const { kana, type } = await request.json();
        if (!kana || !type) return json({ error: 'missing kana or type' }, 400);
        await env.DB.prepare('DELETE FROM learned_kana WHERE kana = ?1 AND type = ?2')
          .bind(kana, type).run();
        return json({ ok: true });
      }

      if (pathname === '/api/reset' && method === 'POST') {
        await env.DB.prepare('DELETE FROM learned_kana').run();
        return json({ ok: true });
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};
