const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  getOrders,
  getReorderCandidates,
  createOrder,
  receiveOrder,
  cancelOrder,
} = require('../controllers/purchaseOrderController');

router.get('/',                                auth, getOrders);
router.get('/reorder-candidates/:supplierId',  auth, getReorderCandidates);
router.post('/',                               auth, createOrder);
router.put('/:id/receive',                     auth, receiveOrder);
router.put('/:id/cancel',                      auth, cancelOrder);

module.exports = router;
