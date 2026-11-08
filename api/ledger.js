import { randomUUID } from 'node:crypto';
import { balances, validateExpense } from '../public/ledger.js';
import { conflict, load, save } from '../lib/store.js';

let queue = Promise.resolve();

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function mutate(body) {
  const { data, etag } = await load();
  if (!body || typeof body !== 'object') throw invalid('Invalid request.');
  if (body.revision !== data.revision) throw conflict();
  const { action, id } = body;

  if (action === 'expense') {
    if (!validateExpense(body.expense)) throw invalid('Payments and shares must each add up to the bill total.');
    const { title, total, paid, shares } = body.expense;
    const index = data.expenses.findIndex(expense => expense.id === id);
    if (id != null && index < 0) throw invalid('This bill was removed.', 404);
    const expense = { id: id ?? randomUUID(), title: title.trim(), total, paid, shares };
    if (index < 0) data.expenses.unshift(expense);
    else data.expenses[index] = expense;
  } else if (action === 'delete') {
    if (!data.expenses.some(expense => expense.id === id)) throw invalid('This bill was removed.', 404);
    data.expenses = data.expenses.filter(expense => expense.id !== id);
  } else if (action === 'settle') {
    const payment = balances(data.expenses, data.payments).find(item =>
      item.from === body.from && item.to === body.to);
    if (!payment) throw conflict();
    if (!Number.isSafeInteger(body.amount) || body.amount < 1 || body.amount > payment.amount) {
      throw invalid('Enter an amount between ₹0.01 and the outstanding balance.');
    }
    data.payments.unshift({ ...payment, amount: body.amount, id: randomUUID(), date: new Date().toISOString() });
  } else if (action === 'undo') {
    if (!data.payments.some(payment => payment.id === id)) throw invalid('This payment was removed.', 404);
    data.payments = data.payments.filter(payment => payment.id !== id);
  } else {
    throw invalid('Unknown action.');
  }

  data.revision = randomUUID();
  await save(data, etag);
  return data;
}

export default async function handler(req, res) {
  function send(status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
  }

  try {
    if (req.method === 'GET') return send(200, (await load()).data);
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed.' });
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      throw invalid('Invalid JSON.');
    }
    const operation = queue.then(() => mutate(body));
    queue = operation.catch(() => {});
    send(200, await operation);
  } catch (error) {
    if (!error.status) console.error(error);
    send(error.status || 500, { error: error.status ? error.message : 'Could not access the shared ledger. Try again.' });
  }
}
