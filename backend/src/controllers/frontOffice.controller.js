const frontOfficeService = require('../services/frontOffice.service');

class FrontOfficeController {
  // Inquiries
  async getInquiries(req, res, next) {
    try {
      const programInterest = req.query.programInterest || req.query.programId;
      const { page, limit } = req.query;
      const result = await frontOfficeService.getInquiries({ programInterest, page, limit });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async createInquiry(req, res, next) {
    try {
      const inquiry = await frontOfficeService.createInquiry(req.body);
      res.status(201).json(inquiry);
    } catch (err) {
      next(err);
    }
  }

  async updateInquiry(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const inquiry = await frontOfficeService.updateInquiry(id, req.body);
      res.json(inquiry);
    } catch (err) {
      next(err);
    }
  }

  async deleteInquiry(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await frontOfficeService.deleteInquiry(id);
      res.json({ message: 'Inquiry deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async addRemark(req, res, next) {
    try {
      const id = req.params.id;
      const { remark } = req.body;
      const updated = await frontOfficeService.addInquiryRemark(id, remark);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  async addFollowUp(req, res, next) {
    try {
      const id = req.params.id;
      const updated = await frontOfficeService.addInquiryFollowUp(id, req.body);
      res.status(201).json(updated);
    } catch (err) {
      next(err);
    }
  }

  async updateFollowUp(req, res, next) {
    try {
      const { id, followUpId } = req.params;
      const updated = await frontOfficeService.updateInquiryFollowUp(id, followUpId, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  async deleteFollowUp(req, res, next) {
    try {
      const { id, followUpId } = req.params;
      const updated = await frontOfficeService.deleteInquiryFollowUp(id, followUpId);
      res.json({ message: 'Follow-up deleted successfully', inquiry: updated });
    } catch (err) {
      next(err);
    }
  }

  // Visitors
  async getVisitors(req, res, next) {
    try {
      const { month } = req.query;
      const visitors = await frontOfficeService.getVisitors(month);
      res.json(visitors);
    } catch (err) {
      next(err);
    }
  }

  async createVisitor(req, res, next) {
    try {
      const visitor = await frontOfficeService.createVisitor(req.body);
      res.status(201).json(visitor);
    } catch (err) {
      next(err);
    }
  }

  async updateVisitor(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const visitor = await frontOfficeService.updateVisitor(id, req.body);
      res.json(visitor);
    } catch (err) {
      next(err);
    }
  }

  async deleteVisitor(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await frontOfficeService.deleteVisitor(id);
      res.json({ message: 'Visitor deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // Complaints
  async getComplaints(req, res, next) {
    try {
      const { date, start, end } = req.query;
      const complaints = await frontOfficeService.getComplaints({ date, start, end });
      res.json(complaints);
    } catch (err) {
      next(err);
    }
  }

  async createComplaint(req, res, next) {
    try {
      const complaint = await frontOfficeService.createComplaint(req.body);
      res.status(201).json(complaint);
    } catch (err) {
      next(err);
    }
  }

  async updateComplaint(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const complaint = await frontOfficeService.updateComplaint(id, req.body);
      res.json(complaint);
    } catch (err) {
      next(err);
    }
  }

  async deleteComplaint(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await frontOfficeService.deleteComplaint(id);
      res.json({ message: 'Complaint deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async addComplaintRemark(req, res, next) {
    try {
      const id = req.params.complaintId || req.params.id;
      const { remark, authorName } = req.body;
      const author = authorName || req.user?.name || req.user?.username || 'Staff';
      const updated = await frontOfficeService.addComplaintRemark(id, remark, author);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  // Contacts
  async getContacts(req, res, next) {
    try {
      const { category, search } = req.query;
      const contacts = await frontOfficeService.getContacts({ category, search });
      res.json(contacts);
    } catch (err) {
      next(err);
    }
  }

  async createContact(req, res, next) {
    try {
      const contact = await frontOfficeService.createContact(req.body);
      res.status(201).json(contact);
    } catch (err) {
      next(err);
    }
  }

  async updateContact(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      const contact = await frontOfficeService.updateContact(id, req.body);
      res.json(contact);
    } catch (err) {
      next(err);
    }
  }

  async deleteContact(req, res, next) {
    try {
      const id = req.query.id || req.params.id;
      await frontOfficeService.deleteContact(id);
      res.json({ message: 'Contact deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FrontOfficeController();
