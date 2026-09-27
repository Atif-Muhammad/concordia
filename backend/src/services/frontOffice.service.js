const {
  FrontOfficeInquiry,
  FrontOfficeVisitor,
  FrontOfficeComplaint,
  FrontOfficeContact
} = require('../models');

class FrontOfficeService {
  // Inquiries
  async getInquiries({ programInterest, page = 1, limit = 15 }) {
    const filter = {};
    if (programInterest) filter.programInterest = programInterest;

    const skip = (page - 1) * limit;
    const total = await FrontOfficeInquiry.countDocuments(filter);
    const data = await FrontOfficeInquiry.find(filter)
      .populate('programInterest')
      .populate('sessionId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return {
      data,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + data.length < total
    };
  }

  _sanitizeInquiryPayload(data) {
    const payload = { ...data };
    if (!payload.programInterest) {
      delete payload.programInterest;
    }
    if (!payload.sessionId) {
      delete payload.sessionId;
    }
    if (typeof payload.remarks === 'string') {
      if (payload.remarks.trim()) {
        payload.remarks = [{ text: payload.remarks.trim(), date: new Date() }];
      } else {
        delete payload.remarks;
      }
    } else if (!Array.isArray(payload.remarks)) {
      delete payload.remarks;
    }
    if (!Array.isArray(payload.followUps)) {
      delete payload.followUps;
    }
    return payload;
  }

  async createInquiry(data) {
    const sanitized = this._sanitizeInquiryPayload(data);
    return FrontOfficeInquiry.create(sanitized);
  }

  async updateInquiry(id, data) {
    const sanitized = this._sanitizeInquiryPayload(data);
    return FrontOfficeInquiry.findByIdAndUpdate(id, sanitized, { new: true });
  }

  async deleteInquiry(id) {
    return FrontOfficeInquiry.findByIdAndDelete(id);
  }

  async addInquiryRemark(id, remark) {
    return FrontOfficeInquiry.findByIdAndUpdate(
      id,
      { $push: { remarks: { text: remark, date: new Date() } } },
      { new: true }
    );
  }

  // Follow-ups
  _syncFollowUpDate(inquiry) {
    if (!inquiry.followUps || inquiry.followUps.length === 0) {
      inquiry.followUpDate = undefined;
      inquiry.followUpSlab = '';
      return;
    }
    const pendingFollowUps = inquiry.followUps.filter((f) => f.status === 'PENDING');
    if (pendingFollowUps.length > 0) {
      pendingFollowUps.sort((a, b) => new Date(a.date) - new Date(b.date));
      inquiry.followUpDate = pendingFollowUps[0].date;
      inquiry.followUpSlab = pendingFollowUps[0].slab || '';
    } else {
      const sorted = [...inquiry.followUps].sort((a, b) => new Date(b.date) - new Date(a.date));
      inquiry.followUpDate = sorted[0].date;
      inquiry.followUpSlab = sorted[0].slab || '';
    }
  }

  async addInquiryFollowUp(id, followUpData) {
    const inquiry = await FrontOfficeInquiry.findById(id);
    if (!inquiry) throw new Error('Inquiry not found');

    inquiry.followUps.push(followUpData);
    this._syncFollowUpDate(inquiry);
    await inquiry.save();
    return inquiry;
  }

  async updateInquiryFollowUp(id, followUpId, updateData) {
    const inquiry = await FrontOfficeInquiry.findById(id);
    if (!inquiry) throw new Error('Inquiry not found');

    const followUp = inquiry.followUps.id(followUpId);
    if (!followUp) throw new Error('Follow-up record not found');

    if (updateData.date !== undefined) followUp.date = updateData.date;
    if (updateData.slab !== undefined) followUp.slab = updateData.slab;
    if (updateData.remarks !== undefined) followUp.remarks = updateData.remarks;
    if (updateData.status !== undefined) followUp.status = updateData.status;

    this._syncFollowUpDate(inquiry);
    await inquiry.save();
    return inquiry;
  }

  async deleteInquiryFollowUp(id, followUpId) {
    const inquiry = await FrontOfficeInquiry.findById(id);
    if (!inquiry) throw new Error('Inquiry not found');

    inquiry.followUps.pull(followUpId);
    this._syncFollowUpDate(inquiry);
    await inquiry.save();
    return inquiry;
  }

  // Visitors
  _normalizeVisitorPayload(data) {
    const payload = { ...data };
    if (!payload.phoneNumber && payload.phone) payload.phoneNumber = payload.phone;
    if (!payload.phone && payload.phoneNumber) payload.phone = payload.phoneNumber;
    if (!payload.ID && payload.IDCard) payload.ID = payload.IDCard;
    if (!payload.IDCard && payload.ID) payload.IDCard = payload.ID;
    if (!payload.visitDate && payload.date) payload.visitDate = payload.date;
    if (!payload.date && payload.visitDate) payload.date = payload.visitDate;
    if (payload.persons !== undefined) payload.persons = Number(payload.persons) || 1;
    return payload;
  }

  async getVisitors(month) {
    const filter = {};
    if (month && month !== "all") {
      filter.$or = [
        { visitDate: { $regex: `^${month}` } },
        { date: { $regex: `^${month}` } }
      ];
    }
    return FrontOfficeVisitor.find(filter).sort({ createdAt: -1 });
  }

  async createVisitor(data) {
    const normalized = this._normalizeVisitorPayload(data);
    return FrontOfficeVisitor.create(normalized);
  }

  async updateVisitor(id, data) {
    const normalized = this._normalizeVisitorPayload(data);
    return FrontOfficeVisitor.findByIdAndUpdate(id, normalized, { new: true });
  }

  async deleteVisitor(id) {
    return FrontOfficeVisitor.findByIdAndDelete(id);
  }

  // Complaints
  _normalizeComplaintPayload(data) {
    const payload = { ...data };
    if (!payload.details && payload.description) payload.details = payload.description;
    if (!payload.assignedToIds && Array.isArray(payload.assignedTo)) {
      payload.assignedToIds = payload.assignedTo.map((a) => a.id || a._id || a);
    }
    if (payload.contact !== undefined) payload.contact = String(payload.contact);
    return payload;
  }

  async getComplaints(params = {}) {
    const filter = {};
    const { date, start, end } = typeof params === "string" ? { date: params } : params;
    if (start && end) {
      filter.createdAt = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    } else if (date) {
      const d = new Date(date).toISOString().split("T")[0];
      filter.createdAt = {
        $gte: new Date(d),
        $lt: new Date(new Date(d).getTime() + 24 * 60 * 60 * 1000)
      };
    }
    return FrontOfficeComplaint.find(filter)
      .populate("assignedToIds", "name email empDepartment staffId")
      .sort({ createdAt: -1 });
  }

  async createComplaint(data) {
    const normalized = this._normalizeComplaintPayload(data);
    return FrontOfficeComplaint.create(normalized);
  }

  async updateComplaint(id, data) {
    const normalized = this._normalizeComplaintPayload(data);
    return FrontOfficeComplaint.findByIdAndUpdate(id, normalized, { new: true })
      .populate("assignedToIds", "name email empDepartment staffId");
  }

  async deleteComplaint(id) {
    return FrontOfficeComplaint.findByIdAndDelete(id);
  }

  async addComplaintRemark(id, remark, authorName = "Staff") {
    const text = typeof remark === "string" ? remark : remark?.text || remark?.remark || "";
    const author = typeof remark === "object" && remark?.authorName ? remark.authorName : authorName;
    return FrontOfficeComplaint.findByIdAndUpdate(
      id,
      {
        $push: {
          remarks: {
            text,
            remark: text,
            authorName: author,
            date: new Date(),
            createdAt: new Date()
          }
        }
      },
      { new: true }
    ).populate("assignedToIds", "name email empDepartment staffId");
  }

  // Contacts
  async getContacts(params = {}) {
    const filter = {};
    const { category, search } = params;
    if (category && category !== "All") {
      filter.category = category;
    }
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { phone: { $regex: search.trim(), $options: "i" } }
      ];
    }
    return FrontOfficeContact.find(filter).sort({ name: 1 });
  }

  async createContact(data) {
    return FrontOfficeContact.create(data);
  }

  async updateContact(id, data) {
    return FrontOfficeContact.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteContact(id) {
    return FrontOfficeContact.findByIdAndDelete(id);
  }
}

module.exports = new FrontOfficeService();
