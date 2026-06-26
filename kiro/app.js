document.addEventListener('DOMContentLoaded', () => {
    // --- 1. State Management (Local Storage) ---
    const STORAGE_KEY = 'budget_visualizer_data';

    // Default configuration if the user is opening the app for the first time
    const defaultData = {
        budgets: {
            "Housing": 1500,
            "Food": 500,
            "Transport": 200,
            "Utilities": 300,
            "Entertainment": 200
        },
        transactions: []
    };

    let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData;

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    }

    // --- 2. DOM Elements ---
    const form = document.getElementById('transaction-form');
    const totalSpentEl = document.getElementById('total-spent');
    const budgetBarsContainer = document.getElementById('budget-bars-container');
    const transactionList = document.getElementById('transaction-list');
    const currentMonthEl = document.getElementById('current-month');

    // Set current month in header
    const dateOptions = { month: 'long', year: 'numeric' };
    currentMonthEl.textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // --- 3. Core Logic & Math ---
    
    // Get total spent per category for the current month
    function getCategoryTotals() {
        const totals = {};
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        // Initialize totals to 0
        Object.keys(appData.budgets).forEach(category => {
            totals[category] = 0;
        });

        appData.transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            if (tx.type === 'expense' && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
                // Ensure category exists in totals (in case an old category was deleted)
                if (totals[tx.category] !== undefined) {
                    totals[tx.category] += parseFloat(tx.amount);
                }
            }
        });

        return totals;
    }

    // Calculate total overall spending for the header
    function calculateTotalSpent(totals) {
        return Object.values(totals).reduce((sum, amount) => sum + amount, 0);
    }

    // --- 4. UI Rendering ---

    function renderBudgetBars() {
        budgetBarsContainer.innerHTML = ''; // Clear existing
        const totals = getCategoryTotals();

        Object.keys(appData.budgets).forEach(category => {
            const spent = totals[category];
            const limit = appData.budgets[category];
            
            // Calculate percentage safely
            let percentage = limit > 0 ? (spent / limit) * 100 : 0;
            if (percentage > 100) percentage = 100; // Cap visual width at 100%

            // Determine color class based on threshold
            let colorClass = '';
            if (percentage >= 90) {
                colorClass = 'danger';
            } else if (percentage >= 75) {
                colorClass = 'warning';
            }

            // Create DOM elements
            const barHTML = `
                <div class="budget-item">
                    <div class="budget-header">
                        <span class="category-name">${category}</span>
                        <span class="category-amounts">$${spent.toFixed(2)} / $${limit.toFixed(2)}</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill ${colorClass}" style="width: ${percentage}%;"></div>
                    </div>
                </div>
            `;
            budgetBarsContainer.insertAdjacentHTML('beforeend', barHTML);
        });

        // Update main header total
        const totalOverall = calculateTotalSpent(totals);
        totalSpentEl.textContent = `$${totalOverall.toFixed(2)}`;
    }

    function renderLedger() {
        transactionList.innerHTML = ''; // Clear existing
        
        // Sort transactions by date (newest first)
        const sortedTx = [...appData.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Take only the 10 most recent for the UI
        const recentTx = sortedTx.slice(0, 10);

        if (recentTx.length === 0) {
            transactionList.innerHTML = '<li class="ledger-item empty-state">No transactions yet.</li>';
            return;
        }

        recentTx.forEach(tx => {
            const amountStr = tx.type === 'expense' ? `-$${parseFloat(tx.amount).toFixed(2)}` : `+$${parseFloat(tx.amount).toFixed(2)}`;
            const amountColor = tx.type === 'expense' ? 'var(--text-main)' : 'var(--fill-safe)';
            
            const liHTML = `
                <li class="ledger-item">
                    <div>
                        <strong>${tx.category}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">
                            ${new Date(tx.date).toLocaleDateString()} ${tx.note ? `- ${tx.note}` : ''}
                        </div>
                    </div>
                    <strong style="color: ${amountColor}">${amountStr}</strong>
                </li>
            `;
            transactionList.insertAdjacentHTML('beforeend', liHTML);
        });
    }

    function updateDashboard() {
        renderBudgetBars();
        renderLedger();
    }

    // --- 5. Event Listeners ---

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Gather form data
        const newTransaction = {
            id: Date.now().toString(),
            type: document.getElementById('type').value,
            category: document.getElementById('category').value,
            amount: document.getElementById('amount').value,
            date: document.getElementById('date').value,
            note: document.getElementById('note').value
        };

        // Add to state and save
        appData.transactions.push(newTransaction);
        saveData();

        // Reset form and update UI
        form.reset();
        // Set date back to today for convenience
        document.getElementById('date').valueAsDate = new Date();
        
        updateDashboard();
    });

    // --- 6. Initialization ---
    // Set default date picker value to today
    document.getElementById('date').valueAsDate = new Date();
    
    // Initial render
    updateDashboard();
});