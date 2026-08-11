const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createEmployee, getEmployees, deleteEmployee, getEmployeeActivity } = require('../controllers/userController');

router.post('/employees', auth, createEmployee);
router.get('/employees', auth, getEmployees);
router.delete('/employees/:id', auth, deleteEmployee);
router.get('/employees/:id/activity', auth, getEmployeeActivity);

module.exports = router;
