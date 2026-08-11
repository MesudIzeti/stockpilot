const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const {
    getSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier
} = require('../controllers/supplierController');

router.get('/', auth, getSuppliers);
router.post('/', auth, createSupplier);
router.put('/:id', auth, updateSupplier);
router.delete('/:id', auth, deleteSupplier);

module.exports = router;