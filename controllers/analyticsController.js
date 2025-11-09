const User = require('../models/User');
const Content = require('../models/Content');

// Helper function to determine age group
const getAgeGroup = (age) => {
  if (!age || age < 0) return null;
  if (age <= 12) return 'kids';
  if (age <= 19) return 'teens';
  return 'adults';
};

exports.getAnalytics = async (req, res) => {
  try {
    console.log('Analytics request - user:', req.user); // debug log
    
    // require admin
    if (!req.user) {
      console.log('No user attached to request');
      return res.status(401).json({ message: 'Unauthorized: No user' });
    }
    
    if (req.user.role !== 'admin') {
      console.log('User role:', req.user.role, '- not admin');
      return res.status(403).json({ message: 'Forbidden: Requires admin role' });
    }

    const totalUsers = await User.countDocuments();
    const activeSubs = await User.countDocuments({ 'subscription.status': 'active' });
    // estimated monthly revenue: assume monthly=1, yearly=10/12 per month
    const monthly = 1;
    const yearly = 10;
    const subs = await User.find({ 'subscription.status': 'active' }).select('subscription.plan');
    let revenueMonthlyEstimate = 0;
    subs.forEach(s => {
      revenueMonthlyEstimate += s.subscription.plan === 'yearly' ? (yearly / 12) : monthly;
    });

    const totalContent = await Content.countDocuments();

    // Demographic counts
    const [maleCount, femaleCount] = await Promise.all([
      User.countDocuments({ gender: 'male' }),
      User.countDocuments({ gender: 'female' })
    ]);
    const genderTotal = (maleCount + femaleCount) || 1;
    const demographics = {
      male: { count: maleCount, percent: +(maleCount * 100 / genderTotal).toFixed(2) },
      female: { count: femaleCount, percent: +(femaleCount * 100 / genderTotal).toFixed(2) }
    };

    // Age group breakdown
    const allUsers = await User.find({}).select('age');
    const ageGroups = {
      kids: { label: 'Kids (0-12)', range: '0-12', count: 0 },
      teens: { label: 'Teens (13-19)', range: '13-19', count: 0 },
      adults: { label: 'Adults (20+)', range: '20+', count: 0 }
    };
    
    allUsers.forEach(u => {
      const group = getAgeGroup(u.age);
      if (group && ageGroups[group]) ageGroups[group].count++;
    });

    const ageTotal = allUsers.length || 1;
    Object.keys(ageGroups).forEach(key => {
      ageGroups[key].percent = +(ageGroups[key].count * 100 / ageTotal).toFixed(2);
    });

    return res.json({
      totalUsers,
      activeSubs,
      revenueMonthlyEstimate: Math.round(revenueMonthlyEstimate),
      totalContent,
      demographics,
      ageGroups
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ message: 'Failed to get analytics' });
  }
};

exports.getUsersTimeline = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Requires admin role' });
    }

    const days = Math.max(parseInt(req.query.days || '30', 10), 1);
    const fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    fromDate.setDate(fromDate.getDate() - (days - 1));

    // aggregate users created since fromDate grouped by day
    const agg = await User.aggregate([
      { $match: { createdAt: { $gte: fromDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // fill missing days with 0
    const byDate = new Map(agg.map(d => [d._id, d.count]));
    const points = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(fromDate);
      d.setDate(fromDate.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      points.push({ date: key, count: byDate.get(key) || 0 });
    }

    return res.json({ points });
  } catch (err) {
    console.error('getUsersTimeline error:', err);
    return res.status(500).json({ message: 'Failed to get users timeline' });
  }
};
