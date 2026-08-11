const express = require('express');
const cors = require('cors');
require('dotenv').config();


const authRoutes = require('./routes/authRoutes');
const categoryRouts = require('./routes/categoryRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const productRoutes = require('./routes/productRoutes');
const dashbordRouts = require('./routes/dashboardRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const qrRoutes = require('./routes/qrRoutes');



//week3 sales routes stockMovement routes notification routes

const salesRoutes = require('./routes/salesRoutes');
const stockMovementRoutes = require('./routes/stockMovementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const returnRoutes = require('./routes/returnRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const { checkAndSendPoReminders } = require('./services/notificationService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

//Routers first Update + add routes login regist

//is now working qr code ane orther routse
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRouts);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashbordRouts);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/users', userRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);



// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'StockPilot API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`StockPilot API running on port ${PORT}`);

  // Purchase order delivery reminders: check 30s after boot, then every hour
  setTimeout(checkAndSendPoReminders, 30_000);
  setInterval(checkAndSendPoReminders, 60 * 60 * 1000);
});
