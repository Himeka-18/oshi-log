// ==========================================
// 1. アプリ全体のデータ管理（localStorage）
// ==========================================
const STORAGE_KEY = 'oshi_log_data_v1';

// 初期データ構造
const defaultData = {
  currentTab: 'home',       // 現在開いているタブ
  selectedOshiId: null,     // 現在選択中の推しID（nullのときは初期グレージュ）
  oshis: [],                // 推しリスト（名前、タグ、色相、背景設定、パーツ配置など）
  logs: [],                 // ログ（思い出・参戦記録）
  plans: [],                // プラン（今後の予定・ToDo）
  bank: {                   // バンク（収支・推し貯金）
    goalTitle: '次の現場・遠征費',
    goalAmount: 30000,
    savedAmount: 0,
    rules: [
      { id: 'r1', label: 'SNS更新', amount: 100 },
      { id: 'r2', label: 'ビジュが神', amount: 300 },
      { id: 'r3', label: '尊い・供給過多', amount: 500 }
    ],
    records: []
  }
};

// アプリ内で扱うデータ本体
let appData = loadData();

// データを読み込む関数（既存データとの互換性も確保）
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...defaultData,
        ...parsed,
        bank: {
          ...defaultData.bank,
          ...(parsed.bank || {}),
          rules: (parsed.bank && parsed.bank.rules) ? parsed.bank.rules : defaultData.bank.rules,
          records: (parsed.bank && parsed.bank.records) ? parsed.bank.records : []
        }
      };
    } catch (e) {
      console.error('データの読み込みに失敗しました', e);
    }
  }
  return JSON.parse(JSON.stringify(defaultData));
}

// データを保存する関数
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// ==========================================
// 2. テーマカラー連動システム（色相Hの変更）
// ==========================================
function applyThemeColor(hue = null, isCustom = false) {
  const root = document.documentElement;
  if (hue === null || !isCustom) {
    // 初期状態（どの推しともかぶらないウォームグレージュ）
    root.style.setProperty('--theme-hue', 30);
    root.style.setProperty('--bg-main', 'hsl(30, 20%, 97%)');
    root.style.setProperty('--bg-sub', 'hsl(30, 25%, 91%)');
    root.style.setProperty('--color-primary', 'hsl(30, 15%, 62%)');
    root.style.setProperty('--color-dark', 'hsl(30, 18%, 45%)');
  } else {
    // 推しカラー連動（4段階パステルパレット）
    root.style.setProperty('--theme-hue', hue);
    root.style.setProperty('--bg-main', `hsl(${hue}, 30%, 97%)`);
    root.style.setProperty('--bg-sub', `hsl(${hue}, 45%, 90%)`);
    root.style.setProperty('--color-primary', `hsl(${hue}, 65%, 68%)`);
    root.style.setProperty('--color-dark', `hsl(${hue}, 55%, 45%)`);
  }
}

// ==========================================
// 3. 共通モーダル・引き出し操作関数
// ==========================================
const modalEl = document.getElementById('app-modal');

function openModal(htmlContent) {
  modalEl.innerHTML = `<div class="modal-sheet">${htmlContent}</div>`;
  modalEl.classList.remove('hidden');
}

function closeModal() {
  modalEl.classList.add('hidden');
  modalEl.innerHTML = '';
}

modalEl.addEventListener('click', (e) => {
  if (e.target === modalEl) {
    closeModal();
  }
});

// ==========================================
// 4. 画面描画ルーター（背景固定＋スライドインジケーター）
// ==========================================
const mainEl = document.getElementById('app-main');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabIndicator = document.getElementById('tab-indicator');

function setScreenContent(html) {
  mainEl.innerHTML = `<div class="fade-in">${html}</div>`;
}

function switchTab(tabName) {
  appData.currentTab = tabName;

  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
      const index = Number(btn.getAttribute('data-index'));
      if (tabIndicator) {
        let nudgeX = 0;
        if (index === 0) nudgeX = 6;
        if (index === 4) nudgeX = -6;
        tabIndicator.style.transform = `translateX(calc(${index * 100}% + ${nudgeX}px))`;
      }
    } else {
      btn.classList.remove('active');
    }
  });

  switch (tabName) {
    case 'bank':
      bankSubPage = 'main';
      renderBankScreen(null, true);
      break;
    case 'log':
      renderLogScreen();
      break;
    case 'home':
      renderHomeScreen();
      break;
    case 'plan':
      renderPlanScreen();
      break;
    case 'system':
      renderSystemScreen();
      break;
  }
}

// ==========================================
// 5. バンク画面（メイン貯金箱＋履歴ページ＋レポートページ）
// ==========================================
let bankSubPage = 'main';        // 'main' | 'history' | 'report'
let currentBankFilter = 'all';   // 'all' | 'save' | 'expense'
let currentReportPeriod = 'month'; // 'month' | 'year'

// サブページ切り替え関数
function openBankSubPage(pageName) {
  bankSubPage = pageName;
  renderBankScreen(null, true);
}

// バンク画面全体のルーター
function renderBankScreen(droppedCoinInfo = null, withFadeIn = false) {
  if (bankSubPage === 'history') {
    renderBankHistoryPage(withFadeIn);
    return;
  }
  if (bankSubPage === 'report') {
    renderBankReportPage(withFadeIn);
    return;
  }
  renderBankMainPage(droppedCoinInfo, withFadeIn);
}

// ------------------------------------------
// 5-1. バンク・メイン画面（大きな立体貯金箱＋別ページ入口）
// ------------------------------------------
function renderBankMainPage(droppedCoinInfo = null, withFadeIn = false) {
  const bank = appData.bank;
  const percent = bank.goalAmount > 0
    ? Math.min(100, Math.round((bank.savedAmount / bank.goalAmount) * 100))
    : 0;

  // 貯金箱の中に溜まる液面（ゲージ）のY座標計算（高さ104px分: y=54〜158）
  const maxFillHeight = 104;
  const fillHeight = Math.round((maxFillHeight * percent) / 100);
  const fillY = 158 - fillHeight;

  // 投入されたコインのアニメーション要素
  const coinAnimHtml = droppedCoinInfo
    ? `<div class="dropping-coin">+¥${Number(droppedCoinInfo.amount).toLocaleString()}</div>`
    : '';

  const html = `
    <div class="page-title">
      <span>バンク</span>
      <button type="button" class="btn btn-sub page-title-right" style="padding:5px 12px; font-size:0.75rem;" onclick="openGoalEditModal()">目標設定</button>
    </div>

    <!-- 枠なしの大きな貯金箱メインステージ -->
    <div class="piggy-hero-stage">
      <div style="font-size:0.85rem; font-weight:700; color:var(--text-sub);">
        目標：${escapeHtml(bank.goalTitle)}（¥${Number(bank.goalAmount).toLocaleString()}）
      </div>
      <div style="font-size:1.95rem; font-weight:700; color:var(--color-dark); line-height:1.2; margin:2px 0;">
        ¥${Number(bank.savedAmount).toLocaleString()}
      </div>
      <div class="tag" style="margin-top:2px;">達成率 ${percent}%</div>

      <!-- 大きな立体貯金箱（達成率に応じて中身が下から推し色に満たされる） -->
      <div class="piggy-visual-wrap">
        ${coinAnimHtml}
        <svg class="piggy-box-svg ${droppedCoinInfo ? 'piggy-bounce' : ''}" viewBox="0 0 180 180" onclick="openSaveModal()">
          <defs>
            <!-- 正面と右側面の内側クリップ領域（ここに推し色ゲージが溜まる） -->
            <clipPath id="piggy-front-clip">
              <rect x="34" y="54" width="88" height="104" rx="4"/>
            </clipPath>
            <clipPath id="piggy-side-clip">
              <polygon points="122,54 150,38 150,142 122,158"/>
            </clipPath>
          </defs>

          <!-- 上面（蓋：右奥へ向かう正しい直方体） -->
          <polygon points="34,54 62,38 150,38 122,54" fill="var(--bg-sub)" stroke="var(--color-dark)" stroke-width="3.2" stroke-linejoin="round"/>
          <!-- コイン投入口 -->
          <line x1="68" y1="46" x2="114" y2="46" stroke="var(--color-dark)" stroke-width="4.5" stroke-linecap="round"/>

          <!-- 右側面のベース背景 -->
          <polygon points="122,54 150,38 150,142 122,158" fill="#ffffff"/>
          <!-- 右側面に溜まる推し色ゲージ -->
          <g clip-path="url(#piggy-side-clip)">
            <rect x="122" y="${fillY - 16}" width="30" height="${fillHeight + 18}" fill="var(--bg-sub)"/>
          </g>
          <!-- 右側面の枠線 -->
          <polygon points="122,54 150,38 150,142 122,158" fill="none" stroke="var(--color-dark)" stroke-width="3.2" stroke-linejoin="round"/>

          <!-- 正面本体のベース背景 -->
          <rect x="34" y="54" width="88" height="104" rx="4" fill="#ffffff"/>
          <!-- 正面本体に下から溜まる推し色ゲージ -->
          <g clip-path="url(#piggy-front-clip)">
            <rect x="34" y="${fillY}" width="88" height="${fillHeight}" fill="var(--bg-sub)"/>
          </g>
          <!-- 正面本体の枠線 -->
          <rect x="34" y="54" width="88" height="104" rx="4" fill="none" stroke="var(--color-dark)" stroke-width="3.2" stroke-linejoin="round"/>

          <!-- 正面中央の縦線コインマーク -->
          <circle cx="78" cy="106" r="27" fill="#ffffff" stroke="var(--color-primary)" stroke-width="3.5"/>
          <circle cx="78" cy="106" r="20" fill="none" stroke="var(--color-primary)" stroke-width="1.5" stroke-dasharray="3 2"/>
          <line x1="78" y1="95" x2="78" y2="117" stroke="var(--color-dark)" stroke-width="3.8" stroke-linecap="round"/>
        </svg>
      </div>

      <!-- メインアクションボタン（貯金する！ ＆ ＋出費を記録） -->
      <div style="display:flex; gap:10px; width:100%; max-width:340px; margin-top:4px;">
        <button type="button" class="btn" style="flex:1.3; padding:12px 16px; font-size:0.96rem; box-shadow:0 4px 12px rgba(74,68,65,0.14);" onclick="openSaveModal()">
          貯金する！
        </button>
        <button type="button" class="btn btn-sub" style="flex:1; padding:12px 14px; font-size:0.9rem;" onclick="openExpenseModal()">
          ＋出費を記録
        </button>
      </div>
    </div>

    <!-- 別ページへ移動する2つのナビカード -->
    <div class="bank-nav-grid">
      <button type="button" class="bank-nav-card" onclick="openBankSubPage('history')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="tag">全 ${bank.records.length} 件</span>
          <span style="color:var(--color-dark); font-weight:700;">›</span>
        </div>
        <div>
          <div style="font-size:0.95rem; font-weight:700; color:var(--text-main);">きろく履歴</div>
          <div style="font-size:0.75rem; color:var(--text-sub); margin-top:2px;">貯金・出費の一覧</div>
        </div>
      </button>

      <button type="button" class="bank-nav-card" onclick="openBankSubPage('report')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="tag">グラフ</span>
          <span style="color:var(--color-dark); font-weight:700;">›</span>
        </div>
        <div>
          <div style="font-size:0.95rem; font-weight:700; color:var(--text-main);">推し活レポート</div>
          <div style="font-size:0.75rem; color:var(--text-sub); margin-top:2px;">今月・年間・推し別</div>
        </div>
      </button>
    </div>
  `;

  if (withFadeIn) {
    setScreenContent(html);
  } else {
    mainEl.innerHTML = `<div>${html}</div>`;
  }
}

// ------------------------------------------
// 5-2. 別ページ①：「きろく履歴」専用ページ
// ------------------------------------------
function buildBankRecordsListHtml() {
  const filteredRecords = appData.bank.records.filter(r => {
    if (currentBankFilter === 'save') return r.type === 'save';
    if (currentBankFilter === 'expense') return r.type === 'expense';
    return true;
  });

  if (filteredRecords.length === 0) {
    return `<p style="font-size:0.85rem; color:var(--text-sub); text-align:center; padding:24px 0;">まだ記録がありません</p>`;
  }

  return filteredRecords.map(rec => {
    const isSave = rec.type === 'save';
    const sign = isSave ? '+' : '-';
    const amountClass = isSave ? 'record-amount-plus' : 'record-amount-minus';
    const targetBadge = rec.targetLabel
      ? `<span class="tag" style="margin-left:4px; font-size:0.68rem;">${escapeHtml(rec.targetLabel)}</span>`
      : '';
    return `
      <div class="bank-record-item">
        <div style="flex:1; min-width:0; padding-right:8px;">
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:2px;">
            <span class="tag">${escapeHtml(rec.category || (isSave ? '推し貯金' : '出費'))}</span>
            ${targetBadge}
            <span style="font-size:0.75rem; color:var(--text-sub);">${escapeHtml(rec.date || '')}</span>
          </div>
          <div style="font-size:0.88rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(rec.memo || (isSave ? '推し貯金' : '推し活出費'))}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <span class="${amountClass}">${sign}¥${Number(rec.amount).toLocaleString()}</span>
          <button type="button" class="delete-mini-btn" onclick="deleteBankRecord('${rec.id}')" title="削除">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderBankHistoryPage(withFadeIn = false) {
  const html = `
    <div class="page-title">
      <button type="button" class="btn btn-sub page-title-left" style="padding:5px 12px; font-size:0.78rem;" onclick="openBankSubPage('main')">← もどる</button>
      <span>きろく履歴</span>
    </div>

    <div class="card">
      <div class="bank-filter-tabs" id="bank-filter-tabs">
        <button type="button" class="filter-pill ${currentBankFilter === 'all' ? 'active' : ''}" data-filter="all" onclick="setBankFilter('all')">すべて</button>
        <button type="button" class="filter-pill ${currentBankFilter === 'save' ? 'active' : ''}" data-filter="save" onclick="setBankFilter('save')">貯金のみ</button>
        <button type="button" class="filter-pill ${currentBankFilter === 'expense' ? 'active' : ''}" data-filter="expense" onclick="setBankFilter('expense')">出費のみ</button>
      </div>
      <div id="bank-records-list">${buildBankRecordsListHtml()}</div>
    </div>
  `;

  if (withFadeIn) {
    setScreenContent(html);
  } else {
    mainEl.innerHTML = `<div>${html}</div>`;
  }
}

function setBankFilter(filter) {
  currentBankFilter = filter;
  const pills = document.querySelectorAll('#bank-filter-tabs .filter-pill');
  pills.forEach(pill => {
    if (pill.getAttribute('data-filter') === filter) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
  const listEl = document.getElementById('bank-records-list');
  if (listEl) {
    listEl.innerHTML = buildBankRecordsListHtml();
  }
}

// ------------------------------------------
// 5-3. 別ページ②：「推し活レポート（収支グラフ＆推し別集計）」
// ------------------------------------------
function renderBankReportPage(withFadeIn = false) {
  const now = new Date();
  const yearPrefix = `${now.getFullYear()}`;
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = currentReportPeriod === 'month' ? monthPrefix : yearPrefix;

  const periodRecords = appData.bank.records.filter(r => r.date && r.date.startsWith(prefix));

  const totalSave = periodRecords
    .filter(r => r.type === 'save')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const totalExpense = periodRecords
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const maxBoth = Math.max(totalSave, totalExpense, 1);
  const saveBarPct = Math.round((totalSave / maxBoth) * 100);
  const expBarPct = Math.round((totalExpense / maxBoth) * 100);

  // 推し別・タグ別の集計（出費＆貯金）
  const targetMap = {};
  periodRecords.forEach(r => {
    const key = r.targetLabel || '指定なし（全体）';
    if (!targetMap[key]) {
      targetMap[key] = { save: 0, expense: 0 };
    }
    if (r.type === 'save') targetMap[key].save += Number(r.amount);
    if (r.type === 'expense') targetMap[key].expense += Number(r.amount);
  });

  const targetEntries = Object.entries(targetMap).sort(
    (a, b) => (b[1].expense + b[1].save) - (a[1].expense + a[1].save)
  );
  const maxTargetTotal = targetEntries.length > 0
    ? Math.max(...targetEntries.map(([, v]) => v.expense + v.save), 1)
    : 1;

  const targetBarsHtml = targetEntries.length > 0
    ? targetEntries.map(([label, val]) => {
        const total = val.expense + val.save;
        const pct = Math.round((total / maxTargetTotal) * 100);
        return `
          <div class="report-bar-row">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem;">
              <span style="font-weight:700;">${escapeHtml(label)}</span>
              <span style="font-size:0.75rem; color:var(--text-sub);">
                出費 <strong style="color:#c96a6a;">¥${val.expense.toLocaleString()}</strong> / 貯金 <strong class="accent-number">¥${val.save.toLocaleString()}</strong>
              </span>
            </div>
            <div class="report-bar-track">
              <div class="report-bar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('')
    : `<p style="font-size:0.82rem; color:var(--text-sub); text-align:center; padding:12px 0;">この期間の記録がまだありません</p>`;

  // カテゴリー別出費の内訳
  const catMap = {};
  periodRecords.filter(r => r.type === 'expense').forEach(r => {
    const cat = r.category || 'その他';
    catMap[cat] = (catMap[cat] || 0) + Number(r.amount);
  });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  const catBarsHtml = catEntries.length > 0
    ? catEntries.map(([cat, amt]) => {
        const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
        return `
          <div class="report-bar-row">
            <div style="display:flex; justify-content:space-between; font-size:0.82rem;">
              <span style="font-weight:700;">${escapeHtml(cat)}</span>
              <span>¥${amt.toLocaleString()}（${pct}%）</span>
            </div>
            <div class="report-bar-track">
              <div class="report-bar-fill" style="width:${pct}%; background-color:#d98a8a;"></div>
            </div>
          </div>
        `;
      }).join('')
    : `<p style="font-size:0.82rem; color:var(--text-sub); text-align:center; padding:12px 0;">この期間の出費記録はありません</p>`;

  const html = `
    <div class="page-title">
      <button type="button" class="btn btn-sub page-title-left" style="padding:5px 12px; font-size:0.78rem;" onclick="openBankSubPage('main')">← もどる</button>
      <span>推し活レポート</span>
    </div>

    <!-- 今月 / 年間 切り替え -->
    <div style="display:flex; justify-content:center; gap:8px; margin-bottom:14px;">
      <button type="button" class="filter-pill ${currentReportPeriod === 'month' ? 'active' : ''}" onclick="setReportPeriod('month')">今月（${now.getMonth() + 1}月）</button>
      <button type="button" class="filter-pill ${currentReportPeriod === 'year' ? 'active' : ''}" onclick="setReportPeriod('year')">年間（${now.getFullYear()}年）</button>
    </div>

    <!-- 収支バランスグラフ -->
    <div class="card">
      <div class="card-title">貯金と出費のバランス</div>
      <div class="report-bar-row">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
          <span style="font-weight:700;">貯めたお金（＋）</span>
          <span class="accent-number">¥${totalSave.toLocaleString()}</span>
        </div>
        <div class="report-bar-track">
          <div class="report-bar-fill" style="width:${saveBarPct}%;"></div>
        </div>
      </div>
      <div class="report-bar-row">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
          <span style="font-weight:700;">使ったお金（−）</span>
          <span style="font-weight:700; color:#c96a6a;">¥${totalExpense.toLocaleString()}</span>
        </div>
        <div class="report-bar-track">
          <div class="report-bar-fill" style="width:${expBarPct}%; background-color:#d98a8a;"></div>
        </div>
      </div>
    </div>

    <!-- 推し別・タグ別まとめ -->
    <div class="card">
      <div class="card-title">推し・タグ別の記録</div>
      ${targetBarsHtml}
    </div>

    <!-- カテゴリー別出費内訳 -->
    <div class="card">
      <div class="card-title">カテゴリー別の出費内訳</div>
      ${catBarsHtml}
    </div>
  `;

  if (withFadeIn) {
    setScreenContent(html);
  } else {
    mainEl.innerHTML = `<div>${html}</div>`;
  }
}

function setReportPeriod(period) {
  currentReportPeriod = period;
  renderBankReportPage(false);
}

// ------------------------------------------
// 5-4. 「貯金する！」モーダル（貯金ガチャ＋コイン型ワンタップ＋自由入力）
// ------------------------------------------
let lastGachaAmount = null;

function openSaveModal() {
  lastGachaAmount = null;
  const targetOptions = buildTargetOptionsHtml();

  // コイン型ワンタップボタン（マイルール）
  const coinRulesHtml = appData.bank.rules.map(rule => `
    <button type="button" class="coin-rule-btn" onclick="dropCoinToPiggy('${rule.id}')">
      <span class="coin-rule-label">${escapeHtml(rule.label)}</span>
      <span class="coin-rule-amount">+¥${Number(rule.amount).toLocaleString()}</span>
    </button>
  `).join('');

  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:12px;">貯金箱に入れる</div>

    <!-- ① 貯金ガチャ（SVGマシン＋ランダム100/200/300円） -->
    <div class="gacha-box-area">
      <div style="font-size:0.82rem; font-weight:700; color:var(--color-dark); margin-bottom:4px;">今日の運試し・貯金ガチャ</div>
      <svg id="gacha-machine-svg" class="gacha-svg" viewBox="0 0 110 110">
        <!-- 上部の透明ドーム -->
        <circle cx="55" cy="36" r="28" fill="#ffffff" stroke="var(--color-dark)" stroke-width="2.8"/>
        <!-- ドーム内のカラフルカプセル -->
        <circle cx="45" cy="44" r="7" fill="var(--bg-sub)" stroke="var(--color-dark)" stroke-width="1.8"/>
        <circle cx="62" cy="46" r="7.5" fill="var(--color-primary)" stroke="var(--color-dark)" stroke-width="1.8"/>
        <circle cx="53" cy="33" r="6.5" fill="var(--bg-main)" stroke="var(--color-dark)" stroke-width="1.8"/>
        <!-- 本体の土台 -->
        <rect x="31" y="58" width="48" height="42" rx="8" fill="var(--color-primary)" stroke="var(--color-dark)" stroke-width="2.8"/>
        <!-- 取り出し口 -->
        <rect x="42" y="84" width="26" height="12" rx="4" fill="#ffffff" stroke="var(--color-dark)" stroke-width="2"/>
        <!-- 回転ハンドル -->
        <g id="gacha-handle-group">
          <circle cx="55" cy="72" r="8" fill="#ffffff" stroke="var(--color-dark)" stroke-width="2.2"/>
          <line x1="48" y1="72" x2="62" y2="72" stroke="var(--color-dark)" stroke-width="2.8" stroke-linecap="round"/>
        </g>
      </svg>

      <div id="gacha-result-area">
        <button type="button" class="btn" style="padding:8px 20px; font-size:0.85rem;" onclick="spinSavingsGacha()">
          ガチャを回す！（100〜300円）
        </button>
      </div>
    </div>

    <!-- ② コイン型ワンタップ貯金（押すとそのまま貯金箱に落ちる） -->
    <div style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="input-label" style="margin-bottom:0;">コインを選んでワンタップ投入</span>
        <button type="button" class="btn btn-sub" style="padding:4px 10px; font-size:0.72rem;" onclick="openRuleManageModal()">コイン編集</button>
      </div>
      <div class="coin-rules-grid">
        ${coinRulesHtml || '<span style="font-size:0.8rem; color:var(--text-sub);">「コイン編集」から追加できます</span>'}
      </div>
    </div>

    <!-- ③ 自由な金額で貯金 -->
    <div style="border-top:1px solid var(--border-soft); padding-top:12px;">
      <div class="input-group">
        <label class="input-label">好きな金額を入力して貯金（円）</label>
        <input type="number" id="save-amount-input" placeholder="例：1000" inputmode="numeric">
      </div>
      <div class="input-group">
        <label class="input-label">メモ（任意）</label>
        <input type="text" id="save-memo-input" placeholder="例：お小遣いから、ライブ発表記念">
      </div>
      <div class="input-group">
        <label class="input-label">対象の推し・タグ</label>
        <select id="save-target-select">${targetOptions}</select>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">閉じる</button>
        <button type="button" class="btn" style="flex:2;" onclick="submitSaveMoney()">この金額を貯金！</button>
      </div>
    </div>
  `);
}

// ガチャを回す演出＆ランダム抽選（100 / 200 / 300円）
function spinSavingsGacha() {
  const machineEl = document.getElementById('gacha-machine-svg');
  const handleEl = document.getElementById('gacha-handle-group');
  const resultEl = document.getElementById('gacha-result-area');
  if (!machineEl || !resultEl) return;

  // アニメーションリセット＆開始
  machineEl.classList.remove('gacha-shake');
  if (handleEl) handleEl.classList.remove('gacha-handle-spin');
  void machineEl.offsetWidth;
  machineEl.classList.add('gacha-shake');
  if (handleEl) handleEl.classList.add('gacha-handle-spin');

  resultEl.innerHTML = `<span style="font-size:0.85rem; font-weight:700; color:var(--text-sub);">ガチャガチャ…</span>`;

  const choices = [100, 200, 300];
  const picked = choices[Math.floor(Math.random() * choices.length)];
  lastGachaAmount = picked;

  setTimeout(() => {
    resultEl.innerHTML = `
      <div style="margin-top:4px;">
        <span class="tag" style="font-size:0.85rem; padding:5px 14px;">カプセル開封：¥${picked}！</span>
        <div style="margin-top:8px;">
          <button type="button" class="btn" style="padding:8px 20px; font-size:0.85rem;" onclick="confirmGachaSave(${picked})">
            ¥${picked}を貯金箱に入れる！
          </button>
        </div>
      </div>
    `;
  }, 650);
}

// ガチャ結果を貯金箱に投入
function confirmGachaSave(amount) {
  appData.bank.savedAmount += amount;
  appData.bank.records.unshift({
    id: 'rec_' + Date.now(),
    type: 'save',
    amount: amount,
    category: '貯金ガチャ',
    memo: `ガチャ結果（¥${amount}）`,
    targetLabel: getSelectedOshiOrTagLabel(),
    date: getTodayString()
  });

  saveData();
  closeModal();
  bankSubPage = 'main';
  renderBankScreen({ amount: amount }, false);
}

// コイン型マイルールをタップ → そのまま貯金箱に落ちる演出
function dropCoinToPiggy(ruleId) {
  const rule = appData.bank.rules.find(r => r.id === ruleId);
  if (!rule) return;

  const amount = Number(rule.amount);
  appData.bank.savedAmount += amount;
  appData.bank.records.unshift({
    id: 'rec_' + Date.now(),
    type: 'save',
    amount: amount,
    category: 'コイン貯金',
    memo: rule.label,
    targetLabel: getSelectedOshiOrTagLabel(),
    date: getTodayString()
  });

  saveData();
  closeModal();
  bankSubPage = 'main';
  renderBankScreen({ amount: amount }, false);
}

// 自由入力で貯金
function submitSaveMoney() {
  const amountVal = Number(document.getElementById('save-amount-input').value);
  const memoVal = document.getElementById('save-memo-input').value.trim();
  const targetVal = document.getElementById('save-target-select').value;

  if (!amountVal || amountVal <= 0) {
    alert('1円以上の金額を入力してください');
    return;
  }

  appData.bank.savedAmount += amountVal;
  appData.bank.records.unshift({
    id: 'rec_' + Date.now(),
    type: 'save',
    amount: amountVal,
    category: '推し貯金',
    memo: memoVal || '貯金箱へ投入',
    targetLabel: targetVal,
    date: getTodayString()
  });

  saveData();
  closeModal();
  bankSubPage = 'main';
  renderBankScreen({ amount: amountVal }, false);
}

// ------------------------------------------
// 5-5. 「＋出費を記録」＆「目標設定」＆「コイン編集」モーダル
// ------------------------------------------
function openExpenseModal() {
  const targetOptions = buildTargetOptionsHtml();
  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:14px;">推し活の出費を記録</div>
    <div class="input-group">
      <label class="input-label">金額（円）</label>
      <input type="number" id="exp-amount-input" placeholder="例：3500" inputmode="numeric">
    </div>
    <div class="input-group">
      <label class="input-label">カテゴリー</label>
      <select id="exp-category-select">
        <option value="グッズ">グッズ</option>
        <option value="チケット">チケット</option>
        <option value="遠征・交通費">遠征・交通費</option>
        <option value="カフェ・コラボ">カフェ・コラボ</option>
        <option value="CD・円盤・配信">CD・円盤・配信</option>
        <option value="その他">その他</option>
      </select>
    </div>
    <div class="input-group">
      <label class="input-label">対象の推し・タグ</label>
      <select id="exp-target-select">${targetOptions}</select>
    </div>
    <div class="input-group">
      <label class="input-label">メモ・内訳</label>
      <input type="text" id="exp-memo-input" placeholder="例：アクスタ2個、ツアー大阪公演">
    </div>
    <div class="input-group">
      <label class="input-label">日付</label>
      <input type="date" id="exp-date-input" value="${getTodayString()}">
    </div>
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">キャンセル</button>
      <button type="button" class="btn" style="flex:2;" onclick="submitExpense()">記録する</button>
    </div>
  `);
}

function submitExpense() {
  const amountVal = Number(document.getElementById('exp-amount-input').value);
  const categoryVal = document.getElementById('exp-category-select').value;
  const targetVal = document.getElementById('exp-target-select').value;
  const memoVal = document.getElementById('exp-memo-input').value.trim();
  const dateVal = document.getElementById('exp-date-input').value || getTodayString();

  if (!amountVal || amountVal <= 0) {
    alert('1円以上の金額を入力してください');
    return;
  }

  appData.bank.records.unshift({
    id: 'rec_' + Date.now(),
    type: 'expense',
    amount: amountVal,
    category: categoryVal,
    targetLabel: targetVal,
    memo: memoVal || categoryVal,
    date: dateVal
  });

  saveData();
  closeModal();
  renderBankScreen(null, false);
}

function openGoalEditModal() {
  const bank = appData.bank;
  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:14px;">貯金目標の設定</div>
    <div class="input-group">
      <label class="input-label">目標タイトル</label>
      <input type="text" id="goal-title-input" value="${escapeHtml(bank.goalTitle)}" placeholder="例：夏のドームツアー遠征費">
    </div>
    <div class="input-group">
      <label class="input-label">目標金額（円）</label>
      <input type="number" id="goal-amount-input" value="${bank.goalAmount}" inputmode="numeric">
    </div>
    <div class="input-group">
      <label class="input-label">現在の貯金額（直接修正したい場合）</label>
      <input type="number" id="goal-saved-input" value="${bank.savedAmount}" inputmode="numeric">
    </div>
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">閉じる</button>
      <button type="button" class="btn" style="flex:2;" onclick="submitGoalEdit()">保存する</button>
    </div>
  `);
}

function submitGoalEdit() {
  const titleVal = document.getElementById('goal-title-input').value.trim();
  const amountVal = Number(document.getElementById('goal-amount-input').value);
  const savedVal = Number(document.getElementById('goal-saved-input').value);

  appData.bank.goalTitle = titleVal || '次の現場・遠征費';
  appData.bank.goalAmount = amountVal > 0 ? amountVal : 10000;
  appData.bank.savedAmount = savedVal >= 0 ? savedVal : 0;

  saveData();
  closeModal();
  renderBankScreen(null, false);
}

function openRuleManageModal() {
  const listHtml = appData.bank.rules.map(r => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-soft);">
      <div>
        <span style="font-weight:700; font-size:0.9rem;">${escapeHtml(r.label)}</span>
        <span class="accent-number" style="margin-left:8px; font-size:0.85rem;">+¥${Number(r.amount).toLocaleString()}</span>
      </div>
      <button type="button" class="delete-mini-btn" onclick="deleteBankRule('${r.id}')">削除</button>
    </div>
  `).join('');

  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:10px;">ワンタップコインの編集</div>
    <div style="margin-bottom:14px;">${listHtml || '<p style="font-size:0.82rem; color:var(--text-sub);">コインがありません</p>'}</div>
    <div class="input-group">
      <label class="input-label">新しいコインの名前</label>
      <input type="text" id="new-rule-label" placeholder="例：SNS更新、配信リアタイ">
    </div>
    <div class="input-group">
      <label class="input-label">金額（円）</label>
      <input type="number" id="new-rule-amount" placeholder="例：100" inputmode="numeric">
    </div>
    <div style="display:flex; gap:8px; margin-top:14px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="openSaveModal()">← 貯金画面へ</button>
      <button type="button" class="btn" style="flex:2;" onclick="addBankRule()">コインを追加</button>
    </div>
  `);
}

function addBankRule() {
  const label = document.getElementById('new-rule-label').value.trim();
  const amount = Number(document.getElementById('new-rule-amount').value);
  if (!label || !amount || amount <= 0) {
    alert('コイン名と1円以上の金額を入力してください');
    return;
  }
  appData.bank.rules.push({
    id: 'rule_' + Date.now(),
    label: label,
    amount: amount
  });
  saveData();
  openRuleManageModal();
}

function deleteBankRule(ruleId) {
  appData.bank.rules = appData.bank.rules.filter(r => r.id !== ruleId);
  saveData();
  openRuleManageModal();
}

function deleteBankRecord(recId) {
  const target = appData.bank.records.find(r => r.id === recId);
  if (!target) return;
  if (target.type === 'save') {
    appData.bank.savedAmount = Math.max(0, appData.bank.savedAmount - Number(target.amount));
  }
  appData.bank.records = appData.bank.records.filter(r => r.id !== recId);
  saveData();
  renderBankScreen(null, false);
}

// ==========================================
// 6. その他の画面（★次に作り込みます）
// ==========================================
function renderLogScreen() {
  setScreenContent(`
    <h1 class="page-title">ログ</h1>
    <div class="card">
      <div class="card-title">思い出アルバム・参戦記録</div>
      <p style="font-size: 0.9rem; color: var(--text-sub);">
        ここにライブの感想やチケット風思い出カード機能が入ります。
      </p>
    </div>
  `);
}

function renderHomeScreen() {
  setScreenContent(`
    <h1 class="page-title">ホーム</h1>
    <div class="card">
      <div class="card-title">推しルーム</div>
      <p style="font-size: 0.9rem; color: var(--text-sub);">
        ここにカスタムした背景・チェキ配置・情報引き出しボタンが入ります。
      </p>
    </div>
  `);
}

function renderPlanScreen() {
  setScreenContent(`
    <h1 class="page-title">プラン</h1>
    <div class="card">
      <div class="card-title">予定・やることリスト</div>
      <p style="font-size: 0.9rem; color: var(--text-sub);">
        ここに今後のライブ日程やチケット当落、持ち物リスト機能が入ります。
      </p>
    </div>
  `);
}

function renderSystemScreen() {
  setScreenContent(`
    <h1 class="page-title">システム</h1>
    <div class="card">
      <div class="card-title">推し管理・カスタム設定</div>
      <p style="font-size: 0.9rem; color: var(--text-sub);">
        ここに推しの登録・テーマカラー変更・背景＆パーツ配置機能が入ります。
      </p>
    </div>
  `);
}

// ==========================================
// 7. 共通ユーティリティ関数
// ==========================================
function getTodayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildTargetOptionsHtml() {
  let options = `<option value="">指定なし（全体）</option>`;
  const tags = new Set();

  appData.oshis.forEach(oshi => {
    options += `<option value="${escapeHtml(oshi.name)}">推し：${escapeHtml(oshi.name)}</option>`;
    if (oshi.tag) {
      tags.add(oshi.tag);
    }
  });

  tags.forEach(tag => {
    options += `<option value="#${escapeHtml(tag)}">タグ：#${escapeHtml(tag)}</option>`;
  });

  return options;
}

function getSelectedOshiOrTagLabel() {
  if (!appData.selectedOshiId) return '';
  const found = appData.oshis.find(o => o.id === appData.selectedOshiId);
  return found ? found.name : '';
}

// ==========================================
// 8. アプリ起動時の初期処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  applyThemeColor(null, false);
  switchTab('home');
});