const YNAB_API_BASE_URL = "https://api.ynab.com/v1/";
const STORAGE_KEY = "ynab_bookmarklet_settings";

interface Settings {
  ynabToken: string;
  ynabBudgetId: string;
  ynabAccountId: string;
}

function getSettings(): Settings | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Settings;
  } catch {
    return null;
  }
}

function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function createSettingsDialog(): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.style.cssText = `
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #ccc;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    max-width: 500px;
    width: 90%;
  `;
  
  dialog.innerHTML = `
    <h2 style="margin-top: 0;">YNAB Bookmarklet Settings</h2>
    <form method="dialog">
      <div style="margin-bottom: 15px;">
        <label for="ynab-token" style="display: block; margin-bottom: 5px;">YNAB API Token:</label>
        <input type="password" id="ynab-token" required style="width: 100%; padding: 5px;" />
      </div>
      <div style="margin-bottom: 15px;">
        <label for="ynab-budget-id" style="display: block; margin-bottom: 5px;">Budget ID:</label>
        <input type="text" id="ynab-budget-id" required style="width: 100%; padding: 5px;" />
      </div>
      <div style="margin-bottom: 15px;">
        <label for="ynab-account-id" style="display: block; margin-bottom: 5px;">Account ID (Amazon Store Card):</label>
        <input type="text" id="ynab-account-id" required style="width: 100%; padding: 5px;" />
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" id="cancel-btn" style="padding: 8px 16px;">Cancel</button>
        <button type="submit" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px;">Save Settings</button>
      </div>
    </form>
  `;
  
  document.body.appendChild(dialog);
  
  const form = dialog.querySelector('form')!;
  const cancelBtn = dialog.querySelector('#cancel-btn')!;
  
  cancelBtn.addEventListener('click', () => {
    dialog.close('cancelled');
  });
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings: Settings = {
      ynabToken: (dialog.querySelector('#ynab-token') as HTMLInputElement).value,
      ynabBudgetId: (dialog.querySelector('#ynab-budget-id') as HTMLInputElement).value,
      ynabAccountId: (dialog.querySelector('#ynab-account-id') as HTMLInputElement).value
    };
    saveSettings(settings);
    dialog.close('saved');
  });
  
  return dialog;
}

async function ensureSettings(): Promise<Settings> {
  let settings = getSettings();
  
  if (!settings) {
    const dialog = createSettingsDialog();
    dialog.showModal();
    
    return new Promise((resolve, reject) => {
      dialog.addEventListener('close', () => {
        if (dialog.returnValue === 'saved') {
          settings = getSettings();
          if (settings) {
            document.body.removeChild(dialog);
            resolve(settings);
          } else {
            reject(new Error('Failed to save settings'));
          }
        } else {
          document.body.removeChild(dialog);
          reject(new Error('Settings configuration cancelled'));
        }
      });
    });
  }
  
  return settings;
}
const ORDERED_MONTH_PREFIXES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

interface YnabTransaction {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
  account_id: string;
  payee_name?: string;
  category_id?: string | null;
  cleared?: string;
  approved?: boolean;
}

interface YnabTransactionsResponse {
  data: {
    transactions: YnabTransaction[];
  };
}

interface CardTransaction {
  type: string;
  date: Date;
  payee: string;
  description: string;
  status: string;
  amount: number;
}

interface TransactionUpdate {
  id: string;
  updates: {
    memo: string;
  };
  cardTransaction?: CardTransaction;
  ynabTransaction?: YnabTransaction;
}

interface MatchingResult {
  transactionsToUpdate: TransactionUpdate[];
  unmatchedYnabTransactions: YnabTransaction[];
  unmatchedCardTransactions: CardTransaction[];
  skippedPayments: CardTransaction[];
}

async function getYnabTransactions(since_date: string, settings: Settings): Promise<YnabTransaction[]> {
  const headers = new Headers();
  headers.append("Authorization", `Bearer ${settings.ynabToken}`);
  headers.append("Content-Type", "application/json");

  async function api(endpoint: string, query: Record<string, string>): Promise<YnabTransactionsResponse> {
    const url = new URL(`${YNAB_API_BASE_URL}${endpoint}`);
    url.search = new URLSearchParams(query).toString();

    const response = await fetch(url.href, {
      headers,
    });
    return response.json() as Promise<YnabTransactionsResponse>;
  }

  const transactions = await api(`budgets/${settings.ynabBudgetId}/transactions`, {
    since_date: since_date,
  });

  return transactions.data.transactions.filter(
    (transaction) => transaction.account_id === settings.ynabAccountId
  );
}

async function createYnabTransaction(transaction: Partial<YnabTransaction>, settings: Settings): Promise<any> {
  const headers = new Headers();
  headers.append("Authorization", `Bearer ${settings.ynabToken}`);
  headers.append("Content-Type", "application/json");

  const response = await fetch(
    `${YNAB_API_BASE_URL}budgets/${settings.ynabBudgetId}/transactions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        transaction,
      }),
    }
  );

  return response.json();
}

async function updateYnabTransaction(transactionId: string, updates: Partial<YnabTransaction>, settings: Settings): Promise<any> {
  const headers = new Headers();
  headers.append("Authorization", `Bearer ${settings.ynabToken}`);
  headers.append("Content-Type", "application/json");

  const response = await fetch(
    `${YNAB_API_BASE_URL}budgets/${settings.ynabBudgetId}/transactions/${transactionId}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        transaction: updates,
      }),
    }
  );

  return response.json();
}

/**
 * Retrieves an array of all text nodes under a given element.
 *
 * @param el - The element under which to search for text nodes.
 * @returns An array of text nodes found under the given element.
 */
function textNodesUnder(el: Node): Node[] {
  const children: Node[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    children.push(walker.currentNode);
  }
  return children;
}

function getCardTransactions(): CardTransaction[] {
  // first we get all of the transactions from the DOM
  const transactionEls = document.querySelectorAll(
    "#activity-panel [data-type='transaction']"
  );
  let currentYear = new Date().getFullYear();
  let previousMonth: number | null = null;

  return Array.from(transactionEls).map((el) => {
    const [typeEl, dateEl, descriptionEl, statusEl, amountEl, ...rest] =
      el.children;

    // we have to jump through a few hoops to parse out the date

    // TODO: fix handling of long lists that span years
    // since the transaction year isn't displayed, we will assume that the
    // first transaction happened in the current year, but for subsequent transactions
    // we need to see if the month has rolled over and decrement the year every time
    const dateSpan = dateEl.getElementsByTagName("span")[0];
    if (!dateSpan) {
      throw new Error("Date span not found");
    }
    const [rawMonth, rawDay] = dateSpan.textContent!.split(" ");

    const month =
      1 +
      ORDERED_MONTH_PREFIXES.findIndex((prefix) =>
        rawMonth.toLowerCase().startsWith(prefix)
      );

    // check if the month has rolled over
    if (previousMonth !== null && month > previousMonth) {
      currentYear--;
    }

    // save previous month
    previousMonth = month;

    const descriptionParagraphs = Array.from(
      descriptionEl.getElementsByTagName("p")
    );
    const textNodes = descriptionParagraphs.flatMap((el) =>
      textNodesUnder(el)
        .filter((t) => t.textContent?.trim())
        .map((t) => t.textContent!.trim())
    );

    const [payee, ...restDescription] = textNodes;

    const typeSpan = typeEl.querySelector("span");
    const statusDiv = statusEl.querySelector("div");
    const amountDiv = amountEl.getElementsByTagName("div")[0];

    if (!typeSpan || !statusDiv || !amountDiv) {
      throw new Error("Required elements not found");
    }

    return {
      type: typeSpan.textContent!,
      date: new Date(`${currentYear}-${month}-${rawDay.padStart(2, "0")}`),
      payee: payee?.trim() || "",
      description: restDescription.join("\n").trim(),
      status: statusDiv.textContent!,
      amount: Math.round(
        parseFloat(
          amountDiv.textContent!.replace("$", "")
        ) * 1000
      ),
    };
  });
}

function performMatching(cardTransactions: CardTransaction[], ynabTransactions: YnabTransaction[], useDateTolerance: boolean): MatchingResult {
  const transactionsToUpdate: TransactionUpdate[] = [];
  const skippedPayments: CardTransaction[] = [];
  const matchedCardTransactions = new Set<CardTransaction>();

  cardTransactions.forEach((cardTransaction) => {
    const isPayment = cardTransaction.type.toLowerCase() === "payment";
    
    // Skip payments
    if (isPayment) {
      skippedPayments.push(cardTransaction);
      matchedCardTransactions.add(cardTransaction);
      return;
    }
    
    const cardTransactionDate = cardTransaction.date.toISOString().split("T")[0];
    
    // First try to find exact match by amount and date
    let matchingYnabTransaction = ynabTransactions.find(
      (y) =>
        y.amount === cardTransaction.amount * -1 &&
        y.date === cardTransactionDate
    );
    
    // If no exact match and date tolerance is enabled, try +/- 1 day with same amount
    if (!matchingYnabTransaction && useDateTolerance) {
      const cardDate = new Date(cardTransaction.date);
      const dayBefore = new Date(cardDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(cardDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      
      matchingYnabTransaction = ynabTransactions.find(
        (y) =>
          y.amount === cardTransaction.amount * -1 &&
          (y.date === dayBefore.toISOString().split("T")[0] ||
           y.date === dayAfter.toISOString().split("T")[0])
      );
    }
    
    if (matchingYnabTransaction) {
      matchedCardTransactions.add(cardTransaction);
      // If we found a matching transaction, prepare to update its memo
      const newMemo = cardTransaction.description.substring(0, 500);
      
      // Only update if the memo is different
      if (matchingYnabTransaction.memo !== newMemo) {
        transactionsToUpdate.push({
          id: matchingYnabTransaction.id,
          updates: {
            memo: newMemo
          },
          cardTransaction,
          ynabTransaction: matchingYnabTransaction
        });
      }
    }
  });

  // Find unmatched card transactions (new transactions to be created)
  const unmatchedCardTransactions = cardTransactions.filter(
    card => !matchedCardTransactions.has(card)
  );

  // Find unmatched YNAB transactions
  const unmatchedYnabTransactions = ynabTransactions.filter((ynabTransaction) => {
    return !cardTransactions.some(
      (c) =>
        ynabTransaction.amount === c.amount * -1 &&
        ynabTransaction.date === c.date.toISOString().split("T")[0]
    );
  });

  return {
    transactionsToUpdate,
    unmatchedYnabTransactions,
    unmatchedCardTransactions,
    skippedPayments
  };
}

function createConfirmationDialog(matchingResult: MatchingResult, useDateTolerance: boolean): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.style.cssText = `
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #ccc;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    max-width: 900px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  const formatAmount = (amount: number) => {
    return `$${Math.abs(amount / 1000).toFixed(2)}`;
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };
  
  let tableHtml = '';
  
  // Updates table
  if (matchingResult.transactionsToUpdate.length > 0) {
    tableHtml += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0;">Transactions to Update (<span id="update-selected-count">${matchingResult.transactionsToUpdate.length}</span> of ${matchingResult.transactionsToUpdate.length})</h3>
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" id="select-all-updates" checked style="margin-right: 5px;" />
          Select All
        </label>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 8px; text-align: center; border: 1px solid #ddd; width: 40px;">✓</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Date</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Amount</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Payee</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Current Memo</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">New Memo</th>
          </tr>
        </thead>
        <tbody>
          ${matchingResult.transactionsToUpdate.map((t, index) => `
            <tr>
              <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
                <input type="checkbox" class="update-checkbox" data-index="${index}" checked />
              </td>
              <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(t.ynabTransaction!.date)}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${formatAmount(t.ynabTransaction!.amount)}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${t.cardTransaction!.payee}</td>
              <td style="padding: 8px; border: 1px solid #ddd; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${t.ynabTransaction!.memo || '(empty)'}</td>
              <td style="padding: 8px; border: 1px solid #ddd; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${t.updates.memo}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    tableHtml += '<p>No transactions need updating.</p>';
  }
  
  // New transactions table
  if (matchingResult.unmatchedCardTransactions.length > 0) {
    tableHtml += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; margin-top: 20px;">
        <h3 style="margin: 0; color: #28a745;">New Transactions to Create (<span id="new-selected-count">${matchingResult.unmatchedCardTransactions.length}</span> of ${matchingResult.unmatchedCardTransactions.length})</h3>
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" id="select-all-new" checked style="margin-right: 5px;" />
          Select All
        </label>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #e8f5e9;">
            <th style="padding: 8px; text-align: center; border: 1px solid #4caf50; width: 40px;">✓</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Date</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Amount</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Payee</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Status</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Memo</th>
          </tr>
        </thead>
        <tbody>
          ${matchingResult.unmatchedCardTransactions.map((t, index) => `
            <tr>
              <td style="padding: 8px; text-align: center; border: 1px solid #4caf50;">
                <input type="checkbox" class="new-checkbox" data-index="${index}" checked />
              </td>
              <td style="padding: 8px; border: 1px solid #4caf50;">${formatDate(t.date.toISOString())}</td>
              <td style="padding: 8px; border: 1px solid #4caf50;">${formatAmount(t.amount)}</td>
              <td style="padding: 8px; border: 1px solid #4caf50;">${t.payee}</td>
              <td style="padding: 8px; border: 1px solid #4caf50;">${t.status}</td>
              <td style="padding: 8px; border: 1px solid #4caf50; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${t.description}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  // Unmatched YNAB transactions (informational only)
  if (matchingResult.unmatchedYnabTransactions.length > 0) {
    tableHtml += `
      <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
        <h3 style="margin: 0 0 10px 0; color: #856404;">📋 YNAB Transactions Without Matches (${matchingResult.unmatchedYnabTransactions.length})</h3>
        <p style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">These YNAB transactions don't have corresponding entries in the card activity. They may be manual entries, pending transactions, or older items.</p>
        <details>
          <summary style="cursor: pointer; color: #856404; font-weight: bold;">Click to view details</summary>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background: #ffeaa7;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Date</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Amount</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Payee</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Memo</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${matchingResult.unmatchedYnabTransactions.map(t => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ffc107;">${formatDate(t.date)}</td>
                  <td style="padding: 8px; border: 1px solid #ffc107;">${formatAmount(t.amount)}</td>
                  <td style="padding: 8px; border: 1px solid #ffc107;">${t.payee_name || '(none)'}</td>
                  <td style="padding: 8px; border: 1px solid #ffc107; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${t.memo || '(empty)'}</td>
                  <td style="padding: 8px; border: 1px solid #ffc107;">${t.cleared || 'uncleared'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </details>
      </div>
    `;
  }
  
  dialog.innerHTML = `
    <h2 style="margin-top: 0;">Review Transaction Updates</h2>
    
    <div style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
      <label style="display: flex; align-items: center; font-weight: bold;">
        <input type="checkbox" id="use-date-tolerance" ${useDateTolerance ? 'checked' : ''} style="margin-right: 8px;" />
        Enable ±1 day date tolerance for matching
      </label>
      <button id="rerun-matching" style="margin-top: 10px; padding: 6px 12px;">Re-run Matching</button>
    </div>
    
    <div id="matching-results">
      ${tableHtml}
    </div>
    
    ${matchingResult.skippedPayments.length > 0 ? `
      <details style="margin-top: 10px;">
        <summary style="cursor: pointer;">Skipped Payments (${matchingResult.skippedPayments.length})</summary>
        <ul style="margin-top: 10px;">
          ${matchingResult.skippedPayments.map(p => 
            `<li>${formatDate(p.date.toISOString())} - ${formatAmount(p.amount)}</li>`
          ).join('')}
        </ul>
      </details>
    ` : ''}
    
    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
      <button type="button" id="cancel-btn" style="padding: 8px 16px;">Cancel</button>
      <button type="button" id="confirm-btn" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px;" ${matchingResult.transactionsToUpdate.length === 0 && matchingResult.unmatchedCardTransactions.length === 0 ? 'disabled' : ''}>
        Confirm (<span id="confirm-update-count">${matchingResult.transactionsToUpdate.length}</span> updates, <span id="confirm-new-count">${matchingResult.unmatchedCardTransactions.length}</span> new)
      </button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  return dialog;
}

async function main(): Promise<void> {
  // Ensure settings are configured
  let settings: Settings;
  try {
    settings = await ensureSettings();
  } catch (error) {
    console.error('Settings configuration failed:', error);
    return;
  }

  const cardTransactions = getCardTransactions();

  // the earliest transaction is the last one in the list
  // we'll look at all YNAB Amazon Store Card transactions after this date
  const earliestTransaction = cardTransactions[cardTransactions.length - 1];

  const ynabTransactions = await getYnabTransactions(
    earliestTransaction.date.toISOString(),
    settings
  );

  // Initial matching with date tolerance disabled
  let useDateTolerance = false;
  let matchingResult = performMatching(cardTransactions, ynabTransactions, useDateTolerance);
  
  // Show confirmation dialog
  const dialog = createConfirmationDialog(matchingResult, useDateTolerance);
  
  // Handle re-run matching
  const rerunBtn = dialog.querySelector('#rerun-matching') as HTMLButtonElement;
  const dateToleranceCheckbox = dialog.querySelector('#use-date-tolerance') as HTMLInputElement;
  const matchingResultsDiv = dialog.querySelector('#matching-results') as HTMLDivElement;
  const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement;
  
  // Function to update counts and button state
  const updateSelectionCounts = () => {
    const updateCheckboxes = dialog.querySelectorAll('.update-checkbox') as NodeListOf<HTMLInputElement>;
    const newCheckboxes = dialog.querySelectorAll('.new-checkbox') as NodeListOf<HTMLInputElement>;
    const updateCheckedCount = Array.from(updateCheckboxes).filter(cb => cb.checked).length;
    const newCheckedCount = Array.from(newCheckboxes).filter(cb => cb.checked).length;
    
    const updateSelectedCountSpan = dialog.querySelector('#update-selected-count');
    const newSelectedCountSpan = dialog.querySelector('#new-selected-count');
    const confirmUpdateCountSpan = dialog.querySelector('#confirm-update-count');
    const confirmNewCountSpan = dialog.querySelector('#confirm-new-count');
    
    if (updateSelectedCountSpan) updateSelectedCountSpan.textContent = updateCheckedCount.toString();
    if (newSelectedCountSpan) newSelectedCountSpan.textContent = newCheckedCount.toString();
    if (confirmUpdateCountSpan) confirmUpdateCountSpan.textContent = updateCheckedCount.toString();
    if (confirmNewCountSpan) confirmNewCountSpan.textContent = newCheckedCount.toString();
    
    confirmBtn.disabled = updateCheckedCount === 0 && newCheckedCount === 0;
  };
  
  // Handle select all checkboxes
  const setupCheckboxHandlers = () => {
    // Updates checkboxes
    const selectAllUpdates = dialog.querySelector('#select-all-updates') as HTMLInputElement;
    const updateCheckboxes = dialog.querySelectorAll('.update-checkbox') as NodeListOf<HTMLInputElement>;
    
    if (selectAllUpdates) {
      selectAllUpdates.addEventListener('change', (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        updateCheckboxes.forEach(cb => cb.checked = isChecked);
        updateSelectionCounts();
      });
    }
    
    updateCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        updateSelectionCounts();
        
        if (selectAllUpdates) {
          const allChecked = Array.from(updateCheckboxes).every(cb => cb.checked);
          const someChecked = Array.from(updateCheckboxes).some(cb => cb.checked);
          selectAllUpdates.checked = allChecked;
          selectAllUpdates.indeterminate = someChecked && !allChecked;
        }
      });
    });
    
    // New transactions checkboxes
    const selectAllNew = dialog.querySelector('#select-all-new') as HTMLInputElement;
    const newCheckboxes = dialog.querySelectorAll('.new-checkbox') as NodeListOf<HTMLInputElement>;
    
    if (selectAllNew) {
      selectAllNew.addEventListener('change', (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        newCheckboxes.forEach(cb => cb.checked = isChecked);
        updateSelectionCounts();
      });
    }
    
    newCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        updateSelectionCounts();
        
        if (selectAllNew) {
          const allChecked = Array.from(newCheckboxes).every(cb => cb.checked);
          const someChecked = Array.from(newCheckboxes).some(cb => cb.checked);
          selectAllNew.checked = allChecked;
          selectAllNew.indeterminate = someChecked && !allChecked;
        }
      });
    });
  };
  
  setupCheckboxHandlers();
  
  rerunBtn.addEventListener('click', () => {
    useDateTolerance = dateToleranceCheckbox.checked;
    matchingResult = performMatching(cardTransactions, ynabTransactions, useDateTolerance);
    
    // Update the results display
    let tableHtml = '';
    
    // Updates table
    if (matchingResult.transactionsToUpdate.length > 0) {
      tableHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h3 style="margin: 0;">Transactions to Update (<span id="update-selected-count">${matchingResult.transactionsToUpdate.length}</span> of ${matchingResult.transactionsToUpdate.length})</h3>
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="select-all-updates" checked style="margin-right: 5px;" />
            Select All
          </label>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f0f0f0;">
              <th style="padding: 8px; text-align: center; border: 1px solid #ddd; width: 40px;">✓</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Date</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Amount</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Payee</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Current Memo</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">New Memo</th>
            </tr>
          </thead>
          <tbody>
            ${matchingResult.transactionsToUpdate.map((t, index) => `
              <tr>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
                  <input type="checkbox" class="update-checkbox" data-index="${index}" checked />
                </td>
                <td style="padding: 8px; border: 1px solid #ddd;">${new Date(t.ynabTransaction!.date).toLocaleDateString()}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">$${Math.abs(t.ynabTransaction!.amount / 1000).toFixed(2)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${t.cardTransaction!.payee}</td>
                <td style="padding: 8px; border: 1px solid #ddd; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${t.ynabTransaction!.memo || '(empty)'}</td>
                <td style="padding: 8px; border: 1px solid #ddd; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${t.updates.memo}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      tableHtml += '<p>No transactions need updating.</p>';
    }
    
    // New transactions table
    if (matchingResult.unmatchedCardTransactions.length > 0) {
      tableHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; margin-top: 20px;">
          <h3 style="margin: 0; color: #28a745;">New Transactions to Create (<span id="new-selected-count">${matchingResult.unmatchedCardTransactions.length}</span> of ${matchingResult.unmatchedCardTransactions.length})</h3>
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="select-all-new" checked style="margin-right: 5px;" />
            Select All
          </label>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #e8f5e9;">
              <th style="padding: 8px; text-align: center; border: 1px solid #4caf50; width: 40px;">✓</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Date</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Amount</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Payee</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Status</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #4caf50;">Memo</th>
            </tr>
          </thead>
          <tbody>
            ${matchingResult.unmatchedCardTransactions.map((t, index) => `
              <tr>
                <td style="padding: 8px; text-align: center; border: 1px solid #4caf50;">
                  <input type="checkbox" class="new-checkbox" data-index="${index}" checked />
                </td>
                <td style="padding: 8px; border: 1px solid #4caf50;">${new Date(t.date).toLocaleDateString()}</td>
                <td style="padding: 8px; border: 1px solid #4caf50;">$${Math.abs(t.amount / 1000).toFixed(2)}</td>
                <td style="padding: 8px; border: 1px solid #4caf50;">${t.payee}</td>
                <td style="padding: 8px; border: 1px solid #4caf50;">${t.status}</td>
                <td style="padding: 8px; border: 1px solid #4caf50; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${t.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    // Unmatched YNAB transactions (informational only)
    if (matchingResult.unmatchedYnabTransactions.length > 0) {
      tableHtml += `
        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0; color: #856404;">📋 YNAB Transactions Without Matches (${matchingResult.unmatchedYnabTransactions.length})</h3>
          <p style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">These YNAB transactions don't have corresponding entries in the card activity. They may be manual entries, pending transactions, or older items.</p>
          <details>
            <summary style="cursor: pointer; color: #856404; font-weight: bold;">Click to view details</summary>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: #ffeaa7;">
                  <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Date</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Amount</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Payee</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Memo</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #ffc107;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${matchingResult.unmatchedYnabTransactions.map(t => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ffc107;">${new Date(t.date).toLocaleDateString()}</td>
                    <td style="padding: 8px; border: 1px solid #ffc107;">$${Math.abs(t.amount / 1000).toFixed(2)}</td>
                    <td style="padding: 8px; border: 1px solid #ffc107;">${t.payee_name || '(none)'}</td>
                    <td style="padding: 8px; border: 1px solid #ffc107; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${t.memo || '(empty)'}</td>
                    <td style="padding: 8px; border: 1px solid #ffc107;">${t.cleared || 'uncleared'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </details>
        </div>
      `;
    }
    
    matchingResultsDiv.innerHTML = tableHtml;
    
    // Re-setup checkbox handlers after updating HTML
    setupCheckboxHandlers();
    updateSelectionCounts();
  });
  
  // Handle cancel
  const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement;
  cancelBtn.addEventListener('click', () => {
    dialog.close('cancelled');
  });
  
  // Handle confirm
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    
    // Get selected update transactions
    const updateCheckboxes = dialog.querySelectorAll('.update-checkbox') as NodeListOf<HTMLInputElement>;
    const selectedUpdates = matchingResult.transactionsToUpdate.filter((_, index) => {
      const checkbox = Array.from(updateCheckboxes).find(cb => cb.dataset.index === index.toString());
      return checkbox?.checked;
    });
    
    // Get selected new transactions
    const newCheckboxes = dialog.querySelectorAll('.new-checkbox') as NodeListOf<HTMLInputElement>;
    const selectedNewTransactions = matchingResult.unmatchedCardTransactions.filter((_, index) => {
      const checkbox = Array.from(newCheckboxes).find(cb => cb.dataset.index === index.toString());
      return checkbox?.checked;
    });
    
    try {
      let updatedCount = 0;
      let createdCount = 0;
      
      // Update selected transactions with new memos
      for (const transaction of selectedUpdates) {
        console.log(`Updating transaction ${transaction.id} with new memo`);
        await updateYnabTransaction(transaction.id, transaction.updates, settings);
        updatedCount++;
      }
      
      // Create new transactions (in reverse order to maintain chronological order)
      for (let i = selectedNewTransactions.length - 1; i >= 0; i--) {
        const cardTransaction = selectedNewTransactions[i];
        const newTransaction = {
          account_id: settings.ynabAccountId,
          date: cardTransaction.date.toISOString().split("T")[0],
          amount: cardTransaction.amount * -1, // YNAB expects negative for expenses
          payee_name: cardTransaction.payee,
          memo: cardTransaction.description.substring(0, 500),
          cleared: cardTransaction.status.toLowerCase() === "posted" ? "cleared" : "uncleared",
        };
        
        console.log(`Creating new transaction for ${cardTransaction.payee} on ${newTransaction.date}`);
        await createYnabTransaction(newTransaction, settings);
        createdCount++;
      }
      
      console.log(`Updated ${updatedCount} and created ${createdCount} transaction(s)`);
      dialog.close('confirmed');
      
      // Show success message
      const successDialog = document.createElement('dialog');
      successDialog.style.cssText = `
        padding: 20px;
        border-radius: 8px;
        border: 1px solid #28a745;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      `;
      
      let successMessage = '';
      if (updatedCount > 0 && createdCount > 0) {
        successMessage = `Updated ${updatedCount} and created ${createdCount} transaction(s) successfully.`;
      } else if (updatedCount > 0) {
        successMessage = `Updated ${updatedCount} transaction(s) successfully.`;
      } else if (createdCount > 0) {
        successMessage = `Created ${createdCount} new transaction(s) successfully.`;
      }
      
      successDialog.innerHTML = `
        <h3 style="color: #28a745; margin-top: 0;">Success!</h3>
        <p>${successMessage}</p>
        <button onclick="this.parentElement.close(); this.parentElement.remove();" style="padding: 6px 12px;">Close</button>
      `;
      document.body.appendChild(successDialog);
      successDialog.showModal();
      
    } catch (error) {
      console.error('Error processing transactions:', error);
      confirmBtn.textContent = 'Error - Try Again';
      confirmBtn.disabled = false;
    }
  });
  
  dialog.showModal();
  
  // Clean up dialog when closed
  dialog.addEventListener('close', () => {
    document.body.removeChild(dialog);
  });
}

// Execute the main function
main().catch(console.error);