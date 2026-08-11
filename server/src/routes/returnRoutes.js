const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createReturn, getReturns, getSaleForReturn } = require('../controllers/returnController');

router.get('/', auth, getReturns);
router.get('/sale/:saleId', auth, getSaleForReturn);
router.post('/', auth, createReturn);

module.exports = router;
