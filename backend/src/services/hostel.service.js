const {
  HostelRoom,
  HostelAllocation,
  HostelRegistration,
  HostelExpense,
  HostelInventory,
  HostelChallan,
  HostelCreditLedger,
  Student,
  InstituteSettings,
  Wallet,
  WalletTransaction,
  User
} = require('../models');

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

function parseYearMonth(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return { year: val.getFullYear(), month: val.getMonth() + 1 };
  }
  if (typeof val !== 'string') return null;
  const str = val.trim();
  const ymMatch = str.match(/^(\d{4})-(\d{1,2})/);
  if (ymMatch) {
    return { year: parseInt(ymMatch[1], 10), month: parseInt(ymMatch[2], 10) };
  }
  const parts = str.toLowerCase().split(/[\s,/-]+/);
  let year = null;
  let month = null;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (!isNaN(num) && num > 1900 && num < 2200) {
      year = num;
    } else {
      const idx = MONTH_NAMES.findIndex((m) => m.startsWith(part) || part.startsWith(m.slice(0, 3)));
      if (idx !== -1) month = idx + 1;
    }
  }
  if (year && month) {
    return { year, month };
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return null;
}

function getPrevYearMonth(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function addMonths(year, month, count) {
  let m = month + count;
  let y = year;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { year: y, month: m };
}

function formatYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function yearMonthToLabel(year, month) {
  const monthName = MONTH_NAMES[month - 1];
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} ${year}`;
}

function compareYearMonth(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

class HostelService {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ROOMS & ALLOCATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getRooms() {
    const rooms = await HostelRoom.find().sort({ roomNumber: 1 }).lean();
    const allocations = await HostelAllocation.find({ status: 'active' }).lean();

    const formattedRooms = rooms.map(room => {
      const roomAllocations = allocations.filter(
        a => a.roomId && a.roomId.toString() === room._id.toString()
      );
      const currentOccupancy = roomAllocations.length;
      const status = currentOccupancy >= room.capacity ? 'occupied' : 'vacant';
      const roomType = room.roomType || room.type || 'Double';

      return {
        ...room,
        id: room._id.toString(),
        roomType,
        currentOccupancy,
        status,
        allocations: roomAllocations.map(a => ({
          ...a,
          id: a._id.toString(),
          roomId: room._id.toString()
        }))
      };
    });

    return formattedRooms;
  }

  async createRoom(data) {
    const roomType = data.roomType || data.type || 'Double';
    const roomData = {
      ...data,
      roomType,
      type: roomType,
      hostelName: data.hostelName || 'Main Hostel',
      currentOccupancy: data.currentOccupancy || 0
    };
    return HostelRoom.create(roomData);
  }

  async updateRoom(id, data) {
    const updateData = { ...data };
    if (data.roomType || data.type) {
      const roomType = data.roomType || data.type;
      updateData.roomType = roomType;
      updateData.type = roomType;
    }
    return HostelRoom.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteRoom(id) {
    await HostelAllocation.updateMany(
      { roomId: id, status: 'active' },
      { status: 'inactive' }
    );
    await HostelRegistration.updateMany(
      { roomId: id },
      { roomId: null }
    );
    return HostelRoom.findByIdAndDelete(id);
  }

  async allocateRoom({ roomId, studentId, externalName, allocationDate }) {
    const room = await HostelRoom.findById(roomId);
    if (!room) throw new Error('Room not found');

    // Deactivate any existing active allocation for this student or external name
    const query = { status: 'active' };
    if (studentId) {
      query.studentId = studentId;
    } else if (externalName) {
      query.externalName = externalName;
    }

    const existingAllocations = await HostelAllocation.find(query);
    for (const alloc of existingAllocations) {
      alloc.status = 'inactive';
      await alloc.save();
      if (alloc.roomId) {
        await this.syncRoomOccupancy(alloc.roomId);
      }
    }

    // Find matching registration
    let registration = null;
    if (studentId) {
      registration = await HostelRegistration.findOne({
        studentId,
        status: { $in: ['active', 'ACTIVE'] }
      });
    } else if (externalName) {
      registration = await HostelRegistration.findOne({
        externalName,
        status: { $in: ['active', 'ACTIVE'] }
      });
    }

    const allocation = await HostelAllocation.create({
      roomId,
      registrationId: registration ? registration._id : null,
      studentId: studentId || null,
      externalName: externalName || '',
      allocationDate: allocationDate || new Date().toISOString().split('T')[0],
      status: 'active'
    });

    if (registration) {
      registration.roomId = roomId;
      await registration.save();
    }

    await this.syncRoomOccupancy(roomId);
    return allocation;
  }

  async deallocateStudent(allocationId) {
    const allocation = await HostelAllocation.findById(allocationId);
    if (!allocation) throw new Error('Allocation not found');

    allocation.status = 'inactive';
    await allocation.save();

    if (allocation.studentId) {
      await HostelRegistration.updateMany(
        { studentId: allocation.studentId, roomId: allocation.roomId },
        { roomId: null }
      );
    }
    if (allocation.externalName) {
      await HostelRegistration.updateMany(
        { externalName: allocation.externalName, roomId: allocation.roomId },
        { roomId: null }
      );
    }

    await this.syncRoomOccupancy(allocation.roomId);
    return { message: 'Deallocated successfully' };
  }

  async syncRoomOccupancy(roomId) {
    if (!roomId) return;
    const count = await HostelAllocation.countDocuments({ roomId, status: 'active' });
    await HostelRoom.findByIdAndUpdate(roomId, { currentOccupancy: count });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTRATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getRegistrations(filters = {}) {
    const query = {};
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status.toLowerCase();
    }
    if (filters.type && filters.type !== 'all') {
      query.registrationType = filters.type.toLowerCase();
    }

    if (filters.search) {
      const searchStr = filters.search.trim();
      const re = new RegExp(searchStr, 'i');

      const matchingStudents = await Student.find({
        $or: [{ fName: re }, { lName: re }, { rollNumber: re }]
      }).select('_id');
      const studentIds = matchingStudents.map(s => s._id);

      query.$or = [
        { studentId: { $in: studentIds } },
        { externalName: re },
        { externalGuardianName: re },
        { externalGuardianNumber: re },
        { externalInstitute: re },
        { guardianCnic: re },
        { studentCnic: re }
      ];
    }

    const registrations = await HostelRegistration.find(query)
      .populate({
        path: 'studentId',
        populate: { path: 'programId' }
      })
      .populate('roomId')
      .sort({ createdAt: -1 });

    const regIds = registrations.map(r => r._id);
    const availableLedgers = await HostelCreditLedger.find({
      registrationId: { $in: regIds },
      status: 'AVAILABLE',
      availableBalance: { $gt: 0 }
    }).lean();

    const creditMap = {};
    for (const l of availableLedgers) {
      const k = l.registrationId?.toString();
      if (k) {
        creditMap[k] = (creditMap[k] || 0) + Number(l.availableBalance || 0);
      }
    }

    const formatted = registrations.map(reg => {
      const plain = reg.toJSON ? reg.toJSON() : reg.toObject();
      const s = reg.studentId && reg.studentId._id ? (reg.studentId.toJSON ? reg.studentId.toJSON() : reg.studentId) : null;
      if (s) {
        if (!s.program && s.programId) s.program = s.programId;
      }
      return {
        ...plain,
        id: reg._id.toString(),
        student: s,
        studentId: s ? s._id.toString() : (reg.studentId ? reg.studentId.toString() : null),
        roomId: reg.roomId && reg.roomId._id ? reg.roomId._id.toString() : (reg.roomId ? reg.roomId.toString() : null),
        room: reg.roomId && reg.roomId._id ? reg.roomId : null,
        status: (reg.status || 'active').toLowerCase(),
        availableAdvanceCredit: creditMap[reg._id.toString()] || 0
      };
    });

    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 20);
    const total = formatted.length;
    const pagedData = formatted.slice((page - 1) * limit, page * limit);

    return {
      data: pagedData,
      page,
      limit,
      total,
      hasMore: page * limit < total
    };
  }

  async searchRegistrations(q) {
    if (!q || !q.trim()) return [];
    const re = new RegExp(q.trim(), 'i');

    const matchingStudents = await Student.find({
      $or: [{ fName: re }, { lName: re }, { rollNumber: re }]
    }).select('_id');
    const studentIds = matchingStudents.map(s => s._id);

    const query = {
      $or: [
        { studentId: { $in: studentIds } },
        { externalName: re },
        { externalGuardianName: re },
        { externalGuardianNumber: re },
        { externalInstitute: re }
      ]
    };

    const registrations = await HostelRegistration.find(query)
      .populate({
        path: 'studentId',
        populate: { path: 'programId' }
      })
      .populate('roomId')
      .sort({ createdAt: -1 })
      .limit(20);

    const regIds = registrations.map(r => r._id);
    const availableLedgers = await HostelCreditLedger.find({
      registrationId: { $in: regIds },
      status: 'AVAILABLE',
      availableBalance: { $gt: 0 }
    }).lean();

    const creditMap = {};
    for (const l of availableLedgers) {
      const k = l.registrationId?.toString();
      if (k) {
        creditMap[k] = (creditMap[k] || 0) + Number(l.availableBalance || 0);
      }
    }

    return registrations.map(reg => {
      const plain = reg.toJSON ? reg.toJSON() : reg.toObject();
      const s = reg.studentId && reg.studentId._id ? (reg.studentId.toJSON ? reg.studentId.toJSON() : reg.studentId) : null;
      if (s && !s.program && s.programId) s.program = s.programId;
      return {
        ...plain,
        id: reg._id.toString(),
        student: s,
        studentId: s ? s._id.toString() : (reg.studentId ? reg.studentId.toString() : null),
        roomId: reg.roomId && reg.roomId._id ? reg.roomId._id.toString() : (reg.roomId ? reg.roomId.toString() : null),
        room: reg.roomId && reg.roomId._id ? reg.roomId : null,
        status: (reg.status || 'active').toLowerCase(),
        availableAdvanceCredit: creditMap[reg._id.toString()] || 0
      };
    });
  }

  async getRegistrationById(id) {
    const reg = await HostelRegistration.findById(id)
      .populate({
        path: 'studentId',
        populate: { path: 'programId' }
      })
      .populate('roomId');
    if (!reg) return null;
    const plain = reg.toJSON ? reg.toJSON() : reg.toObject();
    const s = reg.studentId && reg.studentId._id ? (reg.studentId.toJSON ? reg.studentId.toJSON() : reg.studentId) : null;
    if (s && !s.program && s.programId) s.program = s.programId;

    const availableLedgers = await HostelCreditLedger.find({
      registrationId: reg._id,
      status: 'AVAILABLE',
      availableBalance: { $gt: 0 }
    }).lean();
    const availableAdvanceCredit = availableLedgers.reduce((sum, l) => sum + Number(l.availableBalance || 0), 0);

    return {
      ...plain,
      id: reg._id.toString(),
      student: s,
      studentId: s ? s._id.toString() : (reg.studentId ? reg.studentId.toString() : null),
      roomId: reg.roomId && reg.roomId._id ? reg.roomId._id.toString() : (reg.roomId ? reg.roomId.toString() : null),
      room: reg.roomId && reg.roomId._id ? reg.roomId : null,
      status: (reg.status || 'active').toLowerCase(),
      availableAdvanceCredit
    };
  }

  async getRegistrationByStudent(studentId) {
    const reg = await HostelRegistration.findOne({
      studentId,
      status: { $in: ['active', 'ACTIVE'] }
    })
      .populate({
        path: 'studentId',
        populate: { path: 'programId' }
      })
      .populate('roomId');
    if (!reg) return null;
    const plain = reg.toJSON ? reg.toJSON() : reg.toObject();
    const s = reg.studentId && reg.studentId._id ? (reg.studentId.toJSON ? reg.studentId.toJSON() : reg.studentId) : null;
    if (s && !s.program && s.programId) s.program = s.programId;
    return {
      ...plain,
      id: reg._id.toString(),
      student: s,
      studentId: s ? s._id.toString() : (reg.studentId ? reg.studentId.toString() : null),
      roomId: reg.roomId && reg.roomId._id ? reg.roomId._id.toString() : (reg.roomId ? reg.roomId.toString() : null),
      room: reg.roomId && reg.roomId._id ? reg.roomId : null,
      status: (reg.status || 'active').toLowerCase()
    };
  }

  async getRoomByStudent(studentId) {
    const alloc = await HostelAllocation.findOne({ studentId, status: 'active' }).populate('roomId');
    if (alloc && alloc.roomId) return alloc.roomId;
    const reg = await HostelRegistration.findOne({ studentId, status: { $in: ['active', 'ACTIVE'] } }).populate('roomId');
    return reg ? reg.roomId : null;
  }

  async createRegistration(data) {
    const regData = {
      ...data,
      status: (data.status || 'active').toLowerCase(),
      history: [{
        action: 'registered',
        previousStatus: null,
        reason: 'Initial registration',
        timestamp: new Date()
      }]
    };
    const reg = await HostelRegistration.create(regData);

    if (data.roomId) {
      await this.allocateRoom({
        roomId: data.roomId,
        studentId: reg.studentId,
        externalName: reg.externalName,
        allocationDate: reg.registrationDate
      });
    }

    return reg;
  }

  async updateRegistration(id, data) {
    const updateData = { ...data };
    if (updateData.status) {
      updateData.status = updateData.status.toLowerCase();
    }
    const reg = await HostelRegistration.findByIdAndUpdate(id, updateData, { new: true })
      .populate({
        path: 'studentId',
        populate: { path: 'programId' }
      })
      .populate('roomId');
    return reg;
  }

  async deleteRegistration(id) {
    const reg = await HostelRegistration.findById(id);
    if (reg) {
      await HostelAllocation.updateMany(
        { registrationId: reg._id, status: 'active' },
        { status: 'inactive' }
      );
      if (reg.studentId) {
        await HostelAllocation.updateMany(
          { studentId: reg.studentId, status: 'active' },
          { status: 'inactive' }
        );
      }
      if (reg.externalName) {
        await HostelAllocation.updateMany(
          { externalName: reg.externalName, status: 'active' },
          { status: 'inactive' }
        );
      }
      if (reg.roomId) {
        await this.syncRoomOccupancy(reg.roomId);
      }
    }
    return HostelRegistration.findByIdAndDelete(id);
  }

  async changeRegistrationStatus(id, newStatus, reason = '') {
    const reg = await HostelRegistration.findById(id);
    if (!reg) throw new Error('Registration not found');

    const previousStatus = reg.status || 'active';
    const status = newStatus.toLowerCase();
    reg.status = status;

    if (!Array.isArray(reg.history)) reg.history = [];
    reg.history.push({
      action: status,
      previousStatus,
      reason: reason || (status === 'withdrawn' ? 'Voluntary checkout' : status === 'active' ? 'Readmitted' : ''),
      timestamp: new Date()
    });

    let legacyHistory = [];
    try { legacyHistory = JSON.parse(reg.terminationReason || '[]'); } catch (e) {}
    legacyHistory.push({ action: status, reason, timestamp: new Date() });
    reg.terminationReason = JSON.stringify(legacyHistory);

    if (status === 'terminated' || status === 'withdrawn') {
      await HostelAllocation.updateMany(
        {
          status: 'active',
          $or: [
            { registrationId: reg._id },
            ...(reg.studentId ? [{ studentId: reg.studentId }] : []),
            ...(reg.externalName ? [{ externalName: reg.externalName }] : [])
          ]
        },
        { status: 'inactive' }
      );
      if (reg.roomId) {
        const oldRoomId = reg.roomId;
        reg.roomId = null;
        await this.syncRoomOccupancy(oldRoomId);
      }
    }

    await reg.save();
    return reg;
  }

  async getRegistrationHistory(id) {
    const reg = await HostelRegistration.findById(id);
    if (!reg) throw new Error('Registration not found');

    if (Array.isArray(reg.history) && reg.history.length > 0) {
      return reg.history;
    }

    if (reg.terminationReason) {
      try {
        const parsed = JSON.parse(reg.terminationReason);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }

    return [{
      action: 'registered',
      previousStatus: null,
      reason: 'Registration record created',
      timestamp: reg.createdAt || new Date()
    }];
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EXPENSES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getExpenses(filters = {}) {
    const query = {};
    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = filters.startDate;
      if (filters.endDate) query.date.$lte = filters.endDate;
    }

    const expenses = await HostelExpense.find(query).sort({ date: -1 });
    return expenses.map(e => ({
      id: e._id.toString(),
      expenseTitle: e.expenseTitle || e.title,
      title: e.title || e.expenseTitle,
      amount: e.amount,
      date: e.date,
      category: e.category,
      remarks: e.remarks || e.description,
      description: e.description || e.remarks,
      walletId: e.walletId,
      walletName: e.walletName,
      transactionId: e.transactionId,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt
    }));
  }

  async createExpense(data, userId) {
    const expenseData = {
      ...data,
      title: data.expenseTitle || data.title,
      expenseTitle: data.expenseTitle || data.title,
      description: data.remarks || data.description,
      remarks: data.remarks || data.description
    };

    const expAmount = Number(expenseData.amount || 0);
    let walletRecord = null;
    let walletTx = null;

    if (data.walletId) {
      const wallet = await Wallet.findById(data.walletId);
      if (!wallet) throw new Error('Selected Account / Wallet not found');

      // Deduct from wallet
      wallet.currentBalance = (Number(wallet.currentBalance) || 0) - expAmount;
      await wallet.save();
      walletRecord = wallet;

      const user = userId ? await User.findById(userId).select('name role') : null;
      const txDate = expenseData.date
        ? (typeof expenseData.date === 'string' ? expenseData.date.split('T')[0] : new Date(expenseData.date).toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0];

      walletTx = await WalletTransaction.create({
        transactionType: 'EXPENSE',
        category: 'HOSTEL_EXPENSE',
        sourceWallet: wallet._id,
        amount: expAmount,
        date: txDate,
        sourceCategory: 'HOSTEL_EXPENSE',
        sourceModule: 'Hostel Expense',
        description: expenseData.remarks || `Hostel Expense: ${expenseData.expenseTitle}`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterSource: wallet.currentBalance,
      });

      expenseData.walletId = walletRecord._id;
      expenseData.walletName = walletRecord.name;
      expenseData.transactionId = walletTx._id;
    }

    const created = await HostelExpense.create(expenseData);
    if (walletTx && created) {
      walletTx.expenseId = created._id;
      await walletTx.save();
    }
    return created;
  }

  async updateExpense(id, data, userId) {
    const expense = await HostelExpense.findById(id);
    if (!expense) throw new Error('Expense not found');

    const updateData = {
      ...data,
      title: data.expenseTitle || data.title,
      expenseTitle: data.expenseTitle || data.title,
      description: data.remarks || data.description,
      remarks: data.remarks || data.description
    };

    const oldWalletId = expense.walletId ? expense.walletId.toString() : null;
    const oldAmount = Number(expense.amount || 0);
    const newWalletId = data.walletId ? data.walletId.toString() : null;
    const newAmount = Number(data.amount !== undefined ? data.amount : expense.amount);

    // If wallet or amount changed, revert old deduction
    if (oldWalletId) {
      const oldWallet = await Wallet.findById(oldWalletId);
      if (oldWallet) {
        oldWallet.currentBalance = (Number(oldWallet.currentBalance) || 0) + oldAmount;
        await oldWallet.save();
      }
      if (expense.transactionId) {
        await WalletTransaction.findByIdAndDelete(expense.transactionId);
        updateData.transactionId = null;
      }
      updateData.walletId = null;
      updateData.walletName = '';
    }

    // Now if new wallet specified, apply new deduction
    if (newWalletId) {
      const newWallet = await Wallet.findById(newWalletId);
      if (!newWallet) throw new Error('Selected Account / Wallet not found');

      newWallet.currentBalance = (Number(newWallet.currentBalance) || 0) - newAmount;
      await newWallet.save();

      const user = userId ? await User.findById(userId).select('name role') : null;
      const txDate = updateData.date
        ? (typeof updateData.date === 'string' ? updateData.date.split('T')[0] : new Date(updateData.date).toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0];

      const walletTx = await WalletTransaction.create({
        transactionType: 'EXPENSE',
        category: 'HOSTEL_EXPENSE',
        sourceWallet: newWallet._id,
        amount: newAmount,
        date: txDate,
        expenseId: expense._id,
        sourceCategory: 'HOSTEL_EXPENSE',
        sourceModule: 'Hostel Expense',
        description: updateData.remarks || `Hostel Expense: ${updateData.expenseTitle}`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterSource: newWallet.currentBalance,
      });

      updateData.walletId = newWallet._id;
      updateData.walletName = newWallet.name;
      updateData.transactionId = walletTx._id;
    }

    return HostelExpense.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteExpense(id, userId) {
    const expense = await HostelExpense.findById(id);
    if (!expense) return null;

    if (expense.walletId) {
      const wallet = await Wallet.findById(expense.walletId);
      if (wallet) {
        const amount = Number(expense.amount || 0);
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) + amount;
        await wallet.save();

        const user = userId ? await User.findById(userId).select('name role') : null;
        const userName = user ? `${user.name} (${user.role})` : 'System';

        await WalletTransaction.create({
          transactionType: 'EXPENSE',
          category: 'HOSTEL_EXPENSE',
          sourceWallet: wallet._id,
          amount: -Math.abs(amount),
          date: new Date().toISOString().split('T')[0],
          sourceCategory: 'HOSTEL_EXPENSE_REVERSAL',
          sourceModule: 'Hostel Expense',
          referenceNo: `REV-HEX-${expense._id.toString().slice(-6)}`,
          description: `Reversal: Hostel Expense deleted - ${expense.expenseTitle || expense.category || 'Expense'} refunded to ${wallet.name}`,
          performedBy: userId || null,
          performedByName: userName,
          balanceAfterSource: wallet.currentBalance,
          isReversal: true,
        });
      }
    }

    return HostelExpense.findByIdAndDelete(id);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INVENTORY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getInventory() {
    const items = await HostelInventory.find().populate('assignedRoomId').sort({ itemName: 1 });
    return items.map(item => ({
      id: item._id.toString(),
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      condition: item.condition,
      allocatedToRoom: item.allocatedToRoom || (item.assignedRoomId ? item.assignedRoomId.roomNumber : ''),
      assignedRoomId: item.assignedRoomId,
      hostelName: item.hostelName || 'Main Hostel',
      description: item.description,
      isExpense: !!item.isExpense,
      expenseAmount: item.expenseAmount || 0,
      walletId: item.walletId,
      walletName: item.walletName,
      transactionId: item.transactionId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  async createInventory(data, userId) {
    const itemData = {
      ...data,
      allocatedToRoom: data.allocatedToRoom || '',
      hostelName: data.hostelName || 'Main Hostel',
      isExpense: !!data.isExpense,
      expenseAmount: Number(data.expenseAmount || 0)
    };

    let walletRecord = null;
    let walletTx = null;

    if (itemData.isExpense && data.walletId && itemData.expenseAmount > 0) {
      const wallet = await Wallet.findById(data.walletId);
      if (!wallet) throw new Error('Selected Account / Wallet not found');

      wallet.currentBalance = (Number(wallet.currentBalance) || 0) - itemData.expenseAmount;
      await wallet.save();
      walletRecord = wallet;

      const user = userId ? await User.findById(userId).select('name role') : null;
      const txDate = data.date
        ? (typeof data.date === 'string' ? data.date.split('T')[0] : new Date(data.date).toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0];

      walletTx = await WalletTransaction.create({
        transactionType: 'EXPENSE',
        category: 'HOSTEL_INVENTORY_EXPENSE',
        sourceWallet: wallet._id,
        amount: itemData.expenseAmount,
        date: txDate,
        sourceCategory: 'HOSTEL_INVENTORY_EXPENSE',
        sourceModule: 'Hostel Inventory',
        description: `Hostel Inventory: ${itemData.itemName} (${itemData.quantity || 1} qty)`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterSource: wallet.currentBalance,
      });

      itemData.walletId = walletRecord._id;
      itemData.walletName = walletRecord.name;
      itemData.transactionId = walletTx._id;
    }

    const created = await HostelInventory.create(itemData);
    if (walletTx && created) {
      walletTx.inventoryId = created._id;
      await walletTx.save();
    }
    return created;
  }

  async updateInventory(id, data, userId) {
    const item = await HostelInventory.findById(id);
    if (!item) throw new Error('Inventory item not found');

    const updateData = {
      ...data,
      isExpense: !!data.isExpense,
      expenseAmount: Number(data.expenseAmount || 0)
    };

    const wasExpense = !!item.isExpense && item.walletId;
    const oldAmount = Number(item.expenseAmount || 0);
    const oldWalletId = item.walletId ? item.walletId.toString() : null;

    // If previously deducted, revert old deduction
    if (wasExpense) {
      const oldWallet = await Wallet.findById(oldWalletId);
      if (oldWallet) {
        oldWallet.currentBalance = (Number(oldWallet.currentBalance) || 0) + oldAmount;
        await oldWallet.save();
      }
      if (item.transactionId) {
        await WalletTransaction.findByIdAndDelete(item.transactionId);
        updateData.transactionId = null;
      }
      updateData.walletId = null;
      updateData.walletName = '';
    }

    // If now recorded as expense with wallet
    if (updateData.isExpense && data.walletId && updateData.expenseAmount > 0) {
      const newWallet = await Wallet.findById(data.walletId);
      if (!newWallet) throw new Error('Selected Account / Wallet not found');

      newWallet.currentBalance = (Number(newWallet.currentBalance) || 0) - updateData.expenseAmount;
      await newWallet.save();

      const user = userId ? await User.findById(userId).select('name role') : null;
      const txDate = data.date
        ? (typeof data.date === 'string' ? data.date.split('T')[0] : new Date(data.date).toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0];

      const walletTx = await WalletTransaction.create({
        transactionType: 'EXPENSE',
        category: 'HOSTEL_INVENTORY_EXPENSE',
        sourceWallet: newWallet._id,
        amount: updateData.expenseAmount,
        date: txDate,
        inventoryId: item._id,
        sourceCategory: 'HOSTEL_INVENTORY_EXPENSE',
        sourceModule: 'Hostel Inventory',
        description: `Hostel Inventory: ${updateData.itemName || item.itemName} (${updateData.quantity || item.quantity || 1} qty)`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterSource: newWallet.currentBalance,
      });

      updateData.walletId = newWallet._id;
      updateData.walletName = newWallet.name;
      updateData.transactionId = walletTx._id;
    } else if (!updateData.isExpense) {
      updateData.expenseAmount = 0;
      updateData.walletId = null;
      updateData.walletName = '';
      updateData.transactionId = null;
    }

    return HostelInventory.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteInventory(id, userId) {
    const item = await HostelInventory.findById(id);
    if (!item) return null;

    if (item.isExpense && item.walletId) {
      const wallet = await Wallet.findById(item.walletId);
      if (wallet) {
        const amount = Number(item.expenseAmount || 0);
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) + amount;
        await wallet.save();

        const user = userId ? await User.findById(userId).select('name role') : null;
        const userName = user ? `${user.name} (${user.role})` : 'System';

        await WalletTransaction.create({
          transactionType: 'EXPENSE',
          category: 'HOSTEL_INVENTORY_EXPENSE',
          sourceWallet: wallet._id,
          amount: -Math.abs(amount),
          date: new Date().toISOString().split('T')[0],
          sourceCategory: 'HOSTEL_INVENTORY_EXPENSE_REVERSAL',
          sourceModule: 'Hostel Inventory',
          referenceNo: `REV-HINV-${item._id.toString().slice(-6)}`,
          description: `Reversal: Hostel Inventory deleted - ${item.itemName} (${item.quantity || 1} qty) refunded to ${wallet.name}`,
          performedBy: userId || null,
          performedByName: userName,
          balanceAfterSource: wallet.currentBalance,
          isReversal: true,
        });
      }
    }

    return HostelInventory.findByIdAndDelete(id);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHALLANS & PAYMENTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getChallans(filters = {}) {
    const query = {};
    const regId = filters.registrationId || filters.hostelRegistrationId;
    if (regId) {
      query.$or = [
        { registrationId: regId },
        { hostelRegistrationId: regId }
      ];
    }

    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }

    if (filters.search) {
      const searchStr = filters.search.trim();
      const re = new RegExp(searchStr, 'i');

      const matchingStudents = await Student.find({
        $or: [{ fName: re }, { lName: re }, { rollNumber: re }]
      }).select('_id');
      const studentIds = matchingStudents.map(s => s._id);

      const matchingRegs = await HostelRegistration.find({
        $or: [
          { studentId: { $in: studentIds } },
          { externalName: re },
          { externalGuardianName: re }
        ]
      }).select('_id');
      const regIds = matchingRegs.map(r => r._id);

      query.$or = [
        { challanNo: re },
        { challanNumber: re },
        { registrationId: { $in: regIds } },
        { hostelRegistrationId: { $in: regIds } }
      ];
    }

    const challans = await HostelChallan.find(query)
      .populate({
        path: 'registrationId',
        populate: {
          path: 'studentId',
          populate: { path: 'programId' }
        }
      })
      .populate({
        path: 'hostelRegistrationId',
        populate: {
          path: 'studentId',
          populate: { path: 'programId' }
        }
      })
      .populate('supersededBy')
      .sort({ createdAt: -1 });

    const challanIds = challans.map(c => c._id);
    const challanNos = challans.map(c => c.challanNumber || c.challanNo).filter(Boolean);

    const [sourceLedgers, targetLedgers] = await Promise.all([
      HostelCreditLedger.find({
        $or: [
          { sourceChallanId: { $in: challanIds } },
          { sourceChallanNo: { $in: challanNos } }
        ]
      }).lean(),
      HostelCreditLedger.find({
        $or: [
          { 'allocations.targetChallanId': { $in: challanIds } },
          { 'allocations.targetChallanNo': { $in: challanNos } }
        ]
      }).lean()
    ]);

    const sourceCreditMap = {};
    for (const l of sourceLedgers) {
      const keys = [l.sourceChallanId?.toString(), l.sourceChallanNo].filter(Boolean);
      for (const k of keys) {
        if (!sourceCreditMap[k]) {
          sourceCreditMap[k] = {
            totalCreditCreated: 0,
            remainingCredit: 0,
            adjustedTo: []
          };
        }
        sourceCreditMap[k].totalCreditCreated += Number(l.amount || 0);
        sourceCreditMap[k].remainingCredit += Number(l.availableBalance || 0);
        if (Array.isArray(l.allocations)) {
          for (const a of l.allocations) {
            sourceCreditMap[k].adjustedTo.push({
              targetChallanId: a.targetChallanId?.toString(),
              targetChallanNo: a.targetChallanNo,
              targetMonth: a.targetMonth,
              amount: Number(a.amountApplied || 0)
            });
          }
        }
      }
    }

    const targetCreditMap = {};
    for (const l of targetLedgers) {
      if (Array.isArray(l.allocations)) {
        for (const a of l.allocations) {
          const keys = [a.targetChallanId?.toString(), a.targetChallanNo].filter(Boolean);
          for (const k of keys) {
            if (!targetCreditMap[k]) {
              targetCreditMap[k] = {
                totalAdvanceApplied: 0,
                sources: []
              };
            }
            targetCreditMap[k].totalAdvanceApplied += Number(a.amountApplied || 0);
            targetCreditMap[k].sources.push({
              sourceChallanId: l.sourceChallanId?.toString(),
              sourceChallanNo: l.sourceChallanNo,
              sourceMonth: l.sourceMonth,
              amountApplied: Number(a.amountApplied || 0),
              appliedAt: a.appliedAt
            });
          }
        }
      }
    }

    const formatted = challans.map(c => {
      const reg = c.registrationId || c.hostelRegistrationId;
      let student = reg && reg.studentId && reg.studentId._id ? (reg.studentId.toJSON ? reg.studentId.toJSON() : reg.studentId) : null;
      if (student && !student.program && student.programId) {
        student.program = student.programId;
      }
      const challanNumber = c.challanNumber || c.challanNo;

      const sId = c._id?.toString();
      const sNo = challanNumber;
      const srcCredit = (sId && sourceCreditMap[sId]) || (sNo && sourceCreditMap[sNo]) || null;
      const tgtCredit = (sId && targetCreditMap[sId]) || (sNo && targetCreditMap[sNo]) || null;

      const excessCreditGenerated = Number(c.excessCreditGenerated || (srcCredit ? srcCredit.totalCreditCreated : 0));
      const creditRemaining = (srcCredit ? srcCredit.remainingCredit : (c.creditRemaining || 0));
      const creditAdjustedTo = (srcCredit && srcCredit.adjustedTo.length > 0 ? srcCredit.adjustedTo : (c.creditAdjustedTo || []));

      let advanceApplied = Number(c.advanceApplied || (tgtCredit ? tgtCredit.totalAdvanceApplied : 0));
      const advanceAllocations = (Array.isArray(c.advanceAllocations) && c.advanceAllocations.length > 0)
        ? c.advanceAllocations
        : (tgtCredit ? tgtCredit.sources : []);
      const primarySource = advanceAllocations[0];
      const advanceFromChallanNo = c.advanceFromChallanNo || primarySource?.sourceChallanNo || '';
      const advanceFromMonth = c.advanceFromMonth || primarySource?.sourceMonth || '';
      const advanceFromChallanId = c.advanceFromChallanId || primarySource?.sourceChallanId || null;

      // Check if this challan was superseded by a leading challan that has been paid or settled
      let isSettled = c.status === 'SETTLED';
      let settledViaArrearsAmount = Number(c.settledViaArrearsAmount || 0);
      let settledByChallanNo = c.settledByChallanNo || '';
      let settledByMonth = c.settledByMonth || '';
      let settledByChallanId = c.settledByChallanId || null;

      if (!isSettled && c.supersededBy && typeof c.supersededBy === 'object') {
        const leader = c.supersededBy;
        settledByChallanNo = leader.challanNumber || leader.challanNo || '';
        settledByMonth = leader.month || '';
        settledByChallanId = leader._id;
        const leaderPaid = Number(leader.paidAmount || 0);
        const leaderStatus = leader.status;
        const cTotal = Number(c.totalAmount || c.amount || 0);
        const cPaid = Number(c.paidAmount || 0);
        const cUnpaid = Math.max(0, cTotal - cPaid);

        if (leaderStatus === 'PAID' || leaderPaid >= (Number(leader.arrearsAmount || 0) || cUnpaid)) {
          isSettled = true;
          settledViaArrearsAmount = Math.max(settledViaArrearsAmount, cUnpaid);
          HostelChallan.findByIdAndUpdate(c._id, {
            status: 'SETTLED',
            settledViaArrearsAmount,
            settledByChallanId,
            settledByChallanNo,
            settledByMonth
          }).catch(() => {});
        } else if (leaderPaid > 0) {
          settledViaArrearsAmount = Math.min(cUnpaid, leaderPaid);
        }
      }

      return {
        id: c._id.toString(),
        _id: c._id,
        challanNumber,
        challanNo: challanNumber,
        hostelRegistrationId: reg ? reg._id.toString() : null,
        registrationId: reg ? reg._id.toString() : null,
        hostelRegNumber: reg ? reg._id.toString() : '',
        month: c.month,
        numberOfMonths: c.numberOfMonths || 1,
        dueDate: c.dueDate,
        amount: c.amount || c.totalAmount || 0,
        totalAmount: c.totalAmount || c.amount || 0,
        hostelFee: c.hostelFee || 0,
        heads: c.heads || [],
        fineAmount: c.fineAmount || 0,
        lateFeeFine: c.lateFeeFine || 0,
        arrearsAmount: c.arrearsAmount || 0,
        discount: c.discount || 0,
        advanceApplied,
        advanceFromChallanNo,
        advanceFromMonth,
        advanceFromChallanId,
        advanceAllocations,
        excessCreditGenerated,
        creditRemaining,
        creditAdjustedTo,
        paidAmount: c.paidAmount || 0,
        status: isSettled ? 'SETTLED' : (c.status || 'PENDING'),
        settledViaArrearsAmount,
        settledByChallanNo: settledByChallanNo || (c.supersededBy ? (c.supersededBy.challanNumber || c.supersededBy.challanNo) : ''),
        settledByMonth: settledByMonth || (c.supersededBy ? c.supersededBy.month : ''),
        settledByChallanId: settledByChallanId || (c.supersededBy ? c.supersededBy._id : null),
        arrearAllocations: c.arrearAllocations || [],
        paidDate: c.paidDate || c.paidAt,
        paidAt: c.paidAt || c.paidDate,
        paidBy: c.paidBy || c.paymentMode || 'Cash',
        paymentMode: c.paymentMode || c.paidBy || 'Cash',
        walletId: c.walletId,
        walletName: c.walletName,
        remarks: c.remarks || '',
        supersededBy: c.supersededBy,
        payments: c.payments || [],
        student,
        hostelRegistration: reg,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      };
    });

    if (filters.page || filters.limit) {
      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 25);
      const total = formatted.length;
      const lastPage = Math.ceil(total / limit) || 1;
      const pagedData = formatted.slice((page - 1) * limit, page * limit);
      return {
        data: pagedData,
        meta: {
          total,
          page,
          limit,
          lastPage
        }
      };
    }

    return {
      data: formatted,
      meta: {
        total: formatted.length,
        page: 1,
        limit: formatted.length,
        lastPage: 1
      }
    };
  }
  async generate8DigitChallanNo() {
    let challanNo;
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 30) {
      attempts++;
      challanNo = Math.floor(10000000 + Math.random() * 90000000).toString();
      const found = await HostelChallan.findOne({ $or: [{ challanNo }, { challanNumber: challanNo }] }).select('_id').lean();
      exists = !!found;
    }
    if (exists) {
      const ts = Date.now().toString().slice(-6);
      const rnd = Math.floor(10 + Math.random() * 90).toString();
      challanNo = `${ts}${rnd}`;
    }
    return challanNo;
  }

  async createChallan(data) {
    const regId = data.hostelRegistrationId || data.registrationId;
    if (!regId) throw new Error('Registration ID is required');

    const reg = await HostelRegistration.findById(regId);
    if (!reg) throw new Error('Hostel registration not found');

    const targetYm = parseYearMonth(data.month);
    if (!targetYm) throw new Error('Valid month is required (e.g. September 2026 or 2026-09)');

    const numberOfMonths = Math.max(1, parseInt(data.numberOfMonths || 1, 10) || 1);

    // Compute month range and label
    const targetMonthsList = [];
    for (let i = 0; i < numberOfMonths; i++) {
      targetMonthsList.push(addMonths(targetYm.year, targetYm.month, i));
    }

    let monthLabel = '';
    if (numberOfMonths > 1) {
      const endYm = addMonths(targetYm.year, targetYm.month, numberOfMonths - 1);
      const startLabel = yearMonthToLabel(targetYm.year, targetYm.month);
      const endLabel = yearMonthToLabel(endYm.year, endYm.month);
      monthLabel = `${startLabel} - ${endLabel} (${numberOfMonths} Months)`;
    } else {
      monthLabel = yearMonthToLabel(targetYm.year, targetYm.month);
    }

    const allRegChallans = await HostelChallan.find({
      $or: [{ registrationId: regId }, { hostelRegistrationId: regId }],
      status: { $nin: ['VOID', 'SUPERSEDED'] }
    });

    // 1. Overlap check across all months in target range
    for (const c of allRegChallans) {
      const cYm = parseYearMonth(c.month);
      if (!cYm) continue;
      const cNum = Math.max(1, parseInt(c.numberOfMonths || 1, 10) || 1);
      for (let j = 0; j < cNum; j++) {
        const cCovered = addMonths(cYm.year, cYm.month, j);
        for (const tm of targetMonthsList) {
          if (cCovered.year === tm.year && cCovered.month === tm.month) {
            const mLabel = yearMonthToLabel(tm.year, tm.month);
            throw new Error(`Month ${mLabel} is already covered by Challan #${c.challanNumber || c.challanNo}.`);
          }
        }
      }
    }

    // 2. Registration date boundary: cannot generate for months before registration month
    const regYm = parseYearMonth(reg.registrationDate || reg.createdAt) || targetYm;
    if (compareYearMonth(targetYm, regYm) < 0) {
      const regMonthLabel = yearMonthToLabel(regYm.year, regYm.month);
      throw new Error(`Cannot generate challan for ${monthLabel}. Student was registered in ${regMonthLabel}.`);
    }

    // 3. Sequential check & Arrears chain:
    // If target start month is after registration month, check that preceding month was covered
    let computedArrears = 0;
    let prevChallan = null;
    if (compareYearMonth(targetYm, regYm) > 0) {
      const prevYm = getPrevYearMonth(targetYm.year, targetYm.month);
      const prevMonthLabel = yearMonthToLabel(prevYm.year, prevYm.month);

      for (const c of allRegChallans) {
        const cYm = parseYearMonth(c.month);
        if (!cYm) continue;
        const cNum = Math.max(1, parseInt(c.numberOfMonths || 1, 10) || 1);
        for (let j = 0; j < cNum; j++) {
          const covered = addMonths(cYm.year, cYm.month, j);
          if (covered.year === prevYm.year && covered.month === prevYm.month) {
            prevChallan = c;
            break;
          }
        }
        if (prevChallan) break;
      }

      if (!prevChallan) {
        throw new Error(`Please generate challan covering ${prevMonthLabel} first before generating for ${monthLabel}.`);
      }

      // Compute arrears from previous month's unpaid balance
      const prevTotal = Number(prevChallan.totalAmount || prevChallan.amount || 0);
      const prevPaid = Number(prevChallan.paidAmount || 0);
      computedArrears = Math.max(0, prevTotal - prevPaid);
    }

    const challanNo = data.challanNumber || data.challanNo || (await this.generate8DigitChallanNo());
    const heads = Array.isArray(data.heads) ? data.heads : [];
    const headsTotal = heads.reduce((sum, h) => sum + Number(h.amount || 0), 0);

    const decidedPerMonth = Number(reg.decidedFeePerMonth || 0);
    let hostelFee;
    if (data.hostelFee !== undefined && data.hostelFee !== null && data.hostelFee !== '') {
      hostelFee = Number(data.hostelFee);
    } else {
      hostelFee = decidedPerMonth * numberOfMonths;
    }

    const fineAmount = Number(data.fineAmount || 0);
    const lateFeeFine = Number(data.lateFeeFine || 0);
    const arrearsAmount = Number(data.arrearsAmount !== undefined ? data.arrearsAmount : computedArrears);
    const discount = Number(data.discount || 0);

    const baseAmount = hostelFee + headsTotal;
    const grossAmount = baseAmount + fineAmount + lateFeeFine + arrearsAmount - discount;

    // Advance Payments Auto-Application from HostelCreditLedger
    const availableCreditRecords = await HostelCreditLedger.find({
      registrationId: regId,
      status: 'AVAILABLE',
      availableBalance: { $gt: 0 }
    }).sort({ createdAt: 1 });

    const totalAvailableCredit = availableCreditRecords.reduce((sum, r) => sum + (Number(r.availableBalance) || 0), 0);
    let advanceToApply = 0;
    if (data.advanceApplied !== undefined) {
      advanceToApply = Math.min(grossAmount, Math.max(0, Number(data.advanceApplied)), totalAvailableCredit);
    } else {
      advanceToApply = Math.min(grossAmount, totalAvailableCredit);
    }

    const netAmount = Math.max(0, grossAmount - advanceToApply);
    const isFullyPaidByAdvance = (netAmount === 0 && advanceToApply > 0);

    const challanData = {
      ...data,
      registrationId: regId,
      hostelRegistrationId: regId,
      month: monthLabel,
      numberOfMonths,
      challanNo,
      challanNumber: challanNo,
      hostelFee,
      heads,
      fineAmount,
      lateFeeFine,
      arrearsAmount,
      discount,
      advanceApplied: advanceToApply,
      amount: netAmount,
      totalAmount: netAmount,
      paidAmount: isFullyPaidByAdvance ? advanceToApply : 0,
      paidDate: isFullyPaidByAdvance ? new Date() : undefined,
      paidAt: isFullyPaidByAdvance ? new Date() : undefined,
      paidBy: isFullyPaidByAdvance ? 'Advance Credit' : (data.paidBy || 'Cash'),
      paymentMode: isFullyPaidByAdvance ? 'Advance Credit' : (data.paymentMode || 'Cash'),
      status: isFullyPaidByAdvance ? 'PAID' : 'PENDING'
    };

    if (computedArrears > 0 && prevChallan) {
      challanData.arrearAllocations = [{
        sourceChallanId: prevChallan._id,
        sourceChallanNo: prevChallan.challanNumber || prevChallan.challanNo,
        sourceMonth: prevChallan.month,
        originalDueAmount: Number(prevChallan.totalAmount || prevChallan.amount || 0),
        amountCarriedForward: computedArrears,
        amountSettled: (isFullyPaidByAdvance && advanceToApply >= computedArrears) ? computedArrears : 0
      }];
      challanData.supersedes = [prevChallan._id];
    }

    const challan = await HostelChallan.create(challanData);

    // If advance applied, deduct from HostelCreditLedger and record allocations
    if (advanceToApply > 0) {
      let remToDeduct = advanceToApply;
      const advanceAllocations = [];
      for (const record of availableCreditRecords) {
        if (remToDeduct <= 0) break;
        const take = Math.min(remToDeduct, record.availableBalance);
        record.availableBalance -= take;
        record.allocations.push({
          targetChallanId: challan._id,
          targetChallanNo: challan.challanNo,
          targetMonth: challan.month,
          amountApplied: take,
          appliedAt: new Date()
        });
        if (record.availableBalance <= 0) {
          record.status = 'CONSUMED';
        }
        await record.save();

        advanceAllocations.push({
          sourceChallanId: record.sourceChallanId,
          sourceChallanNo: record.sourceChallanNo,
          sourceMonth: record.sourceMonth,
          amountApplied: take
        });

        remToDeduct -= take;
      }

      challan.advanceAllocations = advanceAllocations;
      if (advanceAllocations.length > 0) {
        challan.advanceFromChallanNo = advanceAllocations[0].sourceChallanNo;
        challan.advanceFromMonth = advanceAllocations[0].sourceMonth;
        challan.advanceFromChallanId = advanceAllocations[0].sourceChallanId;
      }
      await challan.save();
    }

    // Mark previous challan superseded or settled if its arrears were carried over
    if (computedArrears > 0 && prevChallan && prevChallan.status !== 'PAID') {
      prevChallan.supersededBy = challan._id;
      if (isFullyPaidByAdvance && advanceToApply >= computedArrears) {
        prevChallan.status = 'SETTLED';
        prevChallan.settledViaArrearsAmount = computedArrears;
        prevChallan.settledByChallanId = challan._id;
        prevChallan.settledByChallanNo = challan.challanNumber || challan.challanNo;
        prevChallan.settledByMonth = challan.month;
      } else {
        prevChallan.status = 'SUPERSEDED';
      }
      await prevChallan.save();
    }

    return challan;
  }

  async updateChallan(id, data = {}) {
    const challan = await HostelChallan.findById(id);
    if (!challan) throw new Error('Challan not found');

    const payload = data || {};
    if (payload.dueDate) challan.dueDate = payload.dueDate;
    if (payload.remarks !== undefined) challan.remarks = payload.remarks;
    if (payload.fineAmount !== undefined) challan.fineAmount = Number(payload.fineAmount);
    if (payload.lateFeeFine !== undefined) challan.lateFeeFine = Number(payload.lateFeeFine);
    if (payload.arrearsAmount !== undefined) challan.arrearsAmount = Number(payload.arrearsAmount);
    if (payload.discount !== undefined) challan.discount = Number(payload.discount);
    if (payload.hostelFee !== undefined) challan.hostelFee = Number(payload.hostelFee);
    if (payload.numberOfMonths !== undefined) challan.numberOfMonths = Number(payload.numberOfMonths);
    if (payload.advanceApplied !== undefined) challan.advanceApplied = Number(payload.advanceApplied);
    if (Array.isArray(payload.heads)) challan.heads = payload.heads;
    if (payload.status) challan.status = payload.status;

    const headsTotal = (challan.heads || []).reduce((sum, h) => sum + Number(h.amount || 0), 0);
    const baseAmount = (challan.hostelFee || 0) + headsTotal;
    const grossAmount = baseAmount + (challan.fineAmount || 0) + (challan.lateFeeFine || 0) + (challan.arrearsAmount || 0) - (challan.discount || 0);
    const netAmount = Math.max(0, grossAmount - (challan.advanceApplied || 0));
    challan.amount = netAmount;
    challan.totalAmount = netAmount;

    if (challan.paidAmount >= challan.totalAmount && challan.totalAmount > 0) {
      challan.status = 'PAID';
    } else if (challan.paidAmount > 0) {
      challan.status = 'PARTIAL';
    } else {
      challan.status = 'PENDING';
    }

    await challan.save();
    return challan;
  }

  async deleteChallan(id, userId) {
    const challan = await HostelChallan.findById(id);
    if (!challan) return null;

    try {
      const user = userId ? await User.findById(userId).select('name role') : null;
      const userName = user ? `${user.name} (${user.role})` : 'System';
      const challanNo = challan.challanNumber || challan.challanNo || '';

      const txs = await WalletTransaction.find({
        challanId: challan._id,
        amount: { $gt: 0 },
      });

      if (txs.length > 0) {
        for (const tx of txs) {
          const targetWalletId = tx.destinationWallet;
          if (targetWalletId) {
            const wallet = await Wallet.findById(targetWalletId);
            if (wallet) {
              const txAmt = Number(tx.amount || 0);
              wallet.currentBalance = (Number(wallet.currentBalance) || 0) - txAmt;
              await wallet.save();

              await WalletTransaction.create({
                transactionType: 'HOSTEL_FEE',
                category: 'HOSTEL_FEE',
                destinationWallet: wallet._id,
                amount: -Math.abs(txAmt),
                date: new Date().toISOString().split('T')[0],
                month: tx.month || challan.month || '',
                referenceNo: `REV-${tx.referenceNo || challanNo || challan._id}`,
                challanId: challan._id,
                challanNumber: challanNo || tx.challanNumber || '',
                studentName: tx.studentName || '',
                rollNumber: tx.rollNumber || '',
                sourceCategory: 'HOSTEL_FEE_REVERSAL',
                sourceModule: 'Hostel Fee',
                paymentMode: tx.paymentMode || 'Reversal',
                description: `Reversal: Hostel Challan #${challanNo || tx.referenceNo} deleted - fee reversed from ${wallet.name}`,
                performedBy: userId || null,
                performedByName: userName,
                balanceAfterDestination: wallet.currentBalance,
                isReversal: true,
              });
            }
          }
        }
      }

      // 1. Restore Advance Credit if this challan consumed any advance credit
      if (challan.advanceApplied > 0) {
        const ledgers = await HostelCreditLedger.find({
          'allocations.targetChallanId': challan._id
        });

        for (const ledger of ledgers) {
          const allocEntry = ledger.allocations.find(a => a.targetChallanId?.toString() === challan._id.toString());
          if (allocEntry) {
            ledger.availableBalance += (allocEntry.amountApplied || 0);
            ledger.status = 'AVAILABLE';
            ledger.allocations = ledger.allocations.filter(a => a.targetChallanId?.toString() !== challan._id.toString());
            await ledger.save();
          }
        }
      }

      // 2. Delete any excess credit generated from this challan
      if (challan.excessCreditGenerated > 0) {
        await HostelCreditLedger.deleteMany({ sourceChallanId: challan._id });
      }

      // 3. Restore any previously superseded / settled challans
      const supersededPrior = await HostelChallan.find({
        $or: [{ supersededBy: challan._id }, { settledByChallanId: challan._id }]
      });
      for (const prior of supersededPrior) {
        prior.supersededBy = null;
        prior.settledByChallanId = null;
        prior.settledByChallanNo = '';
        prior.settledByMonth = '';
        prior.settledViaArrearsAmount = 0;
        const pTotal = prior.totalAmount || prior.amount || 0;
        const pPaid = prior.paidAmount || 0;
        if (pPaid >= pTotal && pTotal > 0) {
          prior.status = 'PAID';
        } else if (pPaid > 0) {
          prior.status = 'PARTIAL';
        } else if (prior.dueDate && new Date(prior.dueDate) < new Date()) {
          prior.status = 'OVERDUE';
        } else {
          prior.status = 'PENDING';
        }
        await prior.save();
      }
    } catch (err) {
      console.error('Error during hostel challan delete cleanup:', err);
    }

    return HostelChallan.findByIdAndDelete(id);
  }

  async recordPayment(id, { amount, paymentMode, paidDate, paidBy, remarks, walletId }, userId) {
    const challan = await HostelChallan.findById(id)
      .populate({
        path: 'registrationId',
        populate: { path: 'studentId' }
      })
      .populate({
        path: 'hostelRegistrationId',
        populate: { path: 'studentId' }
      });
    if (!challan) throw new Error('Challan not found');

    const payAmount = Number(amount || 0);
    if (!payAmount || payAmount <= 0) throw new Error('Payment amount must be greater than zero');

    let walletRecord = null;
    let walletTx = null;

    if (walletId) {
      const wallet = await Wallet.findById(walletId);
      if (!wallet) throw new Error('Selected Account / Wallet not found');

      // Credit wallet
      wallet.currentBalance = (Number(wallet.currentBalance) || 0) + payAmount;
      await wallet.save();
      walletRecord = wallet;

      const reg = challan.registrationId || challan.hostelRegistrationId;
      const student = reg?.studentId;
      const studentName = student
        ? `${student.fName || ''} ${student.lName || ''}`.trim()
        : (reg?.externalName || challan.hostelRegNumber || 'Boarder');
      const rollNo = student?.rollNumber || reg?.id || '';

      const user = userId ? await User.findById(userId).select('name role') : null;
      const pDate = paidDate
        ? (typeof paidDate === 'string' ? paidDate.split('T')[0] : new Date(paidDate).toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0];

      walletTx = await WalletTransaction.create({
        transactionType: 'HOSTEL_FEE',
        category: 'HOSTEL_FEE',
        destinationWallet: wallet._id,
        amount: payAmount,
        date: pDate,
        month: challan.month || '',
        referenceNo: challan.challanNumber || challan.challanNo || '',
        challanId: challan._id,
        challanNumber: challan.challanNumber || challan.challanNo || '',
        studentName,
        rollNumber: rollNo,
        paymentMode: paymentMode || paidBy || (walletRecord.type === 'BANK' ? 'Bank Transfer' : 'Cash'),
        description: remarks || `Hostel fee collection for Challan #${challan.challanNumber || challan.challanNo} (${challan.month || ''}) - ${studentName}`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterDestination: wallet.currentBalance,
      });
    }

    const paymentRecord = {
      amount: payAmount,
      paymentDate: paidDate ? new Date(paidDate) : new Date(),
      paymentMethod: paymentMode || paidBy || (walletRecord?.type === 'BANK' ? 'Bank Transfer' : 'Cash'),
      paidBy: paidBy || paymentMode || 'Cash',
      remarks: remarks || '',
      walletId: walletRecord ? walletRecord._id : (walletId || null),
      walletName: walletRecord ? walletRecord.name : '',
      walletType: walletRecord ? walletRecord.type : '',
      transactionId: walletTx ? walletTx._id : null,
    };

    if (!Array.isArray(challan.payments)) challan.payments = [];
    challan.payments.push(paymentRecord);

    challan.paidAmount = (challan.paidAmount || 0) + payAmount;
    challan.paidDate = paymentRecord.paymentDate;
    challan.paidAt = paymentRecord.paymentDate;
    challan.paidBy = paymentRecord.paidBy;
    challan.paymentMode = paymentRecord.paymentMethod;
    if (walletRecord) {
      challan.walletId = walletRecord._id;
      challan.walletName = walletRecord.name;
    }

    const total = challan.totalAmount || challan.amount || 0;
    if (challan.paidAmount >= total) {
      challan.status = 'PAID';
    } else if (challan.paidAmount > 0) {
      challan.status = 'PARTIAL';
    }

    // Arrears settlement on superseded source challan(s)
    let remPayForArrears = payAmount;
    if (Array.isArray(challan.arrearAllocations) && challan.arrearAllocations.length > 0) {
      for (const alloc of challan.arrearAllocations) {
        const needed = Math.max(0, (alloc.amountCarriedForward || 0) - (alloc.amountSettled || 0));
        if (needed > 0 && remPayForArrears > 0) {
          const settle = Math.min(needed, remPayForArrears);
          alloc.amountSettled = (alloc.amountSettled || 0) + settle;
          remPayForArrears -= settle;

          if (alloc.sourceChallanId && settle > 0) {
            const sourceChallan = await HostelChallan.findById(alloc.sourceChallanId);
            if (sourceChallan) {
              sourceChallan.settledViaArrearsAmount = (sourceChallan.settledViaArrearsAmount || 0) + settle;
              sourceChallan.settledByChallanId = challan._id;
              sourceChallan.settledByChallanNo = challan.challanNumber || challan.challanNo;
              sourceChallan.settledByMonth = challan.month;
              if (alloc.amountSettled >= alloc.amountCarriedForward) {
                sourceChallan.status = 'SETTLED';
              }
              await sourceChallan.save();
            }
          }
        }
      }
    } else if (Number(challan.arrearsAmount || 0) > 0) {
      // Fallback for challans created before arrearAllocations was added
      const supersededList = await HostelChallan.find({ supersededBy: challan._id });
      for (const sourceChallan of supersededList) {
        const sourceTotal = Number(sourceChallan.totalAmount || sourceChallan.amount || 0);
        const sourcePaid = Number(sourceChallan.paidAmount || 0);
        const alreadySettled = Number(sourceChallan.settledViaArrearsAmount || 0);
        const needed = Math.max(0, sourceTotal - sourcePaid - alreadySettled);
        if (needed > 0 && remPayForArrears > 0) {
          const settle = Math.min(needed, remPayForArrears);
          sourceChallan.settledViaArrearsAmount = alreadySettled + settle;
          sourceChallan.settledByChallanId = challan._id;
          sourceChallan.settledByChallanNo = challan.challanNumber || challan.challanNo;
          sourceChallan.settledByMonth = challan.month;
          remPayForArrears -= settle;
          if ((sourcePaid + sourceChallan.settledViaArrearsAmount) >= sourceTotal) {
            sourceChallan.status = 'SETTLED';
          }
          await sourceChallan.save();
        }
      }
    }

    // Excess Payment -> HostelCreditLedger
    const currentExcess = Math.max(0, challan.paidAmount - total);
    const prevExcess = Number(challan.excessCreditGenerated || 0);
    const incrementalExcess = Math.max(0, currentExcess - prevExcess);

    if (incrementalExcess > 0) {
      const reg = challan.registrationId || challan.hostelRegistrationId;
      const regId = reg?._id || challan.registrationId || challan.hostelRegistrationId;
      const student = reg?.studentId;
      const studentId = student?._id || student || null;

      await HostelCreditLedger.create({
        registrationId: regId,
        studentId,
        sourceChallanId: challan._id,
        sourceChallanNo: challan.challanNumber || challan.challanNo,
        sourceMonth: challan.month || '',
        amount: incrementalExcess,
        availableBalance: incrementalExcess,
        status: 'AVAILABLE',
        allocations: []
      });
      challan.excessCreditGenerated = currentExcess;
    }

    await challan.save();
    return challan;
  }

  async getRegistrationCredit(registrationId) {
    const records = await HostelCreditLedger.find({
      registrationId,
      status: 'AVAILABLE',
      availableBalance: { $gt: 0 }
    }).sort({ createdAt: 1 });

    const totalAvailable = records.reduce((s, r) => s + (Number(r.availableBalance) || 0), 0);
    return {
      registrationId,
      totalAvailableCredit: totalAvailable,
      creditRecords: records
    };
  }

  async getRegistrationPayments(registrationId) {
    const challans = await HostelChallan.find({
      $or: [{ registrationId }, { hostelRegistrationId: registrationId }]
    });

    const allPayments = [];
    for (const c of challans) {
      for (const p of c.payments || []) {
        allPayments.push({
          id: p._id.toString(),
          challanId: c._id.toString(),
          challanNumber: c.challanNumber || c.challanNo,
          amount: p.amount,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          paidBy: p.paidBy,
          remarks: p.remarks,
          walletId: p.walletId,
          walletName: p.walletName,
        });
      }
    }

    return allPayments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  }

  async createRegistrationPayment(registrationId, paymentData, userId) {
    // Find oldest unpaid or partial challan for this registration
    const challan = await HostelChallan.findOne({
      $or: [{ registrationId }, { hostelRegistrationId: registrationId }],
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
    }).sort({ dueDate: 1 });

    if (!challan) throw new Error('No pending or partial challans found for this registration');
    return this.recordPayment(challan._id, paymentData, userId);
  }

  async deleteRegistrationPayment(registrationId, paymentId, userId) {
    const challans = await HostelChallan.find({
      $or: [{ registrationId }, { hostelRegistrationId: registrationId }]
    });

    for (const c of challans) {
      const idx = (c.payments || []).findIndex(p => p._id.toString() === paymentId);
      if (idx !== -1) {
        const removed = c.payments.splice(idx, 1)[0];
        if (removed.walletId) {
          try {
            const w = await Wallet.findById(removed.walletId);
            if (w) {
              const payAmt = Number(removed.amount || 0);
              w.currentBalance = (Number(w.currentBalance) || 0) - payAmt;
              await w.save();

              const user = userId ? await User.findById(userId).select('name role') : null;
              const userName = user ? `${user.name} (${user.role})` : 'System';

              await WalletTransaction.create({
                transactionType: 'HOSTEL_FEE',
                category: 'HOSTEL_FEE',
                destinationWallet: w._id,
                amount: -Math.abs(payAmt),
                date: new Date().toISOString().split('T')[0],
                month: c.month || '',
                referenceNo: `REV-${c.challanNumber || c.challanNo || paymentId}`,
                challanId: c._id,
                challanNumber: c.challanNumber || c.challanNo || '',
                sourceCategory: 'HOSTEL_FEE_REVERSAL',
                sourceModule: 'Hostel Fee',
                paymentMode: removed.paymentMethod || 'Reversal',
                description: `Reversal: Hostel Payment deleted for Challan #${c.challanNumber || c.challanNo} - fee reversed from ${w.name}`,
                performedBy: userId || null,
                performedByName: userName,
                balanceAfterDestination: w.currentBalance,
                isReversal: true,
              });
            }
          } catch (e) {
            console.error('Error reverting wallet on payment delete:', e);
          }
        }
        c.paidAmount = Math.max(0, (c.paidAmount || 0) - (removed.amount || 0));
        const total = c.totalAmount || c.amount || 0;
        if (c.paidAmount === 0) {
          c.status = 'PENDING';
        } else if (c.paidAmount < total) {
          c.status = 'PARTIAL';
        }
        await c.save();
        return { message: 'Payment deleted' };
      }
    }

    throw new Error('Payment record not found');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REVENUE & ANALYTICS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getRevenueReport(filters = {}) {
    const query = {};
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const challans = await HostelChallan.find(query).populate({
      path: 'registrationId',
      populate: { path: 'studentId' }
    });

    let totalCollected = 0;
    let totalOutstanding = 0;
    const monthlyMap = {};
    const perStudentMap = {};

    for (const c of challans) {
      const isVoidOrSuperseded = c.status === 'VOID' || c.status === 'SUPERSEDED';
      const total = (c.amount || c.totalAmount || 0);
      const paid = (c.paidAmount || 0);
      const balance = Math.max(0, total - paid);

      if (!isVoidOrSuperseded) {
        totalCollected += paid;
        totalOutstanding += balance;
      }

      const m = c.month || (c.createdAt ? new Date(c.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'Unknown');
      if (!monthlyMap[m]) monthlyMap[m] = 0;
      monthlyMap[m] += paid;

      const reg = c.registrationId;
      const regId = reg ? reg._id.toString() : (c.hostelRegNumber || 'Unknown');
      const studentName = reg?.studentId
        ? `${reg.studentId.fName} ${reg.studentId.lName || ''}`.trim()
        : reg?.externalName || 'External Student';

      if (!perStudentMap[regId]) {
        perStudentMap[regId] = {
          registrationId: regId,
          name: studentName,
          totalBilled: 0,
          totalPaid: 0,
          outstanding: 0
        };
      }

      if (!isVoidOrSuperseded) {
        perStudentMap[regId].totalBilled += total;
        perStudentMap[regId].totalPaid += paid;
        perStudentMap[regId].outstanding += balance;
      }
    }

    const monthlyBreakdown = Object.entries(monthlyMap).map(([month, collected]) => ({
      month,
      collected
    }));

    const perStudent = Object.values(perStudentMap);

    return {
      totalCollected,
      totalOutstanding,
      monthlyBreakdown,
      perStudent
    };
  }

  async getReportsAnalytics(filters = {}) {
    const rooms = await HostelRoom.find().lean();
    const activeAllocationsCount = await HostelAllocation.countDocuments({ status: 'active' });
    const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
    const occupied = activeAllocationsCount;
    const vacant = Math.max(0, totalCapacity - occupied);

    const expenseQuery = {};
    if (filters.startDate || filters.endDate) {
      expenseQuery.date = {};
      if (filters.startDate) expenseQuery.date.$gte = filters.startDate;
      if (filters.endDate) expenseQuery.date.$lte = filters.endDate;
    }
    const expenses = await HostelExpense.find(expenseQuery);
    const expensesMap = {};
    for (const exp of expenses) {
      const d = new Date(exp.date);
      const bucket = Number.isNaN(d.getTime()) ? exp.date : `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      expensesMap[bucket] = (expensesMap[bucket] || 0) + (exp.amount || 0);
    }
    const expensesSeries = Object.entries(expensesMap).map(([bucket, amount]) => ({ bucket, amount }));

    const challanQuery = {};
    if (filters.startDate || filters.endDate) {
      challanQuery.createdAt = {};
      if (filters.startDate) challanQuery.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) challanQuery.createdAt.$lte = new Date(filters.endDate);
    }
    const challans = await HostelChallan.find(challanQuery);
    const collectionMap = {};
    for (const c of challans) {
      const month = c.month || (c.createdAt ? new Date(c.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'Unknown');
      collectionMap[month] = (collectionMap[month] || 0) + (c.paidAmount || 0);
    }
    const collectionSeries = Object.entries(collectionMap).map(([month, collected]) => ({ month, collected }));

    return {
      occupancy: { occupied, vacant },
      expensesSeries,
      collectionSeries
    };
  }
}

module.exports = new HostelService();
