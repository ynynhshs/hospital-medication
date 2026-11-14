const express = require('express');
const z = require('zod');
const User = require('../../models/User');
const { verifyPassword } = require('../../utils/password');
const { recordAudit } = require('../../lib/audit');

const router = express.Router();
const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
const applicationRoleMap = { lab_admin: 'medication_admin' };

router.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const identifier = payload.username;
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] }).select('+passwordHash');

    if (!user) {
      await recordAudit({ username: identifier, role: 'unknown', action: 'FAILED', module: 'auth', details: 'Invalid login attempt', req });
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const status = String(user.status || user.Status || '').trim().toLowerCase();
    if (status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is not active.' });
    }

    const valid = await verifyPassword(payload.password, user.passwordHash || '');
    if (!valid) {
      await recordAudit({ username: user.username, role: user.role, action: 'FAILED', module: 'auth', details: 'Failed login attempt', req });
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    req.session.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: applicationRoleMap[user.role] || user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };

    await recordAudit({ username: user.username, role: user.role, action: 'LOGIN', module: 'auth', details: 'User logged in', req });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user._id.toString(),
          username: user.username,
          role: req.session.user.role,
          name: `${user.firstName} ${user.lastName}`
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ success: false, message: 'Unable to logout at this time.' });
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  return res.status(200).json({ success: true, data: { user: req.session.user } });
});

module.exports = router;
