const express = require('express');
const router = express.Router();
const frontOfficeController = require('../controllers/frontOffice.controller');
const { authMiddleware } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');

// Inquiries
router.get('/get/inquiries', frontOfficeController.getInquiries);
router.post('/create/inquiry', authMiddleware, checkPermission('Front Office', 'inquiry', 'create'), frontOfficeController.createInquiry);
router.patch('/update/inquiry', authMiddleware, checkPermission('Front Office', 'inquiry', 'update'), frontOfficeController.updateInquiry);
router.delete('/remove/inquiry', authMiddleware, checkPermission('Front Office', 'inquiry', 'delete'), frontOfficeController.deleteInquiry);
router.delete('/delete/inquiry', authMiddleware, checkPermission('Front Office', 'inquiry', 'delete'), frontOfficeController.deleteInquiry);
router.post('/inquiry/:id/remark', authMiddleware, checkPermission('Front Office', 'inquiry', 'update'), frontOfficeController.addRemark);
router.post('/inquiry/:id/follow-up', authMiddleware, checkPermission('Front Office', 'inquiry', 'update'), frontOfficeController.addFollowUp);
router.patch('/inquiry/:id/follow-up/:followUpId', authMiddleware, checkPermission('Front Office', 'inquiry', 'update'), frontOfficeController.updateFollowUp);
router.delete('/inquiry/:id/follow-up/:followUpId', authMiddleware, checkPermission('Front Office', 'inquiry', 'delete'), frontOfficeController.deleteFollowUp);

// Visitors
router.get('/get/visitors', frontOfficeController.getVisitors);
router.post('/create/visitor', authMiddleware, checkPermission('Front Office', 'visitor', 'create'), frontOfficeController.createVisitor);
router.patch('/update/visitor', authMiddleware, checkPermission('Front Office', 'visitor', 'update'), frontOfficeController.updateVisitor);
router.delete('/remove/visitor', authMiddleware, checkPermission('Front Office', 'visitor', 'delete'), frontOfficeController.deleteVisitor);
router.delete('/delete/visitor', authMiddleware, checkPermission('Front Office', 'visitor', 'delete'), frontOfficeController.deleteVisitor);
router.delete('/delete/visitor/:id', authMiddleware, checkPermission('Front Office', 'visitor', 'delete'), frontOfficeController.deleteVisitor);

// Complaints
router.get('/get/complaints', frontOfficeController.getComplaints);
router.get('/get/my-complaints', authMiddleware, frontOfficeController.getComplaints);
router.post('/create/complaint', authMiddleware, checkPermission('Front Office', 'complaints', 'create'), frontOfficeController.createComplaint);
router.patch('/update/complaint', authMiddleware, checkPermission('Front Office', 'complaints', 'update'), frontOfficeController.updateComplaint);
router.delete('/remove/complaint', authMiddleware, checkPermission('Front Office', 'complaints', 'delete'), frontOfficeController.deleteComplaint);
router.delete('/delete/complaint', authMiddleware, checkPermission('Front Office', 'complaints', 'delete'), frontOfficeController.deleteComplaint);
router.delete('/delete/complaint/:id', authMiddleware, checkPermission('Front Office', 'complaints', 'delete'), frontOfficeController.deleteComplaint);
router.post('/complaint/:complaintId/remark', authMiddleware, checkPermission('Front Office', 'complaints', 'update'), frontOfficeController.addComplaintRemark);
router.post('/complaint/:id/remark', authMiddleware, checkPermission('Front Office', 'complaints', 'update'), frontOfficeController.addComplaintRemark);

// Contacts
router.get('/get/contacts', frontOfficeController.getContacts);
router.post('/create/contact', authMiddleware, checkPermission('Front Office', 'contacts', 'create'), frontOfficeController.createContact);
router.patch('/update/contact', authMiddleware, checkPermission('Front Office', 'contacts', 'update'), frontOfficeController.updateContact);
router.delete('/remove/contact', authMiddleware, checkPermission('Front Office', 'contacts', 'delete'), frontOfficeController.deleteContact);
router.delete('/delete/contact', authMiddleware, checkPermission('Front Office', 'contacts', 'delete'), frontOfficeController.deleteContact);
router.delete('/delete/contact/:id', authMiddleware, checkPermission('Front Office', 'contacts', 'delete'), frontOfficeController.deleteContact);

module.exports = router;
