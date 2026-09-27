const mongoose = require('mongoose');
const { Wallet, WalletTransaction, User, Payroll, AdvanceSalary } = require('../models');

class WalletService {
  /**
   * Create a new wallet / treasury account
   */
  async createWallet(data, userId) {
    const openingDebit = Number(data.openingDebit) || 0;
    const openingCredit = Number(data.openingCredit) || 0;
    const initialBalance = openingDebit - openingCredit;

    const wallet = new Wallet({
      name: data.name,
      type: data.type,
      bankName: data.bankName || '',
      accountNumber: data.accountNumber || '',
      accountTitle: data.accountTitle || '',
      branchCode: data.branchCode || '',
      iban: data.iban || '',
      provider: data.provider || '',
      location: data.location || '',
      custodian: data.custodian || '',
      openingDebit,
      openingCredit,
      currentBalance: initialBalance,
      status: data.status || 'ACTIVE',
      createdBy: userId || null,
      updatedBy: userId || null,
    });

    await wallet.save();

    // Log opening balance transaction if balances entered
    if (openingDebit !== 0 || openingCredit !== 0) {
      const user = userId ? await User.findById(userId).select('name role') : null;
      await WalletTransaction.create({
        transactionType: 'OPENING_BALANCE',
        destinationWallet: wallet._id,
        amount: Math.abs(initialBalance),
        date: new Date().toISOString().split('T')[0],
        sourceCategory: 'Opening Balance Setup',
        referenceNo: 'OPENING-BAL',
        description: `Initial opening balance recorded (Debit: ${openingDebit}, Credit: ${openingCredit})`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterDestination: initialBalance,
      });
    }

    return wallet;
  }

  /**
   * Get all wallets with overview stats
   */
  async getWallets() {
    const wallets = await Wallet.find().sort({ createdAt: -1 });

    const stats = {
      totalBalance: 0,
      bankBalance: 0,
      digitalWalletBalance: 0,
      cashBalance: 0,
      totalWallets: wallets.length,
      activeWallets: 0,
    };

    wallets.forEach((w) => {
      const bal = Number(w.currentBalance) || 0;
      if (w.status === 'ACTIVE') {
        stats.activeWallets += 1;
        stats.totalBalance += bal;
        if (w.type === 'BANK') stats.bankBalance += bal;
        else if (w.type === 'DIGITAL_WALLET') stats.digitalWalletBalance += bal;
        else if (w.type === 'CASH') stats.cashBalance += bal;
      }
    });

    return { wallets, stats };
  }

  /**
   * Get single wallet with recent transactions
   */
  async getWalletById(id) {
    const wallet = await Wallet.findById(id).populate('createdBy', 'name email role');
    if (!wallet) throw new Error('Wallet not found');

    const recentTransactions = await WalletTransaction.find({
      $or: [{ sourceWallet: id }, { destinationWallet: id }],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('sourceWallet', 'name type')
      .populate('destinationWallet', 'name type')
      .populate('performedBy', 'name role');

    return { wallet, recentTransactions };
  }

  /**
   * Update wallet details
   */
  async updateWallet(id, data, userId) {
    const wallet = await Wallet.findById(id);
    if (!wallet) throw new Error('Wallet not found');

    const prevDebit = Number(wallet.openingDebit) || 0;
    const prevCredit = Number(wallet.openingCredit) || 0;
    const prevInitial = prevDebit - prevCredit;

    const newDebit = data.openingDebit !== undefined ? Number(data.openingDebit) : prevDebit;
    const newCredit = data.openingCredit !== undefined ? Number(data.openingCredit) : prevCredit;
    const newInitial = newDebit - newCredit;

    const balanceAdjustment = newInitial - prevInitial;

    wallet.name = data.name || wallet.name;
    wallet.type = data.type || wallet.type;
    wallet.bankName = data.bankName !== undefined ? data.bankName : wallet.bankName;
    wallet.accountNumber = data.accountNumber !== undefined ? data.accountNumber : wallet.accountNumber;
    wallet.accountTitle = data.accountTitle !== undefined ? data.accountTitle : wallet.accountTitle;
    wallet.branchCode = data.branchCode !== undefined ? data.branchCode : wallet.branchCode;
    wallet.iban = data.iban !== undefined ? data.iban : wallet.iban;
    wallet.provider = data.provider !== undefined ? data.provider : wallet.provider;
    wallet.location = data.location !== undefined ? data.location : wallet.location;
    wallet.custodian = data.custodian !== undefined ? data.custodian : wallet.custodian;
    wallet.status = data.status || wallet.status;
    wallet.openingDebit = newDebit;
    wallet.openingCredit = newCredit;
    wallet.currentBalance = (Number(wallet.currentBalance) || 0) + balanceAdjustment;
    wallet.updatedBy = userId || wallet.updatedBy;

    await wallet.save();

    if (balanceAdjustment !== 0) {
      const user = userId ? await User.findById(userId).select('name role') : null;
      await WalletTransaction.create({
        transactionType: 'WALLET_UPDATED',
        destinationWallet: wallet._id,
        amount: Math.abs(balanceAdjustment),
        date: new Date().toISOString().split('T')[0],
        sourceCategory: 'Opening Balance Adjustment',
        referenceNo: 'ADJ-OPENING',
        description: `Opening balance updated from ${prevInitial} to ${newInitial} (Delta: ${balanceAdjustment})`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterDestination: wallet.currentBalance,
      });
    }

    return wallet;
  }

  /**
   * Delete or archive wallet
   */
  async deleteWallet(id) {
    const hasTransactions = await WalletTransaction.exists({
      $or: [
        { sourceWallet: id },
        { destinationWallet: id, transactionType: { $in: ['DEPOSIT', 'CONTRA_TRANSFER'] } },
      ],
    });

    if (hasTransactions) {
      // Soft-delete to preserve audit integrity
      const wallet = await Wallet.findByIdAndUpdate(id, { status: 'INACTIVE' }, { new: true });
      return { success: true, message: 'Wallet contains transactions and has been deactivated.', wallet };
    }

    // Otherwise remove cleanly
    await WalletTransaction.deleteMany({ destinationWallet: id });
    await Wallet.findByIdAndDelete(id);
    return { success: true, message: 'Wallet deleted successfully.' };
  }

  /**
   * Direct Deposit / Add Funds (Image 1)
   */
  async depositFunds(data, userId) {
    const {
      destinationTreasuryAccount,
      depositAmount,
      depositDate,
      sourceClassification,
      referenceNo,
      description,
    } = data;

    if (!destinationTreasuryAccount) throw new Error('Destination Treasury Account is required.');
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) throw new Error('Deposit amount must be greater than zero.');

    const wallet = await Wallet.findById(destinationTreasuryAccount);
    if (!wallet) throw new Error('Destination account not found.');

    wallet.currentBalance = (Number(wallet.currentBalance) || 0) + amount;
    await wallet.save();

    const user = userId ? await User.findById(userId).select('name role') : null;

    const transaction = await WalletTransaction.create({
      transactionType: 'DEPOSIT',
      destinationWallet: wallet._id,
      amount,
      date: depositDate || new Date().toISOString().split('T')[0],
      sourceCategory: sourceClassification || 'Other Income / Direct Receipts',
      referenceNo: referenceNo || '',
      description: description || '',
      performedBy: userId || null,
      performedByName: user ? `${user.name} (${user.role})` : 'Admin',
      balanceAfterDestination: wallet.currentBalance,
    });

    return { transaction, wallet };
  }

  /**
   * Contra Account Transfer (Image 2)
   */
  async transferFunds(data, userId) {
    const {
      transferDate,
      fromAccount,
      toAccount,
      transferAmount,
      referenceNo,
      description,
    } = data;

    if (!fromAccount) throw new Error('Source Account (From) is required.');
    if (!toAccount) throw new Error('Destination Account (To) is required.');
    if (fromAccount.toString() === toAccount.toString()) {
      throw new Error('Source and destination accounts must be different.');
    }

    const amount = Number(transferAmount);
    if (!amount || amount <= 0) throw new Error('Transfer amount must be greater than zero.');

    const sourceWallet = await Wallet.findById(fromAccount);
    if (!sourceWallet) throw new Error('Source account not found.');

    const destWallet = await Wallet.findById(toAccount);
    if (!destWallet) throw new Error('Destination account not found.');

    if ((Number(sourceWallet.currentBalance) || 0) < amount) {
      throw new Error(`Insufficient funds in ${sourceWallet.name}. Current balance is ${sourceWallet.currentBalance}.`);
    }

    // Execute atomic balance updates
    sourceWallet.currentBalance = (Number(sourceWallet.currentBalance) || 0) - amount;
    destWallet.currentBalance = (Number(destWallet.currentBalance) || 0) + amount;

    await sourceWallet.save();
    await destWallet.save();

    const user = userId ? await User.findById(userId).select('name role') : null;

    const transaction = await WalletTransaction.create({
      transactionType: 'CONTRA_TRANSFER',
      sourceWallet: sourceWallet._id,
      destinationWallet: destWallet._id,
      amount,
      date: transferDate || new Date().toISOString().split('T')[0],
      referenceNo: referenceNo || '',
      description: description || '',
      performedBy: userId || null,
      performedByName: user ? `${user.name} (${user.role})` : 'Admin',
      balanceAfterSource: sourceWallet.currentBalance,
      balanceAfterDestination: destWallet.currentBalance,
    });

    return {
      transaction,
      sourceWallet,
      destinationWallet: destWallet,
    };
  }

  /**
   * Deduct funds for payroll payment (single or bulk)
   * Deducts from wallet (allows negative balance) and creates transaction record
   */
  async deductPayroll(data, userId) {
    const {
      walletId,
      totalAmount,
      payrollMonth,
      date,
      staffDetails = [], // [{ payrollId, staffId, name, designation, amount }]
      remarks,
      referenceNo,
    } = data;

    if (!walletId) throw new Error('Source wallet/account is required.');
    const amount = Number(totalAmount);
    if (!amount || amount <= 0) throw new Error('Total payment amount must be greater than zero.');

    const wallet = await Wallet.findById(walletId);
    if (!wallet) throw new Error('Source account not found.');

    // Deduct amount from wallet currentBalance (can go negative as requested)
    const prevBalance = Number(wallet.currentBalance) || 0;
    wallet.currentBalance = prevBalance - amount;
    await wallet.save();

    const user = userId ? await User.findById(userId).select('name role') : null;
    const paymentDate = date || new Date().toISOString().split('T')[0];
    const month = payrollMonth || (staffDetails[0]?.month || '');

    const transaction = await WalletTransaction.create({
      transactionType: 'PAYROLL',
      category: 'PAYROLL',
      sourceWallet: wallet._id,
      amount,
      date: paymentDate,
      payrollMonth: month,
      staffCount: staffDetails.length,
      staffDetails,
      payrollIds: staffDetails.map(s => s.payrollId).filter(Boolean),
      referenceNo: referenceNo || '',
      description: remarks || `Payroll disbursement for ${month} (${staffDetails.length} staff) from ${wallet.name}`,
      performedBy: userId || null,
      performedByName: user ? `${user.name} (${user.role})` : 'Admin',
      balanceAfterSource: wallet.currentBalance,
    });

    // Update the associated Payroll records
    for (const item of staffDetails) {
      if (!item.payrollId) continue;
      const payroll = await Payroll.findById(item.payrollId);
      if (!payroll) continue;

      const itemAmount = Number(item.amount) || 0;
      const existingPayments = Array.isArray(payroll.payments) ? payroll.payments : [];
      
      payroll.payments.push({
        id: new mongoose.Types.ObjectId(),
        amount: itemAmount,
        paidBy: wallet.name,
        paymentMethod: wallet.type || 'WALLET',
        walletId: wallet._id,
        walletName: wallet.name,
        paymentDate: paymentDate,
        paidAt: new Date(),
        paidByName: user ? user.name : 'Admin',
        remarks: remarks || `Disbursed from ${wallet.name}`,
        transactionId: transaction._id.toString(),
      });

      const currentPaid = payroll.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const netSalary = Number(payroll.netSalary) || 0;
      const newBalance = Math.max(0, netSalary - currentPaid);
      const newStatus = newBalance <= 0 ? 'PAID' : 'partially_paid';

      payroll.paidAmount = currentPaid;
      payroll.balanceAmount = newBalance;
      payroll.status = newStatus;
      payroll.paymentDate = new Date(paymentDate);
      payroll.paidBy = wallet.name;
      payroll.paidFromWallet = {
        walletId: wallet._id,
        walletName: wallet.name,
        walletType: wallet.type,
      };

      await payroll.save();

      // Adjust advance salary if fully paid
      if (newStatus === 'PAID' && payroll.staffId && payroll.month) {
        await AdvanceSalary.updateMany(
          {
            staffId: payroll.staffId,
            deductionMonth: payroll.month,
            status: { $ne: 'DEDUCTED' }
          },
          {
            $set: {
              status: 'DEDUCTED',
              adjusted: true,
              adjustedSource: 'PAYROLL'
            },
            $push: {
              actionAudit: {
                action: 'ADJUSTED_IN_PAYROLL',
                byName: user?.name || 'Payroll System',
                month: payroll.month,
                at: new Date()
              }
            }
          }
        );
      }
    }

    return {
      success: true,
      transaction,
      wallet,
      count: staffDetails.length,
      totalAmount: amount,
    };
  }

  /**
   * Get Payroll Deduction Logs (month-wise or filtered by wallet/month)
   */
  async getPayrollDeductionLogs(query = {}) {
    const { month, walletId, startDate, endDate, page = 1, limit = 100 } = query;
    const filter = { transactionType: 'PAYROLL' };

    if (walletId && walletId !== 'all') {
      filter.sourceWallet = walletId;
    }

    if (month && month !== 'all' && month !== 'ALL') {
      filter.$or = [
        { payrollMonth: month },
        { payrollMonth: { $regex: month, $options: 'i' } },
        { date: { $regex: `^${month}` } },
      ];
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await WalletTransaction.countDocuments(filter);
    const logs = await WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sourceWallet', 'name type bankName provider location accountNumber')
      .populate('performedBy', 'name email role');

    return {
      logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  }

  /**
   * Get Transfer & Audit History
   */
  async getTransactionHistory(query = {}) {
    const {
      walletId,
      transactionType,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = query;

    const filter = {};

    if (walletId && walletId !== 'all') {
      filter.$or = [{ sourceWallet: walletId }, { destinationWallet: walletId }];
    }

    if (transactionType && transactionType !== 'all') {
      filter.transactionType = transactionType;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        ...(filter.$or || []),
        { referenceNo: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { sourceCategory: { $regex: q, $options: 'i' } },
        { performedByName: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await WalletTransaction.countDocuments(filter);
    const transactions = await WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sourceWallet', 'name type bankName provider location')
      .populate('destinationWallet', 'name type bankName provider location')
      .populate('performedBy', 'name email role');

    return {
      transactions,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  }

  /**
   * Get Hostel Fee Collection Logs for a specific wallet or all wallets
   */
  async getHostelFeeLogs(query = {}) {
    const { walletId, month, startDate, endDate, page = 1, limit = 100 } = query;
    const filter = {
      $or: [
        { transactionType: 'HOSTEL_FEE' },
        { category: 'HOSTEL_FEE' },
        { sourceCategory: 'HOSTEL_FEE_REVERSAL' },
      ],
    };

    if (walletId && walletId !== 'all') {
      filter.destinationWallet = walletId;
    }

    if (month && month !== 'all' && month !== 'ALL') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { month: month },
          { month: { $regex: month, $options: 'i' } },
          { date: { $regex: `^${month}` } },
        ],
      });
    }

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.date = dateFilter;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await WalletTransaction.countDocuments(filter);
    const logs = await WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('destinationWallet', 'name type bankName provider location accountNumber')
      .populate('performedBy', 'name email role');

    return {
      logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  }

  /**
   * Get Expense Deduction Logs for a specific wallet or all wallets
   */
  async getExpenseLogs(query = {}) {
    const { walletId, category, startDate, endDate, page = 1, limit = 100 } = query;
    const filter = {
      $or: [
        { transactionType: { $in: ['EXPENSE', 'EXPENSE_REVERSAL'] } },
        { category: { $in: ['EXPENSE', 'HOSTEL_EXPENSE', 'HOSTEL_INVENTORY_EXPENSE', 'INVENTORY_ITEM_EXPENSE', 'INVENTORY_MANUAL_EXPENSE', 'INVENTORY_EXPENSE', 'EXPENSE_REVERSAL'] } },
        { sourceCategory: { $in: ['FINANCE_EXPENSE_REVERSAL', 'HOSTEL_EXPENSE_REVERSAL', 'HOSTEL_INVENTORY_EXPENSE_REVERSAL', 'INVENTORY_ITEM_EXPENSE_REVERSAL', 'INVENTORY_EXPENSE_REVERSAL'] } },
      ],
    };

    if (walletId && walletId !== 'all') {
      filter.sourceWallet = walletId;
    }

    if (category && category !== 'all') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { category: category },
          { sourceCategory: category }
        ]
      });
    }

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.date = dateFilter;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await WalletTransaction.countDocuments(filter);
    const logs = await WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sourceWallet', 'name type bankName provider location accountNumber')
      .populate('performedBy', 'name email role');

    return {
      logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  }

  /**
   * Get Tuition / Fee Collection Logs for a specific wallet or all wallets
   */
  async getTuitionFeeLogs(query = {}) {
    const { walletId, month, search, startDate, endDate, page = 1, limit = 100 } = query;
    const filter = {
      $or: [
        { transactionType: { $in: ['FEE', 'FEE_REVERSAL'] } },
        { category: { $in: ['FEE', 'FEE_REVERSAL'] } },
        { sourceCategory: 'FEE_REVERSAL' },
      ],
    };

    if (walletId && walletId !== 'all') {
      filter.destinationWallet = walletId;
    }

    if (month && month !== 'all' && month !== 'ALL') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { month: month },
          { month: { $regex: month, $options: 'i' } },
          { date: { $regex: `^${month}` } },
        ],
      });
    }

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.date = dateFilter;
    }

    if (search) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { challanNumber: searchRegex },
          { studentName: searchRegex },
          { rollNumber: searchRegex },
          { referenceNo: searchRegex },
          { description: searchRegex },
        ],
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await WalletTransaction.countDocuments(filter);
    const logs = await WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('destinationWallet', 'name type bankName provider location accountNumber')
      .populate('performedBy', 'name email role');

    return {
      logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  }
}

module.exports = new WalletService();
