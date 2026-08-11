const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const {
    upload,
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getDeletedProducts,
    restoreProduct,
    batchCreateProducts,
    importProducts,
} = require('../controllers/productController');

// Fixed-path routes must come before /:id to avoid parameter capture
router.get('/deleted',        auth, getDeletedProducts);
router.post('/batch',         auth, batchCreateProducts);
router.post('/import',        auth, upload.single('file'), importProducts);

router.get('/',               auth, getProducts);
router.post('/',              auth, createProduct);
router.get('/:id',            auth, getProduct);
router.put('/:id',            auth, updateProduct);
router.delete('/:id',         auth, deleteProduct);
router.put('/:id/restore',    auth, restoreProduct);

module.exports = router;
