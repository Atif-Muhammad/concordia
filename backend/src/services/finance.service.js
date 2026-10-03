const {
  FinanceIncome,
  FinanceExpense,
  FinanceClosing,
  FinanceCategory,
  Wallet,
  WalletTransaction,
  User,
} = require('../models');

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Bills', subCategories: ['Electricity Bill', 'Gas Bill', 'Water Bill', 'Internet Bill', 'Telephone Bill', 'Generator Fuel'] },
  { name: 'Payroll', subCategories: ['Teaching Salaries', 'Non-Teaching Salaries', 'Contract Wages', 'Bonuses', 'Payroll Taxes'] },
  { name: 'Operations', subCategories: ['Office Supplies', 'Printing & Stationery', 'Software Subscription', 'Bank Charges', 'Courier'] },
  { name: 'Maintenance', subCategories: ['Building Repair', 'Equipment Repair', 'Vehicle Maintenance', 'Cleaning', 'Security Services'] },
  { name: 'Academic', subCategories: ['Books & Library', 'Lab Consumables', 'Exam Material', 'Training & Workshops', 'Sports Material'] },
  { name: 'StudentWelfare', subCategories: ['Scholarships', 'Events', 'Medical Support', 'Transport Support', 'Meal Support'] },
  { name: 'Hostel', subCategories: ['Hostel Food', 'Hostel Utilities', 'Hostel Maintenance', 'Hostel Supplies'] },
  { name: 'Compliance', subCategories: ['Tax Payment', 'Legal Fee', 'Licensing & NOC', 'Audit Fee', 'Insurance'] },
  { name: 'Miscellaneous', subCategories: ['Donation', 'Emergency', 'Petty Cash', 'Other'] },
  { name: 'Inventory', subCategories: ['Inventory Purchase', 'Inventory Maintenance'] },
  { name: 'Salaries', subCategories: ['Salary Payment'] },
  { name: 'Utility Bills', subCategories: ['Electricity Bill', 'Gas Bill', 'Water Bill', 'Internet Bill', 'Telephone Bill'] },
  { name: 'Supplies', subCategories: ['General Supplies'] },
  { name: 'Other', subCategories: ['Other'] },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Tuition Fee', subCategories: ['Monthly Tuition', 'Admission Fee', 'Registration Fee'] },
  { name: 'Extra Challan', subCategories: ['Fine', 'Late Fee', 'Lab Fee', 'Library Fee', 'Special Fee'] },
  { name: 'Hostel Challan', subCategories: ['Mess Fee', 'Room Rent', 'Utility Charges'] },
  { name: 'Donation', subCategories: ['General Donation', 'Zakat', 'Alumni Donation', 'Corporate Sponsor'] },
  { name: 'Funding', subCategories: ['Government Grant', 'Trust Fund', 'Research Grant'] },
  { name: 'Revenue', subCategories: ['Canteen Rent', 'Bookshop Rent', 'Uniform Sales', 'Event Revenue'] },
  { name: 'Investments', subCategories: ['Bank Profit', 'Dividends', 'Fixed Deposit Return'] },
  { name: 'Other', subCategories: ['Miscellaneous'] },
];

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

    const expenses = await FinanceExpense.find(query)
      .populate('approvedBy', 'name role email')
      .populate('rejectedBy', 'name role email')
      .populate('createdBy', 'name role email')
      .populate({ path: 'transactionId', select: 'performedByName performedBy createdAt' })
      .sort({ date: -1, createdAt: -1 });

    return expenses.map((exp) => {
      const obj = exp.toObject ? exp.toObject({ virtuals: true }) : { ...exp };
      const isApproved = String(obj.status || '').toUpperCase() === 'APPROVED';
      const isRejected = String(obj.status || '').toUpperCase() === 'REJECTED';

      // 1. Resolve Approver's Name from DB
      let approvedByName = obj.approvedByName;
      if (!approvedByName && obj.approvedBy && typeof obj.approvedBy === 'object') {
        approvedByName = obj.approvedBy.name;
      }
      if (!approvedByName && obj.transactionId?.performedByName) {
        approvedByName = obj.transactionId.performedByName.replace(/\s*\([^)]*\)$/, '').trim();
      }
      if (!approvedByName && isApproved) {
        approvedByName = 'Administrator';
      }

      // 2. Resolve Approval Timestamp
      const approvedAt =
        obj.approvedAt ||
        (isApproved ? (obj.transactionId?.createdAt || obj.updatedAt || obj.createdAt) : null);

      // 3. Resolve Rejecter's Name from DB
      let rejectedByName = obj.rejectedByName;
      if (!rejectedByName && obj.rejectedBy && typeof obj.rejectedBy === 'object') {
        rejectedByName = obj.rejectedBy.name;
      }
      if (!rejectedByName && isRejected) {
        rejectedByName = 'Administrator';
      }

      // 4. Resolve Rejection Timestamp
      const rejectedAt =
        obj.rejectedAt ||
        (isRejected ? (obj.updatedAt || obj.createdAt) : null);

      // 5. Resolve Creator's Name
      let createdByName = obj.createdByName;
      if (!createdByName && obj.createdBy && typeof obj.createdBy === 'object') {
        createdByName = obj.createdBy.name;
      }

      return {
        ...obj,
        approvedByName: approvedByName || '',
        approvedAt,
        rejectedByName: rejectedByName || '',
        rejectedAt,
        createdByName: createdByName || '',
      };
    });
  }

  async createExpense(data, userId, userName = null) {
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

    if (userId) {
      expenseData.createdBy = userId;
      let creatorName = userName;
      if (!creatorName) {
        const u = await User.findById(userId).select('name');
        if (u) creatorName = u.name;
      }
      expenseData.createdByName = creatorName || '';
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
    if (String(expense.status || '').toUpperCase() === 'APPROVED' && expense.walletId) {
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

  async approveExpense(id, userId, customWalletId = null, userName = null) {
    const expense = await FinanceExpense.findById(id);
    if (!expense) throw new Error('Expense not found');

    if (String(expense.status || '').toUpperCase() === 'APPROVED') {
      return expense; // Already approved
    }

    let approverName = userName;
    let approverRole = 'Staff';
    if (userId) {
      const u = await User.findById(userId).select('name role');
      if (u) {
        approverName = u.name;
        approverRole = u.role;
      }
    }
    if (!approverName) approverName = 'Administrator';

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
        performedByName: `${approverName} (${approverRole})`,
        balanceAfterSource: wallet.currentBalance,
      });

      expense.walletId = wallet._id;
      expense.walletName = wallet.name;
      expense.transactionId = walletTx._id;
    }

    expense.status = 'Approved';
    expense.approvedBy = userId || null;
    expense.approvedByName = approverName;
    expense.approvedAt = new Date();
    await expense.save();

    await expense.populate('approvedBy', 'name role email');
    return expense;
  }

  async rejectExpense(id, userId, rejectionReason, userName = null) {
    const expense = await FinanceExpense.findById(id);
    if (!expense) throw new Error('Expense not found');

    let rejecterName = userName;
    if (userId && !rejecterName) {
      const u = await User.findById(userId).select('name role');
      if (u) rejecterName = u.name;
    }
    if (!rejecterName) rejecterName = 'Administrator';

    // If previously approved and deducted, revert deduction
    if (String(expense.status || '').toUpperCase() === 'APPROVED' && expense.walletId && expense.transactionId) {
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
    expense.rejectedByName = rejecterName;
    expense.rejectedAt = new Date();
    if (rejectionReason) expense.notes = rejectionReason;
    await expense.save();

    await expense.populate('rejectedBy', 'name role email');
    return expense;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLOSINGS & HOLDINGS CHECKPOINT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Format transaction metadata into clear human-readable origin/destination details
   */
  formatWalletTxDetail(tx, currentWalletId, isOutflow = false) {
    const isTransfer = tx.transactionType === 'CONTRA_TRANSFER' || tx.category === 'TRANSFER';
    const sourceName = tx.sourceWallet?.name || tx.sourceWalletName || '';
    const destName = tx.destinationWallet?.name || tx.destinationWalletName || '';

    let from = '';
    let to = '';

    if (isTransfer) {
      from = sourceName ? `Transfer from ${sourceName}` : 'Transferred from Wallet';
      to = destName ? `Transfer to ${destName}` : 'Transferred to Wallet';
    } else if (tx.transactionType === 'FEE' || tx.category === 'FEE') {
      const studentInfo = [
        tx.studentName ? tx.studentName : 'Student',
        tx.rollNumber ? `(Roll: ${tx.rollNumber})` : '',
        tx.challanNumber ? `[Challan #${tx.challanNumber}]` : '',
        tx.month ? `for ${tx.month}` : '',
      ].filter(Boolean).join(' ');
      from = `Fee Collection: ${studentInfo}`;
      to = destName ? `Treasury (${destName})` : 'Treasury';
    } else if (tx.transactionType === 'HOSTEL_FEE' || tx.category === 'HOSTEL_FEE') {
      const studentInfo = [
        tx.studentName ? tx.studentName : 'Hostel Resident',
        tx.rollNumber ? `(Roll: ${tx.rollNumber})` : '',
        tx.challanNumber ? `[Challan #${tx.challanNumber}]` : '',
      ].filter(Boolean).join(' ');
      from = `Hostel Fee: ${studentInfo}`;
      to = destName ? `Treasury (${destName})` : 'Treasury';
    } else if (tx.transactionType === 'PAYROLL' || tx.category === 'PAYROLL') {
      from = sourceName ? `Treasury (${sourceName})` : 'Treasury';
      to = `Staff Payroll: ${tx.payrollMonth || 'Salaries'} (${tx.staffCount || (tx.staffDetails?.length || 0)} Staff)`;
    } else if (tx.category?.includes('INVENTORY') || tx.transactionType?.includes('INVENTORY')) {
      from = sourceName ? `Treasury (${sourceName})` : 'Treasury';
      to = tx.description ? `Inventory: ${tx.description}` : 'Inventory Expense';
    } else if (tx.category?.includes('HOSTEL_EXPENSE')) {
      from = sourceName ? `Treasury (${sourceName})` : 'Treasury';
      to = tx.description ? `Hostel Expense: ${tx.description}` : 'Hostel Expense';
    } else if (tx.category === 'EXPENSE' || tx.transactionType === 'EXPENSE') {
      from = sourceName ? `Treasury (${sourceName})` : 'Treasury';
      to = tx.description || tx.sourceCategory || 'Operational Expense';
    } else if (tx.transactionType === 'DEPOSIT' || tx.category === 'DEPOSIT') {
      from = tx.source || tx.description || 'Cash / Bank Deposit';
      to = destName ? `Treasury (${destName})` : 'Treasury';
    } else if (tx.transactionType === 'OPENING_BALANCE') {
      from = 'Initial Opening Balance';
      to = destName ? `Treasury (${destName})` : 'Treasury';
    } else if (tx.isReversal || tx.transactionType?.includes('REVERSAL') || tx.category?.includes('REVERSAL')) {
      from = isOutflow ? (sourceName ? `Reversal from ${sourceName}` : 'Reversal Adjustment') : (tx.source || 'Reversal Refund');
      to = isOutflow ? (tx.description || 'Reversal Adjustment') : (destName ? `Treasury (${destName})` : 'Treasury');
    } else {
      from = tx.source || tx.description || (sourceName ? `Wallet: ${sourceName}` : 'External Source');
      to = tx.description || (destName ? `Wallet: ${destName}` : 'External Destination');
    }

    return {
      id: tx._id?.toString() || tx.id,
      date: tx.date || (tx.createdAt ? new Date(tx.createdAt).toISOString().split('T')[0] : ''),
      createdAt: tx.createdAt,
      transactionType: tx.transactionType || 'OTHER',
      category: tx.category || 'OTHER',
      amount: Number(tx.amount || 0),
      description: tx.description || '',
      referenceNo: tx.referenceNo || '',
      from,
      to,
      studentName: tx.studentName || '',
      rollNumber: tx.rollNumber || '',
      challanNumber: tx.challanNumber || '',
      payrollMonth: tx.payrollMonth || '',
      staffCount: tx.staffCount || (tx.staffDetails?.length || 0),
      staffDetails: Array.isArray(tx.staffDetails) ? tx.staffDetails : [],
      sourceWalletName: sourceName,
      destinationWalletName: destName,
      performedByName: tx.performedByName || 'System',
    };
  }

  /**
   * Calculate live holdings or exact date / period holdings and changes
   */
  async getClosingDashboard({ date, dateFrom, dateTo } = {}) {
    const targetDate = date || (dateFrom && dateFrom === dateTo ? dateFrom : null);
    const effectiveDateFrom = date || dateFrom;
    const effectiveDateTo = date || dateTo;
    const isFiltered = Boolean(targetDate || effectiveDateFrom || effectiveDateTo);

    const lastClosing = await FinanceClosing.findOne().sort({ createdAt: -1 });
    const lastClosingTime = lastClosing ? (lastClosing.closingDateTime || lastClosing.createdAt) : null;

    const wallets = await Wallet.find({ status: 'ACTIVE' }).sort({ name: 1 });

    // Check if an exact formal closing record exists for the selected date
    let exactClosing = null;
    if (targetDate) {
      exactClosing = await FinanceClosing.findOne({ date: targetDate })
        .sort({ closingDateTime: -1, createdAt: -1 })
        .populate('closedBy', 'name role email');
    }

    // Build transaction date filter
    let periodTxFilter = {};
    if (isFiltered) {
      const or = [];
      const strCond = {};
      if (effectiveDateFrom) strCond.$gte = String(effectiveDateFrom);
      if (effectiveDateTo) strCond.$lte = String(effectiveDateTo);
      or.push({ date: strCond });

      const dateCond = {};
      if (effectiveDateFrom) dateCond.$gte = new Date(`${effectiveDateFrom}T00:00:00.000Z`);
      if (effectiveDateTo) dateCond.$lte = new Date(`${effectiveDateTo}T23:59:59.999Z`);
      or.push({ date: { $in: [null, ''] }, createdAt: dateCond });

      periodTxFilter = { $or: or };
    } else {
      periodTxFilter = lastClosingTime ? { createdAt: { $gt: lastClosingTime } } : {};
    }

    // Transactions strictly after effectiveDateTo (to calculate historical wallet balance as of that date)
    let afterDateToFilter = null;
    if (effectiveDateTo) {
      afterDateToFilter = {
        $or: [
          { date: { $gt: String(effectiveDateTo) } },
          { date: { $in: [null, ''] }, createdAt: { $gt: new Date(`${effectiveDateTo}T23:59:59.999Z`) } },
        ],
      };
    }

    const inflowCategories = {};
    const outflowCategories = {};
    let totalInflows = 0;
    let totalOutflows = 0;
    let totalCurrentHolding = 0;
    let totalLastClosingHolding = 0;
    const walletsCalculated = [];

    // Check if exact closing has a valid walletsSnapshot
    const hasValidSnapshot = exactClosing && Array.isArray(exactClosing.walletsSnapshot) && exactClosing.walletsSnapshot.length > 0;

    for (const wallet of wallets) {
      const liveBalance = Number(wallet.currentBalance || 0);

      // Inflows and outflows in the period
      const inTx = await WalletTransaction.find({
        ...periodTxFilter,
        destinationWallet: wallet._id,
      })
        .populate('sourceWallet', 'name type bankName accountNumber')
        .populate('destinationWallet', 'name type bankName accountNumber')
        .sort({ createdAt: -1 });

      const walletInflow = inTx.reduce((s, tx) => {
        const amt = Number(tx.amount || 0);
        const cat = tx.category || tx.transactionType || 'OTHER';
        inflowCategories[cat] = (inflowCategories[cat] || 0) + amt;
        return s + amt;
      }, 0);

      const outTx = await WalletTransaction.find({
        ...periodTxFilter,
        sourceWallet: wallet._id,
      })
        .populate('sourceWallet', 'name type bankName accountNumber')
        .populate('destinationWallet', 'name type bankName accountNumber')
        .sort({ createdAt: -1 });

      const walletOutflow = outTx.reduce((s, tx) => {
        const amt = Number(tx.amount || 0);
        const cat = tx.category || tx.transactionType || 'OTHER';
        outflowCategories[cat] = (outflowCategories[cat] || 0) + amt;
        return s + amt;
      }, 0);

      totalInflows += walletInflow;
      totalOutflows += walletOutflow;

      let balanceAtPeriodEnd = liveBalance;
      let snapObj = null;
      if (hasValidSnapshot) {
        snapObj = exactClosing.walletsSnapshot.find(
          s => s.walletId && s.walletId.toString() === wallet._id.toString()
        );
        if (snapObj) {
          balanceAtPeriodEnd = Number(snapObj.balanceAtClosing || 0);
        }
      } else if (afterDateToFilter) {
        const afterInTx = await WalletTransaction.find({
          ...afterDateToFilter,
          destinationWallet: wallet._id,
        });
        const afterInflow = afterInTx.reduce((s, tx) => s + Number(tx.amount || 0), 0);

        const afterOutTx = await WalletTransaction.find({
          ...afterDateToFilter,
          sourceWallet: wallet._id,
        });
        const afterOutflow = afterOutTx.reduce((s, tx) => s + Number(tx.amount || 0), 0);

        balanceAtPeriodEnd = liveBalance - afterInflow + afterOutflow;
      }
      totalCurrentHolding += balanceAtPeriodEnd;

      let balanceBefore = 0;
      if (hasValidSnapshot) {
        if (snapObj) {
          balanceBefore = Number(snapObj.balanceBefore || 0);
        } else {
          balanceBefore = balanceAtPeriodEnd - walletInflow + walletOutflow;
        }
      } else if (!isFiltered && lastClosing && Array.isArray(lastClosing.walletsSnapshot)) {
        const snap = lastClosing.walletsSnapshot.find(s => s.walletId && s.walletId.toString() === wallet._id.toString());
        if (snap) {
          balanceBefore = Number(snap.balanceAtClosing || 0);
        } else {
          balanceBefore = balanceAtPeriodEnd - walletInflow + walletOutflow;
        }
      } else {
        balanceBefore = balanceAtPeriodEnd - walletInflow + walletOutflow;
      }
      totalLastClosingHolding += balanceBefore;

      const netChange = walletInflow - walletOutflow;

      const formattedInflows = (snapObj && Array.isArray(snapObj.inflows) && snapObj.inflows.length > 0)
        ? snapObj.inflows
        : inTx.map(tx => this.formatWalletTxDetail(tx, wallet._id, false));

      const formattedOutflows = (snapObj && Array.isArray(snapObj.outflows) && snapObj.outflows.length > 0)
        ? snapObj.outflows
        : outTx.map(tx => this.formatWalletTxDetail(tx, wallet._id, true));

      walletsCalculated.push({
        walletId: wallet._id,
        walletName: wallet.name,
        walletType: wallet.type,
        bankName: wallet.bankName || '',
        accountNumber: wallet.accountNumber || '',
        provider: wallet.provider || '',
        location: wallet.location || '',
        balanceAtLastClosing: balanceBefore,
        inflowsSinceLastClosing: walletInflow,
        outflowsSinceLastClosing: walletOutflow,
        netChange,
        currentBalance: balanceAtPeriodEnd,
        inflows: formattedInflows,
        outflows: formattedOutflows,
      });
    }

    // Override summary totals if exact closing explicitly defines them
    const finalInflows = exactClosing && (exactClosing.totalInflows || exactClosing.totalIncome) ? Number(exactClosing.totalInflows || exactClosing.totalIncome) : totalInflows;
    const finalOutflows = exactClosing && (exactClosing.totalOutflows || exactClosing.totalExpense) ? Number(exactClosing.totalOutflows || exactClosing.totalExpense) : totalOutflows;
    const finalNetChange = exactClosing && exactClosing.netChange !== undefined ? Number(exactClosing.netChange) : (finalInflows - finalOutflows);
    const finalHoldings = exactClosing && exactClosing.totalHolding ? Number(exactClosing.totalHolding) : totalCurrentHolding;

    return {
      isDateFiltered: isFiltered,
      isExactCheckpoint: Boolean(exactClosing),
      selectedDate: targetDate || null,
      filter: {
        date: targetDate || null,
        dateFrom: effectiveDateFrom || null,
        dateTo: effectiveDateTo || null,
      },
      lastClosing: exactClosing ? {
        id: exactClosing._id,
        date: exactClosing.date,
        closingDateTime: exactClosing.closingDateTime || exactClosing.createdAt,
        totalHolding: finalHoldings,
        totalInflows: finalInflows,
        totalOutflows: finalOutflows,
        netChange: finalNetChange,
        closedByName: exactClosing.closedByName || exactClosing.closedBy?.name || 'Admin',
        remarks: exactClosing.remarks || '',
      } : (lastClosing ? {
        id: lastClosing._id,
        date: lastClosing.date,
        closingDateTime: lastClosing.closingDateTime || lastClosing.createdAt,
        totalHolding: lastClosing.totalHolding,
        totalInflows: lastClosing.totalInflows,
        totalOutflows: lastClosing.totalOutflows,
        netChange: lastClosing.netChange,
        closedByName: lastClosing.closedByName || 'Admin',
        remarks: lastClosing.remarks || '',
      } : null),
      wallets: walletsCalculated,
      summary: {
        totalCurrentHolding: finalHoldings,
        totalInflows: finalInflows,
        totalOutflows: finalOutflows,
        totalNetChange: finalNetChange,
        totalLastClosingHolding: finalHoldings - finalNetChange,
        activeWalletsCount: wallets.length,
      },
      categoryBreakdown: {
        inflows: Object.entries(inflowCategories).map(([category, amount]) => ({ category, amount })),
        outflows: Object.entries(outflowCategories).map(([category, amount]) => ({ category, amount })),
      },
    };
  }

  async getClosings({ date, dateFrom, dateTo } = {}) {
    const query = {};
    if (date) {
      query.date = date;
    } else if (dateFrom && dateTo) {
      query.date = { $gte: dateFrom, $lte: dateTo };
    } else if (dateFrom) {
      query.date = { $gte: dateFrom };
    } else if (dateTo) {
      query.date = { $lte: dateTo };
    }
    const closings = await FinanceClosing.find(query)
      .sort({ date: -1, createdAt: -1 })
      .populate('closedBy', 'name role email');

    // Backwards compatibility: ensure walletsSnapshot has populated inflows and outflows
    for (const closing of closings) {
      if (Array.isArray(closing.walletsSnapshot)) {
        const needsPop = closing.walletsSnapshot.some(
          w => (!w.inflows || w.inflows.length === 0) && (w.inflowsSinceLastClosing > 0 || w.outflowsSinceLastClosing > 0)
        );
        if (needsPop) {
          const endTime = closing.closingDateTime || closing.createdAt;
          const startTime = closing.previousClosingDate || null;
          const timeFilter = startTime
            ? { createdAt: { $gt: startTime, $lte: endTime } }
            : { createdAt: { $lte: endTime } };

          for (const w of closing.walletsSnapshot) {
            if ((!w.inflows || w.inflows.length === 0) && w.inflowsSinceLastClosing > 0) {
              const inTxs = await WalletTransaction.find({
                ...timeFilter,
                destinationWallet: w.walletId,
              })
                .populate('sourceWallet', 'name type bankName accountNumber')
                .populate('destinationWallet', 'name type bankName accountNumber')
                .sort({ createdAt: -1 });
              w.inflows = inTxs.map(tx => this.formatWalletTxDetail(tx, w.walletId, false));
            }
            if ((!w.outflows || w.outflows.length === 0) && w.outflowsSinceLastClosing > 0) {
              const outTxs = await WalletTransaction.find({
                ...timeFilter,
                sourceWallet: w.walletId,
              })
                .populate('sourceWallet', 'name type bankName accountNumber')
                .populate('destinationWallet', 'name type bankName accountNumber')
                .sort({ createdAt: -1 });
              w.outflows = outTxs.map(tx => this.formatWalletTxDetail(tx, w.walletId, true));
            }
          }
        }
      }
    }

    return closings;
  }

  async createClosing(data, userId) {
    const closingDate = data.date || new Date().toISOString().split('T')[0];

    // Disallow closing for the same date twice
    const existingClosing = await FinanceClosing.findOne({ date: closingDate });
    if (existingClosing) {
      const err = new Error(`A closing checkpoint already exists for ${closingDate}. Duplicate closing for the same date is not allowed.`);
      err.status = 400;
      throw err;
    }

    const dashboard = await this.getClosingDashboard();
    const user = userId ? await User.findById(userId).select('name role') : null;

    const closingData = {
      date: closingDate,
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
        inflows: w.inflows || [],
        outflows: w.outflows || [],
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
      auditText: (() => {
        const isApproved = String(item.status || '').toUpperCase() === 'APPROVED';
        const approverName = item.approvedByName || item.approvedBy?.name || (isApproved ? 'Administrator' : '');
        return approverName ? `Approved by ${approverName}` : (isApproved ? 'Approved' : 'Pending');
      })(),
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CATEGORIES & SUB-CATEGORIES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async seedDefaultCategories() {
    const count = await FinanceCategory.countDocuments();
    if (count > 0) return;

    const docs = [];
    for (const item of DEFAULT_EXPENSE_CATEGORIES) {
      docs.push({
        type: 'EXPENSE',
        name: item.name,
        subCategories: item.subCategories || [],
        isDefault: true,
        isActive: true,
      });
    }
    for (const item of DEFAULT_INCOME_CATEGORIES) {
      docs.push({
        type: 'INCOME',
        name: item.name,
        subCategories: item.subCategories || [],
        isDefault: true,
        isActive: true,
      });
    }
    if (docs.length > 0) {
      await FinanceCategory.insertMany(docs, { ordered: false }).catch(() => {});
    }
  }

  async getCategories({ type } = {}) {
    await this.seedDefaultCategories();
    const query = { isActive: true };
    if (type) {
      query.type = type.toUpperCase();
    }
    return FinanceCategory.find(query).sort({ isDefault: -1, name: 1 });
  }

  async createCategory({ type, name, description = '', subCategories = [] }) {
    if (!type || !['INCOME', 'EXPENSE'].includes(type.toUpperCase())) {
      throw new Error('Valid category type (INCOME or EXPENSE) is required');
    }
    if (!name || !name.trim()) {
      throw new Error('Category name is required');
    }

    const cleanType = type.toUpperCase();
    const cleanName = name.trim();

    const existing = await FinanceCategory.findOne({
      type: cleanType,
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') }
    });
    if (existing) {
      throw new Error(`Category "${cleanName}" already exists for ${cleanType}`);
    }

    const cleanSubCategories = Array.isArray(subCategories)
      ? [...new Set(subCategories.map(s => String(s).trim()).filter(Boolean))]
      : [];

    return FinanceCategory.create({
      type: cleanType,
      name: cleanName,
      description: description ? description.trim() : '',
      subCategories: cleanSubCategories,
      isDefault: false,
      isActive: true,
    });
  }

  async updateCategory(id, { name, description, subCategories }) {
    const category = await FinanceCategory.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    if (name && name.trim() && name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const duplicate = await FinanceCategory.findOne({
        _id: { $ne: id },
        type: category.type,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });
      if (duplicate) {
        throw new Error(`Category "${name.trim()}" already exists for ${category.type}`);
      }
      category.name = name.trim();
    }

    if (description !== undefined) {
      category.description = description ? description.trim() : '';
    }

    if (Array.isArray(subCategories)) {
      category.subCategories = [...new Set(subCategories.map(s => String(s).trim()).filter(Boolean))];
    }

    await category.save();
    return category;
  }

  async deleteCategory(id) {
    const category = await FinanceCategory.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }
    if (category.isDefault) {
      throw new Error('Cannot delete a system default category. You can modify its sub-categories instead.');
    }

    await FinanceCategory.findByIdAndDelete(id);
    return { success: true, message: 'Category deleted successfully' };
  }

  async addSubCategory(id, { name }) {
    if (!name || !name.trim()) {
      throw new Error('Sub-category name is required');
    }
    const category = await FinanceCategory.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    const cleanSub = name.trim();
    const exists = (category.subCategories || []).some(
      s => s.toLowerCase() === cleanSub.toLowerCase()
    );
    if (exists) {
      throw new Error(`Sub-category "${cleanSub}" already exists in ${category.name}`);
    }

    category.subCategories.push(cleanSub);
    await category.save();
    return category;
  }

  async updateSubCategory(id, { oldName, newName }) {
    if (!oldName || !newName || !newName.trim()) {
      throw new Error('Both old and new sub-category names are required');
    }
    const category = await FinanceCategory.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    const cleanNew = newName.trim();
    const index = (category.subCategories || []).findIndex(
      s => s.toLowerCase() === oldName.trim().toLowerCase()
    );
    if (index === -1) {
      throw new Error(`Sub-category "${oldName}" not found in ${category.name}`);
    }

    category.subCategories[index] = cleanNew;
    category.subCategories = [...new Set(category.subCategories)];
    await category.save();
    return category;
  }

  async deleteSubCategory(id, subName) {
    if (!subName || !subName.trim()) {
      throw new Error('Sub-category name is required');
    }
    const category = await FinanceCategory.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    category.subCategories = (category.subCategories || []).filter(
      s => s.toLowerCase() !== subName.trim().toLowerCase()
    );
    await category.save();
    return category;
  }
}

module.exports = new FinanceService();
