const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getMobileQR } = require('../controllers/qrController');

router.get('/mobile', auth, getMobileQR);

module.exports = router;
