const {
  FinanceIncome,
  FinanceExpense,
  FinanceClosing,
  Wallet,
  WalletTransaction,
  User,
} = require('../models');

class FinanceService {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INCOME
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getIncomes({ dateFrom, dateTo, category }) {
    const query = {};
    if (dateFrom && dateTo) {
      query.date = { $gte: dateFrom, $lte: dateTo };
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    return FinanceIncome.find(query).sort({ date: -1 });
  }

  async createIncome(data, userId) {
    const amount = Number(data.amount || 0);
    let walletRecord = null;
    let walletTx = null;

    let targetWalletId = data.walletId;
    if (!targetWalletId) {
      const defaultWallet = await Wallet.findOne({ name: /United Bank Limited/i, status: 'ACTIVE' }) ||
                            await Wallet.findOne({ type: 'BANK', status: 'ACTIVE' }) ||
                            await Wallet.findOne({ status: 'ACTIVE' });
      if (defaultWallet) targetWalletId = defaultWallet._id;
    }

    if (targetWalletId) {
      const wallet = await Wallet.findById(targetWalletId);
      if (!wallet) throw new Error('Selected Account / Wallet not found');

      // Credit wallet
      wallet.currentBalance = (Number(wallet.currentBalance) || 0) + amount;
      await wallet.save();
      walletRecord = wallet;

      const user = userId ? await User.findById(userId).select('name role') : null;
      const txDate = data.date || new Date().toISOString().split('T')[0];

      walletTx = await WalletTransaction.create({
        transactionType: 'DEPOSIT',
        category: 'OTHER',
        destinationWallet: wallet._id,
        amount,
        date: txDate,
        sourceCategory: 'FINANCE_INCOME',
        sourceModule: 'Finance Income',
        description: data.description || `Finance Income: ${data.category}`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterDestination: wallet.currentBalance,
      });

      data.walletId = walletRecord._id;
      data.walletName = walletRecord.name;
      data.transactionId = walletTx._id;
    }

    return FinanceIncome.create(data);
  }

  async deleteIncome(id, userId) {
    const income = await FinanceIncome.findById(id);
    if (!income) return null;

    if (income.walletId) {
      const wallet = await Wallet.findById(income.walletId);
      if (wallet) {
        const amount = Number(income.amount || 0);
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) - amount;
        await wallet.save();

        const user = userId ? await User.findById(userId).select('name role') : null;
        const userName = user ? `${user.name} (${user.role})` : 'System';

        await WalletTransaction.create({
          transactionType: 'DEPOSIT',
          category: 'DEPOSIT',
          destinationWallet: wallet._id,
          amount: -Math.abs(amount),
          date: new Date().toISOString().split('T')[0],
          sourceCategory: 'FINANCE_INCOME_REVERSAL',
          sourceModule: 'Finance Income',
          referenceNo: `REV-INC-${income._id.toString().slice(-6)}`,
          description: `Reversal: Income deleted - ${income.category || 'Income'}${income.description ? ` (${income.description})` : ''} reversed from ${wallet.name}`,
          performedBy: userId || null,
          performedByName: userName,
          balanceAfterDestination: wallet.currentBalance,
          isReversal: true,
        });
      }
    }

    return FinanceIncome.findByIdAndDelete(id);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EXPENSE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getExpenses({ dateFrom, dateTo, category, subCategory, status }) {
    const query = {};
    if (dateFrom && dateTo) {
      query.date = { $gte: dateFrom, $lte: dateTo };
    }
    if (category && category !== 'all') query.category = category;
    if (subCategory && subCategory !== 'all') query.subCategory = subCategory;
    if (status && status !== 'all') query.status = { $regex: new RegExp(`^${status}$`, 'i') };

    return FinanceExpense.find(query).populate('approvedBy', 'name').sort({ date: -1 });
  }

  async createExpense(data, userId) {
    const expenseData = { ...data };

    let targetWalletId = expenseData.walletId;
    if (!targetWalletId) {
      const defaultWallet = await Wallet.findOne({ name: /United Bank Limited/i, status: 'ACTIVE' }) ||
                            await Wallet.findOne({ type: 'BANK', status: 'ACTIVE' }) ||
                            await Wallet.findOne({ status: 'ACTIVE' });
      if (defaultWallet) targetWalletId = defaultWallet._id;
    }

    if (targetWalletId) {
      const wallet = await Wallet.findById(targetWalletId);
      if (wallet) {
        expenseData.walletId = wallet._id;
        expenseData.walletName = wallet.name;
      }
    }

    // Defer wallet deduction and transaction creation until approval!
    expenseData.transactionId = null;
    expenseData.status = 'Pending';

    return FinanceExpense.create(expenseData);
  }

  async deleteExpense(id, userId) {
    const expense = await FinanceExpense.findById(id);
    if (!expense) return null;

    // Only revert deduction if the expense was actually approved and deducted
    if (expense.status === 'Approved' && expense.walletId) {
      const wallet = await Wallet.findById(expense.walletId);
      if (wallet) {
        const amount = Number(expense.amount || 0);
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) + amount;
        await wallet.save();

        const user = userId ? await User.findById(userId).select('name role') : null;
        const userName = user ? `${user.name} (${user.role})` : 'System';

        await WalletTransaction.create({
          transactionType: 'EXPENSE',
          category: 'EXPENSE',
          sourceWallet: wallet._id,
          amount: -Math.abs(amount),
          date: new Date().toISOString().split('T')[0],
          sourceCategory: 'FINANCE_EXPENSE_REVERSAL',
          sourceModule: 'Finance Expense',
          referenceNo: `REV-EXP-${expense._id.toString().slice(-6)}`,
          description: `Reversal: Expense deleted - ${expense.category || 'Expense'}${expense.subCategory ? ` (${expense.subCategory})` : ''} refunded to ${wallet.name}`,
          performedBy: userId || null,
          performedByName: userName,
          balanceAfterSource: wallet.currentBalance,
          isReversal: true,
        });
      }
    }

    return FinanceExpense.findByIdAndDelete(id);
  }

  async approveExpense(id, userId, customWalletId = null) {
    const expense = await FinanceExpense.findById(id);
    if (!expense) throw new Error('Expense not found');

    if (expense.status === 'Approved') {
      return expense; // Already approved
    }

    let targetWalletId = customWalletId || expense.walletId;
    if (!targetWalletId) {
      const defaultWallet = await Wallet.findOne({ name: /United Bank Limited/i, status: 'ACTIVE' }) ||
                            await Wallet.findOne({ type: 'BANK', status: 'ACTIVE' }) ||
                            await Wallet.findOne({ status: 'ACTIVE' });
      if (defaultWallet) targetWalletId = defaultWallet._id;
    }

    if (targetWalletId) {
      const wallet = await Wallet.findById(targetWalletId);
      if (!wallet) throw new Error('Selected Account / Wallet not found');

      const amount = Number(expense.amount || 0);

      // Deduct from wallet upon approval (allowed to go negative if amount > currentBalance)
      wallet.currentBalance = (Number(wallet.currentBalance) || 0) - amount;
      await wallet.save();

      const user = userId ? await User.findById(userId).select('name role') : null;
      const txDate = expense.date || new Date().toISOString().split('T')[0];

      const walletTx = await WalletTransaction.create({
        transactionType: 'EXPENSE',
        category: 'EXPENSE',
        sourceWallet: wallet._id,
        amount,
        date: txDate,
        sourceCategory: 'FINANCE_EXPENSE',
        sourceModule: 'Finance Expense',
        description: expense.description || `Finance Expense: ${expense.category}${expense.subCategory ? ' - ' + expense.subCategory : ''}`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterSource: wallet.currentBalance,
      });

      expense.walletId = wallet._id;
      expense.walletName = wallet.name;
      expense.transactionId = walletTx._id;
    }

    expense.status = 'Approved';
    expense.approvedBy = userId || null;
    return expense.save();
  }

  async rejectExpense(id, userId, rejectionReason) {
    const expense = await FinanceExpense.findById(id);
    if (!expense) throw new Error('Expense not found');

    // If previously approved and deducted, revert deduction
    if (expense.status === 'Approved' && expense.walletId && expense.transactionId) {
      const wallet = await Wallet.findById(expense.walletId);
      if (wallet) {
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) + Number(expense.amount || 0);
        await wallet.save();
      }
      await WalletTransaction.findByIdAndDelete(expense.transactionId);
      expense.transactionId = null;
    }

    expense.status = 'Rejected';
    expense.rejectedBy = userId || null;
    if (rejectionReason) expense.notes = rejectionReason;
    return expense.save();
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLOSINGS & HOLDINGS CHECKPOINT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Calculate live holdings and changes since the last closing
   */
  async getClosingDashboard() {
    const lastClosing = await FinanceClosing.findOne().sort({ createdAt: -1 });
    const lastClosingTime = lastClosing ? (lastClosing.closingDateTime || lastClosing.createdAt) : null;

    const wallets = await Wallet.find({ status: 'ACTIVE' }).sort({ name: 1 });

    const walletsCalculated = [];
    let totalCurrentHolding = 0;
    let totalInflows = 0;
    let totalOutflows = 0;
    let totalLastClosingHolding = 0;

    for (const wallet of wallets) {
      const currentBalance = Number(wallet.currentBalance || 0);
      totalCurrentHolding += currentBalance;

      // Inflows and outflows since last closing
      const timeFilter = lastClosingTime ? { createdAt: { $gt: lastClosingTime } } : {};

      const inTx = await WalletTransaction.find({
        ...timeFilter,
        destinationWallet: wallet._id,
      });
      const walletInflow = inTx.reduce((s, tx) => s + Number(tx.amount || 0), 0);

      const outTx = await WalletTransaction.find({
        ...timeFilter,
        sourceWallet: wallet._id,
      });
      const walletOutflow = outTx.reduce((s, tx) => s + Number(tx.amount || 0), 0);

      totalInflows += walletInflow;
      totalOutflows += walletOutflow;

      // Balance at last closing
      let balanceAtLastClosing = 0;
      if (lastClosing && Array.isArray(lastClosing.walletsSnapshot)) {
        const snap = lastClosing.walletsSnapshot.find(s => s.walletId && s.walletId.toString() === wallet._id.toString());
        if (snap) {
          balanceAtLastClosing = Number(snap.balanceAtClosing || 0);
        } else {
          balanceAtLastClosing = currentBalance - walletInflow + walletOutflow;
        }
      } else {
        balanceAtLastClosing = currentBalance - walletInflow + walletOutflow;
      }
      totalLastClosingHolding += balanceAtLastClosing;

      const netChange = walletInflow - walletOutflow;

      walletsCalculated.push({
        walletId: wallet._id,
        walletName: wallet.name,
        walletType: wallet.type,
        bankName: wallet.bankName || '',
        accountNumber: wallet.accountNumber || '',
        provider: wallet.provider || '',
        location: wallet.location || '',
        balanceAtLastClosing,
        inflowsSinceLastClosing: walletInflow,
        outflowsSinceLastClosing: walletOutflow,
        netChange,
        currentBalance,
      });
    }

    const totalNetChange = totalInflows - totalOutflows;

    return {
      lastClosing: lastClosing ? {
        id: lastClosing._id,
        date: lastClosing.date,
        closingDateTime: lastClosing.closingDateTime || lastClosing.createdAt,
        totalHolding: lastClosing.totalHolding,
        netChange: lastClosing.netChange,
        closedByName: lastClosing.closedByName || 'Admin',
        remarks: lastClosing.remarks || '',
      } : null,
      wallets: walletsCalculated,
      summary: {
        totalCurrentHolding,
        totalInflows,
        totalOutflows,
        totalNetChange,
        totalLastClosingHolding,
        activeWalletsCount: wallets.length,
      }
    };
  }

  async getClosings({ dateFrom, dateTo }) {
    const query = {};
    if (dateFrom && dateTo) {
      query.date = { $gte: dateFrom, $lte: dateTo };
    }
    return FinanceClosing.find(query)
      .sort({ createdAt: -1 })
      .populate('closedBy', 'name role email');
  }

  async createClosing(data, userId) {
    const dashboard = await this.getClosingDashboard();
    const user = userId ? await User.findById(userId).select('name role') : null;

    const closingData = {
      date: data.date || new Date().toISOString().split('T')[0],
      closingDateTime: new Date(),
      type: 'HOLDINGS_CHECKPOINT',
      previousClosingDate: dashboard.lastClosing ? dashboard.lastClosing.closingDateTime : null,
      previousClosingId: dashboard.lastClosing ? dashboard.lastClosing.id : null,
      totalHolding: dashboard.summary.totalCurrentHolding,
      totalInflows: dashboard.summary.totalInflows,
      totalOutflows: dashboard.summary.totalOutflows,
      netChange: dashboard.summary.totalNetChange,
      walletsSnapshot: dashboard.wallets.map(w => ({
        walletId: w.walletId,
        walletName: w.walletName,
        walletType: w.walletType,
        bankName: w.bankName,
        accountNumber: w.accountNumber,
        balanceBefore: w.balanceAtLastClosing,
        inflowsSinceLastClosing: w.inflowsSinceLastClosing,
        outflowsSinceLastClosing: w.outflowsSinceLastClosing,
        netChange: w.netChange,
        balanceAtClosing: w.currentBalance,
      })),
      closedBy: userId || null,
      closedByName: user ? `${user.name} (${user.role})` : 'System Admin',
      remarks: data.remarks || '',
      totalIncome: dashboard.summary.totalInflows,
      totalExpense: dashboard.summary.totalOutflows,
    };

    return FinanceClosing.create(closingData);
  }

  async updateClosing(id, data) {
    return FinanceClosing.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteClosing(id) {
    return FinanceClosing.findByIdAndDelete(id);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IN-BETWEEN DATES FINANCIAL CHANGES LEDGER & ANALYTICS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getFinanceLedger({ dateFrom, dateTo, category, walletId, type }) {
    const incomeQuery = {};
    const expenseQuery = { status: { $ne: 'Rejected' } };

    if (dateFrom && dateTo) {
      incomeQuery.date = { $gte: dateFrom, $lte: dateTo };
      expenseQuery.date = { $gte: dateFrom, $lte: dateTo };
    }
    if (category && category !== 'all') {
      incomeQuery.category = category;
      expenseQuery.category = category;
    }
    if (walletId && walletId !== 'all') {
      incomeQuery.walletId = walletId;
      expenseQuery.walletId = walletId;
    }

    const [incomes, expenses] = await Promise.all([
      type === 'EXPENSE' ? [] : FinanceIncome.find(incomeQuery).sort({ date: -1, createdAt: -1 }),
      type === 'INCOME' ? [] : FinanceExpense.find(expenseQuery).sort({ date: -1, createdAt: -1 }).populate('approvedBy', 'name'),
    ]);

    const incomeEntries = incomes.map(item => ({
      id: item._id.toString(),
      type: 'INCOME',
      date: item.date,
      category: item.category,
      subCategory: '',
      description: item.description,
      amount: item.amount,
      walletId: item.walletId,
      walletName: item.walletName,
      status: 'Completed',
      auditText: item.source ? `Automated ${item.source}` : 'Direct Income',
      createdAt: item.createdAt,
    }));

    const expenseEntries = expenses.map(item => ({
      id: item._id.toString(),
      type: 'EXPENSE',
      date: item.date,
      category: item.category,
      subCategory: item.subCategory || '',
      description: item.description,
      amount: item.amount,
      walletId: item.walletId,
      walletName: item.walletName,
      status: item.status || 'Pending',
      auditText: item.approvedBy ? `Approved by ${item.approvedBy.name}` : (item.status === 'Approved' ? 'Approved' : 'Pending'),
      createdAt: item.createdAt,
    }));

    const combined = [...incomeEntries, ...expenseEntries].sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const totalIncome = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    return {
      ledger: combined,
      stats: {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        incomeCount: incomes.length,
        expenseCount: expenses.length,
        totalTransactions: combined.length,
      },
    };
  }

  async getAnalytics({ dateFrom, dateTo }) {
    const incomeQuery = dateFrom && dateTo ? { date: { $gte: dateFrom, $lte: dateTo } } : {};
    const expenseQuery = dateFrom && dateTo ? { date: { $gte: dateFrom, $lte: dateTo }, status: { $ne: 'Rejected' } } : { status: { $ne: 'Rejected' } };

    const incomes = await FinanceIncome.find(incomeQuery);
    const expenses = await FinanceExpense.find(expenseQuery);

    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      incomeCount: incomes.length,
      expenseCount: expenses.length,
    };
  }
}

module.exports = new FinanceService();
