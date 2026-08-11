const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getDeletedCategories,
    restoreCategory,
} = require('../controllers/categoryController');

// Fixed-path route must come before /:id
router.get('/deleted',     auth, getDeletedCategories);

router.get('/',            auth, getCategories);
router.post('/',           auth, createCategory);
router.put('/:id',         auth, updateCategory);
router.delete('/:id',      auth, deleteCategory);
router.put('/:id/restore', auth, restoreCategory);

module.exports = router;
