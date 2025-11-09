const fs = require('fs');
const path = require('path');

// try load dotenv from backend/.env or project root .env (or fallback to default)
const backendEnv = path.resolve(__dirname, '.env');
const rootEnv = path.resolve(__dirname, '..', '.env');
let envPath;
if (fs.existsSync(backendEnv)) envPath = backendEnv;
else if (fs.existsSync(rootEnv)) envPath = rootEnv;

if (envPath) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config(); // fallback to default behavior
}

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

const app = express();

app.use(cors({
  origin: "*"
}));

app.use(express.json());

// --- Added: register API routes ---
const authRoutes = require('./routes/authRoutes');
const contentRoutes = require('./routes/contentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const recommendRoutes = require('./routes/recommendRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { mongo, default: mongoose } = require('mongoose');

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/recommendations', recommendRoutes);
app.use('/api/admin', adminRoutes);
app.get("/",async (req,res)=>{
  const db = await mongoose.modelNames()
  console.log(db)
res.status(200).send(`Welcome to mflix. Collections are: ${db}`)
})
// --- end added ---

console.log('=== Server Starting ===');
console.log('Environment:', process.env.NODE_ENV);
console.log('Razorpay configured:', !!process.env.RAZORPAY_KEY_ID);

// start server after DB connection
const PORT = process.env.SERVER_PORT || 8000;
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message || err);
    process.exit(1);
  }
}

startServer();
