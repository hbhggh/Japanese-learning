// Cloudflare Worker: gojuon learning app
// HTML inlined below as a template literal — zero build step.

const HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>五十音図 学習</title>
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
const { useState, useEffect, useMemo } = React;

// ========== Kana data ==========
const SEION = [
  ['あ','a'],['い','i'],['う','u'],['え','e'],['お','o'],
  ['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko'],
  ['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so'],
  ['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to'],
  ['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no'],
  ['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho'],
  ['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo'],
  ['や','ya'],['ゆ','yu'],['よ','yo'],
  ['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro'],
  ['わ','wa'],['を','wo'],['ん','n'],
];

const DAKUON = [
  ['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go'],
  ['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo'],
  ['だ','da'],['ぢ','ji'],['づ','zu'],['で','de'],['ど','do'],
  ['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo'],
  ['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po'],
];

const YOUON = [
  ['きゃ','kya'],['きゅ','kyu'],['きょ','kyo'],
  ['しゃ','sha'],['しゅ','shu'],['しょ','sho'],
  ['ちゃ','cha'],['ちゅ','chu'],['ちょ','cho'],
  ['にゃ','nya'],['にゅ','nyu'],['にょ','nyo'],
  ['ひゃ','hya'],['ひゅ','hyu'],['ひょ','hyo'],
  ['みゃ','mya'],['みゅ','myu'],['みょ','myo'],
  ['りゃ','rya'],['りゅ','ryu'],['りょ','ryo'],
  ['ぎゃ','gya'],['ぎゅ','gyu'],['ぎょ','gyo'],
  ['じゃ','ja'],['じゅ','ju'],['じょ','jo'],
  ['びゃ','bya'],['びゅ','byu'],['びょ','byo'],
  ['ぴゃ','pya'],['ぴゅ','pyu'],['ぴょ','pyo'],
];

const ALL_GROUPS = { '清音': SEION, '浊音': DAKUON, '拗音': YOUON };
const ALL_KANA = [...SEION, ...DAKUON, ...YOUON];

// ========== API ==========
const api = {
  async getProgress() {
    const r = await fetch('/api/progress');
    return r.json();
  },
  async answer(kana, correct) {
    return fetch('/api/answer', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({kana, correct})
    });
  },
  async session(total, correct) {
    return fetch('/api/session', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({total, correct})
    });
  },
  async getSessions() {
    const r = await fetch('/api/sessions?limit=30');
    return r.json();
  }
};

// ========== Helpers ==========
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function accuracyColor(c, w) {
  const total = c + w;
  if (total === 0) return 'bg-slate-100 text-slate-400';
  const acc = c / total;
  if (acc < 0.5) return 'bg-red-200 text-red-900';
  if (acc < 0.8) return 'bg-yellow-200 text-yellow-900';
  return 'bg-green-200 text-green-900';
}

// ========== Browse Tab ==========
function BrowseTab({ progress }) {
  return (
    <div className="space-y-8">
      {Object.entries(ALL_GROUPS).map(([name, group]) => (
        <div key={name}>
          <h2 className="text-xl font-bold mb-3 text-slate-700">{name} ({group.length})</h2>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {group.map(([k, r]) => {
              const p = progress[k] || {correct:0, wrong:0};
              const tot = p.correct + p.wrong;
              return (
                <div key={k} className={\`rounded-lg p-2 text-center \${accuracyColor(p.correct, p.wrong)}\`}>
                  <div className="kana text-2xl font-bold">{k}</div>
                  <div className="text-xs">{r}</div>
                  {tot > 0 && <div className="text-[10px] opacity-70">{p.correct}/{tot}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========== Quiz Tab ==========
function QuizTab({ onAnswered, onSessionDone }) {
  const [config, setConfig] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);

  function startQuiz(range, direction) {
    const pool = range === '全部' ? ALL_KANA : ALL_GROUPS[range];
    const qs = shuffle(pool).slice(0, 10).map(([k, r]) => {
      const distractors = shuffle(pool.filter(x => x[0] !== k)).slice(0, 3);
      const choices = shuffle([[k,r], ...distractors]);
      return { kana: k, romaji: r, choices };
    });
    setQuestions(qs);
    setIdx(0); setScore(0); setPicked(null); setDone(false);
    setConfig({range, direction});
  }

  function pick(choice) {
    if (picked) return;
    const q = questions[idx];
    const correct = choice[0] === q.kana;
    setPicked({choice, correct});
    const newScore = correct ? score + 1 : score;
    if (correct) setScore(newScore);
    onAnswered(q.kana, correct);
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        setDone(true);
        onSessionDone(questions.length, newScore);
      } else {
        setIdx(i => i+1);
        setPicked(null);
      }
    }, 700);
  }

  if (!config) {
    return (
      <div className="space-y-6">
        <h3 className="font-bold mb-2">选择范围</h3>
        <div className="grid grid-cols-2 gap-2">
          {['清音','浊音','拗音','全部'].map(r => (
            <button key={r} onClick={() => setConfig({range:r, direction:null})}
              className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg hover:border-blue-500 font-medium">
              {r}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (config && !config.direction) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-slate-500">范围: <span className="font-medium text-slate-700">{config.range}</span></div>
        <h3 className="font-bold">选择方向</h3>
        <div className="flex flex-col gap-2">
          <button onClick={() => startQuiz(config.range, 'k2r')}
            className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg hover:border-blue-500">
            看假名 → 选罗马音
          </button>
          <button onClick={() => startQuiz(config.range, 'r2k')}
            className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg hover:border-blue-500">
            看罗马音 → 选假名
          </button>
        </div>
        <button onClick={() => setConfig(null)} className="text-sm text-slate-500 underline">← 重选范围</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="text-6xl">{score >= 8 ? '🎉' : score >= 5 ? '👍' : '💪'}</div>
        <div className="text-3xl font-bold">{score} / {questions.length}</div>
        <div className="text-slate-500">正确率 {Math.round(score/questions.length*100)}%</div>
        <button onClick={() => setConfig(null)} className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium">再来一组</button>
      </div>
    );
  }

  const q = questions[idx];
  const isK2R = config.direction === 'k2r';
  return (
    <div className="space-y-6">
      <div className="flex justify-between text-sm text-slate-500">
        <span>{idx+1} / {questions.length}</span>
        <span>得分 {score}</span>
      </div>
      <div className="text-center py-12 bg-white rounded-xl shadow-sm">
        <div className={isK2R ? "kana text-7xl font-bold" : "text-5xl font-bold text-slate-700"}>
          {isK2R ? q.kana : q.romaji}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.choices.map(([k, r], i) => {
          const isCorrect = k === q.kana;
          const isPicked = picked && picked.choice[0] === k;
          let cls = "px-4 py-4 bg-white border-2 border-slate-200 rounded-lg hover:border-blue-500";
          if (picked) {
            if (isCorrect) cls = "px-4 py-4 bg-green-100 border-2 border-green-500 rounded-lg";
            else if (isPicked) cls = "px-4 py-4 bg-red-100 border-2 border-red-500 rounded-lg";
            else cls = "px-4 py-4 bg-white border-2 border-slate-200 rounded-lg opacity-50";
          }
          return (
            <button key={i} onClick={() => pick([k,r])} className={cls}>
              <span className={isK2R ? "text-xl" : "kana text-3xl"}>
                {isK2R ? r : k}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== Progress Tab ==========
function ProgressTab({ progress, sessions }) {
  const stats = useMemo(() => {
    let learned = 0, mastered = 0;
    let totalC = 0, totalW = 0;
    ALL_KANA.forEach(([k]) => {
      const p = progress[k];
      if (p && p.correct + p.wrong > 0) {
        learned++;
        totalC += p.correct;
        totalW += p.wrong;
        if (p.correct + p.wrong >= 3 && p.correct/(p.correct+p.wrong) >= 0.8) mastered++;
      }
    });
    return {learned, mastered, total: ALL_KANA.length, totalC, totalW};
  }, [progress]);

  const chart = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const data = sessions.slice().reverse();
    const W = 600, H = 200, P = 30;
    const pts = data.map((s, i) => {
      const x = P + (i/Math.max(data.length-1,1)) * (W - P*2);
      const y = H - P - (s.correct/s.total) * (H - P*2);
      return [x, y, s];
    });
    const path = pts.map((p, i) => (i===0?'M':'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return { W, H, P, pts, path };
  }, [sessions]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl">
          <div className="text-xs text-slate-500">已练习</div>
          <div className="text-2xl font-bold">{stats.learned}<span className="text-base text-slate-400">/{stats.total}</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl">
          <div className="text-xs text-slate-500">已掌握</div>
          <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
        </div>
        <div className="bg-white p-4 rounded-xl">
          <div className="text-xs text-slate-500">总正确率</div>
          <div className="text-2xl font-bold">
            {stats.totalC+stats.totalW > 0 ? Math.round(stats.totalC/(stats.totalC+stats.totalW)*100) : 0}%
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl">
        <h3 className="font-bold mb-3">熟练度热力图</h3>
        <div className="grid grid-cols-10 sm:grid-cols-12 gap-1">
          {ALL_KANA.map(([k], i) => {
            const p = progress[k] || {correct:0, wrong:0};
            return (
              <div key={i} title={k + ': ' + p.correct + '/' + (p.correct+p.wrong)}
                className={\`kana text-center text-sm py-2 rounded \${accuracyColor(p.correct, p.wrong)}\`}>
                {k}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
          <span><span className="inline-block w-3 h-3 bg-slate-100 rounded mr-1 align-middle"></span>未练</span>
          <span><span className="inline-block w-3 h-3 bg-red-200 rounded mr-1 align-middle"></span>&lt;50%</span>
          <span><span className="inline-block w-3 h-3 bg-yellow-200 rounded mr-1 align-middle"></span>50-80%</span>
          <span><span className="inline-block w-3 h-3 bg-green-200 rounded mr-1 align-middle"></span>≥80%</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl">
        <h3 className="font-bold mb-3">最近测验得分</h3>
        {chart ? (
          <svg viewBox={'0 0 ' + chart.W + ' ' + chart.H} className="w-full">
            {[0, 0.5, 1].map(v => {
              const y = chart.H - chart.P - v*(chart.H - chart.P*2);
              return (
                <g key={v}>
                  <line x1={chart.P} y1={y} x2={chart.W-chart.P} y2={y} stroke="#e2e8f0" strokeDasharray="3,3"/>
                  <text x={chart.P-5} y={y+4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(v*100)}%</text>
                </g>
              );
            })}
            <path d={chart.path} fill="none" stroke="#3b82f6" strokeWidth="2"/>
            {chart.pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#3b82f6"/>
            ))}
          </svg>
        ) : (
          <div className="text-slate-400 text-sm py-8 text-center">还没有测验记录，去做一组试试</div>
        )}
      </div>
    </div>
  );
}

// ========== App ==========
function App() {
  const [tab, setTab] = useState('browse');
  const [progress, setProgress] = useState({});
  const [sessions, setSessions] = useState([]);

  async function refresh() {
    try {
      const [p, s] = await Promise.all([api.getProgress(), api.getSessions()]);
      const map = {};
      (p.results || []).forEach(row => {
        map[row.kana] = {correct: row.correct_count || 0, wrong: row.wrong_count || 0};
      });
      setProgress(map);
      setSessions(s.results || []);
    } catch(e) { console.error(e); }
  }

  useEffect(() => { refresh(); }, []);

  function handleAnswered(kana, correct) {
    setProgress(p => {
      const cur = p[kana] || {correct:0, wrong:0};
      return {...p, [kana]: {correct: cur.correct + (correct?1:0), wrong: cur.wrong + (correct?0:1)}};
    });
    api.answer(kana, correct);
  }

  function handleSessionDone(total, correct) {
    api.session(total, correct).then(refresh);
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">五十音図</h1>
        <p className="text-sm text-slate-500">学习 · 测验 · 进度</p>
      </header>
      <nav className="flex gap-1 mb-6 bg-white p-1 rounded-xl">
        {[['browse','浏览'],['quiz','测验'],['progress','进度']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={\`flex-1 py-2 rounded-lg text-sm font-medium \${tab===k?'bg-blue-500 text-white':'text-slate-600 hover:bg-slate-100'}\`}>
            {l}
          </button>
        ))}
      </nav>
      {tab === 'browse' && <BrowseTab progress={progress}/>}
      {tab === 'quiz' && <QuizTab onAnswered={handleAnswered} onSessionDone={handleSessionDone}/>}
      {tab === 'progress' && <ProgressTab progress={progress} sessions={sessions}/>}
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

    try {
      if (pathname === '/' || pathname === '/index.html') {
        return new Response(HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      if (pathname === '/api/progress' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT romaji as kana, correct_count, wrong_count FROM kana_progress'
        ).all();
        return json({ results });
      }

      if (pathname === '/api/answer' && request.method === 'POST') {
        const { kana, correct } = await request.json();
        if (!kana) return json({ error: 'missing kana' }, 400);
        const col = correct ? 'correct_count' : 'wrong_count';
        await env.DB.prepare(
          `INSERT INTO kana_progress (romaji, correct_count, wrong_count, last_reviewed)
           VALUES (?1, ?2, ?3, datetime('now'))
           ON CONFLICT(romaji) DO UPDATE SET ${col} = ${col} + 1, last_reviewed = datetime('now')`
        ).bind(kana, correct ? 1 : 0, correct ? 0 : 1).run();
        return json({ ok: true });
      }

      if (pathname === '/api/session' && request.method === 'POST') {
        const { total, correct } = await request.json();
        await env.DB.prepare(
          "INSERT INTO quiz_sessions (date, total, correct) VALUES (datetime('now'), ?1, ?2)"
        ).bind(total, correct).run();
        return json({ ok: true });
      }

      if (pathname === '/api/sessions' && request.method === 'GET') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);
        const { results } = await env.DB.prepare(
          'SELECT id, date, total, correct FROM quiz_sessions ORDER BY id DESC LIMIT ?1'
        ).bind(limit).all();
        return json({ results });
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};
