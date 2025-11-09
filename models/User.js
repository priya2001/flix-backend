const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  subscription: {
    plan: { type: String, enum: ['monthly', 'yearly', 'none'], default: 'none' },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['active', 'inactive'], default: 'inactive' }
  },
  watchHistory: [{
    content: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
    watchedAt: Date,
    progress: Number
  }],
  preferences: {
    genres: [String], // added: user's favorite genres/tags
    language: String
  },
  gender: { type: String, enum: ['male', 'female'], default: 'male' },
  age: { type: Number, min: 0, max: 120 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
