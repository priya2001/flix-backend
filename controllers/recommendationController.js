const Content = require('../models/Content');
const User = require('../models/User');

// Helper to determine age group from age
const getAgeGroup = (age) => {
  if (!age || age < 0) return 'all';
  if (age <= 12) return 'kids';
  if (age <= 19) return 'teens';
  return 'adults';
};

exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user?._id;
    let user = null;
    let ageGroup = 'all';
    let gender = 'all';

    if (userId) {
      user = await User.findById(userId);
      if (user) {
        ageGroup = getAgeGroup(user.age);
        gender = user.gender || 'all';
      }
    }

    // Build query: match user's age group and gender (or 'all')
    let query = {
      $or: [
        { targetAgeGroup: ageGroup },
        { targetAgeGroup: 'all' }
      ]
    };

    // Filter by gender preference if user gender is set
    if (gender !== 'all') {
      if (!query.$and) query.$and = [];
      query.$and.push({
        $or: [
          { targetGender: gender },
          { targetGender: 'all' }
        ]
      });
    }

    // Prioritize content matching user's genre preferences
    const userGenres = user?.preferences?.genres || [];
    let items = [];

    if (userGenres.length > 0) {
      // First try: content matching user's genres + age/gender
      const genreQuery = { ...query, genre: { $in: userGenres } };
      items = await Content.find(genreQuery)
        .sort({ rating: -1, createdAt: -1 })
        .limit(20);
    }

    // Fallback: if not enough genre matches, add more content without genre filter
    if (items.length < 10) {
      const remaining = await Content.find(query)
        .sort({ rating: -1, createdAt: -1 })
        .limit(20 - items.length);
      items = [...items, ...remaining];
    }

    // Final fallback if still no matches
    if (!items || items.length === 0) {
      items = await Content.find({}).sort({ rating: -1, createdAt: -1 }).limit(20);
    }

    return res.json(items);
  } catch (err) {
    console.error('getRecommendations error:', err);
    return res.status(500).json({ message: 'Failed to get recommendations' });
  }
};
