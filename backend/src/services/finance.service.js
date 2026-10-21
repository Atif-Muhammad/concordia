const {
  FinanceIncome,
  FinanceExpense,
  FinanceClosing,
  FinanceCategory,
  Wallet,
  WalletTransaction,
  User,
  Staff,
  FeeChallan,
  ExtraChallan,
  HostelChallan,
  HostelRegistration,
  FeePaymentReceipt,
  Payroll,
  InventoryExpense,
  HostelExpense,
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
        performedByName: user ? `${user.name} (${user.designation || (user.role === 'TEACHER' ? 'Teacher' : (user.role || 'Staff'))})` : 'System',
        balanceAfterDestination: wallet.currentBalance,
      });

      data.walletId = walletRecord._id;
      data.walletName = walletRecord.name;
      data.transactionId = walletTx._id;
    }

    if (userId) {
      const creator = await User.findById(userId).select('name');
      data.createdBy = userId;
      data.createdByName = creator ? creator.name : (data.createdByName || 'System');
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
    if (String(expense.status || '').toUpperCase() === 'APPROVED' && expense.walletId) {
      const wallet = await Wallet.findById(expense.walletId);
      if (wallet) {
        const amount = Number(expense.amount || 0);
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) + amount;
        await wallet.save();

        await WalletTransaction.create({
          transactionType: 'EXPENSE',
          category: 'EXPENSE',
          sourceWallet: wallet._id,
          amount: -Math.abs(amount),
          date: new Date().toISOString().split('T')[0],
          sourceCategory: 'FINANCE_EXPENSE_REVERSAL',
          sourceModule: 'Finance Expense',
          referenceNo: `REV-EXP-${expense._id.toString().slice(-6)}`,
          description: `Reversal: Expense rejected after approval - ${expense.category || 'Expense'}${expense.subCategory ? ` (${expense.subCategory})` : ''} refunded to ${wallet.name}`,
          performedBy: userId || null,
          performedByName: rejecterName,
          balanceAfterSource: wallet.currentBalance,
          isReversal: true,
        });
      }
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DETAILED CLOSING SECTOR BREAKDOWNS (Fee, Incomes, Payroll, Expenses)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const todayStr = new Date().toISOString().split('T')[0];
    const queryDateFrom = effectiveDateFrom || todayStr;
    const queryDateTo = effectiveDateTo || todayStr;
    const startOfDay = new Date(`${queryDateFrom}T00:00:00.000Z`);
    const endOfDay = new Date(`${queryDateTo}T23:59:59.999Z`);

    const defaultWallet = wallets.find(w => w.type === 'CASH') || wallets[0] || null;
    const defaultWalletId = defaultWallet ? String(defaultWallet._id) : null;
    const defaultWalletName = defaultWallet ? defaultWallet.name : 'Cash in Hand';

    // Find any reversal challan numbers so we can ensure deleted/reversed challans never appear
    const reversalTxs = await WalletTransaction.find({
      isReversal: true,
    }).lean().catch(() => []);
    const reversedChallanNos = new Set(reversalTxs.map(t => t.challanNumber).filter(Boolean));

    // Load Staff records to correctly resolve staff designations for loggedBy and disbursedBy
    const allStaff = await Staff.find({}, 'name email designation empDepartment specialization isTeaching').lean().catch(() => []);
    const staffById = new Map();
    const staffByEmail = new Map();
    const staffByName = new Map();
    for (const s of allStaff) {
      if (s._id) staffById.set(String(s._id), s);
      if (s.email) staffByEmail.set(s.email.toLowerCase().trim(), s);
      if (s.name) staffByName.set(s.name.toLowerCase().trim(), s);
    }

    const formatStaffWithDesignation = (userOrStaff, fallbackName = '') => {
      let name = '';
      let email = '';
      let desig = '';
      let role = '';
      let refId = '';

      if (userOrStaff && typeof userOrStaff === 'object') {
        name = userOrStaff.name || '';
        email = userOrStaff.email || '';
        desig = userOrStaff.designation || '';
        role = userOrStaff.role || '';
        refId = userOrStaff.refId ? String(userOrStaff.refId) : '';
      } else if (typeof userOrStaff === 'string') {
        name = userOrStaff;
      }
      if (!name && fallbackName) name = fallbackName;
      if (!name) return 'Super Admin';

      // Clean existing bracketed tag e.g. "(TEACHER)" or "(STAFF)" from name if present
      let rawName = name;
      const bracketMatch = rawName.match(/^(.*?)\s*\((.*?)\)$/);
      if (bracketMatch) {
        rawName = bracketMatch[1].trim();
        if (!desig) desig = bracketMatch[2].trim();
      }

      // Check Staff document for real designation (from Staff record)
      const staffDoc = (refId && staffById.get(refId)) ||
        (email && staffByEmail.get(email.toLowerCase().trim())) ||
        (rawName && staffByName.get(rawName.toLowerCase().trim()));

      if (staffDoc && staffDoc.designation && staffDoc.designation.trim()) {
        desig = staffDoc.designation.trim();
      } else if (staffDoc?.specialization && staffDoc.specialization.trim()) {
        desig = staffDoc.specialization.trim();
      } else if (desig && desig.toUpperCase() !== 'TEACHER' && desig.toUpperCase() !== 'STAFF') {
        // preserve specific user designation (e.g. "Accountant", "Vice Principal", "Registrar")
      } else if (staffDoc?.empDepartment) {
        desig = staffDoc.empDepartment;
      } else if (role && role.toUpperCase() !== 'TEACHER' && role.toUpperCase() !== 'STAFF') {
        desig = role.replace(/_/g, ' ');
      } else if (desig) {
        desig = desig.charAt(0).toUpperCase() + desig.slice(1).toLowerCase();
      } else if (role) {
        desig = role === 'TEACHER' ? 'Teacher' : (role === 'STAFF' ? 'Staff' : role);
      }

      // Title case if all-caps
      if (desig && desig === desig.toUpperCase() && desig.length > 2) {
        desig = desig.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }

      return desig ? `${rawName} (${desig})` : rawName;
    };

    // 1. Fee Collections Breakdown (Active, non-reversed payments and settlements)
    const feeReceipts = await FeePaymentReceipt.find({
      $or: [
        { paidDate: { $gte: startOfDay, $lte: endOfDay } },
        { paidDate: { $in: [null, ''] }, createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate('challanId')
      .populate('studentId', 'fName lName firstName lastName fatherOrguardian fatherName guardianName rollNumber rollNo')
      .populate('walletId', 'name type')
      .populate('recordedBy', 'name role designation email refId')
      .lean()
      .catch((err) => {
        console.error('Error fetching FeePaymentReceipt for closing:', err);
        return [];
      });

    const receiptChallanIds = new Set(
      feeReceipts
        .map(r => r.challanId?._id ? String(r.challanId._id) : (r.challanId ? String(r.challanId) : null))
        .filter(Boolean)
    );

    const feeChallans = await FeeChallan.find({
      status: { $in: ['PAID', 'PARTIAL'] },
      $or: [
        { paidDate: { $gte: startOfDay, $lte: endOfDay } },
        { paidDate: { $in: [null, ''] }, updatedAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate('studentId', 'fName lName firstName lastName fatherOrguardian fatherName guardianName rollNumber rollNo')
      .populate('receivedBy', 'name role designation email refId')
      .populate('walletId', 'name type')
      .lean()
      .catch(() => []);

    const extraChallans = await ExtraChallan.find({
      status: { $in: ['PAID', 'PARTIAL'] },
      $or: [
        { paidDate: { $gte: startOfDay, $lte: endOfDay } },
        { paidDate: { $in: [null, ''] }, updatedAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate('studentId', 'fName lName firstName lastName fatherOrguardian fatherName rollNumber rollNo')
      .populate('receivedBy', 'name role designation email refId')
      .populate('walletId', 'name type')
      .lean()
      .catch(() => []);

    const hostelChallans = await HostelChallan.find({
      status: { $in: ['PAID', 'PARTIAL'] },
      $or: [
        { paidDate: { $gte: startOfDay, $lte: endOfDay } },
        { paidAt: { $gte: startOfDay, $lte: endOfDay } },
        { 'payments.paymentDate': { $gte: startOfDay, $lte: endOfDay } },
        { paidDate: { $in: [null, ''] }, updatedAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate({
        path: 'registrationId',
        populate: {
          path: 'studentId',
          select: 'fName lName firstName lastName fatherOrguardian fatherName guardianName rollNumber rollNo'
        }
      })
      .populate({
        path: 'hostelRegistrationId',
        populate: {
          path: 'studentId',
          select: 'fName lName firstName lastName fatherOrguardian fatherName guardianName rollNumber rollNo'
        }
      })
      .populate('walletId', 'name type')
      .lean()
      .catch(() => []);

    feeChallans.forEach(c => { c._sourceType = 'FeeChallan'; });
    extraChallans.forEach(c => { c._sourceType = 'ExtraChallan'; });
    hostelChallans.forEach(c => { c._sourceType = 'HostelChallan'; });

    const feeCollectionDetails = [];
    const seenReceiptIds = new Set();
    const seenChallans = new Set();

    // Build lookup map for challans across all types
    const challanMap = new Map();
    feeChallans.forEach(c => challanMap.set(String(c._id), c));
    extraChallans.forEach(c => challanMap.set(String(c._id), c));
    hostelChallans.forEach(c => challanMap.set(String(c._id), c));

    // Gather any unmapped challan IDs from receipts whose challanId was not populated
    const unmappedChallanIds = [];
    for (const r of feeReceipts) {
      const rawChId = r.challanId?._id ? String(r.challanId._id) : (r.challanId ? String(r.challanId) : null);
      if (rawChId && !challanMap.has(rawChId) && (!r.challanId?.challanNo && !r.challanId?.challanNumber)) {
        unmappedChallanIds.push(rawChId);
      }
    }

    if (unmappedChallanIds.length > 0) {
      const [fetchedFeeChallans, fetchedExtraChallans, fetchedHostelChallans] = await Promise.all([
        FeeChallan.find({ _id: { $in: unmappedChallanIds } }).populate('studentId', 'fName lName firstName lastName fatherOrguardian fatherName guardianName rollNumber rollNo').populate('receivedBy', 'name role designation email').lean().catch(() => []),
        ExtraChallan.find({ _id: { $in: unmappedChallanIds } }).populate('studentId', 'fName lName firstName lastName fatherOrguardian fatherName rollNumber rollNo').populate('receivedBy', 'name role designation email').lean().catch(() => []),
        HostelChallan.find({ _id: { $in: unmappedChallanIds } }).populate({ path: 'registrationId', populate: { path: 'studentId', select: 'fName lName firstName lastName fatherOrguardian fatherName guardianName rollNumber rollNo' } }).populate({ path: 'hostelRegistrationId', populate: { path: 'studentId', select: 'fName lName firstName lastName fatherOrguardian fatherName guardianName rollNumber rollNo' } }).lean().catch(() => []),
      ]);
      fetchedFeeChallans.forEach(c => { c._sourceType = 'FeeChallan'; challanMap.set(String(c._id), c); });
      fetchedExtraChallans.forEach(c => { c._sourceType = 'ExtraChallan'; challanMap.set(String(c._id), c); });
      fetchedHostelChallans.forEach(c => { c._sourceType = 'HostelChallan'; challanMap.set(String(c._id), c); });
    }

    // Find any missing hostel registrations for external boarders in receipts
    const missingHostelRegIds = [];
    for (const r of feeReceipts) {
      if (r.challanType === 'HostelChallan' && !r.studentId) {
        const regId = r.challanId?.registrationId || r.challanId?.hostelRegistrationId;
        if (regId) missingHostelRegIds.push(String(regId));
      }
    }

    const hostelRegMap = new Map();
    if (missingHostelRegIds.length > 0) {
      const regs = await HostelRegistration.find({ _id: { $in: missingHostelRegIds } })
        .populate('studentId', 'fName lName firstName lastName fatherOrguardian fatherName guardianName rollNumber rollNo')
        .lean()
        .catch(() => []);
      regs.forEach(reg => hostelRegMap.set(String(reg._id), reg));
    }

    // 1A. Process explicit immutable FeePaymentReceipts
    for (const r of feeReceipts) {
      const rawChId = r.challanId?._id ? String(r.challanId._id) : (r.challanId ? String(r.challanId) : null);
      const ch = (r.challanId && (r.challanId.challanNo || r.challanId.challanNumber))
        ? r.challanId
        : (rawChId ? challanMap.get(rawChId) : null);
      const cNo = ch?.challanNo || ch?.challanNumber || r.challanNo || r.sourceChallanNo || '';
      if (cNo && reversedChallanNos.has(cNo)) continue;

      const rId = String(r._id);
      if (seenReceiptIds.has(rId)) continue;
      seenReceiptIds.add(rId);

      const isAdvance = r.receiptType === 'ADVANCE_SETTLEMENT' || r.paymentMode === 'Advance Credit';
      const isArrears = r.receiptType === 'ARREARS_SETTLEMENT' || r.paymentMode === 'Arrears Transfer';
      const actualCashPaid = (isAdvance || isArrears) ? 0 : Math.max(0, Number(r.amountPaid || 0));

      // Non-cash settlements (advance credit application / arrears settlement) carry zero financial inflow on this date.
      // Closing is strictly for transactions that impact cash ledger flow of money on this date.
      if (isAdvance || isArrears || actualCashPaid <= 0) continue;

      const reg = (ch?.registrationId && hostelRegMap.get(String(ch.registrationId))) ||
                  (ch?.hostelRegistrationId && hostelRegMap.get(String(ch.hostelRegistrationId))) ||
                  {};
      const st = r.studentId || ch?.studentId || reg?.studentId || {};
      const fName = st.fName || st.firstName || '';
      const lName = st.lName || st.lastName || '';
      const stName = `${fName} ${lName}`.trim() || ch?.studentName || reg?.externalName || 'Student';
      const father = st.fatherOrguardian || st.fatherName || ch?.fatherName || reg?.externalGuardianName || '—';
      const roll = st.rollNumber || st.rollNo || ch?.rollNumber || ch?.hostelRegNumber || reg?.hostelRegNumber || '—';

      const assignedWalletId = r.walletId?._id ? String(r.walletId._id) : (r.walletId ? String(r.walletId) : (ch?.walletId ? String(ch.walletId) : defaultWalletId));
      const assignedWalletName = r.walletId?.name || (r.walletId ? wallets.find(w => String(w._id) === String(r.walletId))?.name : (ch?.walletName || defaultWalletName)) || 'Cash in Hand';

      const challanType = r.challanType || (ch?.challanNumber ? 'HostelChallan' : (ch?.isExtra || ch?.extraFeeType ? 'ExtraChallan' : 'FeeChallan'));
      let entryType = 'Tuition Challan';
      let headsStr = 'Tuition Fee';
      let headsAmount = Number(ch?.headsAmount || 0);
      let baseAmount = Number(ch?.basePayable || ch?.amount || 0);
      let lateFeeFine = Number(r.allocatedToLateFee || ch?.lateFeeAmount || ch?.fineAmount || ch?.lateFeeFine || 0);
      let totalAmount = Number(ch?.totalAmount || ch?.grossAmount || actualCashPaid);

      if (challanType === 'ExtraChallan') {
        entryType = 'Extra Challan';
        headsStr = ch?.title || ch?.description || ch?.extraFeeType || (Array.isArray(ch?.heads) && ch.heads[0]?.name) || 'Extra Fee';
        baseAmount = Number(ch?.amount || ch?.baseAmount || actualCashPaid);
        headsAmount = baseAmount;
        lateFeeFine = Number(r.allocatedToLateFee || ch?.lateFeeFine || 0);
        totalAmount = Number(ch?.totalAmount || (baseAmount + lateFeeFine) || actualCashPaid);
      } else if (challanType === 'HostelChallan') {
        entryType = 'Hostel Challan';
        headsStr = ch?.month ? `Hostel Fee (${ch.month})` : 'Hostel Fee';
        baseAmount = Number(ch?.hostelFee || ch?.amount || actualCashPaid);
        const headsList = Array.isArray(ch?.heads) ? ch.heads : [];
        headsAmount = headsList.reduce((sum, h) => sum + Number(h.amount || 0), 0);
        lateFeeFine = Number(r.allocatedToLateFee || ch?.lateFeeFine || ch?.fineAmount || 0);
        totalAmount = Number(ch?.totalAmount || (baseAmount + headsAmount + lateFeeFine) || actualCashPaid);
      } else if (Array.isArray(ch?.challanHeads) && ch.challanHeads.length > 0) {
        headsStr = ch.challanHeads.map(h => `${h.name || h.headName}: PKR ${Number(h.amount || 0).toLocaleString()}`).join(', ');
      }

      feeCollectionDetails.push({
        id: rId,
        challanNo: cNo || '—',
        receiptNo: r.receiptNo || '—',
        receiptType: r.receiptType || 'DIRECT',
        studentName: stName,
        fatherName: father,
        rollNumber: roll,
        compositeStudent: `${stName} • Father: ${father} • Roll: ${roll}`,
        baseAmount,
        heads: headsStr,
        headsAmount,
        lateFeeFine,
        totalAmount,
        paidAmount: actualCashPaid,
        advanceCreditUsed: Number(r.advanceCreditUsed || 0),
        settledViaArrearsAmount: Number(r.settledViaArrearsAmount || 0),
        type: entryType,
        paymentMode: r.paymentMode || 'Cash',
        walletId: assignedWalletId,
        walletName: assignedWalletName,
        loggedBy: formatStaffWithDesignation(r.recordedBy, r.receivedByName || ch?.receivedByName || ch?.paidBy || 'Super Admin'),
      });
    }

    // 1B. Fallback for ExtraChallans, HostelChallans, or legacy FeeChallans without receipts
    for (const c of [...feeChallans, ...extraChallans, ...hostelChallans]) {
      const idStr = String(c._id);
      if (receiptChallanIds.has(idStr)) continue; // Already accounted for by receipt!
      if (seenChallans.has(idStr)) continue;
      seenChallans.add(idStr);

      const cNo = c.challanNo || c.challanNumber;
      if (cNo && reversedChallanNos.has(cNo)) continue;

      const isAdvance = c.paidBy === 'Advance Credit' || c.paymentMode === 'Advance Credit';
      const rawPaid = Number(c.directPaidAmount ?? c.paidAmount ?? 0);
      const actualCashPaid = isAdvance ? 0 : Math.max(0, rawPaid - Number(c.advanceApplied || 0));

      if (actualCashPaid <= 0 || isAdvance) continue;

      const isExtra = c._sourceType === 'ExtraChallan';
      const isHostel = c._sourceType === 'HostelChallan';

      const reg = c.registrationId || c.hostelRegistrationId;
      const st = c.studentId || reg?.studentId || {};
      const fName = st.fName || st.firstName || '';
      const lName = st.lName || st.lastName || '';
      const stName = `${fName} ${lName}`.trim() || c.studentName || reg?.externalName || 'Student';
      const father = st.fatherOrguardian || st.fatherName || c.fatherName || reg?.externalGuardianName || '—';
      const roll = st.rollNumber || st.rollNo || c.rollNumber || c.hostelRegNumber || '—';

      let baseAmount = Number(c.basePayable || c.amount || 0);
      let headsStr = 'Tuition Fee';
      let totalHeadsAmount = 0;
      let lateFee = Number(c.lateFeeAmount || c.lateFeeFine || c.fineAmount || 0);
      let entryType = 'Tuition Challan';

      if (isExtra) {
        entryType = 'Extra Challan';
        headsStr = c.title || c.description || (Array.isArray(c.heads) && c.heads[0]?.name) || 'Extra Fee';
        baseAmount = Number(c.amount || 0);
        totalHeadsAmount = baseAmount;
        lateFee = Number(c.lateFeeFine || 0);
      } else if (isHostel) {
        entryType = 'Hostel Challan';
        headsStr = c.month ? `Hostel Fee (${c.month})` : 'Hostel Fee';
        baseAmount = Number(c.hostelFee || c.amount || 0);
        totalHeadsAmount = Array.isArray(c.heads) ? c.heads.reduce((sum, h) => sum + Number(h.amount || 0), 0) : 0;
        lateFee = Number(c.lateFeeFine || c.fineAmount || 0);
      } else if (Array.isArray(c.challanHeads) && c.challanHeads.length > 0) {
        totalHeadsAmount = c.challanHeads.reduce((s, h) => s + Number(h.amount || 0), 0);
        headsStr = c.challanHeads.map(h => `${h.name || h.headName}: PKR ${Number(h.amount || 0).toLocaleString()}`).join(', ');
      } else if (c.headsAmount) {
        totalHeadsAmount = Number(c.headsAmount || 0);
        headsStr = `PKR ${totalHeadsAmount.toLocaleString()}`;
      } else if (c.totalAmount && baseAmount) {
        const diff = Number(c.totalAmount) - baseAmount - lateFee;
        if (diff > 0) totalHeadsAmount = diff;
      }

      const totalAmount = Number(c.totalAmount || c.grossAmount || (baseAmount + lateFee + totalHeadsAmount));

      const assignedWalletId = c.walletId ? String(c.walletId) : defaultWalletId;
      const assignedWalletName = c.walletName || (c.walletId ? wallets.find(w => String(w._id) === String(c.walletId))?.name : defaultWalletName) || 'Cash in Hand';

      feeCollectionDetails.push({
        id: idStr,
        challanNo: cNo || '—',
        studentName: stName,
        fatherName: father,
        rollNumber: roll,
        compositeStudent: `${stName} • Father: ${father} • Roll: ${roll}`,
        baseAmount,
        heads: isAdvance ? 'Advance Credit Settlement' : headsStr,
        headsAmount: totalHeadsAmount,
        lateFeeFine: lateFee,
        totalAmount,
        paidAmount: actualCashPaid,
        advanceCreditUsed: Number(c.advanceApplied || 0),
        type: entryType,
        paymentMode: isAdvance ? 'Advance Credit' : (c.paymentMode || c.paidBy || 'Cash'),
        walletId: assignedWalletId,
        walletName: isAdvance ? 'Non-Cash Settlement' : assignedWalletName,
        loggedBy: formatStaffWithDesignation(c.receivedBy, c.receivedByName || c.paidBy || 'Super Admin'),
      });
    }

    const totalFeeCollection = feeCollectionDetails.reduce((s, c) => s + c.paidAmount, 0);

    // 2. Other Incomes Breakdown
    const financeIncomes = await FinanceIncome.find({
      $or: [
        { date: { $gte: queryDateFrom, $lte: queryDateTo } },
        { date: { $in: [null, ''] }, createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate('transactionId', 'performedByName')
      .lean()
      .catch(() => []);

    const otherIncomeDetails = [];
    const seenIncomeIds = new Set();

    for (const inc of financeIncomes) {
      const amt = Number(inc.amount || 0);
      if (amt <= 0) continue;
      const idStr = String(inc._id);
      seenIncomeIds.add(idStr);

      const assignedWalletId = inc.walletId ? String(inc.walletId) : defaultWalletId;
      const assignedWalletName = inc.walletName || (inc.walletId ? wallets.find(w => String(w._id) === String(inc.walletId))?.name : defaultWalletName) || 'Cash in Hand';

      otherIncomeDetails.push({
        id: idStr,
        title: inc.description || inc.category || 'Other Revenue',
        category: inc.category || 'Revenue',
        subCategory: inc.subCategory || '',
        source: inc.source || 'Direct Receipt',
        amount: amt,
        walletId: assignedWalletId,
        walletName: assignedWalletName,
        date: inc.date || queryDateFrom,
        remarks: inc.description || inc.remarks || '—',
        loggedBy: formatStaffWithDesignation(inc.transactionId?.performedByName, inc.source || 'Super Admin'),
      });
    }

    // Also include any direct non-fee deposit transactions in WalletTransaction
    const directDeposits = await WalletTransaction.find({
      transactionType: 'DEPOSIT',
      amount: { $gt: 0 },
      isReversal: { $ne: true },
      sourceCategory: { $nin: ['CONTRA_TRANSFER', 'TRANSFER', 'FINANCE_INCOME'] },
      $or: [
        { date: { $gte: queryDateFrom, $lte: queryDateTo } },
        { date: { $in: [null, ''] }, createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate('performedBy', 'name role designation email refId')
      .lean()
      .catch(() => []);

    for (const dep of directDeposits) {
      const idStr = String(dep._id);
      if (seenIncomeIds.has(idStr)) continue;
      seenIncomeIds.add(idStr);

      const amt = Number(dep.amount || 0);
      if (amt <= 0) continue;

      const assignedWalletId = dep.destinationWallet ? String(dep.destinationWallet) : defaultWalletId;
      const assignedWalletName = (dep.destinationWallet ? wallets.find(w => String(w._id) === String(dep.destinationWallet))?.name : defaultWalletName) || 'Cash in Hand';

      otherIncomeDetails.push({
        id: idStr,
        title: dep.description || dep.sourceCategory || 'Direct Deposit',
        category: dep.sourceCategory || 'Deposit',
        subCategory: '',
        source: dep.referenceNo || 'Direct Receipt',
        amount: amt,
        walletId: assignedWalletId,
        walletName: assignedWalletName,
        date: dep.date || queryDateFrom,
        remarks: dep.description || '—',
        loggedBy: formatStaffWithDesignation(dep.performedBy, dep.performedByName || 'Super Admin'),
      });
    }

    const totalOtherRevenue = otherIncomeDetails.reduce((s, inc) => s + inc.amount, 0);
    const calculatedTotalIncome = totalFeeCollection + totalOtherRevenue;

    // Group other revenue by category
    const otherIncomeCategoriesMap = {};
    for (const inc of otherIncomeDetails) {
      const cat = inc.category || 'General';
      if (!otherIncomeCategoriesMap[cat]) {
        otherIncomeCategoriesMap[cat] = {
          category: cat,
          totalAmount: 0,
          items: [],
        };
      }
      otherIncomeCategoriesMap[cat].totalAmount += inc.amount;
      otherIncomeCategoriesMap[cat].items.push(inc);
    }
    const otherIncomeCategories = Object.values(otherIncomeCategoriesMap);

    // 3. Payroll / Salaries Breakdown
    const payrollRecords = await Payroll.find({
      status: { $in: ['PAID', 'partially_paid', 'PARTIALLY_PAID'] },
      $or: [
        { paymentDate: { $gte: startOfDay, $lte: endOfDay } },
        { paymentDate: { $in: [null, ''] }, updatedAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate('staffId', 'name fatherName staffId designation department')
      .lean()
      .catch(() => []);

    const payrollDetails = [];
    const seenPayrolls = new Set();

    for (const p of payrollRecords) {
      const idKey = String(p._id);
      seenPayrolls.add(idKey);
      const paidAmt = Number(p.netSalary || p.paidAmount || p.amount || 0);
      if (paidAmt <= 0) continue;

      const st = p.staffId || {};
      const staffName = st.name || p.staffName || 'Staff Member';
      const fatherName = st.fatherName || '—';
      const empId = st.staffId || p.staffId || '—';
      const desig = st.designation || p.designation || 'Staff';

      const assignedWalletId = p.walletId ? String(p.walletId) : defaultWalletId;
      const assignedWalletName = p.walletName || p.paidBy || (p.walletId ? wallets.find(w => String(w._id) === String(p.walletId))?.name : defaultWalletName) || 'Cash in Hand';

      payrollDetails.push({
        id: idKey,
        staffName,
        fatherName,
        employeeId: empId,
        compositeStaff: `${staffName} • Father: ${fatherName} • ID: ${empId}`,
        designation: desig,
        payable: Number(p.basicSalary || p.baseSalary || p.currentSalary || 0),
        deductions: Number(p.totalDeductions || 0),
        allowance: Number(p.totalAllowances || 0),
        totalAmount: paidAmt,
        month: p.month || '',
        walletId: assignedWalletId,
        walletName: assignedWalletName,
        disbursedBy: formatStaffWithDesignation(p.disbursedBy || p.paidBy, p.paidByName || p.disbursedByName || 'Admin'),
      });
    }

    const totalPayroll = payrollDetails.reduce((s, p) => s + p.totalAmount, 0);

    // 4. Other Expenses Breakdown
    const financeExpenses = await FinanceExpense.find({
      status: 'Approved',
      $or: [
        { date: { $gte: queryDateFrom, $lte: queryDateTo } },
        { date: { $in: [null, ''] }, createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).lean().catch(() => []);

    const inventoryExpenses = await InventoryExpense.find({
      $or: [
        { date: { $gte: queryDateFrom, $lte: queryDateTo } },
        { date: { $in: [null, ''] }, createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).lean().catch(() => []);

    const hostelExpenses = await HostelExpense.find({
      $or: [
        { date: { $gte: queryDateFrom, $lte: queryDateTo } },
        { date: { $in: [null, ''] }, createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).lean().catch(() => []);

    const otherExpenseDetails = [];
    const seenExpenseIds = new Set();

    for (const e of financeExpenses) {
      const amt = Number(e.amount || 0);
      if (amt <= 0) continue;
      const idStr = String(e._id);
      seenExpenseIds.add(idStr);

      const assignedWalletId = e.walletId ? String(e.walletId) : defaultWalletId;
      const assignedWalletName = e.walletName || (e.walletId ? wallets.find(w => String(w._id) === String(e.walletId))?.name : defaultWalletName) || 'Cash in Hand';

      otherExpenseDetails.push({
        id: idStr,
        title: e.description || e.category,
        category: e.category || 'Operations',
        subCategory: e.subCategory || '',
        voucherNo: e.voucherNo || idStr.slice(-6),
        vendor: e.vendor || e.source || '—',
        amount: amt,
        walletId: assignedWalletId,
        walletName: assignedWalletName,
        remarks: e.description || e.remarks || '—',
        disbursedBy: formatStaffWithDesignation(null, e.approvedByName || e.createdByName || 'Admin'),
      });
    }

    for (const e of inventoryExpenses) {
      const amt = Number(e.amount || 0);
      if (amt <= 0) continue;
      const idStr = String(e._id);
      if (seenExpenseIds.has(idStr)) continue;
      seenExpenseIds.add(idStr);

      const assignedWalletId = e.walletId ? String(e.walletId) : defaultWalletId;
      const assignedWalletName = e.walletName || (e.walletId ? wallets.find(w => String(w._id) === String(e.walletId))?.name : defaultWalletName) || 'Cash in Hand';

      otherExpenseDetails.push({
        id: idStr,
        title: e.description || e.itemName || 'Inventory Purchase',
        category: 'Inventory',
        subCategory: e.category || '',
        voucherNo: e.voucherNo || idStr.slice(-6),
        vendor: e.supplier || '—',
        amount: amt,
        walletId: assignedWalletId,
        walletName: assignedWalletName,
        remarks: e.description || '—',
        disbursedBy: formatStaffWithDesignation(null, e.performedByName || 'Admin'),
      });
    }

    for (const e of hostelExpenses) {
      const amt = Number(e.amount || 0);
      if (amt <= 0) continue;
      const idStr = String(e._id);
      if (seenExpenseIds.has(idStr)) continue;
      seenExpenseIds.add(idStr);

      const assignedWalletId = e.walletId ? String(e.walletId) : defaultWalletId;
      const assignedWalletName = e.walletName || (e.walletId ? wallets.find(w => String(w._id) === String(e.walletId))?.name : defaultWalletName) || 'Cash in Hand';

      otherExpenseDetails.push({
        id: idStr,
        title: e.description || e.title || 'Hostel Expense',
        category: 'Hostel',
        subCategory: e.category || '',
        voucherNo: e.voucherNo || idStr.slice(-6),
        vendor: e.vendor || '—',
        amount: amt,
        walletId: assignedWalletId,
        walletName: assignedWalletName,
        remarks: e.description || '—',
        disbursedBy: formatStaffWithDesignation(null, e.performedByName || 'Admin'),
      });
    }

    const totalOtherExpenses = otherExpenseDetails.reduce((s, e) => s + e.amount, 0);
    const calculatedTotalExpense = totalPayroll + totalOtherExpenses;
    const calculatedNetBalance = calculatedTotalIncome - calculatedTotalExpense;

    // Group other expenses by category
    const otherExpenseCategoriesMap = {};
    for (const exp of otherExpenseDetails) {
      const cat = exp.category || 'General';
      if (!otherExpenseCategoriesMap[cat]) {
        otherExpenseCategoriesMap[cat] = {
          category: cat,
          totalAmount: 0,
          items: [],
        };
      }
      otherExpenseCategoriesMap[cat].totalAmount += exp.amount;
      otherExpenseCategoriesMap[cat].items.push(exp);
    }
    const otherExpenseCategories = Object.values(otherExpenseCategoriesMap);

    // 5. Date-Specific Wallet Holdings Breakdown (Strictly Reconciled)
    const walletsDateBreakdown = wallets.map(w => {
      const wId = String(w._id);
      const feeIn = feeCollectionDetails.filter(c => c.walletId === wId).reduce((s, c) => s + c.paidAmount, 0);
      const incIn = otherIncomeDetails.filter(i => i.walletId === wId).reduce((s, i) => s + i.amount, 0);
      const dateInflow = feeIn + incIn;

      const payOut = payrollDetails.filter(p => p.walletId === wId).reduce((s, p) => s + p.totalAmount, 0);
      const expOut = otherExpenseDetails.filter(e => e.walletId === wId).reduce((s, e) => s + e.amount, 0);
      const dateOutflow = payOut + expOut;

      const dateNetBalance = dateInflow - dateOutflow;

      return {
        walletId: wId,
        walletName: w.name,
        walletType: w.type,
        bankName: w.bankName || '',
        accountNumber: w.accountNumber || '',
        location: w.location || '',
        dateInflow,
        dateOutflow,
        dateNetBalance,
        currentBalance: Number(w.currentBalance || 0),
      };
    });

    // Summary tables for Income and Expense
    const incomeSummary = [
      {
        sNo: 1,
        particular: 'Student Fee Collections',
        count: feeCollectionDetails.length,
        amount: totalFeeCollection,
      },
      {
        sNo: 2,
        particular: 'Other Revenue & Direct Receipts',
        count: otherIncomeDetails.length,
        amount: totalOtherRevenue,
      },
    ];

    const expenseSummary = [
      {
        sNo: 1,
        particular: 'Staff Payroll & Salaries',
        count: payrollDetails.length,
        amount: totalPayroll,
      },
      {
        sNo: 2,
        particular: 'Other Operating Expenses',
        count: otherExpenseDetails.length,
        amount: totalOtherExpenses,
      },
    ];

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
        totalHolding: exactClosing.totalHolding || totalCurrentHolding,
        totalInflows: calculatedTotalIncome,
        totalOutflows: calculatedTotalExpense,
        netChange: calculatedNetBalance,
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
        totalIncome: calculatedTotalIncome,
        totalExpense: calculatedTotalExpense,
        netBalance: calculatedNetBalance,
        totalFeeCollection,
        totalOtherRevenue,
        totalPayroll,
        totalOtherExpenses,
        totalCurrentHolding: wallets.reduce((s, w) => s + Number(w.currentBalance || 0), 0),
        activeWalletsCount: wallets.length,
      },
      totalIncome: calculatedTotalIncome,
      totalExpense: calculatedTotalExpense,
      netBalance: calculatedNetBalance,
      totalFeeCollection,
      totalOtherRevenue,
      totalPayroll,
      totalOtherExpenses,
      incomeSummary,
      expenseSummary,
      feeCollectionDetails,
      otherIncomeDetails,
      otherIncomeCategories,
      payrollDetails,
      otherExpenseDetails,
      otherExpenseCategories,
      walletsDateBreakdown,
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

    // Auto-heal checkpoints with 0 inflows/outflows and ensure populated transactions
    for (const closing of closings) {
      if (
        closing.date &&
        ((!closing.totalInflows && !closing.totalOutflows && !closing.totalIncome && !closing.totalExpense) ||
          (Number(closing.totalInflows || 0) === 0 && Number(closing.totalOutflows || 0) === 0 && Number(closing.netChange || 0) === 0))
      ) {
        try {
          const dash = await this.getClosingDashboard({ date: closing.date, dateFrom: closing.date, dateTo: closing.date });
          const healedInflows = Number(dash.totalIncome ?? dash.summary?.totalIncome ?? 0);
          const healedOutflows = Number(dash.totalExpense ?? dash.summary?.totalExpense ?? 0);
          const healedNet = Number(dash.netBalance ?? dash.summary?.netBalance ?? (healedInflows - healedOutflows));

          if (healedInflows > 0 || healedOutflows > 0) {
            closing.totalInflows = healedInflows;
            closing.totalOutflows = healedOutflows;
            closing.netChange = healedNet;
            closing.totalIncome = healedInflows;
            closing.totalExpense = healedOutflows;

            FinanceClosing.updateOne(
              { _id: closing._id },
              {
                $set: {
                  totalInflows: healedInflows,
                  totalOutflows: healedOutflows,
                  netChange: healedNet,
                  totalIncome: healedInflows,
                  totalExpense: healedOutflows,
                },
              }
            ).exec().catch(() => {});
          }
        } catch {
          // ignore heal failure
        }
      }

      // Backwards compatibility: ensure walletsSnapshot has populated inflows and outflows
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

    const dashboard = await this.getClosingDashboard({
      date: closingDate,
      dateFrom: closingDate,
      dateTo: closingDate,
    });
    const user = userId ? await User.findById(userId).select('name role') : null;

    const totalInflows = Number(dashboard.totalIncome ?? dashboard.summary?.totalIncome ?? 0);
    const totalOutflows = Number(dashboard.totalExpense ?? dashboard.summary?.totalExpense ?? 0);
    const netChange = Number(dashboard.netBalance ?? dashboard.summary?.netBalance ?? (totalInflows - totalOutflows));
    const totalHolding = dashboard.wallets && dashboard.wallets.length > 0
      ? dashboard.wallets.reduce((s, w) => s + Number(w.currentBalance || 0), 0)
      : Number(dashboard.summary?.totalCurrentHolding || 0);

    const walletsSnapshot = (dashboard.walletsDateBreakdown || []).map(w => {
      const fullWallet = (dashboard.wallets || []).find(fw => String(fw.walletId) === String(w.walletId));
      return {
        walletId: w.walletId,
        walletName: w.walletName,
        walletType: w.walletType,
        bankName: w.bankName || '',
        accountNumber: w.accountNumber || '',
        balanceBefore: fullWallet ? fullWallet.balanceAtLastClosing : (Number(w.currentBalance || 0) - Number(w.dateNetBalance || 0)),
        inflowsSinceLastClosing: Number(w.dateInflow || 0),
        outflowsSinceLastClosing: Number(w.dateOutflow || 0),
        netChange: Number(w.dateNetBalance || 0),
        balanceAtClosing: Number(w.currentBalance || 0),
        inflows: fullWallet?.inflows || [],
        outflows: fullWallet?.outflows || [],
      };
    });

    const closingData = {
      date: closingDate,
      closingDateTime: new Date(),
      type: 'HOLDINGS_CHECKPOINT',
      previousClosingDate: dashboard.lastClosing ? dashboard.lastClosing.closingDateTime : null,
      previousClosingId: dashboard.lastClosing ? dashboard.lastClosing.id : null,
      totalHolding,
      totalInflows,
      totalOutflows,
      netChange,
      walletsSnapshot,
      closedBy: userId || null,
      closedByName: user ? `${user.name} (${user.role})` : 'System Admin',
      remarks: data.remarks || '',
      totalIncome: totalInflows,
      totalExpense: totalOutflows,
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
  // FINANCIAL REPORTS: USER CONTRIBUTION, PROFIT & LOSS, ANNUAL P&L
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getUserContributionReport({ dateFrom, dateTo, staffId, type }) {
    const eligibleStaffList = await Staff.find({
      isNonTeaching: true,
      isSupportingStaff: { $ne: true }
    }).select('_id staffId name designation email phone isTeaching isNonTeaching').lean();

    const adminUsers = await User.find({
      role: { $in: ['SUPER_ADMIN', 'ADMIN'] }
    }).select('_id name email role').lean();

    const staffMap = new Map();
    const nameToStaffKey = new Map();
    const idToStaffKey = new Map();

    eligibleStaffList.forEach(s => {
      const key = s._id.toString();
      const roleLabel = s.isTeaching ? 'Both (Teaching + Non-Teaching)' : 'Non-Teaching';
      const staffObj = {
        id: key,
        staffId: s.staffId || '',
        name: s.name,
        designation: s.designation || 'Staff',
        roleType: roleLabel,
        totalIncome: 0,
        feeCollections: 0,
        customIncome: 0,
        totalExpense: 0,
        generalExpense: 0,
        boardingExpense: 0,
        inventoryExpense: 0,
        payrollAmount: 0,
        netContribution: 0,
        transactionCount: 0,
      };
      staffMap.set(key, staffObj);
      idToStaffKey.set(key, key);
      if (s.name) nameToStaffKey.set(s.name.trim().toLowerCase(), key);
      if (s.email) nameToStaffKey.set(s.email.trim().toLowerCase(), key);
    });

    adminUsers.forEach(u => {
      const uKey = u._id.toString();
      const matchedKey = (u.name && nameToStaffKey.get(u.name.trim().toLowerCase())) ||
                         (u.email && nameToStaffKey.get(u.email.trim().toLowerCase()));
      if (matchedKey) {
        idToStaffKey.set(uKey, matchedKey);
      } else {
        const staffObj = {
          id: uKey,
          staffId: 'ADMIN',
          name: u.name || 'Administrator',
          designation: u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin',
          roleType: 'Administration',
          totalIncome: 0,
          feeCollections: 0,
          customIncome: 0,
          totalExpense: 0,
          generalExpense: 0,
          boardingExpense: 0,
          inventoryExpense: 0,
          payrollAmount: 0,
          netContribution: 0,
          transactionCount: 0,
        };
        staffMap.set(uKey, staffObj);
        idToStaffKey.set(uKey, uKey);
        if (u.name) nameToStaffKey.set(u.name.trim().toLowerCase(), uKey);
        if (u.email) nameToStaffKey.set(u.email.trim().toLowerCase(), uKey);
      }
    });

    const resolveStaffKey = (userRef, nameRef) => {
      if (userRef) {
        const strId = userRef._id ? userRef._id.toString() : userRef.toString();
        if (idToStaffKey.has(strId)) return idToStaffKey.get(strId);
      }
      if (nameRef) {
        const cleanName = String(nameRef).replace(/\s*\([^)]*\)$/, '').trim().toLowerCase();
        if (nameToStaffKey.has(cleanName)) return nameToStaffKey.get(cleanName);
      }
      return null;
    };

    const hasDateRange = Boolean(dateFrom && dateTo);
    const startD = dateFrom ? new Date(dateFrom + 'T00:00:00.000Z') : null;
    const endD = dateTo ? new Date(dateTo + 'T23:59:59.999Z') : null;

    const itemized = [];

    // 1. Inflow: FeeChallan (Paid collections)
    const feeQuery = { paidAmount: { $gt: 0 } };
    if (hasDateRange) {
      feeQuery.$or = [
        { paidDate: { $gte: startD, $lte: endD } },
        { paidDate: null, updatedAt: { $gte: startD, $lte: endD } }
      ];
    }
    const feeChallans = await FeeChallan.find(feeQuery)
      .select('_id challanNo paidAmount directPaidAmount paidDate paidTime paidBy receivedByName receivedBy paymentMode walletName')
      .lean();

    feeChallans.forEach(c => {
      const amount = Number(c.directPaidAmount || c.paidAmount || 0);
      if (amount <= 0) return;
      const sKey = resolveStaffKey(c.receivedBy, c.receivedByName || c.paidBy);
      const staff = sKey ? staffMap.get(sKey) : null;
      if (staff) {
        staff.totalIncome += amount;
        staff.feeCollections += amount;
        staff.netContribution += amount;
        staff.transactionCount += 1;
      }
      const txDate = c.paidDate ? new Date(c.paidDate).toISOString().split('T')[0] : (c.updatedAt ? new Date(c.updatedAt).toISOString().split('T')[0] : '');
      itemized.push({
        id: c._id.toString(),
        date: txDate,
        staffId: staff?.id || null,
        staffName: staff?.name || c.receivedByName || c.paidBy || 'Administrator',
        type: 'INCOME',
        category: 'Fee Collection',
        sourceModule: 'Fee Challan',
        referenceNo: c.challanNo,
        description: `Fee Payment Received (Challan #${c.challanNo})`,
        amount,
        paymentMode: c.paymentMode || 'Cash',
        walletName: c.walletName || ''
      });
    });

    // Inflow: ExtraChallan (Paid collections)
    const extraQuery = { paidAmount: { $gt: 0 } };
    if (hasDateRange) {
      extraQuery.$or = [
        { paidDate: { $gte: startD, $lte: endD } },
        { paidDate: null, updatedAt: { $gte: startD, $lte: endD } }
      ];
    }
    const extraChallans = await ExtraChallan.find(extraQuery)
      .select('_id challanNo paidAmount paidDate paidBy receivedByName receivedBy paymentMode walletName')
      .lean();

    extraChallans.forEach(c => {
      const amount = Number(c.paidAmount || 0);
      if (amount <= 0) return;
      const sKey = resolveStaffKey(c.receivedBy, c.receivedByName || c.paidBy);
      const staff = sKey ? staffMap.get(sKey) : null;
      if (staff) {
        staff.totalIncome += amount;
        staff.feeCollections += amount;
        staff.netContribution += amount;
        staff.transactionCount += 1;
      }
      const txDate = c.paidDate ? new Date(c.paidDate).toISOString().split('T')[0] : '';
      itemized.push({
        id: c._id.toString(),
        date: txDate,
        staffId: staff?.id || null,
        staffName: staff?.name || c.receivedByName || c.paidBy || 'Administrator',
        type: 'INCOME',
        category: 'Extra Fee',
        sourceModule: 'Extra Challan',
        referenceNo: c.challanNo,
        description: `Extra Challan Payment (#${c.challanNo})`,
        amount,
        paymentMode: c.paymentMode || 'Cash',
        walletName: c.walletName || ''
      });
    });

    // Inflow: HostelChallan (Paid collections)
    const hostelQuery = { paidAmount: { $gt: 0 } };
    if (hasDateRange) {
      hostelQuery.$or = [
        { paidDate: { $gte: startD, $lte: endD } },
        { paidAt: { $gte: startD, $lte: endD } }
      ];
    }
    const hostelChallans = await HostelChallan.find(hostelQuery)
      .select('_id challanNo paidAmount paidDate paidAt paidBy paymentMode walletName')
      .lean();

    hostelChallans.forEach(c => {
      const amount = Number(c.paidAmount || 0);
      if (amount <= 0) return;
      const sKey = resolveStaffKey(null, c.paidBy);
      const staff = sKey ? staffMap.get(sKey) : null;
      if (staff) {
        staff.totalIncome += amount;
        staff.feeCollections += amount;
        staff.netContribution += amount;
        staff.transactionCount += 1;
      }
      const rawDate = c.paidDate || c.paidAt;
      const txDate = rawDate ? new Date(rawDate).toISOString().split('T')[0] : '';
      itemized.push({
        id: c._id.toString(),
        date: txDate,
        staffId: staff?.id || null,
        staffName: staff?.name || c.paidBy || 'Administrator',
        type: 'INCOME',
        category: 'Hostel Fee',
        sourceModule: 'Hostel Challan',
        referenceNo: c.challanNo,
        description: `Hostel Fee Payment (#${c.challanNo})`,
        amount,
        paymentMode: c.paymentMode || 'Cash',
        walletName: c.walletName || ''
      });
    });

    // Inflow: Custom Income (FinanceIncome)
    const incQuery = {};
    if (hasDateRange) {
      incQuery.date = { $gte: dateFrom, $lte: dateTo };
    }
    const incomes = await FinanceIncome.find(incQuery)
      .populate('createdBy', 'name email')
      .lean();

    incomes.forEach(i => {
      const amount = Number(i.amount || 0);
      if (amount <= 0) return;
      const sKey = resolveStaffKey(i.createdBy, i.createdByName);
      const staff = sKey ? staffMap.get(sKey) : null;
      if (staff) {
        staff.totalIncome += amount;
        staff.customIncome += amount;
        staff.netContribution += amount;
        staff.transactionCount += 1;
      }
      itemized.push({
        id: i._id.toString(),
        date: i.date || '',
        staffId: staff?.id || null,
        staffName: staff?.name || i.createdByName || i.createdBy?.name || 'Administrator',
        type: 'INCOME',
        category: i.category || 'General Income',
        sourceModule: 'Custom Income',
        referenceNo: i.id || i._id.toString().slice(-6),
        description: i.description || `Income: ${i.category}`,
        amount,
        paymentMode: 'Bank/Wallet',
        walletName: i.walletName || ''
      });
    });

    // 2. Outflow: FinanceExpense (General Expense)
    const expQuery = { status: { $ne: 'Rejected' } };
    if (hasDateRange) {
      expQuery.date = { $gte: dateFrom, $lte: dateTo };
    }
    const expenses = await FinanceExpense.find(expQuery)
      .populate('createdBy', 'name email')
      .lean();

    expenses.forEach(e => {
      const amount = Number(e.amount || 0);
      if (amount <= 0) return;
      const sKey = resolveStaffKey(e.createdBy, e.createdByName);
      const staff = sKey ? staffMap.get(sKey) : null;
      if (staff) {
        staff.totalExpense += amount;
        staff.generalExpense += amount;
        staff.netContribution -= amount;
        staff.transactionCount += 1;
      }
      itemized.push({
        id: e._id.toString(),
        date: e.date || '',
        staffId: staff?.id || null,
        staffName: staff?.name || e.createdByName || e.createdBy?.name || 'Administrator',
        type: 'EXPENSE',
        category: e.category || 'General Expense',
        sourceModule: 'Finance Expense',
        referenceNo: e.id || e._id.toString().slice(-6),
        description: e.description || `Expense: ${e.category} - ${e.subCategory || ''}`,
        amount,
        paymentMode: 'Bank/Wallet',
        walletName: e.walletName || ''
      });
    });

    // Outflow: HostelExpense (Boarding Expense)
    const hExpQuery = {};
    if (hasDateRange) {
      hExpQuery.date = { $gte: dateFrom, $lte: dateTo };
    }
    const hostelExpenses = await HostelExpense.find(hExpQuery)
      .populate('createdBy', 'name email')
      .lean();

    hostelExpenses.forEach(he => {
      const amount = Number(he.amount || 0);
      if (amount <= 0) return;
      const sKey = resolveStaffKey(he.createdBy, he.createdByName);
      const staff = sKey ? staffMap.get(sKey) : null;
      if (staff) {
        staff.totalExpense += amount;
        staff.boardingExpense += amount;
        staff.netContribution -= amount;
        staff.transactionCount += 1;
      }
      itemized.push({
        id: he._id.toString(),
        date: he.date || '',
        staffId: staff?.id || null,
        staffName: staff?.name || he.createdByName || he.createdBy?.name || 'Administrator',
        type: 'EXPENSE',
        category: he.category || 'Boarding Expense',
        sourceModule: 'Hostel Expense',
        referenceNo: he.id || he._id.toString().slice(-6),
        description: he.description || he.title || 'Hostel Expense',
        amount,
        paymentMode: 'Bank/Wallet',
        walletName: he.walletName || ''
      });
    });

    // Outflow: InventoryExpense
    const invExpQuery = {};
    if (hasDateRange) {
      invExpQuery.date = { $gte: dateFrom, $lte: dateTo };
    }
    const inventoryExpenses = await InventoryExpense.find(invExpQuery)
      .populate('createdBy', 'name email')
      .lean();

    inventoryExpenses.forEach(ie => {
      const amount = Number(ie.amount || 0);
      if (amount <= 0) return;
      const sKey = resolveStaffKey(ie.createdBy, ie.createdByName);
      const staff = sKey ? staffMap.get(sKey) : null;
      if (staff) {
        staff.totalExpense += amount;
        staff.inventoryExpense += amount;
        staff.netContribution -= amount;
        staff.transactionCount += 1;
      }
      itemized.push({
        id: ie._id.toString(),
        date: ie.date || '',
        staffId: staff?.id || null,
        staffName: staff?.name || ie.createdByName || ie.createdBy?.name || 'Administrator',
        type: 'EXPENSE',
        category: ie.expenseType || 'Inventory Expense',
        sourceModule: 'Inventory Expense',
        referenceNo: ie.id || ie._id.toString().slice(-6),
        description: ie.description || `Inventory ${ie.expenseType || 'Expense'}`,
        amount,
        paymentMode: 'Bank/Wallet',
        walletName: ie.walletName || ''
      });
    });

    let finalStaffBreakdown = Array.from(staffMap.values());
    if (staffId && staffId !== 'all') {
      finalStaffBreakdown = finalStaffBreakdown.filter(s => s.id === staffId || s.staffId === staffId);
    }

    let finalItemized = itemized;
    if (staffId && staffId !== 'all') {
      finalItemized = finalItemized.filter(i => i.staffId === staffId);
    }
    if (type && type !== 'all') {
      finalItemized = finalItemized.filter(i => i.type.toUpperCase() === type.toUpperCase());
    }

    finalItemized.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    finalStaffBreakdown.sort((a, b) => b.netContribution - a.netContribution);

    const totalIncomeBrought = finalStaffBreakdown.reduce((s, st) => s + st.totalIncome, 0);
    const totalExpenseCreated = finalStaffBreakdown.reduce((s, st) => s + st.totalExpense, 0);

    return {
      summary: {
        totalIncomeBrought,
        totalExpenseCreated,
        netContribution: totalIncomeBrought - totalExpenseCreated,
        activeStaffCount: finalStaffBreakdown.filter(s => s.transactionCount > 0).length,
        totalEligibleStaff: finalStaffBreakdown.length,
      },
      staffBreakdown: finalStaffBreakdown,
      itemizedTransactions: finalItemized,
    };
  }

  async getProfitLossReport({ dateFrom, dateTo }) {
    const hasDateRange = Boolean(dateFrom && dateTo);
    const startD = dateFrom ? new Date(dateFrom + 'T00:00:00.000Z') : null;
    const endD = dateTo ? new Date(dateTo + 'T23:59:59.999Z') : null;

    const feeQuery = { paidAmount: { $gt: 0 } };
    if (hasDateRange) {
      feeQuery.$or = [
        { paidDate: { $gte: startD, $lte: endD } },
        { paidDate: null, updatedAt: { $gte: startD, $lte: endD } }
      ];
    }
    const [feeChallans, extraChallans, hostelChallans, customIncomes] = await Promise.all([
      FeeChallan.find(feeQuery).select('paidAmount directPaidAmount paidDate updatedAt').lean(),
      ExtraChallan.find(feeQuery).select('paidAmount paidDate heads updatedAt').lean(),
      HostelChallan.find({ paidAmount: { $gt: 0 }, ...(hasDateRange ? { $or: [{ paidDate: { $gte: startD, $lte: endD } }, { paidAt: { $gte: startD, $lte: endD } }] } : {}) }).select('paidAmount paidDate paidAt').lean(),
      FinanceIncome.find(hasDateRange ? { date: { $gte: dateFrom, $lte: dateTo } } : {}).lean(),
    ]);

    const regularFeeTotal = feeChallans.reduce((s, c) => s + Number(c.directPaidAmount || c.paidAmount || 0), 0);
    const extraFeeTotal = extraChallans.reduce((s, c) => s + Number(c.paidAmount || 0), 0);
    const hostelFeeTotal = hostelChallans.reduce((s, c) => s + Number(c.paidAmount || 0), 0);
    const customIncomeTotal = customIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalRevenue = regularFeeTotal + extraFeeTotal + hostelFeeTotal + customIncomeTotal;

    const [financeExpenses, hostelExpenses, inventoryExpenses, payrolls] = await Promise.all([
      FinanceExpense.find({ status: { $ne: 'Rejected' }, ...(hasDateRange ? { date: { $gte: dateFrom, $lte: dateTo } } : {}) }).lean(),
      HostelExpense.find(hasDateRange ? { date: { $gte: dateFrom, $lte: dateTo } } : {}).lean(),
      InventoryExpense.find(hasDateRange ? { date: { $gte: dateFrom, $lte: dateTo } } : {}).lean(),
      Payroll.find({ paidAmount: { $gt: 0 }, ...(hasDateRange ? { $or: [{ paymentDate: { $gte: startD, $lte: endD } }, { month: { $gte: dateFrom.slice(0, 7), $lte: dateTo.slice(0, 7) } }] } : {}) }).lean()
    ]);

    const generalExpenseTotal = financeExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const boardingExpenseTotal = hostelExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const inventoryExpenseTotal = inventoryExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const payrollTotal = payrolls.reduce((s, p) => s + Number(p.paidAmount || 0), 0);
    const totalExpenses = generalExpenseTotal + boardingExpenseTotal + inventoryExpenseTotal + payrollTotal;

    const netProfit = totalRevenue - totalExpenses;
    const marginPercentage = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

    const inflowBreakdown = [
      { category: 'Regular Tuition & Academic Fees', amount: regularFeeTotal },
      { category: 'Hostel / Boarding Fees', amount: hostelFeeTotal },
      { category: 'Extra Challan Fees', amount: extraFeeTotal },
      ...Array.from(customIncomes.reduce((m, i) => {
        const cat = i.category || 'Other Income';
        m.set(cat, (m.get(cat) || 0) + Number(i.amount || 0));
        return m;
      }, new Map()).entries()).map(([category, amount]) => ({ category, amount }))
    ].filter(x => x.amount > 0);

    const outflowBreakdown = [
      { category: 'Staff Payroll & Salaries', amount: payrollTotal },
      { category: 'Boarding & Hostel Operations', amount: boardingExpenseTotal },
      { category: 'Inventory & Supplies', amount: inventoryExpenseTotal },
      ...Array.from(financeExpenses.reduce((m, e) => {
        const cat = e.category || 'General Operations';
        m.set(cat, (m.get(cat) || 0) + Number(e.amount || 0));
        return m;
      }, new Map()).entries()).map(([category, amount]) => ({ category, amount }))
    ].filter(x => x.amount > 0);

    const dateMap = new Map();
    const addToTrend = (dStr, rev, exp) => {
      if (!dStr) return;
      const d = dStr.slice(0, 10);
      if (!dateMap.has(d)) dateMap.set(d, { date: d, revenue: 0, expense: 0, net: 0 });
      const row = dateMap.get(d);
      row.revenue += rev;
      row.expense += exp;
      row.net = row.revenue - row.expense;
    };

    feeChallans.forEach(c => addToTrend(c.paidDate ? new Date(c.paidDate).toISOString().split('T')[0] : '', Number(c.directPaidAmount || c.paidAmount || 0), 0));
    extraChallans.forEach(c => addToTrend(c.paidDate ? new Date(c.paidDate).toISOString().split('T')[0] : '', Number(c.paidAmount || 0), 0));
    hostelChallans.forEach(c => addToTrend(c.paidDate ? new Date(c.paidDate).toISOString().split('T')[0] : '', Number(c.paidAmount || 0), 0));
    customIncomes.forEach(i => addToTrend(i.date, Number(i.amount || 0), 0));

    financeExpenses.forEach(e => addToTrend(e.date, 0, Number(e.amount || 0)));
    hostelExpenses.forEach(e => addToTrend(e.date, 0, Number(e.amount || 0)));
    inventoryExpenses.forEach(e => addToTrend(e.date, 0, Number(e.amount || 0)));
    payrolls.forEach(p => {
      const pDate = p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : (p.month ? `${p.month}-01` : '');
      addToTrend(pDate, 0, Number(p.paidAmount || 0));
    });

    const timeseries = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: { dateFrom: dateFrom || '', dateTo: dateTo || '' },
      kpis: {
        totalRevenue,
        totalExpenses,
        netProfit,
        marginPercentage,
      },
      inflows: {
        regularFees: regularFeeTotal,
        extraFees: extraFeeTotal,
        hostelFees: hostelFeeTotal,
        customIncome: customIncomeTotal,
        total: totalRevenue,
        breakdownByCategory: inflowBreakdown,
      },
      outflows: {
        generalExpenses: generalExpenseTotal,
        boardingExpenses: boardingExpenseTotal,
        inventoryExpenses: inventoryExpenseTotal,
        payrolls: payrollTotal,
        total: totalExpenses,
        breakdownByCategory: outflowBreakdown,
      },
      timeseries,
    };
  }

  async getAnnualProfitLossReport({ startYear, endYear, selectedYear }) {
    const curYear = new Date().getFullYear();
    const sYr = parseInt(startYear) || (curYear - 3);
    const eYr = parseInt(endYear) || curYear;
    const targetYear = parseInt(selectedYear) || curYear;

    const startRange = `${sYr}-01-01`;
    const endRange = `${eYr}-12-31`;
    const startD = new Date(startRange + 'T00:00:00.000Z');
    const endD = new Date(endRange + 'T23:59:59.999Z');

    const [feeChallans, extraChallans, hostelChallans, customIncomes, financeExpenses, hostelExpenses, inventoryExpenses, payrolls] = await Promise.all([
      FeeChallan.find({ paidAmount: { $gt: 0 }, $or: [{ paidDate: { $gte: startD, $lte: endD } }, { paidDate: null, updatedAt: { $gte: startD, $lte: endD } }] }).select('paidAmount directPaidAmount paidDate updatedAt').lean(),
      ExtraChallan.find({ paidAmount: { $gt: 0 }, $or: [{ paidDate: { $gte: startD, $lte: endD } }, { paidDate: null, updatedAt: { $gte: startD, $lte: endD } }] }).select('paidAmount paidDate').lean(),
      HostelChallan.find({ paidAmount: { $gt: 0 }, $or: [{ paidDate: { $gte: startD, $lte: endD } }, { paidAt: { $gte: startD, $lte: endD } }] }).select('paidAmount paidDate paidAt').lean(),
      FinanceIncome.find({ date: { $gte: startRange, $lte: endRange } }).lean(),
      FinanceExpense.find({ status: { $ne: 'Rejected' }, date: { $gte: startRange, $lte: endRange } }).lean(),
      HostelExpense.find({ date: { $gte: startRange, $lte: endRange } }).lean(),
      InventoryExpense.find({ date: { $gte: startRange, $lte: endRange } }).lean(),
      Payroll.find({ paidAmount: { $gt: 0 }, $or: [{ paymentDate: { $gte: startD, $lte: endD } }, { month: { $gte: `${sYr}-01`, $lte: `${eYr}-12` } }] }).lean()
    ]);

    const yearlyData = {};
    for (let y = sYr; y <= eYr; y++) {
      yearlyData[y] = {
        year: y,
        revenue: 0,
        expense: 0,
        netProfit: 0,
        marginPercentage: 0,
        yoyGrowth: 0,
        fees: 0,
        customIncome: 0,
        payroll: 0,
        generalExpense: 0,
        boardingExpense: 0,
        inventoryExpense: 0,
      };
    }

    const getYear = (d) => {
      if (!d) return null;
      if (typeof d === 'string') return parseInt(d.slice(0, 4)) || null;
      if (d instanceof Date) return d.getFullYear();
      return null;
    };

    const addRev = (d, amt, isFee = true) => {
      const y = getYear(d);
      if (y && yearlyData[y]) {
        yearlyData[y].revenue += amt;
        if (isFee) yearlyData[y].fees += amt;
        else yearlyData[y].customIncome += amt;
      }
    };

    const addExp = (d, amt, type) => {
      const y = getYear(d);
      if (y && yearlyData[y]) {
        yearlyData[y].expense += amt;
        if (type === 'payroll') yearlyData[y].payroll += amt;
        else if (type === 'general') yearlyData[y].generalExpense += amt;
        else if (type === 'boarding') yearlyData[y].boardingExpense += amt;
        else if (type === 'inventory') yearlyData[y].inventoryExpense += amt;
      }
    };

    feeChallans.forEach(c => addRev(c.paidDate || c.updatedAt, Number(c.directPaidAmount || c.paidAmount || 0), true));
    extraChallans.forEach(c => addRev(c.paidDate, Number(c.paidAmount || 0), true));
    hostelChallans.forEach(c => addRev(c.paidDate || c.paidAt, Number(c.paidAmount || 0), true));
    customIncomes.forEach(i => addRev(i.date, Number(i.amount || 0), false));

    financeExpenses.forEach(e => addExp(e.date, Number(e.amount || 0), 'general'));
    hostelExpenses.forEach(e => addExp(e.date, Number(e.amount || 0), 'boarding'));
    inventoryExpenses.forEach(e => addExp(e.date, Number(e.amount || 0), 'inventory'));
    payrolls.forEach(p => addExp(p.paymentDate || p.month, Number(p.paidAmount || 0), 'payroll'));

    const yearlyComparison = Object.values(yearlyData).sort((a, b) => a.year - b.year);

    yearlyComparison.forEach((row, idx) => {
      row.netProfit = row.revenue - row.expense;
      row.marginPercentage = row.revenue > 0 ? Number(((row.netProfit / row.revenue) * 100).toFixed(2)) : 0;
      if (idx > 0) {
        const prevRev = yearlyComparison[idx - 1].revenue;
        row.yoyGrowth = prevRev > 0 ? Number((((row.revenue - prevRev) / prevRev) * 100).toFixed(1)) : 0;
      } else {
        row.yoyGrowth = 0;
      }
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyBreakdown = monthNames.map((name, i) => ({
      month: name,
      monthIndex: i + 1,
      year: targetYear,
      revenue: 0,
      expense: 0,
      netProfit: 0,
      margin: 0
    }));

    const getMonthIdx = (d) => {
      if (!d) return null;
      const y = getYear(d);
      if (y !== targetYear) return null;
      let m = 0;
      if (typeof d === 'string') {
        const parts = d.split('-');
        if (parts.length >= 2) m = parseInt(parts[1]);
      } else if (d instanceof Date) {
        m = d.getMonth() + 1;
      }
      return m >= 1 && m <= 12 ? m - 1 : null;
    };

    const addMonthRev = (d, amt) => {
      const idx = getMonthIdx(d);
      if (idx !== null) monthlyBreakdown[idx].revenue += amt;
    };
    const addMonthExp = (d, amt) => {
      const idx = getMonthIdx(d);
      if (idx !== null) monthlyBreakdown[idx].expense += amt;
    };

    feeChallans.forEach(c => addMonthRev(c.paidDate || c.updatedAt, Number(c.directPaidAmount || c.paidAmount || 0)));
    extraChallans.forEach(c => addMonthRev(c.paidDate, Number(c.paidAmount || 0)));
    hostelChallans.forEach(c => addMonthRev(c.paidDate || c.paidAt, Number(c.paidAmount || 0)));
    customIncomes.forEach(i => addMonthRev(i.date, Number(i.amount || 0)));

    financeExpenses.forEach(e => addMonthExp(e.date, Number(e.amount || 0)));
    hostelExpenses.forEach(e => addMonthExp(e.date, Number(e.amount || 0)));
    inventoryExpenses.forEach(e => addMonthExp(e.date, Number(e.amount || 0)));
    payrolls.forEach(p => addMonthExp(p.paymentDate || p.month, Number(p.paidAmount || 0)));

    monthlyBreakdown.forEach(m => {
      m.netProfit = m.revenue - m.expense;
      m.margin = m.revenue > 0 ? Number(((m.netProfit / m.revenue) * 100).toFixed(1)) : 0;
    });

    return {
      selectedYear: targetYear,
      availableYears: yearlyComparison.map(y => y.year),
      yearlyComparison,
      monthlyBreakdown,
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
