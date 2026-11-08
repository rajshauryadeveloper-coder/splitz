import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balances, equalShares, validateExpense } from '../public/ledger.js';

test('equal splits preserve every paise', () => {
  assert.deepEqual(equalShares(1000, ['Shaurya', 'Tata', 'Sohan']), {
    Shaurya: 334, Tata: 333, Sohan: 333,
  });
});

const expense = {
  title: 'Dinner', total: 1000,
  paid: { Shaurya: 700, Tata: 300 },
  shares: { Shaurya: 200, Tata: 200, Sohan: 600 },
};

test('multiple payers receive their net contribution and payments survive bill changes', () => {
  const payment = { from: 'Sohan', to: 'Shaurya', amount: 500 };
  assert.deepEqual(balances([expense]), [
    payment, { from: 'Sohan', to: 'Tata', amount: 100 },
  ]);
  assert.deepEqual(balances([expense], [payment]), [
    { from: 'Sohan', to: 'Tata', amount: 100 },
  ]);
  assert.deepEqual(balances([], [payment]), [
    { from: 'Shaurya', to: 'Sohan', amount: 500 },
  ]);
});

test('rejects mismatched totals and unknown people', () => {
  assert.equal(validateExpense(expense), true);
  assert.equal(validateExpense({ ...expense, paid: { Shaurya: 999 } }), false);
  assert.equal(validateExpense({ ...expense, shares: { Visitor: 1000 } }), false);
});
