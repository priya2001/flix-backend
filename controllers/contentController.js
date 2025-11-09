const Content = require('../models/Content');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const uploadToCloudinaryStream = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const upload_stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(upload_stream);
  });
};

exports.uploadContent = async (req, res) => {
  try {
    const data = req.body.data ? JSON.parse(req.body.data) : {};
    const isSeries = (data.type || req.body.type) === 'series';

    // Utility to pick a file if multer used 'any'
    const pickSingleFile = () => req.file || (Array.isArray(req.files) ? req.files.find(f => f.fieldname === 'video') || req.files[0] : null);

    if (isSeries) {
      // Series: multiple episode files under 'videos'
      const files = Array.isArray(req.files) ? req.files.filter(f => f.fieldname === 'videos' || f.fieldname === 'video' || f.fieldname === 'episodes') : [];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No episode files provided' });
      }

      const titles = Array.isArray(data.episodeTitles) ? data.episodeTitles : (typeof data.episodeTitles === 'string' ? data.episodeTitles.split('\n').map(s => s.trim()).filter(Boolean) : []);
      const episodes = [];
      let totalSize = 0;

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        totalSize += f.size || 0;
        const uploaded = await uploadToCloudinaryStream(f.buffer, { resource_type: 'video' });
        episodes.push({
          title: titles[i] || f.originalname || `Episode ${i + 1}`,
          videoUrl: uploaded.secure_url,
          duration: data?.episodes?.[i]?.duration || null,
          thumbnailUrl: uploaded.secure_url.replace(/\.[^/.]+$/, '.jpg')
        });
      }

      const content = await Content.create({
        title: data.title || 'Untitled Series',
        description: data.description || '',
        type: 'series',
        genre: data.genre || [],
        releaseYear: data.releaseYear || null,
        rating: data.rating || null,
        videoUrl: '', // not applicable for series
        thumbnailUrl: episodes[0]?.thumbnailUrl || '',
        duration: null,
        episodes,
        access: data.access || 'free',
        fileSize: totalSize,
        uploadedAt: new Date(),
        targetAgeGroup: ['kids','teens','adults','all'].includes(data.targetAgeGroup) ? data.targetAgeGroup : 'all',
        targetGender: ['male','female','all'].includes(data.targetGender) ? data.targetGender : 'all'
      });

      return res.status(201).json(content);
    } else {
      // Movie: single file
      const f = pickSingleFile();
      if (!f) return res.status(400).json({ error: 'No video file provided' });

      const uploaded = await uploadToCloudinaryStream(f.buffer, { resource_type: 'video' });

      const content = await Content.create({
        title: data.title || f.originalname || 'Untitled',
        description: data.description || '',
        type: data.type || 'movie',
        genre: Array.isArray(data.genre) ? data.genre : [], // accept array from admin
        releaseYear: data.releaseYear || null,
        rating: data.rating || null,
        videoUrl: uploaded.secure_url,
        thumbnailUrl: uploaded.secure_url.replace(/\.[^/.]+$/, '.jpg'),
        duration: data.duration || null,
        episodes: [],
        access: data.access || 'free',
        fileSize: uploaded?.bytes || f.size || 0,
        uploadedAt: new Date(),
        targetAgeGroup: ['kids','teens','adults','all'].includes(data.targetAgeGroup) ? data.targetAgeGroup : 'all',
        targetGender: ['male','female','all'].includes(data.targetGender) ? data.targetGender : 'all'
      });

      return res.status(201).json(content);
    }
  } catch (error) {
    console.error('uploadContent error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
};

exports.getAllContent = async (req, res) => {
  try {
    const { type, genre, access, targetAgeGroup, targetGender, dateFrom, dateTo, sizeMin, sizeMax, sort } = req.query;
    let query = {};
    
    // type filter (can be multiple comma-separated)
    if (type && type !== 'all') {
      const t = type.split(',').filter(Boolean);
      if (t.length) query.type = { $in: t };
    }
    
    // genre filter (can be multiple comma-separated)
    if (genre && genre !== 'all') {
      const g = genre.split(',').filter(Boolean);
      if (g.length) query.genre = { $in: g };
    }
    
    // access filter (can be multiple comma-separated)
    if (access) {
      const a = access.split(',').filter(Boolean);
      if (a.length) query.access = { $in: a };
    }
    
    // target age group filter (can be multiple comma-separated)
    if (targetAgeGroup) {
      const age = targetAgeGroup.split(',').filter(Boolean);
      if (age.length) query.targetAgeGroup = { $in: age };
    }
    
    // target gender filter (can be multiple comma-separated)
    if (targetGender) {
      const gender = targetGender.split(',').filter(Boolean);
      if (gender.length) query.targetGender = { $in: gender };
    }
    
    // date range filter
    if (dateFrom || dateTo) {
      query.uploadedAt = {};
      if (dateFrom) query.uploadedAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23,59,59,999);
        query.uploadedAt.$lte = end;
      }
    }
    
    // size range filter (in MB, convert to bytes)
    if (sizeMin || sizeMax) {
      query.fileSize = {};
      if (sizeMin) query.fileSize.$gte = parseFloat(sizeMin) * 1024 * 1024;
      if (sizeMax) query.fileSize.$lte = parseFloat(sizeMax) * 1024 * 1024;
    }

    let mongoSort = { uploadedAt: -1 };
    switch (sort) {
      case 'titleAsc': mongoSort = { title: 1 }; break;
      case 'titleDesc': mongoSort = { title: -1 }; break;
      case 'sizeAsc': mongoSort = { fileSize: 1 }; break;
      case 'sizeDesc': mongoSort = { fileSize: -1 }; break;
      case 'dateNew': mongoSort = { uploadedAt: -1 }; break;
      case 'dateOld': mongoSort = { uploadedAt: 1 }; break;
      default: break;
    }

    const content = await Content.find(query).sort(mongoSort);
    res.json(content);
  } catch (error) {
    console.error('getAllContent error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getContentById = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    res.json(content);
  } catch (error) {
    console.error('getContentById error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateContent = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // Validate access values
    if (updates.access && !['free', 'paid'].includes(updates.access)) {
      delete updates.access;
    }
    
    // Validate targetAgeGroup
    if (updates.targetAgeGroup && !['kids', 'teens', 'adults', 'all'].includes(updates.targetAgeGroup)) {
      delete updates.targetAgeGroup;
    }
    
    // Validate targetGender
    if (updates.targetGender && !['male', 'female', 'all'].includes(updates.targetGender)) {
      delete updates.targetGender;
    }
    
    // Ensure genre is an array
    if (updates.genre && !Array.isArray(updates.genre)) {
      updates.genre = [];
    }
    
    const content = await Content.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!content) return res.status(404).json({ error: 'Content not found' });
    res.json(content);
  } catch (error) {
    console.error('updateContent error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteContent = async (req, res) => {
  try {
    const content = await Content.findByIdAndDelete(req.params.id);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('deleteContent error:', error);
    res.status(500).json({ error: error.message });
  }
};

// New: proxy stream with Range support so browser can play/seek
exports.streamContent = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).json({ error: 'Content not found' });

    // Check access rights for premium content
    if (content.access === 'paid') {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) return res.status(403).json({ error: 'Subscription required' });
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('subscription');
        if (!user || user.subscription?.status !== 'active') {
          return res.status(403).json({ error: 'Subscription required' });
        }
      } catch {
        return res.status(403).json({ error: 'Subscription required' });
      }
    }

    const videoUrl = content.videoUrl;
    if (!videoUrl) return res.status(404).json({ error: 'No video available for this content' });

    const parsed = new URL(videoUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    // optional: forward user-agent to remote host
    if (req.headers['user-agent']) headers['User-Agent'] = req.headers['user-agent'];

    const options = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers
    };

    const proxyReq = client.request(options, (proxyRes) => {
      // Copy status and most headers to client so browser can handle Range and content-type
      const responseHeaders = { ...proxyRes.headers };
      // Ensure no transfer-encoding chunked mismatch and allow CORS from frontend if needed
      responseHeaders['Access-Control-Allow-Origin'] = process.env.CLIENT_URL || '*';
      // Write status and headers, then pipe body
      res.writeHead(proxyRes.statusCode || 200, responseHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('streamContent proxy error:', err);
      if (!res.headersSent) res.status(502).json({ error: 'Failed to proxy video stream' });
      else res.end();
    });

    proxyReq.end();
  } catch (error) {
    console.error('streamContent error:', error);
    res.status(500).json({ error: 'Failed to stream content' });
  }
};
