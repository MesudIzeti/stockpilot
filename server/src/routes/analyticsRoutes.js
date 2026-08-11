const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRevenueTrend, getCategoryPerformance, getTopProducts, getSalesVelocity, getExchangeRates } = require('../controllers/analyticsController');

const ownerOnly = (req, res, next) => {
  if (req.user.role === 'employee') {
    return res.status(403).json({ message: 'Analytics are restricted to business owners' });
  }
  next();
};

router.get('/exchange-rates',      auth, getExchangeRates);
router.get('/revenue-trend',       auth, ownerOnly, getRevenueTrend);
router.get('/category-performance',auth, ownerOnly, getCategoryPerformance);
router.get('/top-products',        auth, ownerOnly, getTopProducts);
router.get('/sales-velocity',      auth, ownerOnly, getSalesVelocity);

module.exports = router;
