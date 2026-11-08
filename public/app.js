import { balances, equalShares, people, validateExpense } from './ledger.js';

const $ = id => document.getElementById(id);
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const format = amount => money.format(amount / 100);
const decimal = amount => (amount / 100).toFixed(2);
let ledger;
let selected = '';
let editing;
let payment;
let loading;
let busy = false;

function node(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text, action, className = 'quiet') {
  const element = node('button', text, className);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

function message(id, text = '') {
  $(id).textContent = text;
  $(id).hidden = !text;
}

function row(title, detail, amount, action) {
  const item = node('div', '', 'row');
  const info = node('div', '');
  info.append(node('p', title, 'row-title'));
  if (detail) info.append(node('p', detail, 'meta'));
  const actions = node('div', '', 'row-actions');
  actions.append(node('span', format(amount), 'money'), action);
  item.append(info, actions);
  return item;
}

function list(id, rows, empty) {
  $(id).replaceChildren(...(rows.length ? rows : [node('p', empty, 'empty')]));
}

function render() {
  $('welcome').hidden = Boolean(selected);
  $('dashboard').hidden = !selected;
  if (!selected) return;
  $('heading').textContent = selected + '’s trip';
  $('add').disabled = !ledger || busy;
  const relevant = item => item.from === selected || item.to === selected;
  const open = ledger ? balances(ledger.expenses, ledger.payments).filter(relevant) : [];
  for (const [id, key] of [['owe', 'from'], ['receive', 'to']]) {
    $(id).textContent = ledger ? format(open.reduce((sum, item) =>
      sum + (item[key] === selected ? item.amount : 0), 0)) : '—';
  }
  list('settlements', open.map(item => {
    const title = item.from === selected ? 'Pay ' + item.to : 'Receive from ' + item.from;
    return row(title, '', item.amount,
      button('Record payment', () => openPayment(item)));
  }), ledger ? 'You’re all settled up.' : 'Waiting for the trip ledger…');
  const expenses = ledger?.expenses.filter(item =>
    $('all').checked || item.paid[selected] || item.shares[selected]) ?? [];
  list('expenses', expenses.map(item => {
    const bill = node('article', '');
    const personal = [
      item.paid[selected] && 'You paid ' + format(item.paid[selected]),
      item.shares[selected] && 'Your share ' + format(item.shares[selected]),
    ].filter(Boolean);
    const detail = personal.length ? personal.join(' / ') : 'Paid by ' + Object.keys(item.paid).join(', ');
    const edit = button('Edit', () => openEditor(item));
    edit.setAttribute('aria-label', 'Edit ' + item.title);
    const breakdown = node('details', '', 'breakdown');
    breakdown.append(node('summary', 'View split'));
    for (const [label, amounts] of [['Paid by', item.paid], ['Split between', item.shares]]) {
      const line = node('p', '');
      line.append(node('strong', label + ' '), Object.entries(amounts)
        .map(([name, amount]) => name + ' ' + format(amount)).join(', '));
      breakdown.append(line);
    }
    bill.append(row(item.title, detail, item.total, edit), breakdown);
    return bill;
  }), ledger ? ($('all').checked ? 'No trip expenses yet. Add an expense to get started.'
    : 'No expenses for ' + selected + ' yet. Add one or view all trip expenses.') : 'Waiting for the trip ledger…');
  const history = ledger?.payments.filter(relevant) ?? [];
  $('history-section').hidden = !history.length;
  list('history', history.map(item => row(item.from + ' → ' + item.to,
    new Date(item.date).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
    item.amount, button('Undo', () => {
      if (confirm('Remove this payment from the ledger?')) mutate({ action: 'undo', id: item.id });
    }))), '');
}

async function request(body) {
  const response = await fetch('/api/ledger', body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
  return data;
}

function refresh() {
  if (loading || busy) return loading;
  const previous = ledger;
  loading = request().then(next => {
    if (ledger !== previous || busy) return;
    if (!ledger || next.revision !== ledger.revision) {
      ledger = next;
      render();
    }
    if (!$('retry').hidden) message('notice');
    $('retry').hidden = true;
  }).catch(() => {
    message('notice', 'Could not load the shared ledger.');
    $('retry').hidden = false;
  }).finally(() => { loading = undefined; });
  return loading;
}

async function mutate(change, form) {
  if (busy || !ledger) return;
  const target = form ? form.error : 'notice';
  message(target);
  busy = true;
  const controls = ['save', 'remove', 'payment-save', 'add'].map($);
  for (const control of controls) control.disabled = true;
  let saved = false;
  try {
    ledger = await request({ ...change, revision: form ? form.revision : ledger.revision });
    if (form) $(form.dialog).close();
    message('notice');
    $('retry').hidden = true;
    saved = true;
  } catch (error) {
    message(target, error.status ? error.message : 'Could not save. Reload the ledger and check whether the change was recorded.');
    if (error.status === 409) {
      try {
        ledger = await request();
        if (form) {
          message(target, 'The ledger changed. Close and reopen this form to review the latest amounts.');
          form.stale = true;
        }
      } catch {
        message(target, 'Could not reload the ledger. Refresh the page and try again.');
      }
    }
  } finally {
    busy = false;
    for (const control of controls) control.disabled = false;
    render();
    if (form?.stale) {
      if (form.dialog === 'editor') $('save').disabled = $('remove').disabled = true;
      else $('payment-save').disabled = true;
    }
    if (saved && selected) $(change.action === 'settle' || change.action === 'undo' ? 'settle-title' : 'bills-title').focus();
  }
}

function openPayment(item) {
  if (busy) return;
  payment = { ...item, revision: ledger.revision, dialog: 'payment-editor', error: 'payment-error' };
  $('payment-detail').textContent = item.from + ' owes ' + item.to + ' ' + format(item.amount) + '.';
  $('payment-amount').value = decimal(item.amount);
  $('payment-save').disabled = false;
  message('payment-error');
  $('payment-editor').showModal();
}

function choose(name) {
  selected = name;
  $('person').value = name;
  $('all').checked = false;
  render();
  if (name) {
    $('heading').focus();
    refresh();
  }
}

for (const name of people) {
  $('person').add(new Option(name, name));
  const pick = button(name, () => choose(name), 'name-button');
  const initial = node('span', name[0], 'initial');
  initial.setAttribute('aria-hidden', 'true');
  pick.prepend(initial);
  $('names').append(pick);
}
$('person').addEventListener('change', event => choose(event.target.value));
$('all').addEventListener('change', render);

function makePeopleFields(id, kind) {
  return people.map(name => {
    const field = node('div', '', 'person-field');
    const label = node('label', '');
    const check = document.createElement('input');
    check.type = 'checkbox';
    label.append(check, name);
    const value = document.createElement('input');
    value.inputMode = 'decimal';
    value.placeholder = '₹ 0.00';
    value.setAttribute('aria-label', kind + ' for ' + name + ' in rupees');
    field.append(label, value);
    $(id).append(field);
    check.addEventListener('change', syncFields);
    return { name, check, value };
  });
}

const payers = makePeopleFields('payers', 'Amount paid');
const contributors = makePeopleFields('contributors', 'Share');
const checked = fields => fields.filter(field => field.check.checked);

function syncFields() {
  const singlePayer = checked(payers).length === 1;
  for (const field of payers) field.value.hidden = !field.check.checked || singlePayer;
  for (const field of contributors) field.value.hidden = !field.check.checked || $('equal').checked;
  const total = parseMoney($('amount').value);
  const split = checked(contributors);
  $('payer-hint').textContent = allocationHint(total, checked(payers), singlePayer);
  $('share-hint').textContent = allocationHint(total, split, $('equal').checked, true);
  $('everyone').textContent = checked(contributors).length === people.length ? 'Clear selection' : 'Select everyone';
}

function allocationHint(total, fields, automatic, split = false) {
  if (!(total > 0) || !fields.length) return '';
  if (automatic && split) {
    if (total < fields.length) return 'The total is too small to give everyone at least ₹0.01.';
    const base = Math.floor(total / fields.length);
    return total % fields.length ? format(base) + ' to ' + format(base + 1) + ' per person' : format(base) + ' per person';
  }
  if (automatic) return fields[0].name + ' paid the full ' + format(total) + '.';
  const allocated = Object.values(entered(fields)).reduce((sum, value) => sum + (value || 0), 0);
  if (allocated === total) return format(total) + ' allocated';
  return allocated < total ? format(total - allocated) + ' left to allocate' : format(allocated - total) + ' over the total';
}

function setFields(fields, amounts) {
  for (const { name, check, value } of fields) {
    check.checked = Object.hasOwn(amounts, name);
    value.value = amounts[name] > 0 ? decimal(amounts[name]) : '';
  }
}

function openEditor(expense) {
  if (busy || !ledger) return;
  editing = { id: expense?.id, revision: ledger.revision, dialog: 'editor', error: 'form-error' };
  $('save').disabled = $('remove').disabled = false;
  $('editor-title').textContent = expense ? 'Edit expense' : 'Add expense';
  $('title').value = expense?.title ?? '';
  $('amount').value = expense ? decimal(expense.total) : '';
  $('equal').checked = !expense || Object.entries(equalShares(expense.total,
    people.filter(name => Object.hasOwn(expense.shares, name))))
    .every(([name, amount]) => expense.shares[name] === amount);
  setFields(payers, expense?.paid ?? { [selected]: 0 });
  setFields(contributors, expense?.shares ?? { [selected]: 0 });
  $('remove').hidden = !expense;
  message('form-error');
  syncFields();
  $('editor').showModal();
}

function parseMoney(value) {
  const match = /^(\d{1,7})(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/.exec(value.trim());
  if (!match) return NaN;
  return Number(match[1] ?? 0) * 100 + Number((match[2] ?? match[3] ?? '').padEnd(2, '0'));
}

function entered(fields) {
  return Object.fromEntries(fields.map(({ name, value }) => [name, parseMoney(value.value)]));
}

$('add').addEventListener('click', () => openEditor());
$('close').addEventListener('click', () => { if (!busy) $('editor').close(); });
for (const id of ['editor', 'payment-editor']) {
  $(id).addEventListener('cancel', event => { if (busy) event.preventDefault(); });
}
$('payment-close').addEventListener('click', () => { if (!busy) $('payment-editor').close(); });
$('payment-form').addEventListener('submit', event => {
  event.preventDefault();
  if (payment.stale) return;
  const amount = parseMoney($('payment-amount').value);
  if (!(amount > 0 && amount <= payment.amount)) {
    return message('payment-error', 'Enter an amount between ₹0.01 and ' + format(payment.amount) + '.');
  }
  mutate({ action: 'settle', from: payment.from, to: payment.to, amount }, payment);
});
$('expense-form').addEventListener('input', event => {
  if (event.target.inputMode === 'decimal') syncFields();
});
$('equal').addEventListener('change', syncFields);
$('everyone').addEventListener('click', () => {
  const select = checked(contributors).length !== people.length;
  for (const field of contributors) field.check.checked = select;
  syncFields();
});
$('remove').addEventListener('click', () => {
  if (!editing.stale && confirm('Delete this expense? Recorded payments will remain in the ledger.')) {
    mutate({ action: 'delete', id: editing.id }, editing);
  }
});
$('expense-form').addEventListener('submit', event => {
  event.preventDefault();
  if (editing.stale) return;
  const title = $('title').value.trim();
  const total = parseMoney($('amount').value);
  const paidBy = checked(payers);
  const splitBetween = checked(contributors);
  if (!title || !(total > 0)) return message('form-error', 'Enter a description and a positive total with up to two decimal places.');
  if (!paidBy.length || !splitBetween.length) return message('form-error', 'Select at least one payer and one person to split with.');
  if ($('equal').checked && total < splitBetween.length) {
    return message('form-error', 'Select fewer people so each share is at least ₹0.01.');
  }
  const paid = paidBy.length === 1 ? { [paidBy[0].name]: total } : entered(paidBy);
  const shares = $('equal').checked ? equalShares(total, splitBetween.map(field => field.name)) : entered(splitBetween);
  const expense = { title, total, paid, shares };
  if (!validateExpense(expense)) {
    return message('form-error', 'Each selected amount must be positive. Payments and shares must each add up to ' + format(total) + '.');
  }
  mutate({ action: 'expense', id: editing.id, expense }, editing);
});

$('retry').addEventListener('click', refresh);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !document.querySelector('dialog[open]')) refresh();
});
refresh();
