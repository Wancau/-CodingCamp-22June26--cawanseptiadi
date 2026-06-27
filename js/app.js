/**
 * Expense & Budget Visualizer
 * app.js — Single JS file (TC-1 compliance)
 * Uses: LocalStorage, Chart.js (loaded via CDN in index.html)
 */

/* ===================================================
   STATE
   =================================================== */
const STORAGE_KEY   = 'budgetapp_transactions';
const LIMIT_KEY     = 'budgetapp_limit';
const THEME_KEY     = 'budgetapp_theme';

let transactions = [];      // Array of { id, name, amount, category, date }
let budgetLimit  = 0;       // 0 = no limit set
let sortMode     = 'newest';
let chartInstance = null;

/* ===================================================
   DOM REFERENCES
   =================================================== */
const txForm       = document.getElementById('txForm');
const inputName    = document.getElementById('itemName');
const inputAmount  = document.getElementById('amount');
const inputCat     = document.getElementById('category');
const inputLimit   = document.getElementById('budgetLimit');
const sortBy       = document.getElementById('sortBy');

const errName     = document.getElementById('errName');
const errAmount   = document.getElementById('errAmount');
const errCategory = document.getElementById('errCategory');

const totalBalanceEl = document.getElementById('totalBalance');
const txCountEl      = document.getElementById('txCount');
const txList         = document.getElementById('txList');
const emptyState     = document.getElementById('emptyState');
const limitBanner    = document.getElementById('limitBanner');
const chartCanvas    = document.getElementById('expenseChart');
const chartEmpty     = document.getElementById('chartEmpty');
const themeToggle    = document.getElementById('themeToggle');
const themeIcon      = document.getElementById('themeIcon');

/* ===================================================
   LOCAL STORAGE HELPERS
   =================================================== */
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  transactions = raw ? JSON.parse(raw) : [];
}

function saveLimit() {
  localStorage.setItem(LIMIT_KEY, budgetLimit.toString());
}

function loadLimit() {
  const raw = localStorage.getItem(LIMIT_KEY);
  budgetLimit = raw ? parseFloat(raw) : 0;
  if (budgetLimit > 0) {
    inputLimit.value = budgetLimit;
  }
}

/* ===================================================
   THEME
   =================================================== */
function applyTheme(mode) {
  document.body.classList.toggle('dark', mode === 'dark');
  document.body.classList.toggle('light', mode !== 'dark');
  themeIcon.textContent = mode === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, mode);
  // Redraw chart to match theme
  if (chartInstance) renderChart();
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
}

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
});

/* ===================================================
   VALIDATION
   =================================================== */
function clearErrors() {
  [errName, errAmount, errCategory].forEach(el => el.textContent = '');
  [inputName, inputAmount, inputCat].forEach(el => el.classList.remove('invalid'));
}

function validateForm() {
  clearErrors();
  let valid = true;

  if (!inputName.value.trim()) {
    errName.textContent = 'Nama barang wajib diisi.';
    inputName.classList.add('invalid');
    valid = false;
  }

  const amt = parseFloat(inputAmount.value);
  if (!inputAmount.value || isNaN(amt) || amt <= 0) {
    errAmount.textContent = 'Jumlah harus berupa angka positif.';
    inputAmount.classList.add('invalid');
    valid = false;
  }

  if (!inputCat.value) {
    errCategory.textContent = 'Pilih kategori terlebih dahulu.';
    inputCat.classList.add('invalid');
    valid = false;
  }

  return valid;
}

/* ===================================================
   ADD TRANSACTION
   =================================================== */
txForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  // Read budget limit if set
  const limitVal = parseFloat(inputLimit.value);
  if (!isNaN(limitVal) && limitVal > 0) {
    budgetLimit = limitVal;
    saveLimit();
  }

  const tx = {
    id:       crypto.randomUUID(),
    name:     inputName.value.trim(),
    amount:   parseFloat(inputAmount.value),
    category: inputCat.value,
    date:     Date.now()
  };

  transactions.push(tx);
  saveTransactions();
  render();

  // Reset form fields (keep limit & category for convenience)
  inputName.value   = '';
  inputAmount.value = '';
  inputName.focus();
});

/* ===================================================
   DELETE TRANSACTION
   =================================================== */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  render();
}

/* ===================================================
   SORT
   =================================================== */
sortBy.addEventListener('change', () => {
  sortMode = sortBy.value;
  render();
});

function getSorted() {
  const copy = [...transactions];
  switch (sortMode) {
    case 'newest':      return copy.sort((a, b) => b.date - a.date);
    case 'oldest':      return copy.sort((a, b) => a.date - b.date);
    case 'amount-asc':  return copy.sort((a, b) => a.amount - b.amount);
    case 'amount-desc': return copy.sort((a, b) => b.amount - a.amount);
    case 'category':    return copy.sort((a, b) => a.category.localeCompare(b.category));
    default:            return copy;
  }
}

/* ===================================================
   FORMAT CURRENCY
   =================================================== */
function formatRp(value) {
  return 'Rp ' + value.toLocaleString('id-ID');
}

/* ===================================================
   RENDER TRANSACTION LIST
   =================================================== */
function renderList() {
  const sorted = getSorted();
  txList.innerHTML = '';

  if (sorted.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  sorted.forEach(tx => {
    const isOver = budgetLimit > 0 && tx.amount > budgetLimit;
    const li = document.createElement('li');
    li.className = 'tx-item' + (isOver ? ' over-limit' : '');
    li.setAttribute('data-id', tx.id);

    li.innerHTML = `
      <div class="tx-info">
        <div class="tx-name">${escapeHtml(tx.name)}</div>
        <div class="tx-meta">
          <span class="tx-category cat-${tx.category}">${categoryEmoji(tx.category)} ${tx.category}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.4rem;">
        <span class="tx-amount">${formatRp(tx.amount)}</span>
        ${isOver ? '<span class="tx-over-badge">⚠️ Lebih</span>' : ''}
        <button class="btn-delete" aria-label="Hapus ${escapeHtml(tx.name)}" title="Hapus">🗑️</button>
      </div>
    `;

    li.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(tx.id));
    txList.appendChild(li);
  });
}

function categoryEmoji(cat) {
  const map = { Makanan: '🍔', Transportasi: '🚗', Hiburan: '🎮' };
  return map[cat] || '';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ===================================================
   RENDER BALANCE
   =================================================== */
function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalBalanceEl.textContent = formatRp(total);
  txCountEl.textContent = `${transactions.length} transaksi`;

  // Budget limit banner
  if (budgetLimit > 0 && total > budgetLimit) {
    limitBanner.classList.remove('hidden');
  } else {
    limitBanner.classList.add('hidden');
  }
}

/* ===================================================
   RENDER PIE CHART
   =================================================== */
function renderChart() {
  // Aggregate by category
  const cats = ['Makanan', 'Transportasi', 'Hiburan'];
  const totals = cats.map(cat =>
    transactions.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0)
  );
  const hasData = totals.some(v => v > 0);

  if (!hasData) {
    chartEmpty.classList.remove('hidden');
    chartCanvas.classList.add('hidden');
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  chartEmpty.classList.add('hidden');
  chartCanvas.classList.remove('hidden');

  const isDark = document.body.classList.contains('dark');
  const labelColor = isDark ? '#f1f5f9' : '#1e293b';

  const data = {
    labels: cats,
    datasets: [{
      data:            totals,
      backgroundColor: ['#10b981', '#6366f1', '#f43f5e'],
      borderColor:     isDark ? '#1e293b' : '#ffffff',
      borderWidth:     3,
      hoverOffset:     10
    }]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color:     labelColor,
          font:      { size: 13, weight: '600' },
          padding:   16,
          usePointStyle: true,
          pointStyleWidth: 10
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val   = ctx.parsed;
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return ` ${formatRp(val)} (${pct}%)`;
          }
        }
      }
    },
    animation: { duration: 400, easing: 'easeInOutQuart' }
  };

  if (chartInstance) {
    chartInstance.data    = data;
    chartInstance.options = options;
    chartInstance.update();
  } else {
    chartInstance = new Chart(chartCanvas, { type: 'pie', data, options });
  }
}

/* ===================================================
   MAIN RENDER
   =================================================== */
function render() {
  renderBalance();
  renderList();
  renderChart();
}

/* ===================================================
   INIT
   =================================================== */
function init() {
  loadTheme();
  loadTransactions();
  loadLimit();
  sortBy.value = sortMode;
  render();
}

init();
