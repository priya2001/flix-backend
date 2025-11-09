const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const parseEnvFileFor = (filePath, key) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(new RegExp('^' + key + '\\s*=\\s*(.*)$', 'm'));
    if (match) return match[1].trim();
  } catch (e) {
    // ignore
  }
  return undefined;
};

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    console.log('Attempting to connect to MongoDB...');
    console.log('Connection string (hidden password):', process.env.MONGO_URI.replace(/:[^:@]+@/, ':****@'));

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });

    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('\n⚠️  Authentication Failed - Please check:');
      console.error('1. Your MongoDB username and password are correct');
      console.error('2. The database user exists in MongoDB Atlas');
      console.error('3. The user has proper permissions (Read and Write)');
      console.error('4. Your IP address is whitelisted in MongoDB Atlas Network Access\n');
    }
    
    throw error;
  }
};

module.exports = connectDB;
