const mongoose = require('mongoose');
const {
  FeeHead,
  FeeStructure,
  FeeChallan,
  ExtraChallan,
  StudentCreditLedger,
  FeePaymentReceipt,
  FeeSettings,
  InstituteSettings,
  Student,
  Wallet,
  WalletTransaction,
  User,
  Class,
  Program,
  Section,
  HostelChallan,
  AcademicSession
} = require('../models');

class FeeService {
  // Fee Heads
  async getHeads() {
    return FeeHead.find().sort({ name: 1 });
  }

  async createHead(data) {
    return FeeHead.create(data);
  }

  async updateHead(id, data) {
    return FeeHead.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteHead(id) {
    return FeeHead.findByIdAndDelete(id);
  }

  // Fee Structures
  async getStructures() {
    return FeeStructure.find()
      .populate('programId')
      .populate('classId')
      .populate('feeHeads.headId')
      .sort({ createdAt: -1 });
  }

  async createStructure(data) {
    return FeeStructure.create(data);
  }

  async updateStructure(id, data) {
    return FeeStructure.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteStructure(id) {
    return FeeStructure.findByIdAndDelete(id);
  }

  // Challans / Installments
  async getChallans(filters = {}) {
    const query = {};
    if (filters.studentId) query.studentId = filters.studentId;

    if (filters.sessionId && filters.sessionId !== 'all') {
      query.sessionId = filters.sessionId;
    }

    if (filters.status && filters.status !== 'all') {
      const statuses = filters.status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query.status = { $regex: new RegExp(`^${statuses[0]}$`, 'i') };
      } else if (statuses.length > 1) {
        query.status = { $in: statuses.map(s => new RegExp(`^${s}$`, 'i')) };
      }
    }

    if (filters.month && filters.month !== 'all') {
      query.month = { $regex: new RegExp(`^${filters.month}$`, 'i') };
    }

    if (filters.installmentNumber && filters.installmentNumber !== 'all') {
      query.installmentNumber = Number(filters.installmentNumber);
    }

    if (filters.year && filters.year !== 'all') {
      const yr = Number(filters.year);
      if (!isNaN(yr)) {
        const startOfYear = new Date(yr, 0, 1);
        const endOfYear = new Date(yr, 11, 31, 23, 59, 59, 999);
        query.dueDate = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    if (filters.search) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      const matchingStudents = await Student.find({
        $or: [
          { fName: searchRegex },
          { lName: searchRegex },
          { rollNumber: searchRegex }
        ]
      }).select('_id').lean();

      const matchingStudentIds = matchingStudents.map(s => s._id);

      query.$or = [
        { challanNo: searchRegex },
        { studentId: { $in: matchingStudentIds } }
      ];
    }

    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.max(1, parseInt(filters.limit) || 10);
    const skip = (page - 1) * limit;

    const total = await FeeChallan.countDocuments(query);
    const challans = await FeeChallan.find(query)
      .populate({
        path: 'studentId',
        populate: [
          { path: 'programId' },
          { path: 'classId' },
          { path: 'sectionId' }
        ]
      })
      .populate('sessionId')
      .populate('classId')
      .populate('walletId')
      .populate('challanHeads.headId')
      .populate('arrearAllocations.sourceChallanId')
      .populate('supersededBy')
      .populate('supersedes')
      .sort({ createdAt: -1, dueDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const challanIds = challans.map(c => c._id);
    const challanNos = challans.map(c => c.challanNo).filter(Boolean);
    const reverseAllocChallans = await FeeChallan.find({
      'arrearAllocations.sourceChallanId': { $in: challanIds }
    }).select('_id challanNo arrearAllocations').lean();

    const reverseArrearMap = {};
    for (const rc of reverseAllocChallans) {
      if (Array.isArray(rc.arrearAllocations)) {
        for (const alloc of rc.arrearAllocations) {
          if (alloc.sourceChallanId) {
            const sId = alloc.sourceChallanId.toString();
            if (!reverseArrearMap[sId]) {
              reverseArrearMap[sId] = {
                settledAmount: 0,
                challanNos: [],
                challanIds: []
              };
            }
            reverseArrearMap[sId].settledAmount += Number(alloc.amountSettled || 0);
            if (rc.challanNo && !reverseArrearMap[sId].challanNos.includes(rc.challanNo)) {
              reverseArrearMap[sId].challanNos.push(rc.challanNo);
              reverseArrearMap[sId].challanIds.push(rc._id.toString());
            }
          }
        }
      }
    }

    // Advance Payment & Credit Provenance Linking
    const relatedCreditLedgers = await StudentCreditLedger.find({
      $or: [
        { sourceChallanId: { $in: challanIds } },
        { sourceChallanNo: { $in: challanNos } },
        { 'allocations.targetChallanId': { $in: challanIds } },
        { 'allocations.targetChallanNo': { $in: challanNos } }
      ]
    }).lean();

    const allRefIds = new Set();
    const allRefNos = new Set();
    for (const cl of relatedCreditLedgers) {
      if (cl.sourceChallanId) allRefIds.add(cl.sourceChallanId.toString());
      if (cl.sourceChallanNo) allRefNos.add(cl.sourceChallanNo);
      for (const a of cl.allocations || []) {
        if (a.targetChallanId) allRefIds.add(a.targetChallanId.toString());
        if (a.targetChallanNo) allRefNos.add(a.targetChallanNo);
      }
    }

    const refChallans = (allRefIds.size > 0 || allRefNos.size > 0)
      ? await FeeChallan.find({
          $or: [
            ...(allRefIds.size > 0 ? [{ _id: { $in: Array.from(allRefIds) } }] : []),
            ...(allRefNos.size > 0 ? [{ challanNo: { $in: Array.from(allRefNos) } }] : [])
          ]
        }).select('_id challanNo month installmentNumber').lean()
      : [];

    const metaLookup = {};
    for (const rc of refChallans) {
      const info = {
        month: rc.month || (rc.installmentNumber ? `Inst #${rc.installmentNumber}` : ''),
        challanNo: rc.challanNo
      };
      if (rc._id) metaLookup[rc._id.toString()] = info;
      if (rc.challanNo) metaLookup[rc.challanNo] = info;
    }

    const sourceCreditMap = {};
    const targetCreditMap = {};

    for (const cl of relatedCreditLedgers) {
      const sId = cl.sourceChallanId ? cl.sourceChallanId.toString() : null;
      const sNo = cl.sourceChallanNo || (sId ? metaLookup[sId]?.challanNo : null);
      const sMonth = (sId && metaLookup[sId]?.month) || (sNo && metaLookup[sNo]?.month) || '';

      const sKeys = [sId, sNo].filter(Boolean);
      for (const k of sKeys) {
        if (!sourceCreditMap[k]) {
          sourceCreditMap[k] = {
            totalCreditCreated: 0,
            remainingCredit: 0,
            adjustedTo: []
          };
        }
        sourceCreditMap[k].totalCreditCreated += Number(cl.amount || 0);
        sourceCreditMap[k].remainingCredit += Number(cl.remainingAmount || 0);

        for (const a of cl.allocations || []) {
          const tId = a.targetChallanId ? a.targetChallanId.toString() : null;
          const tNo = a.targetChallanNo || (tId ? metaLookup[tId]?.challanNo : '');
          const tMonth = (tId && metaLookup[tId]?.month) || (tNo && metaLookup[tNo]?.month) || '';
          sourceCreditMap[k].adjustedTo.push({
            challanId: tId,
            challanNo: tNo,
            month: tMonth,
            amount: Number(a.amountApplied || 0),
            appliedAt: a.appliedAt
          });
        }
      }

      for (const a of cl.allocations || []) {
        const tId = a.targetChallanId ? a.targetChallanId.toString() : null;
        const tNo = a.targetChallanNo;
        const tKeys = [tId, tNo].filter(Boolean);
        for (const tk of tKeys) {
          if (!targetCreditMap[tk]) {
            targetCreditMap[tk] = {
              totalAdvanceApplied: 0,
              sources: []
            };
          }
          targetCreditMap[tk].totalAdvanceApplied += Number(a.amountApplied || 0);
          targetCreditMap[tk].sources.push({
            sourceChallanId: sId,
            sourceChallanNo: sNo,
            sourceMonth: sMonth,
            amountApplied: Number(a.amountApplied || 0),
            appliedAt: a.appliedAt
          });
        }
      }
    }

    const mappedChallans = challans.map(c => {
      const student = c.studentId && typeof c.studentId === 'object' ? c.studentId : null;
      const basePayable = Number(c.basePayable ?? c.amount ?? 0);
      const headsAmount = Number(c.headsAmount ?? (Array.isArray(c.challanHeads) && c.challanHeads.length > 0
        ? c.challanHeads.reduce((s, h) => s + (Number(h.amount) || 0), 0)
        : (Array.isArray(c.selectedHeads) ? c.selectedHeads.reduce((s, h) => s + (Number(h?.amount) || 0), 0) : 0)));
      const arrearsAmount = Number(c.arrearsAmount ?? (Array.isArray(c.arrearAllocations) ? c.arrearAllocations.reduce((s, a) => s + (Number(a.amountCarriedForward) || 0), 0) : 0));
      const lateFeeAmount = Number(c.lateFeeAmount ?? c.fineAmount ?? 0);
      const discountAmount = Number(c.discountAmount ?? c.discount ?? 0);

      const sId = c._id?.toString();
      const sNo = c.challanNo;
      const srcCredit = (sId && sourceCreditMap[sId]) || (sNo && sourceCreditMap[sNo]) || null;
      const tgtCredit = (sId && targetCreditMap[sId]) || (sNo && targetCreditMap[sNo]) || null;

      const excessCreditGenerated = Number(c.excessCreditGenerated || (srcCredit ? srcCredit.totalCreditCreated : 0));
      const creditRemaining = srcCredit ? srcCredit.remainingCredit : 0;
      const creditAdjustedTo = srcCredit ? srcCredit.adjustedTo : [];

      let advanceApplied = Number(c.advanceApplied || (tgtCredit ? tgtCredit.totalAdvanceApplied : 0));
      const advanceAllocations = (Array.isArray(c.advanceAllocations) && c.advanceAllocations.length > 0)
        ? c.advanceAllocations
        : (tgtCredit ? tgtCredit.sources : []);
      const primarySource = advanceAllocations[0];
      const advanceFromChallanNo = c.advanceFromChallanNo || primarySource?.sourceChallanNo || primarySource?.challanNo || '';
      const advanceFromMonth = c.advanceFromMonth || primarySource?.sourceMonth || primarySource?.month || '';
      const advanceFromChallanId = c.advanceFromChallanId || primarySource?.sourceChallanId || primarySource?.challanId || null;

      const grossAmount = Number(c.grossAmount || (basePayable + headsAmount + arrearsAmount + lateFeeAmount));
      const calculatedNet = Math.max(0, grossAmount - discountAmount - advanceApplied);
      const netPayable = (c.netPayable != null && !isNaN(Number(c.netPayable)) && Number(c.netPayable) > 0)
        ? Number(c.netPayable)
        : (Number(c.totalAmount) || calculatedNet);
      const directPaidAmount = Number(c.paidAmount || 0);
      const revInfo = reverseArrearMap[c._id?.toString()];
      let settledViaArrearsAmount = Number(c.settledViaArrearsAmount || (revInfo ? revInfo.settledAmount : 0) || 0);
      const isSettled = c.status === 'SETTLED';
      if (isSettled && settledViaArrearsAmount === 0 && directPaidAmount < netPayable) {
        settledViaArrearsAmount = Math.max(0, netPayable - directPaidAmount);
      }
      const settledByChallanNo = c.settledByChallanNo || (revInfo?.challanNos?.length ? revInfo.challanNos.join(', ') : (c.supersededBy?.challanNo || ''));
      const settledByChallanId = c.settledByChallanId || (revInfo?.challanIds?.length ? revInfo.challanIds[0] : (c.supersededBy?._id || null));
      const totalSettledAmount = isSettled ? netPayable : (directPaidAmount + settledViaArrearsAmount);
      const remainingAmount = isSettled ? 0 : Math.max(0, netPayable - totalSettledAmount);

      return {
        ...c,
        id: c._id?.toString(),
        student,
        studentId: student?._id?.toString() || c.studentId?.toString(),
        studentClass: student?.classId || c.classId,
        studentProgram: student?.programId,
        studentSection: student?.sectionId,
        fatherName: student?.fatherOrguardian || '',
        basePayable,
        headsAmount,
        arrearsAmount,
        lateFeeAmount,
        discountAmount,
        advanceApplied,
        advanceFromChallanNo,
        advanceFromMonth,
        advanceFromChallanId,
        advanceAllocations,
        excessCreditGenerated,
        creditRemaining,
        creditAdjustedTo,
        grossAmount,
        netPayable,
        paidAmount: directPaidAmount,
        directPaidAmount,
        settledViaArrearsAmount,
        totalSettledAmount,
        settledAmount: settledViaArrearsAmount,
        settledByChallanNo,
        settledByChallanNumber: settledByChallanNo,
        settledByChallanId,
        remainingAmount,
        totalAmount: (c.totalAmount != null && Number(c.totalAmount) > 0) ? Number(c.totalAmount) : netPayable,
      };
    });

    const lastPage = Math.ceil(total / limit) || 1;

    return {
      data: mappedChallans,
      meta: {
        total,
        page,
        limit,
        lastPage,
      }
    };
  }

  async getChallanById(id) {
    if (!id) return null;
    const mongoose = require('mongoose');
    let queryId = id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const ch = await FeeChallan.findOne({ challanNo: id }).select('_id').lean();
      if (!ch) return null;
      queryId = ch._id;
    }
    const c = await FeeChallan.findById(queryId)
      .populate({
        path: 'studentId',
        populate: [
          { path: 'programId' },
          { path: 'classId' },
          { path: 'sectionId' }
        ]
      })
      .populate('sessionId')
      .populate('classId')
      .populate('walletId')
      .populate('challanHeads.headId')
      .populate('arrearAllocations.sourceChallanId')
      .populate('supersededBy')
      .populate('supersedes')
      .lean();
    if (!c) return null;

    const reverseAllocChallans = await FeeChallan.find({
      'arrearAllocations.sourceChallanId': c._id
    }).select('_id challanNo arrearAllocations').lean();

    let revSettled = 0;
    const revChallanNos = [];
    const revChallanIds = [];
    for (const rc of reverseAllocChallans) {
      if (Array.isArray(rc.arrearAllocations)) {
        for (const alloc of rc.arrearAllocations) {
          if (alloc.sourceChallanId?.toString() === c._id.toString()) {
            revSettled += Number(alloc.amountSettled || 0);
            if (rc.challanNo && !revChallanNos.includes(rc.challanNo)) {
              revChallanNos.push(rc.challanNo);
              revChallanIds.push(rc._id.toString());
            }
          }
        }
      }
    }

    const directPaidAmount = Number(c.paidAmount || 0);
    const netPayable = (c.netPayable != null && !isNaN(Number(c.netPayable)) && Number(c.netPayable) > 0)
      ? Number(c.netPayable)
      : (Number(c.totalAmount) || Number(c.amount) || 0);
    const isSettled = c.status === 'SETTLED';
    let settledViaArrearsAmount = Number(c.settledViaArrearsAmount || revSettled || 0);
    if (isSettled && settledViaArrearsAmount === 0 && directPaidAmount < netPayable) {
      settledViaArrearsAmount = Math.max(0, netPayable - directPaidAmount);
    }
    const settledByChallanNo = c.settledByChallanNo || (revChallanNos.length ? revChallanNos.join(', ') : (c.supersededBy?.challanNo || ''));
    const settledByChallanId = c.settledByChallanId || (revChallanIds.length ? revChallanIds[0] : (c.supersededBy?._id || null));
    const totalSettledAmount = isSettled ? netPayable : (directPaidAmount + settledViaArrearsAmount);

    return {
      ...c,
      id: c._id?.toString(),
      directPaidAmount,
      settledViaArrearsAmount,
      totalSettledAmount,
      settledAmount: settledViaArrearsAmount,
      settledByChallanNo,
      settledByChallanNumber: settledByChallanNo,
      settledByChallanId,
      remainingAmount: isSettled ? 0 : Math.max(0, netPayable - totalSettledAmount)
    };
  }

  async generate8DigitChallanNo() {
    let challanNo;
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 30) {
      attempts++;
      // 8-digit numeric string (10000000 to 99999999), e.g. 85404742
      challanNo = Math.floor(10000000 + Math.random() * 90000000).toString();
      const [feeMatch, extraMatch] = await Promise.all([
        FeeChallan.findOne({ challanNo }).select('_id').lean(),
        ExtraChallan.findOne({ challanNo }).select('_id').lean()
      ]);
      exists = !!(feeMatch || extraMatch);
    }
    if (exists) {
      const ts = Date.now().toString().slice(-6);
      const rnd = Math.floor(10 + Math.random() * 90).toString();
      challanNo = `${ts}${rnd}`;
    }
    return challanNo;
  }

  async createChallan(data) {
    if (!data.challanNo) {
      data.challanNo = await this.generate8DigitChallanNo();
    }
    return FeeChallan.create(data);
  }

  async updateChallan(id, data) {
    let challan = await FeeChallan.findById(id);
    if (!challan) {
      challan = await ExtraChallan.findById(id);
      if (!challan) throw new Error('Challan not found');
      if (Array.isArray(data.heads)) {
        data.heads = data.heads.map(h => {
          const candidateHeadId = (h.headId && mongoose.Types.ObjectId.isValid(h.headId))
            ? h.headId
            : (h.id && h.id !== -1 && h.id !== '-1' && mongoose.Types.ObjectId.isValid(h.id) ? h.id : null);
          return {
            headId: candidateHeadId ? new mongoose.Types.ObjectId(candidateHeadId) : undefined,
            name: h.name || h.headName || 'Fee Head',
            headName: h.headName || h.name || 'Fee Head',
            amount: Math.max(0, Number(h.amount) || 0)
          };
        });
        if (data.amount === undefined) {
          data.amount = data.heads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
        }
      }
      return ExtraChallan.findByIdAndUpdate(id, data, { new: true });
    }

    if (data.dueDate) challan.dueDate = new Date(data.dueDate);
    if (data.remarks !== undefined) challan.remarks = data.remarks;
    if (data.amount !== undefined) challan.basePayable = Math.max(0, Number(data.amount) || 0);
    if (data.discount !== undefined) {
      challan.discountAmount = Math.max(0, Number(data.discount) || 0);
      challan.discount = challan.discountAmount;
    }
    if (data.fineAmount !== undefined) {
      challan.lateFeeAmount = Math.max(0, Number(data.fineAmount) || 0);
      challan.fineAmount = challan.lateFeeAmount;
    }

    // Process fee heads (catalog heads + custom 'Other' head)
    if (Array.isArray(data.challanHeads) || Array.isArray(data.selectedHeads)) {
      const rawHeads = data.challanHeads || data.selectedHeads || [];
      const processedHeads = rawHeads.map(h => {
        const isCustom = h.isCustom === true || h.id === -1 || h.id === '-1' || h.name === 'Fine' || h.name === 'Other';
        const candidateHeadId = (h.headId && mongoose.Types.ObjectId.isValid(h.headId))
          ? h.headId
          : (h.id && h.id !== -1 && h.id !== '-1' && mongoose.Types.ObjectId.isValid(h.id) ? h.id : null);
        return {
          headId: candidateHeadId ? new mongoose.Types.ObjectId(candidateHeadId) : null,
          name: h.name || 'Fee Head',
          category: h.category || (h.type === 'tuition' ? 'monthly' : 'custom'),
          amount: Math.max(0, Number(h.amount) || 0),
          isCustom,
          appliedAt: h.appliedAt || new Date(),
        };
      });

      challan.challanHeads = processedHeads;
      challan.selectedHeads = rawHeads;
      challan.headsAmount = processedHeads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
    }

    // Recompute financials
    const base = Number(challan.basePayable ?? challan.amount ?? 0);
    const heads = Number(challan.headsAmount || 0);
    const arrears = Number(challan.arrearsAmount || 0);
    const late = Number(challan.lateFeeAmount ?? challan.fineAmount ?? 0);
    const disc = Number(challan.discountAmount ?? challan.discount ?? 0);
    const adv = Number(challan.advanceApplied || 0);

    challan.grossAmount = base + heads + arrears + late;
    challan.netPayable = Math.max(0, challan.grossAmount - disc - adv);
    challan.totalAmount = challan.netPayable;
    challan.amount = base;

    // Adjust status if needed
    const totalEffectivePaid = Number(challan.paidAmount || 0) + adv;
    if (totalEffectivePaid >= (challan.grossAmount - disc) && (challan.grossAmount - disc) > 0) {
      challan.status = 'PAID';
    } else if (totalEffectivePaid > 0) {
      challan.status = 'PARTIAL';
    }

    await challan.save();
    return challan;
  }

  async deleteChallan(id, userId) {
    const challan = await FeeChallan.findById(id);
    if (!challan) {
      return this.deleteExtraChallan(id, userId);
    }

    // 0. Reverse any wallet deductions / deposits associated with this challan
    try {
      const user = userId ? await User.findById(userId).select('name role') : null;
      const userName = user ? `${user.name} (${user.role})` : 'System';
      const challanNo = challan.challanNo || challan.challanNumber || '';
      const studentName = challan.studentName || '';
      const rollNumber = challan.rollNumber || '';

      const feeTxs = await WalletTransaction.find({
        challanId: challan._id,
        amount: { $gt: 0 },
      });

      if (feeTxs.length > 0) {
        for (const tx of feeTxs) {
          const targetWalletId = tx.destinationWallet || challan.walletId;
          if (targetWalletId) {
            const wallet = await Wallet.findById(targetWalletId);
            if (wallet) {
              const txAmt = Number(tx.amount || 0);
              wallet.currentBalance = (Number(wallet.currentBalance) || 0) - txAmt;
              await wallet.save();

              await WalletTransaction.create({
                transactionType: 'FEE',
                category: 'FEE',
                destinationWallet: wallet._id,
                amount: -Math.abs(txAmt),
                date: new Date().toISOString().split('T')[0],
                month: tx.month || challan.month || (challan.installmentNumber ? `Inst #${challan.installmentNumber}` : ''),
                referenceNo: `REV-${tx.referenceNo || challanNo || challan._id}`,
                challanId: challan._id,
                challanNumber: challanNo || tx.challanNumber || '',
                studentName: tx.studentName || studentName,
                rollNumber: tx.rollNumber || rollNumber,
                sourceCategory: 'FEE_REVERSAL',
                sourceModule: 'Fee Challan',
                paymentMode: tx.paymentMode || 'Reversal',
                description: `Reversal: Challan #${challanNo || tx.referenceNo} deleted - fee reversed from ${wallet.name}`,
                performedBy: userId || null,
                performedByName: userName,
                balanceAfterDestination: wallet.currentBalance,
                isReversal: true,
              });
            }
          }
        }
      } else if (challan.walletId && Number(challan.paidAmount || 0) > 0) {
        // Fallback: If no WalletTransaction was found but walletId and paidAmount exist
        const wallet = await Wallet.findById(challan.walletId);
        if (wallet) {
          const paidAmt = Number(challan.paidAmount || 0);
          wallet.currentBalance = (Number(wallet.currentBalance) || 0) - paidAmt;
          await wallet.save();

          await WalletTransaction.create({
            transactionType: 'FEE',
            category: 'FEE',
            destinationWallet: wallet._id,
            amount: -Math.abs(paidAmt),
            date: new Date().toISOString().split('T')[0],
            month: challan.month || (challan.installmentNumber ? `Inst #${challan.installmentNumber}` : ''),
            referenceNo: `REV-${challanNo || challan._id}`,
            challanId: challan._id,
            challanNumber: challanNo,
            studentName,
            rollNumber,
            sourceCategory: 'FEE_REVERSAL',
            sourceModule: 'Fee Challan',
            paymentMode: challan.paymentMode || 'Reversal',
            description: `Reversal: Challan #${challanNo} deleted - fee reversed from ${wallet.name}`,
            performedBy: userId || null,
            performedByName: userName,
            balanceAfterDestination: wallet.currentBalance,
            isReversal: true,
          });
        }
      }
    } catch (wErr) {
      console.error('Error reverting wallet transactions on challan delete:', wErr);
    }

    // 1. Restore provenance: any previous challans marked SUPERSEDED / SETTLED via arrears in this challan
    if (Array.isArray(challan.arrearAllocations) && challan.arrearAllocations.length > 0) {
      for (const alloc of challan.arrearAllocations) {
        if (!alloc.sourceChallanId) continue;
        const source = await FeeChallan.findById(alloc.sourceChallanId);
        if (source) {
          source.supersededBy = null;
          source.settledViaArrearsAmount = Math.max(0, (source.settledViaArrearsAmount || 0) - (alloc.amountSettled || 0));
          if (source.settledByChallanId?.toString() === challan._id.toString()) {
            source.settledByChallanId = null;
            source.settledByChallanNo = '';
          }
          // Restore status based ONLY on direct payments received on that source challan
          const directPaid = Number(source.paidAmount || 0);
          const sourceTarget = (source.netPayable != null && !isNaN(Number(source.netPayable)) && Number(source.netPayable) > 0)
            ? Number(source.netPayable)
            : (Number(source.totalAmount) || Number(source.amount) || Number(source.basePayable) || 0);
          if (directPaid >= sourceTarget && sourceTarget > 0) {
            source.status = 'PAID';
          } else if (directPaid > 0) {
            source.status = 'PARTIAL';
          } else if (source.dueDate && new Date(source.dueDate) < new Date()) {
            source.status = 'OVERDUE';
          } else {
            source.status = 'PENDING';
          }
          await source.save();

          // Sync matching installment on Student
          if (source.studentId) {
            const student = await Student.findById(source.studentId);
            if (student && Array.isArray(student.installments)) {
              const inst = student.installments.find(i =>
                (source.installmentId && i._id?.toString() === source.installmentId.toString()) ||
                (source.installmentNumber && i.installmentNumber === source.installmentNumber)
              );
              if (inst) {
                inst.status = source.status;
                await student.save();
              }
            }
          }
        }
      }
    }

    // 2. Restore Advance Credit if this challan consumed any advance credit
    if (challan.advanceApplied > 0) {
      const ledgers = await StudentCreditLedger.find({
        studentId: challan.studentId,
        'allocations.targetChallanId': challan._id
      });

      for (const ledger of ledgers) {
        const allocEntry = ledger.allocations.find(a => a.targetChallanId?.toString() === challan._id.toString());
        if (allocEntry) {
          ledger.remainingAmount += allocEntry.amountApplied;
          ledger.status = 'AVAILABLE';
          ledger.allocations = ledger.allocations.filter(a => a.targetChallanId?.toString() !== challan._id.toString());
          await ledger.save();
        }
      }
    }

    // 3. Reset challanGenerated, paidAmount, and status on Student installment for this deleted challan
    if (challan.studentId) {
      const student = await Student.findById(challan.studentId);
      if (student && Array.isArray(student.installments)) {
        const matchingInsts = student.installments.filter(i =>
          (challan.installmentId && i._id?.toString() === challan.installmentId.toString()) ||
          (challan.installmentNumber && i.installmentNumber === challan.installmentNumber) ||
          (challan.month && i.month && challan.month.trim().toLowerCase() === (challan.month || '').trim().toLowerCase())
        );

        for (const inst of matchingInsts) {
          // Check if any other non-void challan exists for this student & installment
          const otherChallans = await FeeChallan.find({
            _id: { $ne: challan._id },
            studentId: challan.studentId,
            status: { $nin: ['VOID'] },
            $or: [
              { installmentId: inst._id },
              { installmentNumber: inst.installmentNumber, session: student.session },
              { month: inst.month, session: student.session }
            ]
          });

          if (otherChallans.length === 0) {
            // Full reset so challan can be generated again
            inst.challanGenerated = false;
            inst.paidAmount = 0;
            inst.pendingAmount = inst.amount;
            inst.status = (inst.dueDate && new Date(inst.dueDate) < new Date()) ? 'OVERDUE' : 'PENDING';
          } else {
            const otherPaid = otherChallans.reduce((sum, oc) => sum + (Number(oc.paidAmount) || 0), 0);
            inst.challanGenerated = true;
            inst.paidAmount = otherPaid;
            inst.pendingAmount = Math.max(0, (inst.amount || 0) - otherPaid);
            if (otherPaid >= inst.amount) {
              inst.status = 'PAID';
            } else if (otherPaid > 0) {
              inst.status = 'PARTIAL';
            } else {
              inst.status = (inst.dueDate && new Date(inst.dueDate) < new Date()) ? 'OVERDUE' : 'PENDING';
            }
          }
        }
        await student.save();
      }
    }

    // 4. Clean up any receipts created for this challan
    await FeePaymentReceipt.deleteMany({ challanId: id });

    return FeeChallan.findByIdAndDelete(id);
  }

  async recordPayment({ challanId, id, amount, paidDate, paidBy, paymentMode, remarks, walletId, useAdvanceCredit }, userId) {
    const targetId = challanId || id;
    let challan = await FeeChallan.findById(targetId);
    let isExtra = false;
    if (!challan) {
      challan = await ExtraChallan.findById(targetId);
      if (!challan) throw new Error('Challan not found');
      isExtra = true;
    }

    const payAmount = Number(amount) || 0;
    const advanceCreditToUse = Math.max(0, Number(useAdvanceCredit) || 0);

    if (payAmount <= 0 && advanceCreditToUse <= 0) {
      throw new Error('Valid payment amount or advance credit is required');
    }

    let advanceDeducted = 0;
    // Apply requested advance credit from StudentCreditLedger if requested
    if (advanceCreditToUse > 0 && !isExtra && challan.studentId) {
      const ledgers = await StudentCreditLedger.find({
        studentId: challan.studentId,
        status: 'AVAILABLE',
        remainingAmount: { $gt: 0 }
      }).sort({ createdAt: 1 });

      let remAdvance = advanceCreditToUse;
      const advanceAllocations = [];
      for (const record of ledgers) {
        if (remAdvance <= 0) break;
        const take = Math.min(remAdvance, record.remainingAmount);
        record.remainingAmount -= take;
        record.allocations.push({
          targetChallanId: challan._id,
          targetChallanNo: challan.challanNo,
          amountApplied: take,
          appliedAt: new Date()
        });
        if (record.remainingAmount === 0) record.status = 'EXHAUSTED';
        await record.save();

        let sourceMonth = '';
        if (record.sourceChallanId) {
          const srcCh = await FeeChallan.findById(record.sourceChallanId).select('month installmentNumber').lean();
          sourceMonth = srcCh?.month || (srcCh?.installmentNumber ? `Inst #${srcCh.installmentNumber}` : '');
        }

        advanceAllocations.push({
          sourceChallanId: record.sourceChallanId,
          sourceChallanNo: record.sourceChallanNo,
          sourceMonth,
          amountApplied: take,
          appliedAt: new Date()
        });

        advanceDeducted += take;
        remAdvance -= take;
      }
      challan.advanceApplied = (challan.advanceApplied || 0) + advanceDeducted;
      if (advanceAllocations.length > 0) {
        challan.advanceAllocations = [...(challan.advanceAllocations || []), ...advanceAllocations];
        challan.advanceFromChallanNo = advanceAllocations.map(a => a.sourceChallanNo).filter(Boolean).join(', ');
        challan.advanceFromMonth = advanceAllocations[0].sourceMonth || '';
        challan.advanceFromChallanId = advanceAllocations[0].sourceChallanId || null;
      }
    }

    // Waterfall allocation: Option A (Strict FIFO)
    let remPay = payAmount;
    let allocatedToArrears = 0;
    let allocatedToLateFee = 0;
    let allocatedToHeads = 0;
    let allocatedToTuition = 0;
    let excessCredited = 0;

    if (!isExtra) {
      // 1. Oldest Arrears first
      if (Array.isArray(challan.arrearAllocations) && challan.arrearAllocations.length > 0) {
        for (const alloc of challan.arrearAllocations) {
          const needed = Math.max(0, (alloc.amountCarriedForward || 0) - (alloc.amountSettled || 0));
          if (needed > 0 && remPay > 0) {
            const settle = Math.min(needed, remPay);
            alloc.amountSettled = (alloc.amountSettled || 0) + settle;
            remPay -= settle;
            allocatedToArrears += settle;

            // Track settlement on source challan
            if (alloc.sourceChallanId && settle > 0) {
              const sourceChallan = await FeeChallan.findById(alloc.sourceChallanId);
              if (sourceChallan) {
                sourceChallan.settledViaArrearsAmount = (sourceChallan.settledViaArrearsAmount || 0) + settle;
                sourceChallan.settledByChallanId = challan._id;
                sourceChallan.settledByChallanNo = challan.challanNo;

                // If this source challan is now fully settled via arrears:
                if (alloc.amountSettled >= alloc.amountCarriedForward) {
                  sourceChallan.status = 'SETTLED';
                }
                await sourceChallan.save();

                // Update installment on Student
                if (sourceChallan.studentId) {
                  const student = await Student.findById(sourceChallan.studentId);
                  if (student && Array.isArray(student.installments)) {
                    const inst = student.installments.find(i =>
                      (sourceChallan.installmentId && i._id?.toString() === sourceChallan.installmentId.toString()) ||
                      (sourceChallan.installmentNumber && i.installmentNumber === sourceChallan.installmentNumber)
                    );
                    if (inst) {
                      if (alloc.amountSettled >= alloc.amountCarriedForward) {
                        inst.status = 'SETTLED';
                      }
                      await student.save();
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 2. Current Late Fees
      let lateDue = Math.max(0, Number(challan.lateFeeAmount ?? challan.fineAmount ?? 0));
      if (lateDue === 0 && challan.dueDate) {
        const settings = await FeeSettings.findOne();
        const ratePerDay = Number(settings?.lateFeeRatePerDay ?? 0);
        if (ratePerDay > 0) {
          const now = new Date(paidDate || Date.now());
          now.setHours(0, 0, 0, 0);
          const due = new Date(challan.dueDate);
          due.setHours(0, 0, 0, 0);
          if (now > due) {
            const diffDays = Math.floor(Math.abs(now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            lateDue = diffDays * ratePerDay;
            challan.lateFeeAmount = lateDue;
            challan.fineAmount = lateDue;
            challan.netPayable = Number(challan.netPayable || challan.totalAmount || 0) + lateDue;
            challan.totalAmount = Number(challan.totalAmount || challan.netPayable || 0) + lateDue;
          }
        }
      }
      if (lateDue > 0 && remPay > 0) {
        const lateChunk = Math.min(lateDue, remPay);
        allocatedToLateFee += lateChunk;
        remPay -= lateChunk;
      }

      // 3. Current Fee Heads
      const headsDue = Math.max(0, Number(challan.headsAmount || 0));
      if (headsDue > 0 && remPay > 0) {
        const headsChunk = Math.min(headsDue, remPay);
        allocatedToHeads += headsChunk;
        remPay -= headsChunk;
      }

      // 4. Current Base Tuition
      const tuitionDue = Math.max(0, Number(challan.basePayable ?? challan.amount ?? 0));
      if (tuitionDue > 0 && remPay > 0) {
        const tuitionChunk = Math.min(tuitionDue, remPay);
        allocatedToTuition += tuitionChunk;
        remPay -= tuitionChunk;
      }

      // 5. Excess Payment -> StudentCreditLedger
      if (remPay > 0 && challan.studentId) {
        await StudentCreditLedger.create({
          studentId: challan.studentId,
          sourceChallanId: challan._id,
          sourceChallanNo: challan.challanNo,
          amount: remPay,
          remainingAmount: remPay,
          status: 'AVAILABLE',
          notes: `Overpayment on Challan #${challan.challanNo}`,
        });
        excessCredited = remPay;
        challan.excessCreditGenerated = (challan.excessCreditGenerated || 0) + remPay;
      }
    }

    if (isExtra && (!challan.lateFeeFine || challan.lateFeeFine === 0) && challan.dueDate) {
      const settings = await FeeSettings.findOne();
      const extraRate = Number(settings?.extraChallanLateFee ?? 0);
      if (extraRate > 0) {
        const now = new Date(paidDate || Date.now());
        now.setHours(0, 0, 0, 0);
        const due = new Date(challan.dueDate);
        due.setHours(0, 0, 0, 0);
        if (now > due) {
          const diffDays = Math.floor(Math.abs(now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          const autoLate = diffDays * extraRate;
          challan.lateFeeFine = autoLate;
          challan.totalAmount = Number(challan.amount || 0) + autoLate;
        }
      }
    }

    // Update paid amount and status
    challan.paidAmount = (challan.paidAmount || 0) + payAmount;
    const targetTotal = (challan.netPayable != null && !isNaN(Number(challan.netPayable)) && Number(challan.netPayable) > 0)
      ? Number(challan.netPayable)
      : (Number(challan.totalAmount) || Number(challan.amount) || Number(challan.basePayable) || 0);
    const effectiveTotalPaid = (challan.paidAmount || 0) + (challan.advanceApplied || 0);

    if (effectiveTotalPaid >= targetTotal && targetTotal > 0) {
      challan.status = 'PAID';
    } else if (effectiveTotalPaid > 0) {
      challan.status = 'PARTIAL';
    }

    challan.paidDate = paidDate ? new Date(paidDate) : new Date();
    challan.paidBy = paidBy || paymentMode || 'Cash';
    if (remarks !== undefined) challan.remarks = remarks;

    // Update matching installment on Student
    let student = null;
    if (challan.studentId) {
      student = await Student.findById(challan.studentId);
      if (student && !isExtra && Array.isArray(student.installments)) {
        const inst = student.installments.find(i =>
          (challan.installmentId && i._id?.toString() === challan.installmentId.toString()) ||
          (challan.installmentNumber && i.installmentNumber === challan.installmentNumber)
        );
        if (inst) {
          inst.paidAmount = (inst.paidAmount || 0) + payAmount + advanceDeducted;
          if (inst.paidAmount >= inst.amount) {
            inst.status = 'PAID';
          } else if (inst.paidAmount > 0) {
            inst.status = 'PARTIAL';
          }
          await student.save();
        }
      }
    }

    // Create itemized FeePaymentReceipt
    if (!isExtra) {
      const receiptNo = `REC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      await FeePaymentReceipt.create({
        receiptNo,
        challanId: challan._id,
        studentId: challan.studentId,
        amountPaid: payAmount,
        walletId: walletId || undefined,
        paymentMode: challan.paidBy,
        paidDate: challan.paidDate,
        recordedBy: userId || null,
        allocatedToArrears,
        allocatedToLateFee,
        allocatedToHeads,
        allocatedToTuition,
        excessCredited,
        advanceCreditUsed: advanceDeducted,
        remarks: remarks || ''
      });
    }

    // Deposit to wallet if walletId provided and payAmount > 0
    if (walletId && payAmount > 0) {
      const wallet = await Wallet.findById(walletId);
      if (wallet) {
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) + payAmount;
        await wallet.save();

        const user = userId ? await User.findById(userId).select('name role') : null;
        const pDate = paidDate
          ? (typeof paidDate === 'string' ? paidDate.split('T')[0] : new Date(paidDate).toISOString().split('T')[0])
          : new Date().toISOString().split('T')[0];

        const studentName = student
          ? `${student.fName || ''} ${student.lName || ''}`.trim()
          : (challan.studentName || 'Student');
        const rollNo = student?.rollNumber || challan.rollNumber || '';
        const challanNo = challan.challanNo || challan.challanNumber || '';

        await WalletTransaction.create({
          transactionType: 'FEE',
          category: 'FEE',
          destinationWallet: wallet._id,
          amount: payAmount,
          date: pDate,
          month: challan.month || (challan.installmentNumber ? `Inst #${challan.installmentNumber}` : ''),
          referenceNo: challanNo,
          challanId: challan._id,
          challanNumber: challanNo,
          studentName,
          rollNumber: rollNo,
          paymentMode: paymentMode || paidBy || (wallet.type === 'BANK' ? 'Bank Transfer' : 'Cash'),
          description: remarks || `${isExtra ? 'Extra' : 'Tuition'} fee collection for Challan #${challanNo} (${challan.month || ''}) - ${studentName}`,
          performedBy: userId || null,
          performedByName: user ? `${user.name} (${user.role})` : 'System',
          balanceAfterDestination: wallet.currentBalance,
        });

        challan.walletId = wallet._id;
        challan.walletName = wallet.name;
      }
    }

    await challan.save();
    return challan;
  }

  // Extra Challans
  async getExtraChallans(filters = {}) {
    const query = {};
    if (filters.studentId) {
      query.studentId = filters.studentId;
    }
    if (filters.status && filters.status !== 'all') {
      query.status = { $regex: new RegExp(`^${filters.status}$`, 'i') };
    }
    if (filters.search && filters.search.trim()) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      const matchingStudents = await Student.find({
        $or: [
          { fName: searchRegex },
          { lName: searchRegex },
          { rollNumber: searchRegex }
        ]
      }).select('_id');
      const studentIds = matchingStudents.map(s => s._id);

      query.$or = [
        { challanNo: searchRegex },
        { remarks: searchRegex },
        { studentId: { $in: studentIds } }
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const total = await ExtraChallan.countDocuments(query);

    const data = await ExtraChallan.find(query)
      .populate({
        path: 'studentId',
        populate: [
          { path: 'classId', select: 'name' },
          { path: 'sectionId', select: 'name' },
          { path: 'programId', select: 'name' }
        ]
      })
      .sort({ createdAt: -1, dueDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit) || 1
      }
    };
  }

  async createExtraChallan(data) {
    if (Array.isArray(data.studentIds) && data.studentIds.length > 0) {
      const results = [];
      const students = await Student.find({ _id: { $in: data.studentIds } }).lean();

      let resolvedHeads = Array.isArray(data.heads) ? [...data.heads] : [];
      if (Array.isArray(data.feeHeadIds) && data.feeHeadIds.length > 0) {
        const foundHeads = await FeeHead.find({ _id: { $in: data.feeHeadIds } }).lean();
        for (const fh of foundHeads) {
          if (!resolvedHeads.some(h => (h.headId && h.headId.toString() === fh._id.toString()) || (h.name && h.name.toLowerCase() === fh.name.toLowerCase()) || (h.headName && h.headName.toLowerCase() === fh.name.toLowerCase()))) {
            resolvedHeads.push({
              headId: fh._id,
              name: fh.name,
              headName: fh.name,
              amount: Number(fh.amount || 0)
            });
          }
        }
      }

      const normalizedHeads = resolvedHeads.map(h => ({
        headId: h.headId || undefined,
        name: h.headName || h.name || 'Fee Head',
        amount: Number(h.amount || 0)
      })).filter(h => h.name && h.amount > 0);

      const totalAmount = data.amount !== undefined && data.amount !== null
        ? Number(data.amount)
        : normalizedHeads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);

      const effectiveDueDate = data.dueDate ? new Date(data.dueDate) : new Date();

      for (const student of students) {
        try {
          const challanNo = await this.generate8DigitChallanNo();
          const extraChallan = await ExtraChallan.create({
            studentId: student._id,
            challanNo,
            amount: totalAmount,
            dueDate: effectiveDueDate,
            heads: normalizedHeads,
            remarks: data.remarks || '',
            status: 'PENDING',
          });

          results.push({
            id: extraChallan._id.toString(),
            studentId: student._id.toString(),
            studentName: `${student.fName} ${student.lName || ''}`.trim(),
            status: 'CREATED',
            challanNumber: challanNo,
          });
        } catch (err) {
          results.push({
            studentId: student._id.toString(),
            studentName: `${student.fName} ${student.lName || ''}`.trim(),
            status: 'FAILED',
            error: err.message,
          });
        }
      }
      return results;
    }

    if (!data.challanNo) {
      data.challanNo = await this.generate8DigitChallanNo();
    }
    if (data.amount === undefined || data.amount === null) {
      if (Array.isArray(data.heads)) {
        data.amount = data.heads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
      } else {
        data.amount = 0;
      }
    }
    return ExtraChallan.create(data);
  }

  async updateExtraChallan(id, data) {
    return ExtraChallan.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteExtraChallan(id, userId) {
    const challan = await ExtraChallan.findById(id);
    if (!challan) return null;

    try {
      const user = userId ? await User.findById(userId).select('name role') : null;
      const userName = user ? `${user.name} (${user.role})` : 'System';
      const challanNo = challan.challanNo || challan.challanNumber || '';

      const feeTxs = await WalletTransaction.find({
        challanId: challan._id,
        amount: { $gt: 0 },
      });

      if (feeTxs.length > 0) {
        for (const tx of feeTxs) {
          const targetWalletId = tx.destinationWallet || challan.walletId;
          if (targetWalletId) {
            const wallet = await Wallet.findById(targetWalletId);
            if (wallet) {
              const txAmt = Number(tx.amount || 0);
              wallet.currentBalance = (Number(wallet.currentBalance) || 0) - txAmt;
              await wallet.save();

              await WalletTransaction.create({
                transactionType: 'FEE',
                category: 'FEE',
                destinationWallet: wallet._id,
                amount: -Math.abs(txAmt),
                date: new Date().toISOString().split('T')[0],
                month: tx.month || challan.month || '',
                referenceNo: `REV-${tx.referenceNo || challanNo || challan._id}`,
                challanId: challan._id,
                challanNumber: challanNo || tx.challanNumber || '',
                studentName: tx.studentName || challan.studentName || '',
                rollNumber: tx.rollNumber || challan.rollNumber || '',
                sourceCategory: 'FEE_REVERSAL',
                sourceModule: 'Extra Challan',
                paymentMode: tx.paymentMode || 'Reversal',
                description: `Reversal: Extra Challan #${challanNo || tx.referenceNo} deleted - fee reversed from ${wallet.name}`,
                performedBy: userId || null,
                performedByName: userName,
                balanceAfterDestination: wallet.currentBalance,
                isReversal: true,
              });
            }
          }
        }
      } else if (challan.walletId && Number(challan.paidAmount || 0) > 0) {
        const wallet = await Wallet.findById(challan.walletId);
        if (wallet) {
          const paidAmt = Number(challan.paidAmount || 0);
          wallet.currentBalance = (Number(wallet.currentBalance) || 0) - paidAmt;
          await wallet.save();

          await WalletTransaction.create({
            transactionType: 'FEE',
            category: 'FEE',
            destinationWallet: wallet._id,
            amount: -Math.abs(paidAmt),
            date: new Date().toISOString().split('T')[0],
            month: challan.month || '',
            referenceNo: `REV-${challanNo || challan._id}`,
            challanId: challan._id,
            challanNumber: challanNo,
            studentName: challan.studentName || '',
            rollNumber: challan.rollNumber || '',
            sourceCategory: 'FEE_REVERSAL',
            sourceModule: 'Extra Challan',
            paymentMode: challan.paymentMode || 'Reversal',
            description: `Reversal: Extra Challan #${challanNo} deleted - fee reversed from ${wallet.name}`,
            performedBy: userId || null,
            performedByName: userName,
            balanceAfterDestination: wallet.currentBalance,
            isReversal: true,
          });
        }
      }
    } catch (wErr) {
      console.error('Error reverting wallet transactions on extra challan delete:', wErr);
    }

    return ExtraChallan.findByIdAndDelete(id);
  }

  // Settings
  async getSettings() {
    let settings = await FeeSettings.findOne();
    if (!settings) {
      settings = await FeeSettings.create({});
    }
    const obj = settings.toObject();
    const rate = Number(obj.lateFeeRatePerDay ?? obj.lateFeeFinePerDay ?? 0);
    return {
      ...obj,
      lateFeeRatePerDay: rate,
      lateFeeFinePerDay: rate,
      extraChallanLateFee: Number(obj.extraChallanLateFee ?? 0),
      defaultDueDays: Number(obj.defaultDueDays ?? 10),
      challanPrefix: obj.challanPrefix || 'CH-',
      bankName: obj.bankName || 'United Bank Limited',
      accountNumber: obj.accountNumber || '',
      accountTitle: obj.accountTitle || 'Concordia College'
    };
  }

  async updateSettings(data) {
    let settings = await FeeSettings.findOne();
    const payload = { ...data };
    if (payload.lateFeeRatePerDay !== undefined) {
      payload.lateFeeRatePerDay = Number(payload.lateFeeRatePerDay) || 0;
      payload.lateFeeFinePerDay = payload.lateFeeRatePerDay;
      try {
        await InstituteSettings.findOneAndUpdate({}, { lateFeeRatePerDay: payload.lateFeeRatePerDay });
      } catch (e) {
        console.error('Failed to sync InstituteSettings lateFeeRatePerDay:', e);
      }
    } else if (payload.lateFeeFinePerDay !== undefined) {
      payload.lateFeeFinePerDay = Number(payload.lateFeeFinePerDay) || 0;
      payload.lateFeeRatePerDay = payload.lateFeeFinePerDay;
      try {
        await InstituteSettings.findOneAndUpdate({}, { lateFeeRatePerDay: payload.lateFeeFinePerDay });
      } catch (e) {
        console.error('Failed to sync InstituteSettings lateFeeRatePerDay:', e);
      }
    }
    if (payload.extraChallanLateFee !== undefined) {
      payload.extraChallanLateFee = Number(payload.extraChallanLateFee) || 0;
    }
    if (payload.defaultDueDays !== undefined) {
      payload.defaultDueDays = Number(payload.defaultDueDays) || 10;
    }

    if (!settings) {
      settings = await FeeSettings.create(payload);
    } else {
      settings = await FeeSettings.findByIdAndUpdate(settings._id, payload, { new: true });
    }
    const obj = settings.toObject();
    const rate = Number(obj.lateFeeRatePerDay ?? obj.lateFeeFinePerDay ?? 0);
    return {
      ...obj,
      lateFeeRatePerDay: rate,
      lateFeeFinePerDay: rate,
      extraChallanLateFee: Number(obj.extraChallanLateFee ?? 0),
      defaultDueDays: Number(obj.defaultDueDays ?? 10),
      challanPrefix: obj.challanPrefix || 'CH-',
      bankName: obj.bankName || 'United Bank Limited',
      accountNumber: obj.accountNumber || '',
      accountTitle: obj.accountTitle || 'Concordia College'
    };
  }

  // Reports
  _buildFeeReportFilters(filters = {}) {
    const { sessionId, type, dateFrom, dateTo, period, groupBy } = filters;
    const sessionMatch = {};
    const studentSessionMatch = {};

    if (sessionId && sessionId !== 'all') {
      try {
        const sId = new mongoose.Types.ObjectId(sessionId);
        sessionMatch.sessionId = sId;
        studentSessionMatch.$or = [
          { sessionId: sId },
          { 'academicRecords.sessionId': sId },
          { 'installments.sessionId': sId }
        ];
      } catch (e) {
        // Ignore invalid ObjectId
      }
    }

    return {
      sessionId: (sessionId && sessionId !== 'all') ? sessionId : null,
      type: type || 'all',
      dateFrom,
      dateTo,
      period: period || groupBy || 'month',
      sessionMatch,
      studentSessionMatch
    };
  }

  async getFeeReportSummary(filters = {}) {
    const { sessionId, type, dateFrom, dateTo, sessionMatch, studentSessionMatch } = this._buildFeeReportFilters(filters);

    let sessionStudentIds = [];
    if (sessionId) {
      sessionStudentIds = await Student.find(studentSessionMatch).distinct('_id').catch(() => []);
    }

    const challanFilter = {};
    if (sessionId) {
      challanFilter.$or = [
        { sessionId: sessionMatch.sessionId },
        { studentId: { $in: sessionStudentIds } }
      ];
    }

    const extraFilter = {};
    if (sessionId) {
      extraFilter.studentId = { $in: sessionStudentIds };
    }

    const hostelFilter = {};
    if (sessionId) {
      hostelFilter.$or = [
        { sessionId: sessionMatch.sessionId },
        { studentId: { $in: sessionStudentIds } }
      ];
    }

    const [challans, extraChallans, hostelChallans] = await Promise.all([
      FeeChallan.find(challanFilter).lean().catch(() => []),
      ExtraChallan.find(extraFilter).lean().catch(() => []),
      HostelChallan.find(hostelFilter).lean().catch(() => []),
    ]);

    const hasDateFilter = Boolean(dateFrom || dateTo);
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const toTime = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity;

    const matchesDate = (item) => {
      if (!hasDateFilter) return true;
      const d = item.paidDate ? new Date(item.paidDate).getTime() : (item.updatedAt ? new Date(item.updatedAt).getTime() : null);
      if (!d) return false;
      return d >= fromTime && d <= toTime;
    };

    let regularCollected = 0;
    let regularPending = 0;
    for (const c of challans) {
      if (c.status === 'VOID' || c.status === 'SUPERSEDED') continue;
      const paid = Number(c.paidAmount || 0);
      const total = Number(c.totalAmount || c.netPayable || c.amount || 0);
      if (paid > 0 && matchesDate(c)) {
        regularCollected += paid;
      }
      if (!['PAID', 'SETTLED'].includes(c.status)) {
        regularPending += Math.max(0, total - paid);
      }
    }

    let extraCollected = 0;
    let extraPending = 0;
    for (const ec of extraChallans) {
      if (ec.status === 'VOID') continue;
      const paid = Number(ec.paidAmount || 0);
      const total = Number(ec.totalAmount || ec.amount || 0);
      if (paid > 0 && matchesDate(ec)) {
        extraCollected += paid;
      }
      if (ec.status !== 'PAID') {
        extraPending += Math.max(0, total - paid);
      }
    }

    let hostelCollected = 0;
    let hostelPending = 0;
    for (const hc of hostelChallans) {
      if (hc.status === 'VOID' || hc.status === 'SUPERSEDED') continue;
      const paid = Number(hc.paidAmount || 0);
      const total = Number(hc.totalAmount || hc.amount || hc.hostelFee || 0);
      if (paid > 0 && matchesDate(hc)) {
        hostelCollected += paid;
      }
      if (!['PAID', 'SETTLED'].includes(hc.status)) {
        hostelPending += Math.max(0, total - paid);
      }
    }

    let totalRevenue = 0;
    let totalOutstanding = 0;

    if (type === 'installment') {
      totalRevenue = regularCollected;
      totalOutstanding = regularPending;
    } else if (type === 'extra') {
      totalRevenue = extraCollected;
      totalOutstanding = extraPending;
    } else {
      totalRevenue = regularCollected + extraCollected + hostelCollected;
      totalOutstanding = regularPending + extraPending + hostelPending;
    }

    const totalExpected = totalRevenue + totalOutstanding;
    const collectionRate = totalExpected > 0 ? Math.round((totalRevenue / totalExpected) * 100) : 0;

    return {
      totalRevenue,
      totalOutstanding,
      regularRevenue: regularCollected,
      extraRevenue: extraCollected,
      hostelRevenue: hostelCollected,
      installmentOutstanding: regularPending,
      extraOutstanding: extraPending,
      hostelOutstanding: hostelPending,
      collectionRate
    };
  }

  async getRevenueOverTime(filters = {}) {
    const { sessionId, sessionMatch, studentSessionMatch } = this._buildFeeReportFilters(filters);

    let sessionStudentIds = [];
    if (sessionId) {
      sessionStudentIds = await Student.find(studentSessionMatch).distinct('_id').catch(() => []);
    }

    const challanFilter = {
      status: { $in: ['PAID', 'PARTIAL', 'SETTLED'] },
      paidAmount: { $gt: 0 },
    };
    if (sessionId) {
      challanFilter.$or = [
        { sessionId: sessionMatch.sessionId },
        { studentId: { $in: sessionStudentIds } }
      ];
    }

    const extraFilter = {
      status: { $in: ['PAID', 'PARTIAL'] },
      paidAmount: { $gt: 0 },
    };
    if (sessionId) {
      extraFilter.studentId = { $in: sessionStudentIds };
    }

    const [challans, extraChallans] = await Promise.all([
      FeeChallan.find(challanFilter).select('paidAmount paidDate updatedAt createdAt').lean().catch(() => []),
      ExtraChallan.find(extraFilter).select('paidAmount paidDate updatedAt createdAt').lean().catch(() => []),
    ]);

    // Build default past 12 months map: "YYYY-MM"
    const monthMap = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = { name: key, installment: 0, extra: 0, value: 0 };
    }

    const getMonthKey = (item) => {
      const d = item.paidDate ? new Date(item.paidDate) : (item.updatedAt ? new Date(item.updatedAt) : (item.createdAt ? new Date(item.createdAt) : null));
      if (!d || isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    for (const c of challans) {
      const k = getMonthKey(c);
      if (!k) continue;
      if (!monthMap[k]) {
        monthMap[k] = { name: k, installment: 0, extra: 0, value: 0 };
      }
      const paid = Number(c.paidAmount || 0);
      monthMap[k].installment += paid;
      monthMap[k].value += paid;
    }

    for (const ec of extraChallans) {
      const k = getMonthKey(ec);
      if (!k) continue;
      if (!monthMap[k]) {
        monthMap[k] = { name: k, installment: 0, extra: 0, value: 0 };
      }
      const paid = Number(ec.paidAmount || 0);
      monthMap[k].extra += paid;
      monthMap[k].value += paid;
    }

    return Object.keys(monthMap).sort().map(k => monthMap[k]);
  }

  async getClassStats(filters = {}) {
    const { sessionId, sessionMatch, studentSessionMatch } = this._buildFeeReportFilters(filters);

    let sessionStudentFilter = {};
    if (sessionId) {
      sessionStudentFilter = studentSessionMatch;
    }

    // 1. Fetch classes with their program (Program -> Class relationship)
    const allClasses = await Class.find().populate('programId').lean().catch(() => []);

    // 2. Fetch all students matching session filter (Student belongs to classId, programId, optional sectionId)
    const students = await Student.find(sessionStudentFilter)
      .select('_id classId programId sectionId')
      .populate('programId', 'name')
      .lean()
      .catch(() => []);

    const studentIds = students.map(s => s._id);

    // Map student to classId and programName
    const studentClassMap = new Map();
    const studentProgramMap = new Map();
    for (const s of students) {
      if (s.classId) {
        studentClassMap.set(s._id.toString(), s.classId.toString());
      }
      if (s.programId?.name) {
        studentProgramMap.set(s._id.toString(), s.programId.name);
      }
    }

    // 3. Fetch FeeChallan & ExtraChallan
    const challanFilter = {
      status: { $nin: ['VOID', 'SUPERSEDED'] }
    };
    if (sessionId) {
      challanFilter.$or = [
        { sessionId: sessionMatch.sessionId },
        { studentId: { $in: studentIds } }
      ];
    }

    const extraFilter = {
      status: { $ne: 'VOID' }
    };
    if (sessionId) {
      extraFilter.studentId = { $in: studentIds };
    }

    const [challans, extraChallans] = await Promise.all([
      FeeChallan.find(challanFilter).lean().catch(() => []),
      ExtraChallan.find(extraFilter).lean().catch(() => []),
    ]);

    // 4. Map per class
    const classStatsMap = new Map();

    for (const c of allClasses) {
      const cId = c._id.toString();
      classStatsMap.set(cId, {
        classId: cId,
        className: c.name,
        programName: c.programId?.name || 'General',
        collected: 0,
        outstanding: 0,
        totalStudents: 0
      });
    }

    // Count students per class
    for (const s of students) {
      if (s.classId) {
        const cId = s.classId.toString();
        const stat = classStatsMap.get(cId);
        if (stat) {
          stat.totalStudents++;
        }
      }
    }

    // Aggregate FeeChallan amounts
    for (const c of challans) {
      const cId = (c.classId ? c.classId.toString() : null) || (c.studentId ? studentClassMap.get(c.studentId.toString()) : null);
      if (!cId) continue;

      let stat = classStatsMap.get(cId);
      if (!stat) {
        const pName = (c.studentId ? studentProgramMap.get(c.studentId.toString()) : '') || 'General';
        stat = {
          classId: cId,
          className: 'Class',
          programName: pName,
          collected: 0,
          outstanding: 0,
          totalStudents: 0
        };
        classStatsMap.set(cId, stat);
      }

      const paid = Number(c.paidAmount || 0);
      const total = Number(c.totalAmount || c.netPayable || c.amount || 0);
      stat.collected += paid;

      if (!['PAID', 'SETTLED'].includes(c.status)) {
        stat.outstanding += Math.max(0, total - paid);
      }
    }

    // Aggregate ExtraChallan amounts
    for (const ec of extraChallans) {
      const cId = ec.studentId ? studentClassMap.get(ec.studentId.toString()) : null;
      if (!cId) continue;

      let stat = classStatsMap.get(cId);
      if (!stat) {
        const pName = (ec.studentId ? studentProgramMap.get(ec.studentId.toString()) : '') || 'General';
        stat = {
          classId: cId,
          className: 'Class',
          programName: pName,
          collected: 0,
          outstanding: 0,
          totalStudents: 0
        };
        classStatsMap.set(cId, stat);
      }

      const paid = Number(ec.paidAmount || 0);
      const total = Number(ec.totalAmount || ec.amount || 0);
      stat.collected += paid;

      if (ec.status !== 'PAID') {
        stat.outstanding += Math.max(0, total - paid);
      }
    }

    return Array.from(classStatsMap.values()).map(item => ({
      ...item,
      collected: Math.round(item.collected),
      outstanding: Math.round(item.outstanding)
    }));
  }

  async getFeeReportsAnalytics(filters = {}) {
    const [summary, timeline, classComparison] = await Promise.all([
      this.getFeeReportSummary(filters),
      this.getRevenueOverTime(filters),
      this.getClassStats(filters),
    ]);

    return {
      summary,
      timeline,
      classComparison,
      // Backward compatibility fields
      totalCollected: summary.totalRevenue,
      totalPending: summary.totalOutstanding,
      recentChallans: await FeeChallan.find().sort({ createdAt: -1 }).limit(10).lean().catch(() => [])
    };
  }

  async getAnalytics(filters = {}) {
    return this.getFeeReportsAnalytics(filters);
  }

  // Installment Plans & Bulk Challans
  async getInstallmentPlans(filters = {}) {
    const query = { status: { $regex: /^active$/i } };
    if (filters.studentId) {
      query._id = filters.studentId;
    }
    if (filters.programId && filters.programId !== 'all') {
      query.programId = filters.programId;
    }
    if (filters.classId && filters.classId !== 'all') {
      query.classId = filters.classId;
    }
    if (filters.sectionId && filters.sectionId !== 'all') {
      query.sectionId = filters.sectionId;
    }
    if (filters.sessionId && filters.sessionId !== 'all') {
      query.sessionId = filters.sessionId;
    }

    const students = await Student.find(query)
      .populate('programId')
      .populate('classId')
      .populate('sectionId')
      .populate('sessionId')
      .sort({ rollNumber: 1 })
      .lean();

    const studentIds = students.map(s => s._id);
    const [challans, creditLedgers] = await Promise.all([
      FeeChallan.find({ studentId: { $in: studentIds } }).lean(),
      StudentCreditLedger.find({
        studentId: { $in: studentIds },
        status: 'AVAILABLE',
        remainingAmount: { $gt: 0 }
      }).lean()
    ]);

    return students.map(s => {
      const studentChallans = challans.filter(c => c.studentId?.toString() === s._id.toString());
      const studentCredits = creditLedgers.filter(cl => cl.studentId?.toString() === s._id.toString());
      const availableAdvanceCredit = studentCredits.reduce((sum, cl) => sum + (Number(cl.remainingAmount) || 0), 0);

      const studentClassObj = s.classId ? {
        id: s.classId._id?.toString(),
        name: s.classId.name,
        year: s.classId.year,
        semester: s.classId.semester,
        allowSections: s.classId.allowSections
      } : null;

      const installments = (s.installments || []).map(inst => {
        const matchingChallans = studentChallans.filter(c => 
          c.status !== 'VOID' &&
          ((c.installmentNumber && c.installmentNumber === inst.installmentNumber) ||
          (c.installmentId && c.installmentId.toString() === inst._id?.toString()) ||
          (c.month && inst.month && c.month.toLowerCase() === inst.month.toLowerCase()))
        );

        const isPaid = matchingChallans.some(c => c.status === 'PAID');
        const hasChallan = matchingChallans.length > 0;

        return {
          ...inst,
          class: studentClassObj,
          classId: inst.classId || s.classId?._id,
          programId: inst.programId || s.programId?._id,
          challans: matchingChallans,
          challanGenerated: hasChallan || false,
          status: hasChallan 
            ? (isPaid ? 'PAID' : (matchingChallans[0]?.status || 'PENDING')) 
            : (Number(inst.paidAmount || 0) > 0 ? (inst.paidAmount >= inst.amount ? 'PAID' : 'PARTIAL') : 'PENDING')
        };
      });

      return {
        ...s,
        id: s._id.toString(),
        class: studentClassObj,
        program: s.programId ? { id: s.programId._id?.toString(), name: s.programId.name } : null,
        section: s.sectionId ? { id: s.sectionId._id?.toString(), name: s.sectionId.name } : null,
        installments,
        feeInstallments: installments,
        challans: studentChallans,
        availableAdvanceCredit,
        creditDetails: studentCredits
      };
    });
  }

  async bulkGenerateChallans({ studentIds = [], month, dueDate, sessionId }) {
    const results = [];
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return { results };
    }

    const [selYear, selMonthNum] = (month || '').split('-').map(Number);
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const monthName = selMonthNum ? monthNames[selMonthNum - 1] : '';

    const students = await Student.find({ _id: { $in: studentIds } })
      .populate('classId')
      .populate('programId')
      .populate('sectionId');

    for (const student of students) {
      try {
        let matchingInst = (student.installments || []).find(inst => {
          const mMatch = monthName && (inst.month || '').trim().toLowerCase() === monthName.toLowerCase();
          const yMatch = inst.dueDate ? new Date(inst.dueDate).getFullYear() === selYear : true;
          return mMatch && yMatch;
        });

        if (!matchingInst && (student.installments || []).length > 0) {
          matchingInst = student.installments.find(inst =>
            monthName && (inst.month || '').trim().toLowerCase() === monthName.toLowerCase()
          );
        }

        if (!matchingInst) {
          results.push({
            studentId: student._id.toString(),
            studentName: `${student.fName} ${student.lName || ''}`.trim(),
            status: 'BLOCKED',
            reason: `No installment scheduled for ${monthName || month} in student plan`
          });
          continue;
        }

        const installmentNumber = matchingInst.installmentNumber || 1;
        const basePayable = matchingInst.amount || matchingInst.basePayable || student.tuitionFee || 0;
        const effectiveDueDate = dueDate ? new Date(dueDate) : (matchingInst.dueDate || new Date());

        const existing = await FeeChallan.findOne({
          studentId: student._id,
          status: { $ne: 'VOID' },
          $or: [
            { installmentNumber, session: student.session },
            { month: monthName || month, session: student.session },
            { installmentId: matchingInst._id }
          ]
        });

        if (existing) {
          results.push({
            studentId: student._id.toString(),
            studentName: `${student.fName} ${student.lName || ''}`.trim(),
            status: 'ALREADY_EXISTS',
            reason: `Challan ${existing.challanNo} already exists for ${monthName || month}`,
            challanNumber: existing.challanNo,
            challan: existing
          });
          continue;
        }

        // 1. Traceable Arrears (N-level chains across prior unpaid installments)
        const priorUnpaidChallans = await FeeChallan.find({
          studentId: student._id,
          status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        }).sort({ dueDate: 1, installmentNumber: 1, createdAt: 1 });

        const eligiblePriors = priorUnpaidChallans.filter(p =>
          (p.month || '').trim().toLowerCase() !== (monthName || '').trim().toLowerCase() &&
          (p.installmentNumber < installmentNumber || (p.dueDate && new Date(p.dueDate) < effectiveDueDate))
        );

        let totalArrears = 0;
        const arrearAllocations = [];
        const supersededChallanIds = [];

        for (const prev of eligiblePriors) {
          const prevTarget = (prev.netPayable != null && !isNaN(Number(prev.netPayable)) && Number(prev.netPayable) > 0)
            ? Number(prev.netPayable)
            : (Number(prev.totalAmount) || Number(prev.amount) || Number(prev.basePayable) || 0);
          const prevPaid = Number(prev.paidAmount || 0);
          const prevRem = Math.max(0, prevTarget - prevPaid);
          if (prevRem > 0) {
            totalArrears += prevRem;
            arrearAllocations.push({
              sourceChallanId: prev._id,
              sourceChallanNo: prev.challanNo,
              sourceInstallmentNumber: prev.installmentNumber,
              sourceMonth: prev.month,
              originalDueAmount: prevTarget,
              amountCarriedForward: prevRem,
              amountSettled: 0
            });
            supersededChallanIds.push(prev._id);
          }
        }

        // Check also for prior installments on student that were never generated into challans and are unpaid
        const priorUnbilledInsts = (student.installments || []).filter(inst => {
          if (inst.installmentNumber >= installmentNumber) return false;
          if (inst.month && monthName && inst.month.trim().toLowerCase() === monthName.trim().toLowerCase()) return false;
          const isPaid = ['PAID', 'SETTLED', 'SUPERSEDED'].includes(inst.status);
          const hasChallan = priorUnpaidChallans.some(c =>
            (c.installmentNumber && c.installmentNumber === inst.installmentNumber) ||
            (c.installmentId && c.installmentId.toString() === inst._id?.toString()) ||
            (c.month && inst.month && c.month.toLowerCase() === inst.month.toLowerCase())
          );
          return !isPaid && !hasChallan;
        });

        for (const unbilled of priorUnbilledInsts) {
          const unbilledTarget = Number(unbilled.pendingAmount ?? unbilled.amount ?? unbilled.basePayable ?? 0);
          const unbilledPaid = Number(unbilled.paidAmount || 0);
          const unbilledRem = Math.max(0, unbilledTarget - unbilledPaid);
          if (unbilledRem > 0) {
            totalArrears += unbilledRem;
            arrearAllocations.push({
              sourceInstallmentNumber: unbilled.installmentNumber,
              sourceMonth: unbilled.month,
              originalDueAmount: unbilledTarget,
              amountCarriedForward: unbilledRem,
              amountSettled: 0
            });
            unbilled.status = 'SUPERSEDED';
          }
        }

        // 2. Advance Payments Auto-Application from StudentCreditLedger
        const creditRecords = await StudentCreditLedger.find({
          studentId: student._id,
          status: 'AVAILABLE',
          remainingAmount: { $gt: 0 }
        }).sort({ createdAt: 1 });

        const totalAvailableCredit = creditRecords.reduce((sum, r) => sum + (Number(r.remainingAmount) || 0), 0);
        const grossAmount = basePayable + totalArrears;
        const advanceToApply = Math.min(grossAmount, totalAvailableCredit);
        const netPayable = Math.max(0, grossAmount - advanceToApply);
        const isFullyPaidByAdvance = (netPayable === 0 && advanceToApply > 0);

        const challanNo = await this.generate8DigitChallanNo();

        const createdChallan = await FeeChallan.create({
          studentId: student._id,
          challanNo,
          installmentNumber,
          amount: basePayable,
          basePayable,
          arrearsAmount: totalArrears,
          grossAmount,
          advanceApplied: advanceToApply,
          netPayable,
          totalAmount: netPayable,
          dueDate: effectiveDueDate,
          month: monthName || month,
          session: student.session || '',
          sessionId: (sessionId && sessionId !== 'all') ? sessionId : student.sessionId,
          classId: student.classId?._id || student.classId,
          installmentId: matchingInst._id,
          arrearAllocations,
          supersedes: supersededChallanIds,
          status: isFullyPaidByAdvance ? 'PAID' : 'PENDING',
          paidAmount: isFullyPaidByAdvance ? advanceToApply : 0,
          paidDate: isFullyPaidByAdvance ? new Date() : undefined,
          paidBy: isFullyPaidByAdvance ? 'Advance Credit' : 'Cash'
        });

        // 3. Mark prior challans as SUPERSEDED
        if (supersededChallanIds.length > 0) {
          await FeeChallan.updateMany(
            { _id: { $in: supersededChallanIds } },
            { $set: { status: 'SUPERSEDED', supersededBy: createdChallan._id } }
          );

          if (Array.isArray(student.installments)) {
            for (const prevId of supersededChallanIds) {
              const prevChallan = eligiblePriors.find(p => p._id.toString() === prevId.toString());
              if (prevChallan) {
                const prevInst = student.installments.find(i =>
                  (prevChallan.installmentId && i._id?.toString() === prevChallan.installmentId.toString()) ||
                  (prevChallan.installmentNumber && i.installmentNumber === prevChallan.installmentNumber) ||
                  (prevChallan.month && i.month && prevChallan.month.toLowerCase() === i.month.toLowerCase())
                );
                if (prevInst) {
                  prevInst.status = 'SUPERSEDED';
                }
              }
            }
          }
        }

        // 4. Deduct credit from StudentCreditLedger
        if (advanceToApply > 0) {
          let remToDeduct = advanceToApply;
          const advanceAllocations = [];
          for (const record of creditRecords) {
            if (remToDeduct <= 0) break;
            const take = Math.min(remToDeduct, record.remainingAmount);
            record.remainingAmount -= take;
            record.allocations.push({
              targetChallanId: createdChallan._id,
              targetChallanNo: createdChallan.challanNo,
              amountApplied: take,
              appliedAt: new Date()
            });
            if (record.remainingAmount === 0) {
              record.status = 'EXHAUSTED';
            }
            await record.save();

            let sourceMonth = '';
            if (record.sourceChallanId) {
              const srcCh = await FeeChallan.findById(record.sourceChallanId).select('month installmentNumber').lean();
              sourceMonth = srcCh?.month || (srcCh?.installmentNumber ? `Inst #${srcCh.installmentNumber}` : '');
            }

            advanceAllocations.push({
              sourceChallanId: record.sourceChallanId,
              sourceChallanNo: record.sourceChallanNo,
              sourceMonth,
              amountApplied: take,
              appliedAt: new Date()
            });

            remToDeduct -= take;
          }

          createdChallan.advanceAllocations = advanceAllocations;
          if (advanceAllocations.length > 0) {
            createdChallan.advanceFromChallanNo = advanceAllocations.map(a => a.sourceChallanNo).filter(Boolean).join(', ');
            createdChallan.advanceFromMonth = advanceAllocations[0].sourceMonth || '';
            createdChallan.advanceFromChallanId = advanceAllocations[0].sourceChallanId || null;
          }
          await createdChallan.save();
        }

        // 5. Update matching installment on Student
        if (matchingInst) {
          matchingInst.challanGenerated = true;
          if (isFullyPaidByAdvance) {
            matchingInst.status = 'PAID';
            matchingInst.paidAmount = advanceToApply;
          }
          await student.save();
        }

        results.push({
          studentId: student._id.toString(),
          studentName: `${student.fName} ${student.lName || ''}`.trim(),
          status: 'CREATED',
          challanNumber: challanNo,
          challan: createdChallan
        });
      } catch (err) {
        results.push({
          studentId: student._id.toString(),
          studentName: `${student.fName} ${student.lName || ''}`.trim(),
          status: 'BLOCKED',
          reason: err.message || 'Failed to generate challan'
        });
      }
    }

    return { results };
  }

  // Student Advance Credit Ledger
  async getStudentCreditBalance(studentId) {
    if (!studentId) return { availableCredit: 0, records: [] };
    const ledgers = await StudentCreditLedger.find({
      studentId,
      status: 'AVAILABLE',
      remainingAmount: { $gt: 0 }
    }).sort({ createdAt: 1 });

    const totalAvailableCredit = ledgers.reduce((sum, item) => sum + (Number(item.remainingAmount) || 0), 0);
    return {
      studentId,
      availableCredit: totalAvailableCredit,
      records: ledgers
    };
  }

  // Payment Receipts
  async getChallanReceipts(challanId) {
    if (!challanId) return [];
    return FeePaymentReceipt.find({ challanId })
      .populate('recordedBy', 'name role')
      .populate('walletId', 'name type')
      .sort({ createdAt: -1 });
  }

  // Student Installments with Linked Challans and Payment Transactions
  async getStudentInstallments(studentId) {
    if (!studentId) return [];

    const student = await Student.findById(studentId)
      .populate('programId')
      .populate('classId')
      .populate('sectionId')
      .populate('sessionId')
      .lean();

    if (!student) return [];

    const challans = await FeeChallan.find({ studentId })
      .populate('sessionId')
      .populate('classId')
      .populate('walletId')
      .populate('challanHeads.headId')
      .populate('arrearAllocations.sourceChallanId')
      .sort({ createdAt: 1, installmentNumber: 1 })
      .lean();

    const challanIds = challans.map(c => c._id);
    const [receipts, reverseAllocChallans] = await Promise.all([
      FeePaymentReceipt.find({
        $or: [
          { studentId },
          { challanId: { $in: challanIds } }
        ]
      })
        .populate('walletId', 'name type')
        .populate('recordedBy', 'name role')
        .sort({ paidDate: 1, createdAt: 1 })
        .lean(),
      FeeChallan.find({
        'arrearAllocations.sourceChallanId': { $in: challanIds }
      }).select('_id challanNo arrearAllocations').lean()
    ]);

    const reverseArrearMap = {};
    for (const rc of reverseAllocChallans) {
      if (Array.isArray(rc.arrearAllocations)) {
        for (const alloc of rc.arrearAllocations) {
          if (alloc.sourceChallanId) {
            const sId = alloc.sourceChallanId.toString();
            if (!reverseArrearMap[sId]) {
              reverseArrearMap[sId] = {
                settledAmount: 0,
                challanNos: [],
                challanIds: []
              };
            }
            reverseArrearMap[sId].settledAmount += Number(alloc.amountSettled || 0);
            if (rc.challanNo && !reverseArrearMap[sId].challanNos.includes(rc.challanNo)) {
              reverseArrearMap[sId].challanNos.push(rc.challanNo);
              reverseArrearMap[sId].challanIds.push(rc._id.toString());
            }
          }
        }
      }
    }

    const receiptsByChallan = {};
    for (const r of receipts) {
      const cId = r.challanId?.toString();
      if (cId) {
        if (!receiptsByChallan[cId]) receiptsByChallan[cId] = [];
        receiptsByChallan[cId].push({
          id: r._id?.toString(),
          receiptNo: r.receiptNo,
          challanId: cId,
          amountPaid: Number(r.amountPaid || 0),
          walletId: r.walletId?._id?.toString() || r.walletId?.toString(),
          walletName: r.walletId?.name || '',
          walletType: r.walletId?.type || '',
          paymentMode: r.paymentMode || 'Cash',
          paidDate: r.paidDate || r.createdAt,
          recordedBy: r.recordedBy ? {
            id: r.recordedBy._id?.toString(),
            name: r.recordedBy.name,
            role: r.recordedBy.role
          } : null,
          allocatedToArrears: Number(r.allocatedToArrears || 0),
          allocatedToLateFee: Number(r.allocatedToLateFee || 0),
          allocatedToHeads: Number(r.allocatedToHeads || 0),
          allocatedToTuition: Number(r.allocatedToTuition || 0),
          excessCredited: Number(r.excessCredited || 0),
          advanceCreditUsed: Number(r.advanceCreditUsed || 0),
          remarks: r.remarks || ''
        });
      }
    }

    const mappedChallans = challans.map(c => {
      const cId = c._id.toString();
      let txs = receiptsByChallan[cId] || [];

      const baseAmount = Number(c.basePayable ?? c.amount ?? 0);
      const arrearsAmount = Number(c.arrearsAmount ?? (Array.isArray(c.arrearAllocations) ? c.arrearAllocations.reduce((s, a) => s + (Number(a.amountCarriedForward) || 0), 0) : 0));
      const lateFeeAmount = Number(c.lateFeeAmount ?? c.fineAmount ?? 0);
      const discountAmount = Number(c.discountAmount ?? c.discount ?? 0);
      const totalAmount = Number(c.totalAmount ?? c.netPayable ?? c.grossAmount ?? c.amount ?? 0);
      const paidAmount = Number(c.paidAmount ?? 0);

      const revInfo = reverseArrearMap[cId];
      let settledViaArrearsAmount = Number(c.settledViaArrearsAmount || (revInfo ? revInfo.settledAmount : 0) || 0);
      const isSettled = c.status === 'SETTLED';
      if (isSettled && settledViaArrearsAmount === 0 && paidAmount < totalAmount) {
        settledViaArrearsAmount = Math.max(0, totalAmount - paidAmount);
      }
      const settledByChallanNo = c.settledByChallanNo || (revInfo?.challanNos?.length ? revInfo.challanNos.join(', ') : (c.supersededBy?.challanNo || ''));
      const settledByChallanId = c.settledByChallanId || (revInfo?.challanIds?.length ? revInfo.challanIds[0] : (c.supersededBy?._id || null));
      const totalSettledAmount = isSettled ? totalAmount : (paidAmount + settledViaArrearsAmount);
      const remainingAmount = isSettled ? 0 : Math.max(0, totalAmount - totalSettledAmount);

      // Fallback synthetic transaction if paidAmount > 0 but no receipts were logged
      if (txs.length === 0 && paidAmount > 0) {
        txs = [{
          id: `synth-${cId}`,
          receiptNo: `REC-${c.challanNo || cId.slice(-6)}`,
          challanId: cId,
          amountPaid: paidAmount,
          walletId: c.walletId?._id?.toString() || c.walletId?.toString() || '',
          walletName: c.walletName || c.walletId?.name || '',
          paymentMode: c.paidBy || 'Cash',
          paidDate: c.paidDate || c.updatedAt || c.createdAt,
          recordedBy: null,
          allocatedToArrears: Number(c.settledViaArrearsAmount || 0),
          allocatedToLateFee: Number(c.lateFeeAmount || c.fineAmount || 0),
          allocatedToHeads: Number(c.headsAmount || 0),
          allocatedToTuition: Math.max(0, paidAmount - Number(c.headsAmount || 0) - Number(c.lateFeeAmount || c.fineAmount || 0)),
          excessCredited: Number(c.excessCreditGenerated || 0),
          advanceCreditUsed: Number(c.advanceApplied || 0),
          remarks: c.remarks || 'Payment'
        }];
      }

      // If settled via arrears, append an explicit arrears settlement transaction entry
      if (settledViaArrearsAmount > 0) {
        txs.push({
          id: `settle-arr-${cId}`,
          receiptNo: `SETTLED-ARR`,
          challanId: cId,
          amountPaid: settledViaArrearsAmount,
          walletId: '',
          walletName: settledByChallanNo ? `Settled via Challan ${settledByChallanNo}` : 'Settled via Arrears',
          paymentMode: 'Arrears Settlement',
          paidDate: c.paidDate || c.updatedAt || c.createdAt,
          recordedBy: null,
          allocatedToArrears: settledViaArrearsAmount,
          allocatedToLateFee: 0,
          allocatedToHeads: 0,
          allocatedToTuition: 0,
          excessCredited: 0,
          advanceCreditUsed: 0,
          settledViaArrears: settledViaArrearsAmount,
          settledByChallanNo,
          isArrearsSettlement: true,
          remarks: settledByChallanNo ? `Settled via Arrears carried forward to ${settledByChallanNo}` : 'Settled via Arrears carry forward'
        });
      }

      return {
        id: cId,
        _id: cId,
        challanNumber: c.challanNo,
        challanNo: c.challanNo,
        installmentNumber: c.installmentNumber,
        installmentId: c.installmentId?.toString(),
        month: c.month,
        session: c.session || c.sessionId?.name,
        sessionId: c.sessionId?._id || c.sessionId,
        generatedDate: c.createdAt,
        createdAt: c.createdAt,
        dueDate: c.dueDate,
        paidDate: c.paidDate,
        paidTime: c.paidTime,
        paidBy: c.paidBy,
        status: c.status,
        snapshotBaseAmount: baseAmount,
        basePayable: baseAmount,
        snapshotArrearsAmount: arrearsAmount,
        arrearsAmount: arrearsAmount,
        snapshotLateFee: lateFeeAmount,
        lateFeeAmount: lateFeeAmount,
        fineAmount: lateFeeAmount,
        discountAmount: discountAmount,
        discount: discountAmount,
        advanceApplied: Number(c.advanceApplied || 0),
        snapshotTotalDue: totalAmount,
        totalDue: totalAmount,
        totalAmount: totalAmount,
        amountReceived: paidAmount,
        paidAmount: paidAmount,
        settledViaArrearsAmount,
        settledAmount: settledViaArrearsAmount,
        settledByChallanNo,
        settledByChallanId,
        totalSettledAmount,
        isSettledViaArrears: settledViaArrearsAmount > 0,
        remainingAmount: remainingAmount,
        heads: c.challanHeads || [],
        headsAmount: Number(c.headsAmount || 0),
        arrearAllocations: c.arrearAllocations || [],
        advanceAllocations: c.advanceAllocations || [],
        walletName: c.walletName || c.walletId?.name || '',
        transactions: txs
      };
    });

    const studentInstallments = Array.isArray(student.installments) ? student.installments : [];
    const matchedChallanIds = new Set();

    let mappedInstallments = [];

    if (studentInstallments.length > 0) {
      mappedInstallments = studentInstallments.map((inst, index) => {
        const matchingChallans = mappedChallans.filter(c => {
          const idMatch = c.installmentId && inst._id && c.installmentId.toString() === inst._id.toString();
          const numMatch = c.installmentNumber != null && inst.installmentNumber != null && Number(c.installmentNumber) === Number(inst.installmentNumber);
          const monthMatch = c.month && inst.month && c.month.trim().toLowerCase() === inst.month.trim().toLowerCase();
          return idMatch || numMatch || monthMatch;
        });

        matchingChallans.forEach(c => matchedChallanIds.add(c.id));

        const hasChallan = matchingChallans.length > 0;
        const primaryChallan = matchingChallans[0];

        const basePayable = Number(inst.basePayable ?? (primaryChallan ? primaryChallan.basePayable : inst.amount) ?? 0);
        const arrears = Number(primaryChallan ? primaryChallan.arrearsAmount : (inst.arrears || 0));
        const lateFeeFine = Number(primaryChallan ? primaryChallan.lateFeeAmount : (inst.lateFeeRatePerDay || 0));
        const discount = Number(primaryChallan ? primaryChallan.discount : 0);
        const totalAmount = Number(primaryChallan ? primaryChallan.totalAmount : (inst.totalAmount || inst.amount || 0));
        const paidAmount = hasChallan
          ? matchingChallans.reduce((sum, c) => sum + Number(c.paidAmount || 0), 0)
          : Number(inst.paidAmount || 0);
        const settledViaArrearsTotal = matchingChallans.reduce((sum, c) => sum + Number(c.settledViaArrearsAmount || 0), 0);
        const totalSettled = matchingChallans.reduce((sum, c) => sum + Number(c.totalSettledAmount || c.paidAmount || 0), paidAmount);
        const isSettled = matchingChallans.some(c => c.status === 'SETTLED') || (hasChallan && totalSettled >= totalAmount && totalAmount > 0 && settledViaArrearsTotal > 0);
        const pendingAmount = isSettled ? 0 : Math.max(0, totalAmount - (hasChallan ? totalSettled : paidAmount));

        let status = inst.status || 'PENDING';
        if (hasChallan) {
          if (matchingChallans.some(c => c.status === 'PAID')) {
            status = 'PAID';
          } else if (isSettled || matchingChallans.some(c => c.status === 'SETTLED')) {
            status = 'SETTLED';
          } else if (matchingChallans.some(c => c.status === 'PARTIAL') || (totalSettled > 0 && totalSettled < totalAmount)) {
            status = 'PARTIAL';
          } else if (matchingChallans.every(c => c.status === 'VOID')) {
            status = 'VOID';
          } else {
            status = primaryChallan?.status || 'PENDING';
          }
        } else {
          if (paidAmount >= totalAmount && totalAmount > 0) {
            status = 'PAID';
          } else if (paidAmount > 0) {
            status = 'PARTIAL';
          }
        }

        return {
          id: inst._id?.toString() || `inst-${index + 1}`,
          _id: inst._id?.toString() || `inst-${index + 1}`,
          installmentNumber: inst.installmentNumber || (index + 1),
          month: inst.month || (primaryChallan?.month || ''),
          dueDate: inst.dueDate || primaryChallan?.dueDate,
          sessionId: inst.sessionId || student.sessionId?._id || student.sessionId,
          sessionName: student.sessionId?.name || '',
          basePayable,
          arrears,
          lateFeeFine,
          discount,
          totalAmount,
          paidAmount,
          settledViaArrearsAmount: settledViaArrearsTotal,
          settledByChallanNo: matchingChallans.find(c => c.settledByChallanNo)?.settledByChallanNo || '',
          totalSettledAmount: totalSettled,
          pendingAmount,
          status,
          challanGenerated: hasChallan || inst.challanGenerated || false,
          isLocked: inst.isLocked || false,
          challans: matchingChallans
        };
      });
    }

    // Any challans not matched to student.installments (or if student had no installments array)
    const unmatchedChallans = mappedChallans.filter(c => !matchedChallanIds.has(c.id));
    if (unmatchedChallans.length > 0) {
      if (mappedInstallments.length === 0) {
        unmatchedChallans.forEach((c, idx) => {
          mappedInstallments.push({
            id: c.id,
            _id: c.id,
            installmentNumber: c.installmentNumber || (idx + 1),
            month: c.month || '',
            dueDate: c.dueDate,
            sessionId: c.sessionId || student.sessionId?._id || student.sessionId,
            sessionName: student.sessionId?.name || '',
            basePayable: c.basePayable,
            arrears: c.arrearsAmount,
            lateFeeFine: c.lateFeeAmount,
            discount: c.discount,
            totalAmount: c.totalAmount,
            paidAmount: c.paidAmount,
            pendingAmount: c.remainingAmount,
            status: c.status,
            challanGenerated: true,
            isLocked: false,
            challans: [c]
          });
        });
      } else {
        mappedInstallments.push({
          id: 'extra-challans',
          _id: 'extra-challans',
          installmentNumber: 'Supplementary',
          month: 'Other',
          dueDate: unmatchedChallans[0]?.dueDate,
          sessionId: student.sessionId?._id || student.sessionId,
          sessionName: student.sessionId?.name || '',
          basePayable: unmatchedChallans.reduce((s, c) => s + c.basePayable, 0),
          arrears: unmatchedChallans.reduce((s, c) => s + c.arrearsAmount, 0),
          lateFeeFine: unmatchedChallans.reduce((s, c) => s + c.lateFeeAmount, 0),
          discount: unmatchedChallans.reduce((s, c) => s + c.discount, 0),
          totalAmount: unmatchedChallans.reduce((s, c) => s + c.totalAmount, 0),
          paidAmount: unmatchedChallans.reduce((s, c) => s + c.paidAmount, 0),
          pendingAmount: unmatchedChallans.reduce((s, c) => s + c.remainingAmount, 0),
          status: unmatchedChallans.every(c => c.status === 'PAID') ? 'PAID' : (unmatchedChallans.some(c => c.paidAmount > 0) ? 'PARTIAL' : 'PENDING'),
          challanGenerated: true,
          isLocked: false,
          challans: unmatchedChallans
        });
      }
    }

    return mappedInstallments;
  }
}

module.exports = new FeeService();
