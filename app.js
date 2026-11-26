// ==========================================
// 1. アプリ全体のデータ管理（localStorage）
// ==========================================
const STORAGE_KEY = 'oshi_log_data_v1';

const defaultData = {
  currentTab: 'home',       // 現在開いているタブ
  selectedOshiId: null,     // 現在選択中の推しID（nullのときは初期グレージュ）
  oshis: [],                // 推しリスト
  logs: [],                 // ログ（思い出・参戦記録）
  countdowns: [],           // カウントダウン（誕生日・周年・ライブ・推し始め経過日数：ホーム連動対応）
  plans: [],                // カレンダー予定（現場・イベント・参戦服・持ち物チェックリスト）
  planTodos: [],            // 日付未定の推し活やること・ウィッシュリスト
  bank: {                   // バンク（複数貯金箱・コイン・1日1回ガチャ・収支）
    boxes: [],
    activeBoxIndex: 0,
    lastGachaDate: '',
    rules: [
      { id: 'r1', label: 'SNS更新', amount: 100 },
      { id: 'r2', label: 'ビジュが神', amount: 300 },
      { id: 'r3', label: '供給過多', amount: 500 }
    ],
    records: []
  }
};

let appData = loadData();

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const savedBank = parsed.bank || {};
      return {
        ...defaultData,
        ...parsed,
        countdowns: Array.isArray(parsed.countdowns) ? parsed.countdowns : [],
        plans: Array.isArray(parsed.plans) ? parsed.plans : [],
        planTodos: Array.isArray(parsed.planTodos) ? parsed.planTodos : [],
        bank: {
          ...defaultData.bank,
          ...savedBank,
          boxes: Array.isArray(savedBank.boxes) ? savedBank.boxes : [],
          activeBoxIndex: typeof savedBank.activeBoxIndex === 'number' ? savedBank.activeBoxIndex : 0,
          lastGachaDate: savedBank.lastGachaDate || '',
          rules: Array.isArray(savedBank.rules) ? savedBank.rules : defaultData.bank.rules,
          records: Array.isArray(savedBank.records) ? savedBank.records : []
        }
      };
    } catch (e) {
      console.error('データの読み込みに失敗しました', e);
    }
  }
  return JSON.parse(JSON.stringify(defaultData));
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// ==========================================
// 2. テーマカラー連動システム（色相Hの変更）
// ==========================================
function applyThemeColor(hue = null, isCustom = false) {
  const root = document.documentElement;
  if (hue === null || !isCustom) {
    root.style.setProperty('--theme-hue', 30);
    root.style.setProperty('--bg-main', 'hsl(30, 20%, 97%)');
    root.style.setProperty('--bg-sub', 'hsl(30, 25%, 91%)');
    root.style.setProperty('--color-primary', 'hsl(30, 15%, 62%)');
    root.style.setProperty('--color-dark', 'hsl(30, 18%, 45%)');
  } else {
    root.style.setProperty('--theme-hue', hue);
    root.style.setProperty('--bg-main', `hsl(${hue}, 30%, 97%)`);
    root.style.setProperty('--bg-sub', `hsl(${hue}, 45%, 90%)`);
    root.style.setProperty('--color-primary', `hsl(${hue}, 65%, 68%)`);
    root.style.setProperty('--color-dark', `hsl(${hue}, 55%, 45%)`);
  }
}

function syncDefaultThemeColor() {
  if (appData.selectedOshiId) {
    const oshi = appData.oshis.find(o => o.id === appData.selectedOshiId);
    if (oshi && oshi.hue !== undefined) {
      applyThemeColor(oshi.hue, true);
      return;
    }
  }
  applyThemeColor(null, false);
}

function syncBankThemeColor() {
  const boxes = appData.bank.boxes;
  const idx = appData.bank.activeBoxIndex;
  if (idx < boxes.length) {
    const currentBox = boxes[idx];
    if (currentBox && currentBox.oshiId) {
      const oshi = appData.oshis.find(o => o.id === currentBox.oshiId);
      if (oshi && oshi.hue !== undefined) {
        applyThemeColor(oshi.hue, true);
        return;
      }
    }
  }
  syncDefaultThemeColor();
}

// ==========================================
// 3. カスタムセレクト（テーマカラー連動の選択UI）
// ==========================================
const customSelectCallbacks = {};

function renderCustomSelect({ id, options, selectedValue = '', onChange = null, compact = false }) {
  if (onChange) {
    customSelectCallbacks[id] = onChange;
  } else {
    delete customSelectCallbacks[id];
  }

  const activeOpt = options.find(o => String(o.value) === String(selectedValue)) || options[0] || { value: '', label: '' };

  const optionsHtml = options.map(opt => {
    const isSelected = String(opt.value) === String(activeOpt.value);
    return `
      <button type="button"
              class="custom-select-option ${isSelected ? 'selected' : ''}"
              data-value="${escapeHtml(opt.value)}"
              onclick="selectCustomOption('${id}', '${escapeJsString(opt.value)}', '${escapeJsString(opt.label)}')">
        ${escapeHtml(opt.label)}
      </button>
    `;
  }).join('');

  return `
    <div class="custom-select ${compact ? 'compact' : ''}" id="cs-wrap-${id}" data-value="${escapeHtml(activeOpt.value)}">
      <button type="button" class="custom-select-trigger" onclick="toggleCustomSelect('${id}', event)">
        <span class="custom-select-label" id="cs-label-${id}">${escapeHtml(activeOpt.label)}</span>
        <svg class="custom-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="custom-select-menu">
        ${optionsHtml}
      </div>
    </div>
  `;
}

function toggleCustomSelect(id, event) {
  if (event) event.stopPropagation();
  const targetWrap = document.getElementById(`cs-wrap-${id}`);
  if (!targetWrap) return;
  const wasOpen = targetWrap.classList.contains('open');

  document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
  if (!wasOpen) {
    targetWrap.classList.add('open');
  }
}

function selectCustomOption(id, value, label) {
  const wrap = document.getElementById(`cs-wrap-${id}`);
  if (wrap) {
    wrap.setAttribute('data-value', value);
    wrap.classList.remove('open');
    const labelEl = document.getElementById(`cs-label-${id}`);
    if (labelEl) labelEl.textContent = label;
    wrap.querySelectorAll('.custom-select-option').forEach(optBtn => {
      if (optBtn.getAttribute('data-value') === String(value)) {
        optBtn.classList.add('selected');
      } else {
        optBtn.classList.remove('selected');
      }
    });
  }
  if (typeof customSelectCallbacks[id] === 'function') {
    customSelectCallbacks[id](value);
  }
}

function getCustomSelectValue(id) {
  const wrap = document.getElementById(`cs-wrap-${id}`);
  return wrap ? wrap.getAttribute('data-value') : '';
}

document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
});

// ==========================================
// 4. 共通モーダル ＆ 右からスライドする絞り込みドロワー
// ==========================================
const modalEl = document.getElementById('app-modal');

function openModal(htmlContent, customSheetClass = 'modal-sheet', isRightDrawer = false) {
  if (isRightDrawer) {
    modalEl.classList.add('right-drawer-mode');
  } else {
    modalEl.classList.remove('right-drawer-mode');
  }
  modalEl.innerHTML = `<div class="${customSheetClass}">${htmlContent}</div>`;
  modalEl.classList.remove('hidden');
}

function closeModal() {
  modalEl.classList.add('hidden');
  modalEl.classList.remove('right-drawer-mode');
  modalEl.innerHTML = '';
}

modalEl.addEventListener('click', (e) => {
  if (e.target === modalEl) {
    closeModal();
  }
});

// 共通の検索（虫眼鏡）SVGアイコン
function getSearchIconSvg() {
  return `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <line x1="20" y1="20" x2="16.2" y2="16.2"/>
    </svg>
  `;
}

// ==========================================
// 5. 画面描画ルーター（背景固定＋スライドインジケーター）
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
      syncBankThemeColor();
      renderBankScreen({ withFadeIn: true });
      break;
    case 'log':
      syncDefaultThemeColor();
      renderLogScreen();
      break;
    case 'home':
      syncDefaultThemeColor();
      renderHomeScreen();
      break;
    case 'plan':
      syncDefaultThemeColor();
      renderPlanScreen({ withFadeIn: true });
      break;
    case 'system':
      syncDefaultThemeColor();
      renderSystemScreen();
      break;
  }
}

// ==========================================
// 6. バンク画面（複数貯金箱・達成お祝い・コイン飛翔・ガチャ・履歴＆レポート）
// ==========================================
let bankSubPage = 'main';
let historyTypeFilter = 'all';
let historyBoxFilter = 'all';
let historyOshiFilter = 'all';
let historySearchQuery = '';
let reportPeriod = 'month';
let reportBoxFilter = 'all';
let reportOshiFilter = 'all';

function openBankSubPage(pageName) {
  bankSubPage = pageName;
  renderBankScreen({ withFadeIn: true });
}

function renderBankScreen(options = {}) {
  const { withFadeIn = false, bouncePiggy = false, slideDir = null } = options;
  if (bankSubPage === 'history') {
    renderBankHistoryPage(withFadeIn);
    return;
  }
  if (bankSubPage === 'report') {
    renderBankReportPage(withFadeIn);
    return;
  }
  renderBankMainPage({ withFadeIn, bouncePiggy, slideDir });
}

// ------------------------------------------
// 6-1. バンク・メイン画面
// ------------------------------------------
function renderBankMainPage({ withFadeIn = false, bouncePiggy = false, slideDir = null } = {}) {
  const bank = appData.bank;
  const boxes = bank.boxes;
  const totalSlots = boxes.length + 1;
  if (bank.activeBoxIndex < 0) bank.activeBoxIndex = 0;
  if (bank.activeBoxIndex >= totalSlots) bank.activeBoxIndex = totalSlots - 1;

  const isAddSlot = bank.activeBoxIndex === boxes.length;
  const currentBox = isAddSlot ? null : boxes[bank.activeBoxIndex];
  const allBoxesTotal = boxes.reduce((sum, b) => sum + Number(b.savedAmount || 0), 0);

  let slideClass = '';
  if (slideDir === 'next') slideClass = 'piggy-slide-next';
  if (slideDir === 'prev') slideClass = 'piggy-slide-prev';

  const dotsHtml = Array.from({ length: totalSlots }, (_, i) =>
    `<span class="piggy-dot ${i === bank.activeBoxIndex ? 'active' : ''}"></span>`
  ).join('');

  let isGoalCompleted = false;
  let piggyCenterHtml = '';

  if (isAddSlot) {
    piggyCenterHtml = `
      <div style="font-size:0.85rem; font-weight:700; color:var(--text-sub); min-height:20px;">
        ${boxes.length === 0 ? 'まずは最初の貯金箱を作ろう' : '新しい貯金箱を追加'}
      </div>
      <div style="font-size:1.45rem; font-weight:700; color:var(--color-dark); line-height:1.3; margin:2px 0;">
        ＋ 貯金箱をつくる
      </div>
      <div style="min-height:24px;"></div>

      <div class="piggy-carousel-row">
        <button type="button" class="piggy-arrow-btn" ${bank.activeBoxIndex === 0 ? 'disabled' : ''} onclick="slidePiggyBox(-1)">‹</button>
        <div class="piggy-visual-wrap ${slideClass}">
          <svg id="main-piggy-svg" class="piggy-box-svg" viewBox="0 0 180 180" onclick="openBoxCreateOrEditModal(null)">
            <polygon points="34,54 62,38 150,38 122,54" fill="#ffffff" fill-opacity="0.6" stroke="var(--color-primary)" stroke-width="2.8" stroke-dasharray="6 4" stroke-linejoin="round"/>
            <line x1="68" y1="46" x2="114" y2="46" stroke="var(--color-primary)" stroke-width="3.5" stroke-dasharray="5 3" stroke-linecap="round"/>
            <polygon points="122,54 150,38 150,142 122,158" fill="#ffffff" fill-opacity="0.6" stroke="var(--color-primary)" stroke-width="2.8" stroke-dasharray="6 4" stroke-linejoin="round"/>
            <rect x="34" y="54" width="88" height="104" rx="4" fill="#ffffff" fill-opacity="0.8" stroke="var(--color-primary)" stroke-width="2.8" stroke-dasharray="6 4" stroke-linejoin="round"/>
            <circle cx="78" cy="106" r="27" fill="#ffffff" stroke="var(--color-primary)" stroke-width="2.8" stroke-dasharray="5 4"/>
            <line x1="78" y1="95" x2="78" y2="117" stroke="var(--color-dark)" stroke-width="3.5" stroke-linecap="round"/>
            <line x1="67" y1="106" x2="89" y2="106" stroke="var(--color-dark)" stroke-width="3.5" stroke-linecap="round"/>
          </svg>
        </div>
        <button type="button" class="piggy-arrow-btn" disabled>›</button>
      </div>
    `;
  } else {
    const percent = currentBox.goalAmount > 0
      ? Math.min(100, Math.round((currentBox.savedAmount / currentBox.goalAmount) * 100))
      : 0;
    isGoalCompleted = Number(currentBox.savedAmount) >= Number(currentBox.goalAmount) && Number(currentBox.goalAmount) > 0;

    const maxFillHeight = 104;
    const fillHeight = Math.round((maxFillHeight * percent) / 100);
    const frontTopY = 158 - fillHeight;
    const sideTopY = 142 - fillHeight;

    const oshiBadge = currentBox.oshiName
      ? `<span class="tag" style="margin-right:4px;">${escapeHtml(currentBox.oshiName)}</span>`
      : '';

    const congratsHtml = isGoalCompleted
      ? `
        <div class="goal-congrats-banner">
          <span class="goal-congrats-dot"></span>
          <span>目標達成 おめでとうございます</span>
          <span class="goal-congrats-dot"></span>
        </div>
      `
      : '';

    piggyCenterHtml = `
      ${congratsHtml}
      <div style="font-size:0.82rem; font-weight:700; color:var(--text-sub); display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:4px;">
        ${oshiBadge}
        <span>${escapeHtml(currentBox.title)}（目標 ¥${Number(currentBox.goalAmount).toLocaleString()}）</span>
      </div>
      <div style="font-size:1.95rem; font-weight:700; color:var(--color-dark); line-height:1.2; margin:2px 0;">
        ¥${Number(currentBox.savedAmount).toLocaleString()}
      </div>
      <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
        <span class="tag">達成率 ${percent}%</span>
        ${boxes.length > 1 ? `<span style="font-size:0.74rem; font-weight:700; color:var(--text-sub);">全箱合計 ¥${allBoxesTotal.toLocaleString()}</span>` : ''}
      </div>

      <div class="piggy-carousel-row">
        <button type="button" class="piggy-arrow-btn" ${bank.activeBoxIndex === 0 ? 'disabled' : ''} onclick="slidePiggyBox(-1)">‹</button>
        <div class="piggy-visual-wrap ${slideClass}">
          <svg id="main-piggy-svg" class="piggy-box-svg ${bouncePiggy ? 'piggy-bounce' : ''}" viewBox="0 0 180 180" onclick="${isGoalCompleted ? 'openUsePiggyBoxModal()' : 'openSaveDrawer()'}">
            <polygon points="34,54 62,38 150,38 122,54" fill="var(--bg-sub)" stroke="var(--color-dark)" stroke-width="3.2" stroke-linejoin="round"/>
            <line x1="68" y1="46" x2="114" y2="46" stroke="var(--color-dark)" stroke-width="4.5" stroke-linecap="round"/>

            <polygon points="122,54 150,38 150,142 122,158" fill="#ffffff"/>
            ${fillHeight > 0 ? `<polygon points="122,${frontTopY} 150,${sideTopY} 150,142 122,158" fill="var(--bg-sub)"/>` : ''}
            <polygon points="122,54 150,38 150,142 122,158" fill="none" stroke="var(--color-dark)" stroke-width="3.2" stroke-linejoin="round"/>

            <rect x="34" y="54" width="88" height="104" rx="4" fill="#ffffff"/>
            ${fillHeight > 0 ? `<rect x="34" y="${frontTopY}" width="88" height="${fillHeight}" fill="var(--bg-sub)"/>` : ''}
            <rect x="34" y="54" width="88" height="104" rx="4" fill="none" stroke="var(--color-dark)" stroke-width="3.2" stroke-linejoin="round"/>

            <circle cx="78" cy="106" r="27" fill="#ffffff" stroke="var(--color-primary)" stroke-width="3.5"/>
            <circle cx="78" cy="106" r="20" fill="none" stroke="var(--color-primary)" stroke-width="1.5" stroke-dasharray="3 2"/>
            <line x1="78" y1="95" x2="78" y2="117" stroke="var(--color-dark)" stroke-width="3.8" stroke-linecap="round"/>
          </svg>
        </div>
        <button type="button" class="piggy-arrow-btn" ${bank.activeBoxIndex === totalSlots - 1 ? 'disabled' : ''} onclick="slidePiggyBox(1)">›</button>
      </div>
    `;
  }

  let primaryActionBtnHtml = '';
  if (isAddSlot) {
    primaryActionBtnHtml = `
      <button type="button" class="btn" style="flex:1.25; padding:12px 16px; font-size:0.95rem;" onclick="openBoxCreateOrEditModal(null)">
        貯金箱をつくる
      </button>
    `;
  } else if (isGoalCompleted) {
    primaryActionBtnHtml = `
      <button type="button" class="btn" style="flex:1.35; padding:12px 16px; font-size:0.95rem; background-color:var(--color-dark);" onclick="openUsePiggyBoxModal()">
        貯金箱を使う
      </button>
    `;
  } else {
    primaryActionBtnHtml = `
      <button type="button" class="btn" style="flex:1.25; padding:12px 16px; font-size:0.95rem;" onclick="openSaveDrawer()">
        貯金する
      </button>
    `;
  }

  const recent3 = bank.records.slice(0, 3);
  const recentListHtml = recent3.length > 0
    ? recent3.map(rec => {
        const isSave = rec.type === 'save';
        const sign = isSave ? '+' : '-';
        const amountClass = isSave ? 'record-amount-plus' : 'record-amount-minus';
        const badgeText = isSave ? (rec.boxTitle || '貯金') : (rec.category || '出費');
        return `
          <div class="bank-record-item">
            <div style="flex:1; min-width:0; padding-right:8px;">
              <div style="display:flex; align-items:center; gap:5px; margin-bottom:2px;">
                <span class="tag" style="font-size:0.7rem;">${escapeHtml(badgeText)}</span>
                ${rec.targetLabel ? `<span style="font-size:0.72rem; font-weight:700; color:var(--color-dark);">${escapeHtml(rec.targetLabel)}</span>` : ''}
                <span style="font-size:0.72rem; color:var(--text-sub);">${escapeHtml(rec.date || '')}</span>
              </div>
              <div style="font-size:0.86rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(rec.memo || badgeText)}
              </div>
            </div>
            <span class="${amountClass}">${sign}¥${Number(rec.amount).toLocaleString()}</span>
          </div>
        `;
      }).join('')
    : `<p style="font-size:0.82rem; color:var(--text-sub); text-align:center; padding:12px 0;">まだ記録がありません</p>`;

  const html = `
    <div class="page-title">
      <span>バンク</span>
      ${!isAddSlot ? `<button type="button" class="btn btn-sub page-title-right" style="padding:5px 12px; font-size:0.75rem;" onclick="openBoxCreateOrEditModal('${currentBox.id}')">目標</button>` : ''}
    </div>

    <div class="piggy-hero-stage">
      ${piggyCenterHtml}
      <div class="piggy-dots">${dotsHtml}</div>

      <div style="display:flex; gap:10px; width:100%; max-width:340px;">
        ${primaryActionBtnHtml}
        <button type="button" class="btn btn-sub" style="flex:1; padding:12px 14px; font-size:0.9rem;" onclick="openExpenseModal()">
          ＋出費
        </button>
      </div>
    </div>

    <button type="button" class="report-banner-card" onclick="openBankSubPage('report')">
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="tag">分析</span>
        <div>
          <div style="font-size:0.92rem; font-weight:700; color:var(--text-main);">レポート</div>
          <div style="font-size:0.74rem; color:var(--text-sub);">今月・年間・推し別の収支グラフ</div>
        </div>
      </div>
      <span style="font-size:1.1rem; font-weight:700; color:var(--color-dark);">›</span>
    </button>

    <div class="card" style="margin-bottom:0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span class="card-title" style="margin-bottom:0;">きろく履歴</span>
        <button type="button" class="btn btn-sub" style="padding:4px 12px; font-size:0.75rem;" onclick="openBankSubPage('history')">
          もっとみる →
        </button>
      </div>
      ${recentListHtml}
    </div>
  `;

  if (withFadeIn) {
    setScreenContent(html);
  } else {
    mainEl.innerHTML = `<div>${html}</div>`;
  }
}

function slidePiggyBox(delta) {
  const totalSlots = appData.bank.boxes.length + 1;
  const nextIndex = appData.bank.activeBoxIndex + delta;
  if (nextIndex < 0 || nextIndex >= totalSlots) return;

  appData.bank.activeBoxIndex = nextIndex;
  saveData();
  syncBankThemeColor();
  renderBankScreen({ slideDir: delta > 0 ? 'next' : 'prev' });
}

// ------------------------------------------
// 6-2. 貯金箱を使うモーダル（目標達成時）
// ------------------------------------------
function openUsePiggyBoxModal() {
  const currentBox = appData.bank.boxes[appData.bank.activeBoxIndex];
  if (!currentBox) return;

  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:6px;">貯金箱を使う</div>
    <p style="font-size:0.82rem; color:var(--text-sub); text-align:center; margin-bottom:14px;">
      「${escapeHtml(currentBox.title)}」に ¥${Number(currentBox.savedAmount).toLocaleString()} 貯まっています
    </p>

    <div style="background-color:var(--bg-main); border-radius:16px; padding:14px; margin-bottom:12px;">
      <div style="font-size:0.88rem; font-weight:700; color:var(--color-dark); margin-bottom:4px;">
        全額使ってこの貯金箱を完了する
      </div>
      <p style="font-size:0.76rem; color:var(--text-sub); margin-bottom:10px;">
        出費履歴に記録したあと、この貯金箱はリストから完了（削除）されます。
      </p>
      <button type="button" class="btn btn-block" onclick="completeAndUseAllPiggyBox()">
        ¥${Number(currentBox.savedAmount).toLocaleString()} をすべて使う
      </button>
    </div>

    <div style="text-align:center; margin-top:10px;">
      <button type="button" class="btn btn-sub" style="padding:8px 18px; font-size:0.82rem;" onclick="closeModal(); openSaveDrawer();">
        まだ貯金を続ける
      </button>
    </div>
  `);
}

function completeAndUseAllPiggyBox() {
  const currentBox = appData.bank.boxes[appData.bank.activeBoxIndex];
  if (!currentBox) return;

  const usedAmount = Number(currentBox.savedAmount || 0);
  if (usedAmount > 0) {
    appData.bank.records.unshift({
      id: 'rec_' + Date.now(),
      type: 'expense',
      amount: usedAmount,
      category: '貯金達成・使用',
      memo: `${currentBox.title} を使用`,
      boxId: currentBox.id,
      boxTitle: currentBox.title,
      targetLabel: currentBox.oshiName || '',
      date: getTodayString()
    });
  }

  appData.bank.boxes = appData.bank.boxes.filter(b => b.id !== currentBox.id);
  appData.bank.activeBoxIndex = Math.max(0, appData.bank.boxes.length - 1);

  saveData();
  syncBankThemeColor();
  closeModal();
  renderBankScreen({ withFadeIn: false });
}

// ------------------------------------------
// 6-3. 貯金箱の作成・編集・削除モーダル
// ------------------------------------------
function openBoxCreateOrEditModal(boxId = null) {
  const isEdit = Boolean(boxId);
  const targetBox = isEdit ? appData.bank.boxes.find(b => b.id === boxId) : null;

  const oshiOptions = [
    { value: '', label: '指定なし（全体・現在のテーマ色）' },
    ...appData.oshis.map(o => ({ value: o.id, label: o.name }))
  ];

  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:14px;">
      ${isEdit ? '貯金箱の目標・設定' : '新しい貯金箱をつくる'}
    </div>
    <div class="input-group">
      <label class="input-label">貯金箱の名前（目的）</label>
      <input type="text" id="box-title-input" value="${targetBox ? escapeHtml(targetBox.title) : ''}" placeholder="例：夏のツアー遠征費、推し生誕祭">
    </div>
    <div class="input-group">
      <label class="input-label">目標金額（円）</label>
      <input type="number" id="box-goal-input" value="${targetBox ? targetBox.goalAmount : 30000}" inputmode="numeric">
    </div>
    <div class="input-group">
      <label class="input-label">紐づける推し（テーマカラー連動）</label>
      ${renderCustomSelect({
        id: 'box-oshi-select',
        options: oshiOptions,
        selectedValue: targetBox && targetBox.oshiId ? targetBox.oshiId : ''
      })}
    </div>
    ${isEdit ? `
      <div class="input-group">
        <label class="input-label">現在の貯金額（直接修正する場合）</label>
        <input type="number" id="box-saved-input" value="${targetBox.savedAmount}" inputmode="numeric">
      </div>
    ` : ''}
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">閉じる</button>
      <button type="button" class="btn" style="flex:2;" onclick="submitBoxForm('${boxId || ''}')">
        ${isEdit ? '保存する' : 'この貯金箱をつくる'}
      </button>
    </div>
    ${isEdit ? `
      <div style="text-align:center; margin-top:14px;">
        <button type="button" class="delete-mini-btn" style="color:#c96a6a;" onclick="deletePiggyBox('${boxId}')">この貯金箱を削除する</button>
      </div>
    ` : ''}
  `);
}

function submitBoxForm(boxId) {
  const titleVal = document.getElementById('box-title-input').value.trim();
  const goalVal = Number(document.getElementById('box-goal-input').value);
  const oshiIdVal = getCustomSelectValue('box-oshi-select') || null;
  const foundOshi = oshiIdVal ? appData.oshis.find(o => o.id === oshiIdVal) : null;

  if (!titleVal) {
    alert('貯金箱の名前を入力してください');
    return;
  }

  if (boxId) {
    const box = appData.bank.boxes.find(b => b.id === boxId);
    if (box) {
      const savedVal = Number(document.getElementById('box-saved-input').value);
      box.title = titleVal;
      box.goalAmount = goalVal > 0 ? goalVal : 10000;
      box.savedAmount = savedVal >= 0 ? savedVal : 0;
      box.oshiId = oshiIdVal;
      box.oshiName = foundOshi ? foundOshi.name : '';
    }
  } else {
    appData.bank.boxes.push({
      id: 'box_' + Date.now(),
      title: titleVal,
      goalAmount: goalVal > 0 ? goalVal : 10000,
      savedAmount: 0,
      oshiId: oshiIdVal,
      oshiName: foundOshi ? foundOshi.name : ''
    });
    appData.bank.activeBoxIndex = appData.bank.boxes.length - 1;
  }

  saveData();
  syncBankThemeColor();
  closeModal();
  renderBankScreen({ withFadeIn: false });
}

function deletePiggyBox(boxId) {
  appData.bank.boxes = appData.bank.boxes.filter(b => b.id !== boxId);
  appData.bank.activeBoxIndex = Math.max(0, appData.bank.boxes.length - 1);
  saveData();
  syncBankThemeColor();
  closeModal();
  renderBankScreen({ withFadeIn: false });
}

// ------------------------------------------
// 6-4. 貯金引き出しパネル
// ------------------------------------------
function openSaveDrawer() {
  const boxes = appData.bank.boxes;
  const currentBox = boxes[appData.bank.activeBoxIndex];
  if (!currentBox) {
    openBoxCreateOrEditModal(null);
    return;
  }

  const visibleRules = appData.bank.rules.slice(0, 3);
  const coinButtonsHtml = visibleRules.map(rule => `
    <button type="button" class="coin-item-col" id="coin-btn-${rule.id}" onclick="launchCoinToPiggy('${rule.id}', this)">
      <svg class="coin-svg-circle" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="#ffffff" stroke="var(--color-primary)" stroke-width="3.5"/>
        <circle cx="32" cy="32" r="21" fill="var(--bg-main)" stroke="var(--color-primary)" stroke-width="1.5" stroke-dasharray="3 2"/>
        <line x1="32" y1="21" x2="32" y2="43" stroke="var(--color-dark)" stroke-width="3.8" stroke-linecap="round"/>
      </svg>
      <span class="coin-below-amount">+${Number(rule.amount).toLocaleString()}円</span>
      <span class="coin-below-label">${escapeHtml(rule.label)}</span>
    </button>
  `).join('');

  const editPlusCoinHtml = `
    <button type="button" class="coin-item-col" onclick="openCoinEditAndCustomModal()">
      <svg class="coin-svg-circle" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="#ffffff" stroke="var(--color-primary)" stroke-width="2.8" stroke-dasharray="5 4"/>
        <line x1="32" y1="22" x2="32" y2="42" stroke="var(--color-dark)" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="22" y1="32" x2="42" y2="32" stroke="var(--color-dark)" stroke-width="3.2" stroke-linecap="round"/>
      </svg>
      <span class="coin-below-amount">＋</span>
      <span class="coin-below-label">コイン編集<br>その他貯金</span>
    </button>
  `;

  const today = getTodayString();
  const isGachaDoneToday = appData.bank.lastGachaDate === today;

  const gachaSectionHtml = isGachaDoneToday
    ? `
      <button type="button" class="btn btn-sub" style="padding:10px 24px;" disabled>
        本日のガチャ終了（また明日）
      </button>
      <div style="font-size:0.74rem; color:var(--text-sub); margin-top:6px;">
        貯金ガチャは1日1回まで回せます
      </div>
    `
    : `
      <button type="button" class="btn" style="padding:11px 32px; font-size:0.95rem;" onclick="revealAndSpinGacha()">
        ガチャ
      </button>
    `;

  openModal(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <span class="tag">${escapeHtml(currentBox.title)}へ投入</span>
      <button type="button" class="delete-mini-btn" style="font-size:1rem;" onclick="closeModal()">✕</button>
    </div>

    <div class="coin-row-4">
      ${coinButtonsHtml}
      ${editPlusCoinHtml}
    </div>

    <div class="gacha-divider-area" id="gacha-drawer-area">
      ${gachaSectionHtml}
    </div>
  `, 'save-drawer-sheet');
}

function launchCoinToPiggy(ruleId, btnEl) {
  const rule = appData.bank.rules.find(r => r.id === ruleId);
  const currentBox = appData.bank.boxes[appData.bank.activeBoxIndex];
  const piggySvg = document.getElementById('main-piggy-svg');
  if (!rule || !currentBox) return;

  const coinCircle = btnEl ? btnEl.querySelector('.coin-svg-circle') : null;
  const startRect = coinCircle ? coinCircle.getBoundingClientRect() : null;
  const targetRect = piggySvg ? piggySvg.getBoundingClientRect() : null;

  const amount = Number(rule.amount);
  currentBox.savedAmount = Number(currentBox.savedAmount || 0) + amount;
  appData.bank.records.unshift({
    id: 'rec_' + Date.now(),
    type: 'save',
    amount: amount,
    category: 'ワンタップ貯金',
    memo: rule.label,
    boxId: currentBox.id,
    boxTitle: currentBox.title,
    targetLabel: currentBox.oshiName || getSelectedOshiOrTagLabel(),
    date: getTodayString()
  });
  saveData();

  closeModal();

  if (startRect && targetRect) {
    const flyer = document.createElement('div');
    flyer.className = 'flying-coin-el';
    flyer.style.left = `${startRect.left + startRect.width / 2 - 29}px`;
    flyer.style.top = `${startRect.top + startRect.height / 2 - 29}px`;
    flyer.innerHTML = `
      <svg viewBox="0 0 64 64" width="58" height="58">
        <circle cx="32" cy="32" r="28" fill="#ffffff" stroke="var(--color-primary)" stroke-width="4"/>
        <circle cx="32" cy="32" r="21" fill="var(--bg-sub)" stroke="var(--color-primary)" stroke-width="1.5"/>
        <line x1="32" y1="21" x2="32" y2="43" stroke="var(--color-dark)" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `;
    document.body.appendChild(flyer);

    const goalX = (targetRect.left + targetRect.width / 2) - (startRect.left + startRect.width / 2);
    const goalY = (targetRect.top + targetRect.height * 0.26) - (startRect.top + startRect.height / 2);

    requestAnimationFrame(() => {
      flyer.style.transform = `translate(${goalX}px, ${goalY}px) scale(0.45)`;
      flyer.style.opacity = '0.15';
    });

    setTimeout(() => {
      flyer.remove();
      renderBankScreen({ bouncePiggy: true });
    }, 500);
  } else {
    renderBankScreen({ bouncePiggy: true });
  }
}

// ------------------------------------------
// 6-5. 1日1回限定ガチャ
// ------------------------------------------
function revealAndSpinGacha() {
  const area = document.getElementById('gacha-drawer-area');
  if (!area) return;

  const today = getTodayString();
  if (appData.bank.lastGachaDate === today) return;

  appData.bank.lastGachaDate = today;
  saveData();

  const choices = [100, 200, 300];
  const picked = choices[Math.floor(Math.random() * choices.length)];

  area.innerHTML = `
    <div style="font-size:0.8rem; font-weight:700; color:var(--color-dark);">今日の貯金ガチャ回転中…</div>
    <svg id="gacha-machine-svg" class="gacha-svg gacha-shake" viewBox="0 0 110 110">
      <circle cx="55" cy="36" r="28" fill="#ffffff" stroke="var(--color-dark)" stroke-width="2.8"/>
      <circle cx="45" cy="44" r="7" fill="var(--bg-sub)" stroke="var(--color-dark)" stroke-width="1.8"/>
      <circle cx="62" cy="46" r="7.5" fill="var(--color-primary)" stroke="var(--color-dark)" stroke-width="1.8"/>
      <circle cx="53" cy="33" r="6.5" fill="var(--bg-main)" stroke="var(--color-dark)" stroke-width="1.8"/>
      <rect x="31" y="58" width="48" height="42" rx="8" fill="var(--color-primary)" stroke="var(--color-dark)" stroke-width="2.8"/>
      <rect x="42" y="84" width="26" height="12" rx="4" fill="#ffffff" stroke="var(--color-dark)" stroke-width="2"/>
      <g class="gacha-handle-spin">
        <circle cx="55" cy="72" r="8" fill="#ffffff" stroke="var(--color-dark)" stroke-width="2.2"/>
        <line x1="48" y1="72" x2="62" y2="72" stroke="var(--color-dark)" stroke-width="2.8" stroke-linecap="round"/>
      </g>
    </svg>
    <div id="gacha-cap-result" style="font-size:0.85rem; font-weight:700; color:var(--text-sub);">ガチャガチャ…</div>
  `;

  setTimeout(() => {
    const resEl = document.getElementById('gacha-cap-result');
    if (resEl) {
      resEl.innerHTML = `
        <div style="margin-bottom:8px;">
          <span class="tag" style="font-size:0.9rem; padding:5px 14px;">カプセル開封：+${picked}円</span>
        </div>
        <button type="button" class="btn" style="padding:9px 22px;" onclick="putGachaCoinInPiggy(${picked})">
          ${picked}円を貯金箱に入れる
        </button>
      `;
    }
  }, 680);
}

function putGachaCoinInPiggy(amount) {
  const currentBox = appData.bank.boxes[appData.bank.activeBoxIndex];
  if (!currentBox) return;

  currentBox.savedAmount = Number(currentBox.savedAmount || 0) + amount;
  appData.bank.records.unshift({
    id: 'rec_' + Date.now(),
    type: 'save',
    amount: amount,
    category: '貯金ガチャ',
    memo: `今日の貯金ガチャ（+${amount}円）`,
    boxId: currentBox.id,
    boxTitle: currentBox.title,
    targetLabel: currentBox.oshiName || getSelectedOshiOrTagLabel(),
    date: getTodayString()
  });

  saveData();
  closeModal();
  renderBankScreen({ bouncePiggy: true });
}

// ------------------------------------------
// 6-6. 点線「＋」コイン画面
// ------------------------------------------
function openCoinEditAndCustomModal() {
  const currentBox = appData.bank.boxes[appData.bank.activeBoxIndex];
  const rulesListHtml = appData.bank.rules.map(r => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-soft);">
      <div>
        <span style="font-weight:700; font-size:0.88rem;">${escapeHtml(r.label)}</span>
        <span class="accent-number" style="margin-left:8px; font-size:0.84rem;">+${Number(r.amount).toLocaleString()}円</span>
      </div>
      <button type="button" class="delete-mini-btn" onclick="deleteBankRule('${r.id}')">削除</button>
    </div>
  `).join('');

  openModal(`
    <div class="card-title" style="font-size:1.05rem; text-align:center; margin-bottom:12px;">その他貯金 ＆ コイン編集</div>

    <div style="background-color:var(--bg-main); border-radius:16px; padding:12px; margin-bottom:16px;">
      <div style="font-size:0.85rem; font-weight:700; color:var(--color-dark); margin-bottom:8px;">
        好きな金額で貯金（${currentBox ? escapeHtml(currentBox.title) : ''}）
      </div>
      <div class="input-group">
        <label class="input-label">金額（円）</label>
        <input type="number" id="custom-save-amount" placeholder="例：1000" inputmode="numeric">
      </div>
      <div class="input-group" style="margin-bottom:8px;">
        <label class="input-label">メモ（任意）</label>
        <input type="text" id="custom-save-memo" placeholder="例：お小遣いから、ライブ当選祝い">
      </div>
      <button type="button" class="btn btn-block" onclick="submitCustomSave()">この金額を貯金箱へ入れる</button>
    </div>

    <div>
      <div style="font-size:0.85rem; font-weight:700; color:var(--color-dark); margin-bottom:6px;">
        ワンタップコインの編集（最大3個表示）
      </div>
      <div style="margin-bottom:10px;">
        ${rulesListHtml || '<p style="font-size:0.8rem; color:var(--text-sub);">コインがありません</p>'}
      </div>
      ${appData.bank.rules.length < 3 ? `
        <div style="display:flex; gap:6px; margin-bottom:8px;">
          <input type="text" id="new-coin-label" placeholder="名前（例：SNS更新）" style="flex:1.4;">
          <input type="number" id="new-coin-amount" placeholder="金額" inputmode="numeric" style="flex:1;">
        </div>
        <button type="button" class="btn btn-sub btn-block" onclick="addBankRule()">＋ コインを追加</button>
      ` : `<p style="font-size:0.75rem; color:var(--text-sub); text-align:center;">※コインは3個まで登録できます（入れ替える場合は一度削除してください）</p>`}
    </div>

    <div style="margin-top:14px;">
      <button type="button" class="btn btn-sub btn-block" onclick="openSaveDrawer()">← 貯金パネルにもどる</button>
    </div>
  `);
}

function submitCustomSave() {
  const amountVal = Number(document.getElementById('custom-save-amount').value);
  const memoVal = document.getElementById('custom-save-memo').value.trim();
  const currentBox = appData.bank.boxes[appData.bank.activeBoxIndex];

  if (!currentBox) return;
  if (!amountVal || amountVal <= 0) {
    alert('1円以上の金額を入力してください');
    return;
  }

  currentBox.savedAmount = Number(currentBox.savedAmount || 0) + amountVal;
  appData.bank.records.unshift({
    id: 'rec_' + Date.now(),
    type: 'save',
    amount: amountVal,
    category: 'その他貯金',
    memo: memoVal || '貯金箱へ投入',
    boxId: currentBox.id,
    boxTitle: currentBox.title,
    targetLabel: currentBox.oshiName || getSelectedOshiOrTagLabel(),
    date: getTodayString()
  });

  saveData();
  closeModal();
  renderBankScreen({ bouncePiggy: true });
}

function addBankRule() {
  const label = document.getElementById('new-coin-label').value.trim();
  const amount = Number(document.getElementById('new-coin-amount').value);
  if (!label || !amount || amount <= 0) {
    alert('コインの名前と1円以上の金額を入力してください');
    return;
  }
  appData.bank.rules.push({
    id: 'r_' + Date.now(),
    label: label,
    amount: amount
  });
  saveData();
  openCoinEditAndCustomModal();
}

function deleteBankRule(ruleId) {
  appData.bank.rules = appData.bank.rules.filter(r => r.id !== ruleId);
  saveData();
  openCoinEditAndCustomModal();
}

// ------------------------------------------
// 6-7. 「＋出費」モーダル（プラン画面からの連携引継ぎにも対応）
// ------------------------------------------
function openExpenseModal(prefill = {}) {
  const categoryOptions = [
    { value: 'グッズ', label: 'グッズ' },
    { value: 'チケット', label: 'チケット' },
    { value: '遠征・交通費', label: '遠征・交通費' },
    { value: 'カフェ・コラボ', label: 'カフェ・コラボ' },
    { value: 'CD・円盤・配信', label: 'CD・円盤・配信' },
    { value: 'その他', label: 'その他' }
  ];

  const availableBoxes = appData.bank.boxes.filter(b => Number(b.savedAmount || 0) > 0);
  const boxUseOptions = [
    { value: '', label: '貯金箱からは使わない（通常の出費）' },
    ...availableBoxes.map(b => ({
      value: b.id,
      label: `${b.title} から使う（残高 ¥${Number(b.savedAmount).toLocaleString()}）`
    }))
  ];

  const targetOptions = buildTargetOptionsArray();

  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:14px;">推し活の出費を記録</div>
    <div class="input-group">
      <label class="input-label">金額（円）</label>
      <input type="number" id="exp-amount-input" value="${prefill.amount || ''}" placeholder="例：3500" inputmode="numeric">
    </div>
    <div class="input-group">
      <label class="input-label">貯金箱から使う（任意・達成途中でも可）</label>
      ${renderCustomSelect({
        id: 'exp-use-box-select',
        options: boxUseOptions,
        selectedValue: ''
      })}
    </div>
    <div class="input-group">
      <label class="input-label">カテゴリー</label>
      ${renderCustomSelect({
        id: 'exp-category-select',
        options: categoryOptions,
        selectedValue: prefill.category || 'グッズ'
      })}
    </div>
    <div class="input-group">
      <label class="input-label">対象の推し・タグ</label>
      ${renderCustomSelect({
        id: 'exp-target-select',
        options: targetOptions,
        selectedValue: prefill.targetLabel || ''
      })}
    </div>
    <div class="input-group">
      <label class="input-label">メモ・内訳</label>
      <input type="text" id="exp-memo-input" value="${prefill.memo ? escapeHtml(prefill.memo) : ''}" placeholder="例：アクスタ2個、ツアー大阪公演">
    </div>
    <div class="input-group">
      <label class="input-label">日付</label>
      <input type="date" id="exp-date-input" value="${prefill.date || getTodayString()}">
    </div>
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">キャンセル</button>
      <button type="button" class="btn" style="flex:2;" onclick="submitExpense()">記録する</button>
    </div>
  `);
}

function submitExpense() {
  const amountVal = Number(document.getElementById('exp-amount-input').value);
  const useBoxId = getCustomSelectValue('exp-use-box-select');
  const categoryVal = getCustomSelectValue('exp-category-select') || 'グッズ';
  let targetVal = getCustomSelectValue('exp-target-select');
  const memoVal = document.getElementById('exp-memo-input').value.trim();
  const dateVal = document.getElementById('exp-date-input').value || getTodayString();

  if (!amountVal || amountVal <= 0) {
    alert('1円以上の金額を入力してください');
    return;
  }

  let usedBoxTitle = '';
  if (useBoxId) {
    const box = appData.bank.boxes.find(b => b.id === useBoxId);
    if (box) {
      if (amountVal > Number(box.savedAmount || 0)) {
        alert(`「${box.title}」の残高（¥${Number(box.savedAmount).toLocaleString()}）を超えています`);
        return;
      }
      box.savedAmount = Math.max(0, Number(box.savedAmount || 0) - amountVal);
      usedBoxTitle = box.title;
      if (!targetVal && box.oshiName) {
        targetVal = box.oshiName;
      }
    }
  }

  const defaultMemo = usedBoxTitle ? `${categoryVal}（${usedBoxTitle}から使用）` : categoryVal;

  appData.bank.records.unshift({
    id: 'rec_' + Date.now(),
    type: 'expense',
    amount: amountVal,
    category: categoryVal,
    boxId: useBoxId || '',
    boxTitle: usedBoxTitle,
    targetLabel: targetVal,
    memo: memoVal || defaultMemo,
    date: dateVal
  });

  saveData();
  closeModal();
  if (appData.currentTab === 'bank') {
    renderBankScreen({ withFadeIn: false });
  }
}

// ------------------------------------------
// 6-8. 別ページ①：「きろく履歴」（検索アイコン＆右スライド絞り込み対応）
// ------------------------------------------
function buildFilteredHistoryHtml() {
  const q = historySearchQuery.toLowerCase();

  const filtered = appData.bank.records.filter(r => {
    if (historyTypeFilter !== 'all' && r.type !== historyTypeFilter) return false;
    if (historyBoxFilter !== 'all' && r.boxId !== historyBoxFilter) return false;
    if (historyOshiFilter !== 'all' && (r.targetLabel || '') !== historyOshiFilter) return false;
    if (q) {
      const hay = `${r.memo || ''} ${r.category || ''} ${r.boxTitle || ''} ${r.targetLabel || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return `<p style="font-size:0.85rem; color:var(--text-sub); text-align:center; padding:24px 0;">条件に合う記録がありません</p>`;
  }

  return filtered.map(rec => {
    const isSave = rec.type === 'save';
    const sign = isSave ? '+' : '-';
    const amountClass = isSave ? 'record-amount-plus' : 'record-amount-minus';
    return `
      <div class="bank-record-item">
        <div style="flex:1; min-width:0; padding-right:8px;">
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:2px;">
            <span class="tag">${escapeHtml(rec.category || (isSave ? '貯金' : '出費'))}</span>
            ${rec.boxTitle ? `<span class="tag" style="font-size:0.68rem;">${escapeHtml(rec.boxTitle)}</span>` : ''}
            ${rec.targetLabel ? `<span class="tag" style="font-size:0.68rem;">${escapeHtml(rec.targetLabel)}</span>` : ''}
            <span style="font-size:0.74rem; color:var(--text-sub);">${escapeHtml(rec.date || '')}</span>
          </div>
          <div style="font-size:0.88rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(rec.memo || '')}
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
  const hasActiveFilter = historySearchQuery || historyTypeFilter !== 'all' || historyBoxFilter !== 'all' || historyOshiFilter !== 'all';

  const html = `
    <div class="page-title">
      <button type="button" class="btn btn-sub page-title-left" style="padding:5px 12px; font-size:0.78rem;" onclick="openBankSubPage('main')">← もどる</button>
      <span>きろく履歴</span>
      <button type="button" class="icon-circle-btn page-title-right ${hasActiveFilter ? 'has-filter' : ''}" onclick="openHistoryRightFilterDrawer()" title="検索・絞り込み">
        ${getSearchIconSvg()}
      </button>
    </div>

    ${hasActiveFilter ? `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; padding:0 4px;">
        <span style="font-size:0.76rem; color:var(--color-dark); font-weight:700;">絞り込み適用中</span>
        <button type="button" class="btn btn-sub" style="padding:3px 10px; font-size:0.72rem;" onclick="resetHistoryFilters()">解除</button>
      </div>
    ` : ''}

    <div class="card">
      <div id="filtered-history-list">${buildFilteredHistoryHtml()}</div>
    </div>
  `;

  if (withFadeIn) {
    setScreenContent(html);
  } else {
    mainEl.innerHTML = `<div>${html}</div>`;
  }
}

function openHistoryRightFilterDrawer() {
  const boxOptions = [
    { value: 'all', label: 'すべての貯金箱' },
    ...appData.bank.boxes.map(b => ({ value: b.id, label: b.title }))
  ];

  const oshiLabels = new Set();
  appData.oshis.forEach(o => oshiLabels.add(o.name));
  appData.bank.records.forEach(r => { if (r.targetLabel) oshiLabels.add(r.targetLabel); });

  const oshiOptions = [
    { value: 'all', label: 'すべての推し・タグ' },
    ...Array.from(oshiLabels).map(lbl => ({ value: lbl, label: lbl }))
  ];

  openModal(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <span class="card-title" style="margin-bottom:0; font-size:1.05rem;">検索・絞り込み</span>
      <button type="button" class="delete-mini-btn" style="font-size:1rem;" onclick="closeModal()">✕</button>
    </div>

    <div class="input-group">
      <label class="input-label">キーワード検索</label>
      <input type="search" id="drawer-hist-search" value="${escapeHtml(historySearchQuery)}" placeholder="メモ・カテゴリー・貯金箱名">
    </div>

    <div class="input-group">
      <label class="input-label">記録の種別</label>
      ${renderCustomSelect({
        id: 'drawer-hist-type',
        options: [
          { value: 'all', label: 'すべて（貯金・出費）' },
          { value: 'save', label: '貯金のみ' },
          { value: 'expense', label: '出費のみ' }
        ],
        selectedValue: historyTypeFilter
      })}
    </div>

    <div class="input-group">
      <label class="input-label">貯金箱で絞り込み</label>
      ${renderCustomSelect({
        id: 'drawer-hist-box',
        options: boxOptions,
        selectedValue: historyBoxFilter
      })}
    </div>

    <div class="input-group">
      <label class="input-label">推し・タグで絞り込み</label>
      ${renderCustomSelect({
        id: 'drawer-hist-oshi',
        options: oshiOptions,
        selectedValue: historyOshiFilter
      })}
    </div>

    <div style="margin-top:auto; display:flex; gap:8px; padding-top:16px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="resetHistoryFilters(); closeModal();">リセット</button>
      <button type="button" class="btn" style="flex:1.5;" onclick="applyHistoryRightFilter()">適用する</button>
    </div>
  `, 'right-filter-sheet', true);
}

function applyHistoryRightFilter() {
  const searchInput = document.getElementById('drawer-hist-search');
  historySearchQuery = searchInput ? searchInput.value.trim() : '';
  historyTypeFilter = getCustomSelectValue('drawer-hist-type') || 'all';
  historyBoxFilter = getCustomSelectValue('drawer-hist-box') || 'all';
  historyOshiFilter = getCustomSelectValue('drawer-hist-oshi') || 'all';
  closeModal();
  renderBankHistoryPage(false);
}

function resetHistoryFilters() {
  historySearchQuery = '';
  historyTypeFilter = 'all';
  historyBoxFilter = 'all';
  historyOshiFilter = 'all';
  renderBankHistoryPage(false);
}

function deleteBankRecord(recId) {
  const target = appData.bank.records.find(r => r.id === recId);
  if (!target) return;
  if (target.boxId) {
    const box = appData.bank.boxes.find(b => b.id === target.boxId);
    if (box) {
      if (target.type === 'save') {
        box.savedAmount = Math.max(0, Number(box.savedAmount || 0) - Number(target.amount));
      } else if (target.type === 'expense') {
        box.savedAmount = Number(box.savedAmount || 0) + Number(target.amount);
      }
    }
  }
  appData.bank.records = appData.bank.records.filter(r => r.id !== recId);
  saveData();
  renderBankScreen({ withFadeIn: false });
}

// ------------------------------------------
// 6-9. 別ページ②：「推し活レポート」（右スライド絞り込み対応）
// ------------------------------------------
function renderBankReportPage(withFadeIn = false) {
  const now = new Date();
  const yearPrefix = `${now.getFullYear()}`;
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = reportPeriod === 'month' ? monthPrefix : yearPrefix;

  const periodRecords = appData.bank.records.filter(r => {
    if (!r.date || !r.date.startsWith(prefix)) return false;
    if (reportBoxFilter !== 'all' && r.boxId !== reportBoxFilter) return false;
    if (reportOshiFilter !== 'all' && (r.targetLabel || '') !== reportOshiFilter) return false;
    return true;
  });

  const totalSave = periodRecords
    .filter(r => r.type === 'save')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const totalExpense = periodRecords
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const maxBoth = Math.max(totalSave, totalExpense, 1);
  const saveBarPct = Math.round((totalSave / maxBoth) * 100);
  const expBarPct = Math.round((totalExpense / maxBoth) * 100);

  const targetMap = {};
  periodRecords.forEach(r => {
    const key = r.targetLabel || '指定なし（全体）';
    if (!targetMap[key]) targetMap[key] = { save: 0, expense: 0 };
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
    : `<p style="font-size:0.82rem; color:var(--text-sub); text-align:center; padding:12px 0;">該当する記録がまだありません</p>`;

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
    : `<p style="font-size:0.82rem; color:var(--text-sub); text-align:center; padding:12px 0;">該当する出費記録はありません</p>`;

  const hasActiveFilter = reportBoxFilter !== 'all' || reportOshiFilter !== 'all';

  const html = `
    <div class="page-title">
      <button type="button" class="btn btn-sub page-title-left" style="padding:5px 12px; font-size:0.78rem;" onclick="openBankSubPage('main')">← もどる</button>
      <span>レポート</span>
      <button type="button" class="icon-circle-btn page-title-right ${hasActiveFilter ? 'has-filter' : ''}" onclick="openReportRightFilterDrawer()" title="絞り込み">
        ${getSearchIconSvg()}
      </button>
    </div>

    <div style="display:flex; justify-content:center; gap:8px; margin-bottom:12px;">
      <button type="button" class="filter-pill ${reportPeriod === 'month' ? 'active' : ''}" onclick="setReportPeriod('month')">今月（${now.getMonth() + 1}月）</button>
      <button type="button" class="filter-pill ${reportPeriod === 'year' ? 'active' : ''}" onclick="setReportPeriod('year')">年間（${now.getFullYear()}年）</button>
    </div>

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

    <div class="card">
      <div class="card-title">推し・タグ別の記録</div>
      ${targetBarsHtml}
    </div>

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

function openReportRightFilterDrawer() {
  const boxOptions = [
    { value: 'all', label: 'すべての貯金箱' },
    ...appData.bank.boxes.map(b => ({ value: b.id, label: b.title }))
  ];

  const oshiLabels = new Set();
  appData.oshis.forEach(o => oshiLabels.add(o.name));
  appData.bank.records.forEach(r => { if (r.targetLabel) oshiLabels.add(r.targetLabel); });

  const oshiOptions = [
    { value: 'all', label: 'すべての推し・タグ' },
    ...Array.from(oshiLabels).map(lbl => ({ value: lbl, label: lbl }))
  ];

  openModal(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <span class="card-title" style="margin-bottom:0; font-size:1.05rem;">レポート絞り込み</span>
      <button type="button" class="delete-mini-btn" style="font-size:1rem;" onclick="closeModal()">✕</button>
    </div>

    <div class="input-group">
      <label class="input-label">貯金箱で絞り込み</label>
      ${renderCustomSelect({
        id: 'drawer-rep-box',
        options: boxOptions,
        selectedValue: reportBoxFilter
      })}
    </div>

    <div class="input-group">
      <label class="input-label">推し・タグで絞り込み</label>
      ${renderCustomSelect({
        id: 'drawer-rep-oshi',
        options: oshiOptions,
        selectedValue: reportOshiFilter
      })}
    </div>

    <div style="margin-top:auto; display:flex; gap:8px; padding-top:16px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="reportBoxFilter='all'; reportOshiFilter='all'; closeModal(); renderBankReportPage(false);">リセット</button>
      <button type="button" class="btn" style="flex:1.5;" onclick="applyReportRightFilter()">適用する</button>
    </div>
  `, 'right-filter-sheet', true);
}

function applyReportRightFilter() {
  reportBoxFilter = getCustomSelectValue('drawer-rep-box') || 'all';
  reportOshiFilter = getCustomSelectValue('drawer-rep-oshi') || 'all';
  closeModal();
  renderBankReportPage(false);
}

function setReportPeriod(period) {
  reportPeriod = period;
  renderBankReportPage(false);
}

// ==========================================
// 7. プラン画面（1画面フィット・年月ピッカー・複数チェック絞り込み・お知らせ貼付）
// ==========================================
let planCalYear = new Date().getFullYear();
let planCalMonth = new Date().getMonth();
let planFilterOshis = [];      // 複数選択チェック用（推し・タグ）
let planFilterCategories = []; // 複数選択チェック用（カテゴリー）
let planSearchQuery = '';
let planHubTab = 'active';     // 'active'（直近・進行中） | 'todo'（やることメモ）

function switchPlanHubTab(tab) {
  planHubTab = tab;
  renderPlanScreen({ withFadeIn: false });
}

function renderPlanScreen(options = {}) {
  const { withFadeIn = false } = options;
  const hasFilter = planFilterOshis.length > 0 || planFilterCategories.length > 0 || Boolean(planSearchQuery);
  const todayStr = getTodayString();

  // 複数選択チェック絞り込み適用
  const filteredCountdowns = appData.countdowns.filter(cd => {
    if (planFilterOshis.length > 0 && !planFilterOshis.includes(cd.targetLabel || '')) return false;
    if (planSearchQuery) {
      const hay = `${cd.title || ''} ${cd.targetLabel || ''}`.toLowerCase();
      if (!hay.includes(planSearchQuery.toLowerCase())) return false;
    }
    return true;
  });

  const filteredPlans = appData.plans.filter(p => {
    if (planFilterOshis.length > 0 && !planFilterOshis.includes(p.targetLabel || '')) return false;
    if (planFilterCategories.length > 0 && !planFilterCategories.includes(p.category || '')) return false;
    if (planSearchQuery) {
      const hay = `${p.title || ''} ${p.category || ''} ${p.outfit || ''} ${p.memo || ''} ${p.targetLabel || ''}`.toLowerCase();
      if (!hay.includes(planSearchQuery.toLowerCase())) return false;
    }
    return true;
  });

  // 1. カウントダウン横スクロール列
  const cdCardsHtml = filteredCountdowns.map(cd => {
    const info = calcCountdownInfo(cd);
    return `
      <div class="countdown-card-compact" onclick="openCountdownFormModal('${cd.id}')">
        <div style="font-size:0.63rem; font-weight:700; color:var(--color-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(cd.targetLabel || info.typeLabel)}
        </div>
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(cd.title)}
        </div>
        <div style="font-size:1.05rem; font-weight:700; color:var(--color-dark); line-height:1.15; margin-top:1px;">
          ${escapeHtml(info.mainText)}
        </div>
        <div style="font-size:0.61rem; color:var(--text-sub);">
          ${escapeHtml(info.subText)}
        </div>
      </div>
    `;
  }).join('');

  // 2. 真ん中の2タブ枠（1画面に収まるよう最大2件表示）
  let hubBodyHtml = '';
  if (planHubTab === 'active') {
    const priorityStatuses = ['抽選待ち', '当選・入金済', '準備完了'];
    const upcomingOrActive = [...filteredPlans]
      .filter(p => p.date >= todayStr || priorityStatuses.includes(p.status))
      .sort((a, b) => {
        const aPri = priorityStatuses.includes(a.status) ? 0 : 1;
        const bPri = priorityStatuses.includes(b.status) ? 0 : 1;
        if (aPri !== bPri) return aPri - bPri;
        return a.date.localeCompare(b.date);
      })
      .slice(0, 2);

    hubBodyHtml = upcomingOrActive.length > 0
      ? upcomingOrActive.map(p => `
          <div class="plan-hub-row" onclick="openDayPlanSheet('${p.date}')">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:5px;">
                <span style="font-size:0.69rem; font-weight:700; color:var(--text-sub);">${escapeHtml(p.date)}</span>
                ${p.status ? `<span class="tag" style="font-size:0.62rem; padding:1px 7px;">${escapeHtml(p.status)}</span>` : ''}
                ${p.targetLabel ? `<span style="font-size:0.68rem; font-weight:700; color:var(--color-dark);">${escapeHtml(p.targetLabel)}</span>` : ''}
              </div>
              <div style="font-size:0.8rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(p.title)}
              </div>
            </div>
            <span style="font-size:0.88rem; font-weight:700; color:var(--color-dark);">›</span>
          </div>
        `).join('')
      : `<p style="font-size:0.75rem; color:var(--text-sub); text-align:center; padding:8px 0;">進行中・直近の予定はありません</p>`;
  } else {
    const todos = appData.planTodos || [];
    const todoListHtml = todos.length > 0
      ? todos.map(t => `
          <div class="checklist-item-row" style="padding:3px 2px;">
            <button type="button" class="checklist-toggle" onclick="toggleGlobalPlanTodo('${t.id}')">
              <span class="check-circle ${t.done ? 'checked' : ''}" style="width:15px; height:15px;"></span>
              <span class="checklist-text ${t.done ? 'done' : ''}" style="font-size:0.78rem;">${escapeHtml(t.text)}</span>
            </button>
            <button type="button" class="delete-mini-btn" style="padding:2px 6px;" onclick="deleteGlobalPlanTodo('${t.id}')">✕</button>
          </div>
        `).join('')
      : `<p style="font-size:0.74rem; color:var(--text-sub); text-align:center; padding:3px 0;">買いたいグッズや準備メモを追加</p>`;

    hubBodyHtml = `
      <div style="max-height:54px; overflow-y:auto;">${todoListHtml}</div>
      <div style="display:flex; gap:6px; margin-top:4px;">
        <input type="text" id="global-plan-todo-input" placeholder="例：次のライブまでにペンラ購入" style="padding:5px 9px; font-size:0.76rem; border-radius:10px;">
        <button type="button" class="btn btn-sub" style="padding:5px 10px; font-size:0.72rem; white-space:nowrap;" onclick="addGlobalPlanTodo()">追加</button>
      </div>
    `;
  }

  // 3. 月曜始まりカレンダーのセル生成
  const firstDay = new Date(planCalYear, planCalMonth, 1);
  const lastDate = new Date(planCalYear, planCalMonth + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const plansByDate = {};
  filteredPlans.forEach(p => {
    if (!plansByDate[p.date]) plansByDate[p.date] = [];
    plansByDate[p.date].push(p);
  });

  let cellsHtml = '';
  for (let i = 0; i < startOffset; i++) {
    cellsHtml += `<div class="calendar-cell empty"></div>`;
  }

  for (let day = 1; day <= lastDate; day++) {
    const mStr = String(planCalMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateKey = `${planCalYear}-${mStr}-${dStr}`;
    const dayPlans = plansByDate[dateKey] || [];
    const colIndex = (startOffset + day - 1) % 7;
    const weekendClass = colIndex === 5 ? 'sat' : (colIndex === 6 ? 'sun' : '');
    const isToday = dateKey === todayStr;
    const dotsHtml = dayPlans.slice(0, 3).map(() => `<span class="calendar-dot"></span>`).join('');

    cellsHtml += `
      <button type="button"
              class="calendar-cell ${weekendClass} ${isToday ? 'today' : ''} ${dayPlans.length > 0 ? 'has-event' : ''}"
              onclick="openDayPlanSheet('${dateKey}')">
        <span class="calendar-day-num">${day}</span>
        <div class="calendar-dots">${dotsHtml}</div>
      </button>
    `;
  }

  const innerHtml = `
    <div class="plan-screen-fit">
      <div class="page-title">
        <span>プラン</span>
        <div class="page-title-right">
          <button type="button" class="icon-circle-btn ${hasFilter ? 'has-filter' : ''}" onclick="openPlanRightFilterDrawer()" title="検索・絞り込み">
            ${getSearchIconSvg()}
          </button>
        </div>
      </div>

      ${hasFilter ? `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; padding:0 4px; flex-shrink:0;">
          <span style="font-size:0.72rem; color:var(--color-dark); font-weight:700;">
            絞り込み中（${planFilterOshis.length + planFilterCategories.length + (planSearchQuery ? 1 : 0)}件）
          </span>
          <button type="button" class="btn btn-sub" style="padding:2px 9px; font-size:0.68rem;" onclick="resetPlanFilters()">解除</button>
        </div>
      ` : ''}

      <!-- 上段：カウントダウン横スクロール列 -->
      <div class="countdown-strip-wrap">
        ${cdCardsHtml}
        <button type="button" class="countdown-add-compact" onclick="openCountdownFormModal(null)">
          <span style="font-size:1.1rem; line-height:1;">＋</span>
          <span>追加</span>
        </button>
      </div>

      <!-- 中段：直近・進行中 ／ やることメモ 切り替え枠 -->
      <div class="plan-hub-card">
        <div class="plan-hub-tabs">
          <div class="plan-hub-tab-group">
            <button type="button" class="plan-hub-tab ${planHubTab === 'active' ? 'active' : ''}" onclick="switchPlanHubTab('active')">直近・進行中</button>
            <button type="button" class="plan-hub-tab ${planHubTab === 'todo' ? 'active' : ''}" onclick="switchPlanHubTab('todo')">やることメモ</button>
          </div>
          <button type="button" class="btn btn-sub" style="padding:3px 9px; font-size:0.68rem;" onclick="openPasteNoticeModal()">
            お知らせ貼付
          </button>
        </div>
        ${hubBodyHtml}
      </div>

      <!-- 中央CTAボタン：プランをたてる -->
      <button type="button" class="btn plan-make-cta" onclick="openPlanFormModal(null, '${todayStr}')">
        プランをたてる
      </button>

      <!-- 下段：コンパクト月間カレンダー（月曜始まり・年月タップジャンプ対応） -->
      <div class="calendar-card">
        <div class="calendar-header">
          <button type="button" class="calendar-nav-btn" onclick="changePlanCalendarMonth(-1)">‹</button>
          <button type="button" class="calendar-ym-btn" onclick="openCalendarYearMonthPicker(${planCalYear})" title="年・月を選んで移動">
            <span>${planCalYear}年 ${planCalMonth + 1}月</span>
            <span style="font-size:0.7rem;">▾</span>
          </button>
          <button type="button" class="calendar-nav-btn" onclick="changePlanCalendarMonth(1)">›</button>
        </div>

        <div class="calendar-weekdays">
          <span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span><span>日</span>
        </div>

        <div class="calendar-grid">
          ${cellsHtml}
        </div>
      </div>
    </div>
  `;

  if (withFadeIn) {
    setScreenContent(innerHtml);
  } else {
    mainEl.innerHTML = `<div>${innerHtml}</div>`;
  }
}

// 年・月ジャンプピッカーモーダル
function openCalendarYearMonthPicker(targetYear) {
  const monthsHtml = Array.from({ length: 12 }, (_, idx) => {
    const isCurrent = targetYear === planCalYear && idx === planCalMonth;
    return `
      <button type="button"
              class="month-pick-btn ${isCurrent ? 'active' : ''}"
              onclick="selectCalendarYearMonth(${targetYear}, ${idx})">
        ${idx + 1}月
      </button>
    `;
  }).join('');

  openModal(`
    <div class="card-title" style="font-size:1.05rem; text-align:center; margin-bottom:10px;">
      年・月を選んで移動
    </div>
    <div style="display:flex; align-items:center; justify-content:center; gap:18px; margin-bottom:6px;">
      <button type="button" class="calendar-nav-btn" onclick="openCalendarYearMonthPicker(${targetYear - 1})">‹</button>
      <span style="font-size:1.15rem; font-weight:700; color:var(--color-dark); min-width:86px; text-align:center;">
        ${targetYear}年
      </span>
      <button type="button" class="calendar-nav-btn" onclick="openCalendarYearMonthPicker(${targetYear + 1})">›</button>
    </div>

    <div class="month-picker-grid">
      ${monthsHtml}
    </div>

    <div style="display:flex; gap:8px; margin-top:16px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">閉じる</button>
      <button type="button" class="btn" style="flex:1;" onclick="jumpToTodayCalendar()">今月にもどる</button>
    </div>
  `);
}

function selectCalendarYearMonth(year, monthIndex) {
  planCalYear = year;
  planCalMonth = monthIndex;
  closeModal();
  renderPlanScreen({ withFadeIn: false });
}

function jumpToTodayCalendar() {
  const now = new Date();
  planCalYear = now.getFullYear();
  planCalMonth = now.getMonth();
  closeModal();
  renderPlanScreen({ withFadeIn: false });
}

function addGlobalPlanTodo() {
  const input = document.getElementById('global-plan-todo-input');
  const text = input ? input.value.trim() : '';
  if (!text) return;
  if (!Array.isArray(appData.planTodos)) appData.planTodos = [];
  appData.planTodos.push({
    id: 'todo_' + Date.now(),
    text: text,
    done: false
  });
  saveData();
  renderPlanScreen({ withFadeIn: false });
}

function toggleGlobalPlanTodo(todoId) {
  const target = (appData.planTodos || []).find(t => t.id === todoId);
  if (target) target.done = !target.done;
  saveData();
  renderPlanScreen({ withFadeIn: false });
}

function deleteGlobalPlanTodo(todoId) {
  appData.planTodos = (appData.planTodos || []).filter(t => t.id !== todoId);
  saveData();
  renderPlanScreen({ withFadeIn: false });
}

function openPasteNoticeModal() {
  openModal(`
    <div class="card-title" style="font-size:1.05rem; text-align:center; margin-bottom:8px;">
      公式お知らせ文から予定を作成
    </div>
    <p style="font-size:0.78rem; color:var(--text-sub); text-align:center; margin-bottom:12px;">
      公式SNSやサイトの告知文を貼り付けると、日付とタイトル候補を自動で読み取ります
    </p>
    <div class="input-group">
      <textarea id="notice-paste-area" rows="5" placeholder="例：【お知らせ】2026年12月24日(木) クリスマス配信ライブ開催決定！チケット受付は…"></textarea>
    </div>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">閉じる</button>
      <button type="button" class="btn" style="flex:2;" onclick="parseNoticeAndOpenPlanForm()">読み取って予定作成へ</button>
    </div>
  `);
}

function parseNoticeAndOpenPlanForm() {
  const raw = document.getElementById('notice-paste-area')?.value.trim() || '';
  if (!raw) {
    alert('お知らせ文を貼り付けてください');
    return;
  }

  let detectedDate = getTodayString();
  const nowYear = new Date().getFullYear();
  const fullMatch = raw.match(/(20\d{2})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
  const shortMatch = raw.match(/(\d{1,2})[月\/](\d{1,2})日?/);

  if (fullMatch) {
    detectedDate = `${fullMatch[1]}-${String(fullMatch[2]).padStart(2, '0')}-${String(fullMatch[3]).padStart(2, '0')}`;
  } else if (shortMatch) {
    detectedDate = `${nowYear}-${String(shortMatch[1]).padStart(2, '0')}-${String(shortMatch[2]).padStart(2, '0')}`;
  }

  const firstLine = raw.split(/\r?\n/)[0].replace(/^【.*?】/, '').trim();
  const titleCandidate = firstLine.slice(0, 28);

  openPlanFormModal(null, detectedDate);

  setTimeout(() => {
    const titleInput = document.getElementById('plan-title-input');
    const memoInput = document.getElementById('plan-memo-input');
    if (titleInput && titleCandidate) titleInput.value = titleCandidate;
    if (memoInput) memoInput.value = raw.slice(0, 120);
  }, 20);
}

function changePlanCalendarMonth(delta) {
  planCalMonth += delta;
  if (planCalMonth < 0) {
    planCalMonth = 11;
    planCalYear -= 1;
  } else if (planCalMonth > 11) {
    planCalMonth = 0;
    planCalYear += 1;
  }
  renderPlanScreen({ withFadeIn: false });
}

function calcCountdownInfo(cd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (cd.mode === 'elapsed') {
    const start = parseLocalDate(cd.date);
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
    const safeDays = Math.max(1, diffDays);
    return {
      typeLabel: '記念日経過',
      mainText: `${safeDays}日目`,
      subText: `${cd.date}〜`
    };
  }

  if (cd.mode === 'annual') {
    const base = parseLocalDate(cd.date);
    let nextTarget = new Date(today.getFullYear(), base.getMonth(), base.getDate());
    if (nextTarget < today) {
      nextTarget = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
    }
    const diffDays = Math.round((nextTarget - today) / (1000 * 60 * 60 * 24));
    return {
      typeLabel: '毎年記念日',
      mainText: diffDays === 0 ? '本日当日' : `あと${diffDays}日`,
      subText: `${base.getMonth() + 1}/${base.getDate()}`
    };
  }

  const target = parseLocalDate(cd.date);
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  let mainText = '';
  if (diffDays > 0) mainText = `あと${diffDays}日`;
  else if (diffDays === 0) mainText = '本日開催';
  else mainText = `${Math.abs(diffDays)}日前`;

  return {
    typeLabel: 'カウントダウン',
    mainText: mainText,
    subText: cd.date.slice(5).replace('-', '/')
  };
}

function parseLocalDate(dateStr) {
  const [y, m, d] = (dateStr || getTodayString()).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function openCountdownFormModal(cdId = null) {
  const isEdit = Boolean(cdId);
  const target = isEdit ? appData.countdowns.find(c => c.id === cdId) : null;

  const modeOptions = [
    { value: 'once', label: 'カウントダウン（ライブ・イベント日）' },
    { value: 'annual', label: '毎年くり返し（推しの誕生日・周年）' },
    { value: 'elapsed', label: '経過日数（推し始めてからの日数）' }
  ];

  const targetOptions = buildTargetOptionsArray();

  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:14px;">
      ${isEdit ? 'カウントダウン設定の編集' : 'カウントダウンを追加'}
    </div>
    <div class="input-group">
      <label class="input-label">種類</label>
      ${renderCustomSelect({
        id: 'cd-mode-select',
        options: modeOptions,
        selectedValue: target ? target.mode : 'once'
      })}
    </div>
    <div class="input-group">
      <label class="input-label">タイトル</label>
      <input type="text" id="cd-title-input" value="${target ? escapeHtml(target.title) : ''}" placeholder="例：〇〇誕生日、全国ツアー初日、推し始め">
    </div>
    <div class="input-group">
      <label class="input-label">基準日（または開催日）</label>
      <input type="date" id="cd-date-input" value="${target ? target.date : getTodayString()}">
    </div>
    <div class="input-group">
      <label class="input-label">対象の推し・タグ（ホーム連動用）</label>
      ${renderCustomSelect({
        id: 'cd-target-select',
        options: targetOptions,
        selectedValue: target ? (target.targetLabel || '') : ''
      })}
    </div>
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">閉じる</button>
      <button type="button" class="btn" style="flex:2;" onclick="submitCountdownForm('${cdId || ''}')">
        ${isEdit ? '保存する' : '追加する'}
      </button>
    </div>
    ${isEdit ? `
      <div style="text-align:center; margin-top:14px;">
        <button type="button" class="delete-mini-btn" style="color:#c96a6a;" onclick="deleteCountdown('${cdId}')">このカウントダウンを削除</button>
      </div>
    ` : ''}
  `);
}

function submitCountdownForm(cdId) {
  const modeVal = getCustomSelectValue('cd-mode-select') || 'once';
  const titleVal = document.getElementById('cd-title-input').value.trim();
  const dateVal = document.getElementById('cd-date-input').value || getTodayString();
  const targetVal = getCustomSelectValue('cd-target-select');

  if (!titleVal) {
    alert('タイトルを入力してください');
    return;
  }

  if (cdId) {
    const item = appData.countdowns.find(c => c.id === cdId);
    if (item) {
      item.mode = modeVal;
      item.title = titleVal;
      item.date = dateVal;
      item.targetLabel = targetVal;
    }
  } else {
    appData.countdowns.push({
      id: 'cd_' + Date.now(),
      mode: modeVal,
      title: titleVal,
      date: dateVal,
      targetLabel: targetVal
    });
  }

  saveData();
  closeModal();
  renderPlanScreen({ withFadeIn: false });
}

function deleteCountdown(cdId) {
  appData.countdowns = appData.countdowns.filter(c => c.id !== cdId);
  saveData();
  closeModal();
  renderPlanScreen({ withFadeIn: false });
}

function openDayPlanSheet(dateKey) {
  const dayPlans = appData.plans.filter(p => p.date === dateKey);

  const plansHtml = dayPlans.length > 0
    ? dayPlans.map(plan => {
        const items = Array.isArray(plan.items) ? plan.items : [];
        const checklistHtml = items.map(item => `
          <div class="checklist-item-row">
            <button type="button" class="checklist-toggle" onclick="togglePlanChecklistItem('${plan.id}', '${item.id}', '${dateKey}')">
              <span class="check-circle ${item.done ? 'checked' : ''}"></span>
              <span class="checklist-text ${item.done ? 'done' : ''}">${escapeHtml(item.text)}</span>
            </button>
            <button type="button" class="delete-mini-btn" onclick="deletePlanChecklistItem('${plan.id}', '${item.id}', '${dateKey}')">✕</button>
          </div>
        `).join('');

        return `
          <div style="background-color:#ffffff; border:1.5px solid var(--bg-sub); border-radius:18px; padding:14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div>
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin-bottom:4px;">
                  <span class="tag">${escapeHtml(plan.category || '現場・ライブ')}</span>
                  ${plan.status ? `<span class="tag" style="background-color:var(--color-primary); color:#ffffff;">${escapeHtml(plan.status)}</span>` : ''}
                  ${plan.targetLabel ? `<span style="font-size:0.75rem; font-weight:700; color:var(--color-dark);">${escapeHtml(plan.targetLabel)}</span>` : ''}
                </div>
                <div style="font-size:1.02rem; font-weight:700; color:var(--text-main);">
                  ${escapeHtml(plan.title)}
                </div>
              </div>
              <button type="button" class="btn btn-sub" style="padding:4px 10px; font-size:0.74rem;" onclick="openPlanFormModal('${plan.id}', '${dateKey}')">編集</button>
            </div>

            ${plan.memo ? `<p style="font-size:0.82rem; color:var(--text-sub); margin-top:6px;">${escapeHtml(plan.memo)}</p>` : ''}

            <div class="plan-outfit-box">
              <div style="font-size:0.74rem; font-weight:700; color:var(--color-dark); margin-bottom:2px;">参戦服・コーデメモ</div>
              <div style="font-size:0.84rem; color:var(--text-main);">
                ${plan.outfit ? escapeHtml(plan.outfit) : '<span style="color:var(--text-sub);">未設定（編集から登録できます）</span>'}
              </div>
            </div>

            <div style="margin-top:10px;">
              <div style="font-size:0.76rem; font-weight:700; color:var(--color-dark); margin-bottom:4px;">持ち物・やることリスト</div>
              ${checklistHtml || '<p style="font-size:0.76rem; color:var(--text-sub); padding:4px 0;">まだ項目がありません</p>'}
              <div style="display:flex; gap:6px; margin-top:8px;">
                <input type="text" id="new-check-input-${plan.id}" placeholder="例：ペンライト、チケット、双眼鏡" style="padding:7px 10px; font-size:0.82rem;">
                <button type="button" class="btn btn-sub" style="padding:7px 12px; font-size:0.78rem; white-space:nowrap;" onclick="addPlanChecklistItem('${plan.id}', '${dateKey}')">追加</button>
              </div>
            </div>

            <div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--bg-sub); display:flex; justify-content:flex-end;">
              <button type="button" class="btn btn-sub" style="padding:5px 12px; font-size:0.75rem;" onclick="sendPlanToBankExpense('${plan.id}')">
                バンクに出費を記録する →
              </button>
            </div>
          </div>
        `;
      }).join('')
    : `<p style="font-size:0.85rem; color:var(--text-sub); text-align:center; padding:18px 0;">この日の予定はまだありません</p>`;

  openModal(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span class="card-title" style="margin-bottom:0; font-size:1.05rem;">${escapeHtml(dateKey)} の予定</span>
      <button type="button" class="delete-mini-btn" style="font-size:1rem;" onclick="closeModal()">✕</button>
    </div>

    ${plansHtml}

    <button type="button" class="btn btn-block" onclick="openPlanFormModal(null, '${dateKey}')">
      ＋ この日に予定を追加する
    </button>
  `);
}

function togglePlanChecklistItem(planId, itemId, dateKey) {
  const plan = appData.plans.find(p => p.id === planId);
  if (!plan || !Array.isArray(plan.items)) return;
  const item = plan.items.find(i => i.id === itemId);
  if (item) item.done = !item.done;
  saveData();
  openDayPlanSheet(dateKey);
}

function addPlanChecklistItem(planId, dateKey) {
  const input = document.getElementById(`new-check-input-${planId}`);
  const text = input ? input.value.trim() : '';
  if (!text) return;
  const plan = appData.plans.find(p => p.id === planId);
  if (!plan) return;
  if (!Array.isArray(plan.items)) plan.items = [];
  plan.items.push({
    id: 'chk_' + Date.now(),
    text: text,
    done: false
  });
  saveData();
  openDayPlanSheet(dateKey);
}

function deletePlanChecklistItem(planId, itemId, dateKey) {
  const plan = appData.plans.find(p => p.id === planId);
  if (!plan || !Array.isArray(plan.items)) return;
  plan.items = plan.items.filter(i => i.id !== itemId);
  saveData();
  openDayPlanSheet(dateKey);
}

function sendPlanToBankExpense(planId) {
  const plan = appData.plans.find(p => p.id === planId);
  if (!plan) return;
  openExpenseModal({
    category: plan.category === 'グッズ発売' ? 'グッズ' : 'チケット',
    targetLabel: plan.targetLabel || '',
    memo: plan.title,
    date: plan.date
  });
}

function openPlanFormModal(planId = null, defaultDate = getTodayString()) {
  const isEdit = Boolean(planId);
  const target = isEdit ? appData.plans.find(p => p.id === planId) : null;

  const categoryOptions = [
    { value: '現場・ライブ', label: '現場・ライブ' },
    { value: '推し友と会う', label: '推し友と会う' },
    { value: 'チケット申込・当落', label: 'チケット申込・当落' },
    { value: 'グッズ発売', label: 'グッズ発売' },
    { value: '配信・メディア', label: '配信・メディア' },
    { value: 'その他', label: 'その他' }
  ];

  const statusOptions = [
    { value: '', label: 'ステータスなし' },
    { value: '参加予定', label: '参加予定' },
    { value: '抽選待ち', label: '抽選待ち' },
    { value: '当選・入金済', label: '当選・入金済' },
    { value: '準備完了', label: '準備完了' }
  ];

  const targetOptions = buildTargetOptionsArray();

  openModal(`
    <div class="card-title" style="font-size:1.1rem; text-align:center; margin-bottom:14px;">
      ${isEdit ? '予定の編集' : '新しい予定を追加'}
    </div>
    <div class="input-group">
      <label class="input-label">タイトル</label>
      <input type="text" id="plan-title-input" value="${target ? escapeHtml(target.title) : ''}" placeholder="例：〇〇ドーム公演、コラボカフェ">
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
      <div class="input-group">
        <label class="input-label">日付</label>
        <input type="date" id="plan-date-input" value="${target ? target.date : defaultDate}">
      </div>
      <div class="input-group">
        <label class="input-label">カテゴリー</label>
        ${renderCustomSelect({
          id: 'plan-cat-select',
          options: categoryOptions,
          selectedValue: target ? (target.category || '現場・ライブ') : '現場・ライブ',
          compact: true
        })}
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
      <div class="input-group">
        <label class="input-label">ステータス</label>
        ${renderCustomSelect({
          id: 'plan-status-select',
          options: statusOptions,
          selectedValue: target ? (target.status || '') : '参加予定',
          compact: true
        })}
      </div>
      <div class="input-group">
        <label class="input-label">対象の推し・タグ</label>
        ${renderCustomSelect({
          id: 'plan-target-select',
          options: targetOptions,
          selectedValue: target ? (target.targetLabel || '') : '',
          compact: true
        })}
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">参戦服・コーデメモ</label>
      <input type="text" id="plan-outfit-input" value="${target ? escapeHtml(target.outfit || '') : ''}" placeholder="例：白ワンピース＋推し色リボン、痛バ">
    </div>
    <div class="input-group">
      <label class="input-label">詳細メモ（会場・時間など）</label>
      <input type="text" id="plan-memo-input" value="${target ? escapeHtml(target.memo || '') : ''}" placeholder="例：17:00開演 〇〇アリーナ">
    </div>
    ${!isEdit ? `
      <div style="background-color:var(--bg-main); border-radius:12px; padding:9px 12px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="plan-preset-items" checked style="width:16px; height:16px; accent-color:var(--color-primary);">
        <label for="plan-preset-items" style="font-size:0.78rem; color:var(--text-main); font-weight:700; cursor:pointer;">
          基本の持ち物セット（チケット・ペンライト・スマホ・モバイルバッテリー）を自動追加する
        </label>
      </div>
    ` : ''}
    <div style="display:flex; gap:8px; margin-top:14px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="closeModal()">キャンセル</button>
      <button type="button" class="btn" style="flex:2;" onclick="submitPlanForm('${planId || ''}')">
        ${isEdit ? '保存する' : '追加する'}
      </button>
    </div>
    ${isEdit ? `
      <div style="text-align:center; margin-top:14px;">
        <button type="button" class="delete-mini-btn" style="color:#c96a6a;" onclick="deletePlanItem('${planId}')">この予定を削除する</button>
      </div>
    ` : ''}
  `);
}

function submitPlanForm(planId) {
  const titleVal = document.getElementById('plan-title-input').value.trim();
  const dateVal = document.getElementById('plan-date-input').value || getTodayString();
  const catVal = getCustomSelectValue('plan-cat-select') || '現場・ライブ';
  const statusVal = getCustomSelectValue('plan-status-select') || '';
  const targetVal = getCustomSelectValue('plan-target-select') || '';
  const outfitVal = document.getElementById('plan-outfit-input').value.trim();
  const memoVal = document.getElementById('plan-memo-input').value.trim();

  if (!titleVal) {
    alert('タイトルを入力してください');
    return;
  }

  if (planId) {
    const item = appData.plans.find(p => p.id === planId);
    if (item) {
      item.title = titleVal;
      item.date = dateVal;
      item.category = catVal;
      item.status = statusVal;
      item.targetLabel = targetVal;
      item.outfit = outfitVal;
      item.memo = memoVal;
    }
  } else {
    const addPreset = document.getElementById('plan-preset-items')?.checked;
    const presetItems = addPreset
      ? [
          { id: 'chk_1_' + Date.now(), text: 'チケット・身分証', done: false },
          { id: 'chk_2_' + Date.now(), text: 'ペンライト・うちわ', done: false },
          { id: 'chk_3_' + Date.now(), text: 'スマホ・モバイルバッテリー', done: false }
        ]
      : [];

    appData.plans.push({
      id: 'plan_' + Date.now(),
      title: titleVal,
      date: dateVal,
      category: catVal,
      status: statusVal,
      targetLabel: targetVal,
      outfit: outfitVal,
      memo: memoVal,
      items: presetItems
    });
  }

  const dObj = parseLocalDate(dateVal);
  planCalYear = dObj.getFullYear();
  planCalMonth = dObj.getMonth();

  saveData();
  renderPlanScreen({ withFadeIn: false });
  openDayPlanSheet(dateVal);
}

function deletePlanItem(planId) {
  appData.plans = appData.plans.filter(p => p.id !== planId);
  saveData();
  closeModal();
  renderPlanScreen({ withFadeIn: false });
}

// 右スライド絞り込みドロワー（複数チェックボタン選択）
function openPlanRightFilterDrawer() {
  const targetLabels = new Set();
  appData.oshis.forEach(o => {
    targetLabels.add(o.name);
    if (o.tag) targetLabels.add(`#${o.tag}`);
  });
  appData.plans.forEach(p => { if (p.targetLabel) targetLabels.add(p.targetLabel); });
  appData.countdowns.forEach(c => { if (c.targetLabel) targetLabels.add(c.targetLabel); });

  const oshiCheckList = Array.from(targetLabels);
  const categoryList = [
    '現場・ライブ',
    '推し友と会う',
    'チケット申込・当落',
    'グッズ発売',
    '配信・メディア',
    'その他'
  ];

  const oshiCheckHtml = oshiCheckList.length > 0
    ? oshiCheckList.map(lbl => {
        const checked = planFilterOshis.includes(lbl) ? 'checked' : '';
        return `
          <label class="filter-check-item">
            <input type="checkbox" name="plan-filter-oshi-chk" value="${escapeHtml(lbl)}" ${checked}>
            <span>${escapeHtml(lbl)}</span>
          </label>
        `;
      }).join('')
    : `<p style="font-size:0.76rem; color:var(--text-sub); padding:4px 0;">推し・タグが登録されるとここに並びます</p>`;

  const catCheckHtml = categoryList.map(cat => {
    const checked = planFilterCategories.includes(cat) ? 'checked' : '';
    return `
      <label class="filter-check-item">
        <input type="checkbox" name="plan-filter-cat-chk" value="${escapeHtml(cat)}" ${checked}>
        <span>${escapeHtml(cat)}</span>
      </label>
    `;
  }).join('');

  openModal(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span class="card-title" style="margin-bottom:0; font-size:1.05rem;">予定の検索・絞り込み</span>
      <button type="button" class="delete-mini-btn" style="font-size:1rem;" onclick="closeModal()">✕</button>
    </div>

    <div class="input-group">
      <label class="input-label">キーワード検索</label>
      <input type="search" id="drawer-plan-search" value="${escapeHtml(planSearchQuery)}" placeholder="イベント名・参戦服・メモ">
    </div>

    <div class="input-group">
      <label class="input-label">推し・タグ（複数選択可）</label>
      <div class="filter-check-list">
        ${oshiCheckHtml}
      </div>
    </div>

    <div class="input-group">
      <label class="input-label">カテゴリー（複数選択可）</label>
      <div class="filter-check-list">
        ${catCheckHtml}
      </div>
    </div>

    <div style="margin-top:auto; display:flex; gap:8px; padding-top:12px;">
      <button type="button" class="btn btn-sub" style="flex:1;" onclick="resetPlanFilters(); closeModal();">リセット</button>
      <button type="button" class="btn" style="flex:1.5;" onclick="applyPlanRightFilter()">適用する</button>
    </div>
  `, 'right-filter-sheet', true);
}

function applyPlanRightFilter() {
  const sEl = document.getElementById('drawer-plan-search');
  planSearchQuery = sEl ? sEl.value.trim() : '';
  planFilterOshis = Array.from(document.querySelectorAll('input[name="plan-filter-oshi-chk"]:checked')).map(el => el.value);
  planFilterCategories = Array.from(document.querySelectorAll('input[name="plan-filter-cat-chk"]:checked')).map(el => el.value);
  closeModal();
  renderPlanScreen({ withFadeIn: false });
}

function resetPlanFilters() {
  planSearchQuery = '';
  planFilterOshis = [];
  planFilterCategories = [];
  renderPlanScreen({ withFadeIn: false });
}

// ==========================================
// 8. その他の画面（★次に作り込みます）
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
// 9. 共通ユーティリティ関数
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

function escapeJsString(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

function buildTargetOptionsArray() {
  const options = [{ value: '', label: '指定なし（全体）' }];
  const tags = new Set();

  appData.oshis.forEach(oshi => {
    options.push({ value: oshi.name, label: `推し：${oshi.name}` });
    if (oshi.tag) {
      tags.add(oshi.tag);
    }
  });

  tags.forEach(tag => {
    options.push({ value: `#${tag}`, label: `タグ：#${tag}` });
  });

  return options;
}

function getSelectedOshiOrTagLabel() {
  if (!appData.selectedOshiId) return '';
  const found = appData.oshis.find(o => o.id === appData.selectedOshiId);
  return found ? found.name : '';
}

// ==========================================
// 10. アプリ起動時の初期処理
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