const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const contentController = require('../controllers/contentController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', contentController.getAllContent);
router.get('/:id/stream', contentController.streamContent);
router.get('/:id', contentController.getContentById);

// Accept both single 'video' (movie) and multiple 'videos' (series)
router.post('/upload', auth, upload.any(), contentController.uploadContent);

router.delete('/:id', auth, contentController.deleteContent);
router.put('/:id', auth, contentController.updateContent);

module.exports = router;
