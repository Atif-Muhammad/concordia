const walletService = require('../services/wallet.service');

class WalletController {
  async getWallets(req, res, next) {
    try {
      const result = await walletService.getWallets();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getWalletById(req, res, next) {
    try {
      const result = await walletService.getWalletById(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async createWallet(req, res, next) {
    try {
      const wallet = await walletService.createWallet(req.body, req.user?.id);
      res.status(201).json(wallet);
    } catch (err) {
      next(err);
    }
  }

  async updateWallet(req, res, next) {
    try {
      const wallet = await walletService.updateWallet(req.params.id, req.body, req.user?.id);
      res.json(wallet);
    } catch (err) {
      next(err);
    }
  }

  async deleteWallet(req, res, next) {
    try {
      const result = await walletService.deleteWallet(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async depositFunds(req, res, next) {
    try {
      const result = await walletService.depositFunds(req.body, req.user?.id);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async transferFunds(req, res, next) {
    try {
      const result = await walletService.transferFunds(req.body, req.user?.id);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getTransactionHistory(req, res, next) {
    try {
      const result = await walletService.getTransactionHistory(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async deductPayroll(req, res, next) {
    try {
      const result = await walletService.deductPayroll(req.body, req.user?.id || req.user?._id);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getPayrollDeductionLogs(req, res, next) {
    try {
      const result = await walletService.getPayrollDeductionLogs(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getHostelFeeLogs(req, res, next) {
    try {
      const result = await walletService.getHostelFeeLogs(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getExpenseLogs(req, res, next) {
    try {
      const result = await walletService.getExpenseLogs(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getTuitionFeeLogs(req, res, next) {
    try {
      const result = await walletService.getTuitionFeeLogs(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WalletController();
