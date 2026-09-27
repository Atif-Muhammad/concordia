const authService = require('../services/auth.service');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { user, accessToken, refreshToken } = await authService.login({ email, password });

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        message: 'Logged in successfully',
        user,
        accessToken,
        refreshToken
      });
    } catch (err) {
      next(err);
    }
  }

  async refreshTokens(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      const { user, accessToken } = await authService.refreshTokens(refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      res.json({
        message: 'Tokens refreshed',
        user,
        accessToken
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  async userWho(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const user = await authService.getUserWho(req.user.id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
