const { InstituteSettings, Template } = require('../models');

class ConfigurationService {
  async getInstituteSettings() {
    let settings = await InstituteSettings.findOne();
    if (!settings) {
      settings = await InstituteSettings.create({});
    }
    return settings;
  }

  async updateInstituteSettings(data) {
    let settings = await InstituteSettings.findOne();
    if (!settings) {
      settings = await InstituteSettings.create(data);
    } else {
      settings = await InstituteSettings.findByIdAndUpdate(settings._id, data, { new: true });
    }
    return settings;
  }

  async getTemplates(type) {
    let filter = {};
    if (type) {
      filter = typeof type === 'object' ? { type } : { type };
    }
    return Template.find(filter);
  }

  async getDefaultTemplate(type) {
    let template = await Template.findOne({ type, isDefault: true });
    if (!template) {
      template = await Template.findOne({ type });
    }
    if (!template && (type === 'HOSTEL' || type === 'INSTALLMENT' || type === 'EXTRA')) {
      template = await Template.findOne({ type: 'FEE_CHALLAN', isDefault: true }) || await Template.findOne({ type: 'FEE_CHALLAN' });
    }
    return template || null;
  }

  async createTemplate(data) {
    if (data.type) {
      const existing = await Template.findOne({ type: data.type });
      if (existing) {
        throw new Error(`A template for type '${data.type}' already exists. Only one template per type is allowed.`);
      }
    }
    return Template.create({ ...data, isDefault: true });
  }

  async updateTemplate(id, data) {
    if (data.type) {
      const existing = await Template.findOne({ type: data.type, _id: { $ne: id } });
      if (existing) {
        throw new Error(`A template for type '${data.type}' already exists. Only one template per type is allowed.`);
      }
    }
    return Template.findByIdAndUpdate(id, { ...data, isDefault: true }, { new: true });
  }

  async deleteTemplate(id) {
    return Template.findByIdAndDelete(id);
  }
}

module.exports = new ConfigurationService();
