let _rateCache   = null;
let _rateCacheAt = 0;
const RATE_TTL   = 60 * 60 * 1000; // 1 hour

async function getRates() {
  if (_rateCache && Date.now() - _rateCacheAt < RATE_TTL) {
    return _rateCache;
  }
  const r    = await fetch('https://open.er-api.com/v6/latest/USD');
  const data = await r.json();
  if (data.result !== 'success') throw new Error('Exchange rate API error');
  _rateCache   = data.rates;
  _rateCacheAt = Date.now();
  return _rateCache;
}

// Returns how many units of `code` equal 1 USD (i.e. the value from the API).
// USD itself is always 1.0.
function rateForCurrency(rates, code) {
  if (!code || code === 'USD') return 1.0;
  return rates[code] ?? 1.0;
}

module.exports = { getRates, rateForCurrency };
