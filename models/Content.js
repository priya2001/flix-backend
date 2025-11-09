const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['movie', 'series'], required: true },
  genre: [String], // already array - admin can select multiple
  releaseYear: Number,
  rating: Number,
  videoUrl: { type: String }, // removed required: true
  thumbnailUrl: { type: String, required: true },
  duration: Number,
  episodes: [{
    title: String,
    videoUrl: String,
    duration: Number,
    thumbnailUrl: String
  }],
  access: { type: String, enum: ['free', 'paid'], default: 'free' },
  fileSize: { type: Number }, // bytes
  uploadedAt: { type: Date, default: Date.now },
  targetAgeGroup: { type: String, enum: ['kids', 'teens', 'adults', 'all'], default: 'all' },
  targetGender: { type: String, enum: ['male', 'female', 'all'], default: 'all' }
}, { timestamps: true });

module.exports = mongoose.model('Content', contentSchema);
