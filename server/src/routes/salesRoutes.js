const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');

const { 
    createSale,
    getSales,
    getSale
} = require('../controllers/salesController');

router.post('/', auth, createSale);
router.get('/', auth, getSales);
router.get('/:id', auth, getSale);

module.exports = router;