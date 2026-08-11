const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');


const { addStock, adjustStock, getProductMovements } = require('../controllers/stockMovementController');


router.post('/add', auth, addStock);
router.post('/adjust', auth, adjustStock);
router.get('/product/:productId', auth, getProductMovements);

module.exports = router;
