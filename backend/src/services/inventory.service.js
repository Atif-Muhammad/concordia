const { InventoryItem, InventoryExpense, Wallet, WalletTransaction, User } = require('../models');

class InventoryService {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ITEMS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getItems() {
    return InventoryItem.find().sort({ itemName: 1 });
  }

  async getItemById(id) {
    return InventoryItem.findById(id);
  }

  async createItem(data, userId) {
    const totalValue = Number(data.quantity || 0) * Number(data.unitPrice || 0);
    const itemData = {
      ...data,
      totalValue,
    };

    let walletRecord = null;
    let walletTx = null;

    if (itemData.isExpense && itemData.walletId) {
      const wallet = await Wallet.findById(itemData.walletId);
      if (!wallet) throw new Error('Selected Account / Wallet not found');

      const expAmount = Number(itemData.expenseAmount) > 0 ? Number(itemData.expenseAmount) : totalValue;
      itemData.expenseAmount = expAmount;

      // Deduct from wallet
      wallet.currentBalance = (Number(wallet.currentBalance) || 0) - expAmount;
      await wallet.save();
      walletRecord = wallet;

      const user = userId ? await User.findById(userId).select('name role') : null;
      const txDate = itemData.purchaseDate || new Date().toISOString().split('T')[0];

      walletTx = await WalletTransaction.create({
        transactionType: 'EXPENSE',
        category: 'INVENTORY_ITEM_EXPENSE',
        sourceWallet: wallet._id,
        amount: expAmount,
        date: txDate,
        sourceCategory: 'INVENTORY_ITEM_EXPENSE',
        sourceModule: 'School Inventory',
        description: itemData.description || `Inventory Item: ${itemData.itemName} (${itemData.quantity || 1} units)`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterSource: wallet.currentBalance,
      });

      itemData.walletId = walletRecord._id;
      itemData.walletName = walletRecord.name;
      itemData.transactionId = walletTx._id;
    } else {
      itemData.isExpense = false;
      itemData.expenseAmount = 0;
      itemData.walletId = null;
      itemData.walletName = '';
      itemData.transactionId = null;
    }

    const created = await InventoryItem.create(itemData);
    if (walletTx && created) {
      walletTx.inventoryItemId = created._id;
      await walletTx.save();
    }
    return created;
  }

  async updateItem(id, data, userId) {
    const item = await InventoryItem.findById(id);
    if (!item) throw new Error('Inventory item not found');

    const totalValue =
      Number(data.quantity !== undefined ? data.quantity : item.quantity) *
      Number(data.unitPrice !== undefined ? data.unitPrice : item.unitPrice);

    const updateData = {
      ...data,
      totalValue,
    };

    const hadExpense = item.isExpense && item.walletId;
    const oldWalletId = item.walletId ? item.walletId.toString() : null;
    const oldAmount = Number(item.expenseAmount || item.totalValue || 0);

    const willBeExpense = data.isExpense !== undefined ? Boolean(data.isExpense) : Boolean(item.isExpense);
    const newWalletId = data.walletId !== undefined ? data.walletId : item.walletId;
    const newAmount = Number(data.expenseAmount !== undefined ? data.expenseAmount : item.expenseAmount) > 0
      ? Number(data.expenseAmount !== undefined ? data.expenseAmount : item.expenseAmount)
      : totalValue;

    if (hadExpense) {
      // If toggled off OR wallet changed OR amount changed, revert old deduction
      if (!willBeExpense || oldWalletId !== (newWalletId ? newWalletId.toString() : null) || oldAmount !== newAmount) {
        const oldWallet = await Wallet.findById(oldWalletId);
        if (oldWallet) {
          oldWallet.currentBalance = (Number(oldWallet.currentBalance) || 0) + oldAmount;
          await oldWallet.save();
        }
        if (item.transactionId) {
          await WalletTransaction.findByIdAndDelete(item.transactionId);
        }
        updateData.transactionId = null;
      }
    }

    if (willBeExpense && newWalletId) {
      // If was not an expense, or wallet/amount changed, apply new deduction
      if (!hadExpense || oldWalletId !== newWalletId.toString() || oldAmount !== newAmount) {
        const newWallet = await Wallet.findById(newWalletId);
        if (!newWallet) throw new Error('Selected Account / Wallet not found');

        newWallet.currentBalance = (Number(newWallet.currentBalance) || 0) - newAmount;
        await newWallet.save();

        const user = userId ? await User.findById(userId).select('name role') : null;
        const txDate = updateData.purchaseDate || item.purchaseDate || new Date().toISOString().split('T')[0];

        const walletTx = await WalletTransaction.create({
          transactionType: 'EXPENSE',
          category: 'INVENTORY_ITEM_EXPENSE',
          sourceWallet: newWallet._id,
          amount: newAmount,
          date: txDate,
          sourceCategory: 'INVENTORY_ITEM_EXPENSE',
          sourceModule: 'School Inventory',
          description: updateData.description || `Inventory Item: ${updateData.itemName || item.itemName}`,
          performedBy: userId || null,
          performedByName: user ? `${user.name} (${user.role})` : 'System',
          balanceAfterSource: newWallet.currentBalance,
        });

        updateData.walletId = newWallet._id;
        updateData.walletName = newWallet.name;
        updateData.transactionId = walletTx._id;
        updateData.expenseAmount = newAmount;
      }
    } else if (!willBeExpense) {
      updateData.isExpense = false;
      updateData.walletId = null;
      updateData.walletName = '';
      updateData.transactionId = null;
      updateData.expenseAmount = 0;
    }

    return InventoryItem.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteItem(id, userId) {
    const item = await InventoryItem.findById(id);
    if (!item) return null;

    if (item.isExpense && item.walletId) {
      const wallet = await Wallet.findById(item.walletId);
      if (wallet) {
        const amount = Number(item.expenseAmount || item.totalValue || 0);
        wallet.currentBalance = (Number(wallet.currentBalance) || 0) + amount;
        await wallet.save();

        const user = userId ? await User.findById(userId).select('name role') : null;
        const userName = user ? `${user.name} (${user.role})` : 'System';

        await WalletTransaction.create({
          transactionType: 'EXPENSE',
          category: 'INVENTORY_ITEM_EXPENSE',
          sourceWallet: wallet._id,
          amount: -Math.abs(amount),
          date: new Date().toISOString().split('T')[0],
          sourceCategory: 'INVENTORY_ITEM_EXPENSE_REVERSAL',
          sourceModule: 'School Inventory',
          referenceNo: `REV-ITM-${item._id.toString().slice(-6)}`,
          description: `Reversal: Inventory Item deleted - ${item.itemName} (${item.quantity || 1} units) refunded to ${wallet.name}`,
          performedBy: userId || null,
          performedByName: userName,
          balanceAfterSource: wallet.currentBalance,
          isReversal: true,
        });
      }
    }

    return InventoryItem.findByIdAndDelete(id);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EXPENSES (Manual Inventory Maintenance / Repairs)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getExpenses() {
    return InventoryExpense.find().populate('inventoryItemId').sort({ date: -1 });
  }

  async getExpensesByItem(itemId) {
    return InventoryExpense.find({ inventoryItemId: itemId }).sort({ date: -1 });
  }

  async createExpense(data, userId) {
    const expenseData = { ...data };
    const expAmount = Number(expenseData.amount || 0);
    let walletRecord = null;
    let walletTx = null;

    let targetWalletId = expenseData.walletId;
    if (!targetWalletId) {
      const defaultWallet = await Wallet.findOne({ name: /United Bank Limited/i, status: 'ACTIVE' }) ||
                            await Wallet.findOne({ type: 'BANK', status: 'ACTIVE' }) ||
                            await Wallet.findOne({ status: 'ACTIVE' });
      if (defaultWallet) targetWalletId = defaultWallet._id;
    }

    if (targetWalletId) {
      const wallet = await Wallet.findById(targetWalletId);
      if (!wallet) throw new Error('Selected Account / Wallet not found');

      wallet.currentBalance = (Number(wallet.currentBalance) || 0) - expAmount;
      await wallet.save();
      walletRecord = wallet;

      const user = userId ? await User.findById(userId).select('name role') : null;
      const txDate = expenseData.date || new Date().toISOString().split('T')[0];

      walletTx = await WalletTransaction.create({
        transactionType: 'EXPENSE',
        category: 'INVENTORY_MANUAL_EXPENSE',
        sourceWallet: wallet._id,
        amount: expAmount,
        date: txDate,
        sourceCategory: 'INVENTORY_MANUAL_EXPENSE',
        sourceModule: 'Inventory Expense',
        description: expenseData.description || `Inventory Expense: ${expenseData.expenseType || 'Maintenance'} (${expenseData.vendor || 'Vendor'})`,
        performedBy: userId || null,
        performedByName: user ? `${user.name} (${user.role})` : 'System',
        balanceAfterSource: wallet.currentBalance,
      });

      expenseData.walletId = walletRecord._id;
      expenseData.walletName = walletRecord.name;
      expenseData.transactionId = walletTx._id;
    }

    const created = await InventoryExpense.create(expenseData);
    if (walletTx && created) {
      walletTx.expenseId = created._id;
      await walletTx.save();
    }
    return created;
  }

  async updateExpense(id, data, userId) {
    const expense = await InventoryExpense.findById(id);
    if (!expense) throw new Error('Expense not found');

    const updateData = { ...data };
    const oldWalletId = expense.walletId ? expense.walletId.toString() : null;
    const oldAmount = Number(expense.amount || 0);
    const newWalletId = data.walletId ? data.walletId.toString() : null;
    const newAmount = Number(data.amount !== undefined ? data.amount : expense.amount);

    if (oldWalletId) {
      if (!newWalletId || oldWalletId !== newWalletId || oldAmount !== newAmount) {
        const oldWallet = await Wallet.findById(oldWalletId);
        if (oldWallet) {
          oldWallet.currentBalance = (Number(oldWallet.currentBalance) || 0) + oldAmount;
          await oldWallet.save();
        }
        if (expense.transactionId) {
          await WalletTransaction.findByIdAndDelete(expense.transactionId);
        }
        updateData.transactionId = null;
      }
    }

    if (newWalletId) {
      if (!oldWalletId || oldWalletId !== newWalletId || oldAmount !== newAmount) {
        const newWallet = await Wallet.findById(newWalletId);
        if (!newWallet) throw new Error('Selected Account / Wallet not found');

        newWallet.currentBalance = (Number(newWallet.currentBalance) || 0) - newAmount;
        await newWallet.save();

        const user = userId ? await User.findById(userId).select('name role') : null;
        const txDate = updateData.date || expense.date || new Date().toISOString().split('T')[0];

        const walletTx = await WalletTransaction.create({
          transactionType: 'EXPENSE',
          category: 'INVENTORY_MANUAL_EXPENSE',
          sourceWallet: newWallet._id,
          amount: newAmount,
          date: txDate,
          sourceCategory: 'INVENTORY_MANUAL_EXPENSE',
          sourceModule: 'Inventory Expense',
          description: updateData.description || expense.description || `Inventory Expense: ${updateData.expenseType || expense.expenseType}`,
          performedBy: userId || null,
          performedByName: user ? `${user.name} (${user.role})` : 'System',
          balanceAfterSource: newWallet.currentBalance,
        });

        updateData.walletId = newWallet._id;
        updateData.walletName = newWallet.name;
        updateData.transactionId = walletTx._id;
      }
    } else {
      updateData.walletId = null;
      updateData.walletName = '';
      updateData.transactionId = null;
    }

    return InventoryExpense.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteExpense(id, userId) {
    const expense = await InventoryExpense.findById(id);
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
          category: 'INVENTORY_MANUAL_EXPENSE',
          sourceWallet: wallet._id,
          amount: -Math.abs(amount),
          date: new Date().toISOString().split('T')[0],
          sourceCategory: 'INVENTORY_EXPENSE_REVERSAL',
          sourceModule: 'Inventory Expense',
          referenceNo: `REV-INVE-${expense._id.toString().slice(-6)}`,
          description: `Reversal: Inventory Expense deleted - ${expense.expenseType || 'Expense'} (${expense.vendor || ''}) refunded to ${wallet.name}`,
          performedBy: userId || null,
          performedByName: userName,
          balanceAfterSource: wallet.currentBalance,
          isReversal: true,
        });
      }
    }

    return InventoryExpense.findByIdAndDelete(id);
  }
}

module.exports = new InventoryService();
