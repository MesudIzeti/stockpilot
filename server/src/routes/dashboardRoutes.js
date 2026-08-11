const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSummary, getLowStock, getExpiryWarnings } = require('../controllers/dashboardController');

router.get('/summary', auth, getSummary);
router.get('/low-stock', auth, getLowStock);
router.get('/expiry-warnings', auth, getExpiryWarnings);

module.exports = router;
 