export const people = ['Shaurya', 'Shreyas', 'Tata', 'Sampriti', 'Prudhvi', 'Sahithi', 'Mahmood', 'Vipul', 'Sohan'];

export function equalShares(total, names) {
  const base = Math.floor(total / names.length);
  const remainder = total % names.length;
  return Object.fromEntries(names.map((name, index) => [name, base + Number(index < remainder)]));
}

export function validateExpense(expense) {
  const { title, total, paid, shares } = expense ?? {};
  if (typeof title !== 'string' || !title.trim() || title.length > 100 ||
      !Number.isSafeInteger(total) || total < 1 || total > 999999999) return false;
  return [paid, shares].every(amounts => {
    if (!amounts || Array.isArray(amounts) || typeof amounts !== 'object') return false;
    const entries = Object.entries(amounts);
    return entries.every(([name, amount]) =>
      people.includes(name) && Number.isSafeInteger(amount) && amount > 0 && amount <= total
    ) && entries.reduce((sum, [, amount]) => sum + amount, 0) === total;
  });
}

export function balances(expenses, payments = []) {
  const pairs = new Map();
  function add(from, to, amount) {
    const [first, second] = [from, to].sort((a, b) => people.indexOf(a) - people.indexOf(b));
    const key = first + '|' + second;
    pairs.set(key, (pairs.get(key) ?? 0) + (from === first ? amount : -amount));
  }

  for (const { paid, shares } of expenses) {
    const net = people.map(name => (paid[name] ?? 0) - (shares[name] ?? 0));
    const creditors = people.filter((_, i) => net[i] > 0);
    let next = 0;
    for (const [index, from] of people.entries()) {
      let due = -net[index];
      while (due > 0) {
        const to = creditors[next];
        const target = people.indexOf(to);
        const amount = Math.min(due, net[target]);
        add(from, to, amount);
        due -= amount;
        net[target] -= amount;
        if (!net[target]) next++;
      }
    }
  }
  for (const { from, to, amount } of payments) add(from, to, -amount);
  return [...pairs].flatMap(([key, amount]) => {
    const [first, second] = key.split('|');
    if (amount > 0) return [{ from: first, to: second, amount }];
    if (amount < 0) return [{ from: second, to: first, amount: -amount }];
    return [];
  });
}

// The starting ledger is public and ships with the site.
export const startingLedger = { revision: null, expenses: [], payments: [] };

export function updateLedger(current, body) {
  const data = structuredClone(current);
  if (body.revision !== data.revision) throw new Error('This ledger changed in another tab. Reopen the form and try again.');
  const { action, id } = body;

  if (action === 'expense') {
    if (!validateExpense(body.expense)) throw new Error('Payments and shares must each add up to the bill total.');
    const { title, total, paid, shares } = body.expense;
    const index = data.expenses.findIndex(expense => expense.id === id);
    if (id != null && index < 0) throw new Error('This bill was removed.');
    const expense = { id: id ?? crypto.randomUUID(), title: title.trim(), total, paid, shares };
    if (index < 0) data.expenses.unshift(expense);
    else data.expenses[index] = expense;
  } else if (action === 'delete') {
    if (!data.expenses.some(expense => expense.id === id)) throw new Error('This bill was removed.');
    data.expenses = data.expenses.filter(expense => expense.id !== id);
  } else if (action === 'settle') {
    const payment = balances(data.expenses, data.payments).find(item =>
      item.from === body.from && item.to === body.to);
    if (!payment) throw new Error('This ledger changed in another tab. Reopen the form and try again.');
    if (!Number.isSafeInteger(body.amount) || body.amount < 1 || body.amount > payment.amount) {
      throw new Error('Enter an amount between ₹0.01 and the outstanding balance.');
    }
    data.payments.unshift({ ...payment, amount: body.amount, id: crypto.randomUUID(), date: new Date().toISOString() });
  } else if (action === 'undo') {
    if (!data.payments.some(payment => payment.id === id)) throw new Error('This payment was removed.');
    data.payments = data.payments.filter(payment => payment.id !== id);
  } else {
    throw new Error('Unknown action.');
  }

  data.revision = crypto.randomUUID();
  return data;
}
