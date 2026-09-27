const configurationService = require('../services/configuration.service');

class ConfigurationController {
  async getInstituteSettings(req, res, next) {
    try {
      const settings = await configurationService.getInstituteSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  async updateInstituteSettings(req, res, next) {
    try {
      const settings = await configurationService.updateInstituteSettings(req.body);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  // Generic template handlers
  createTemplateHandlers(type) {
    return {
      getAll: async (req, res, next) => {
        try {
          const templates = await configurationService.getTemplates(type);
          res.json(templates);
        } catch (err) {
          next(err);
        }
      },
      getDefault: async (req, res, next) => {
        try {
          const template = await configurationService.getDefaultTemplate(type);
          res.json(template);
        } catch (err) {
          next(err);
        }
      },
      create: async (req, res, next) => {
        try {
          const template = await configurationService.createTemplate({ ...req.body, type });
          res.status(201).json(template);
        } catch (err) {
          next(err);
        }
      },
      update: async (req, res, next) => {
        try {
          const template = await configurationService.updateTemplate(req.params.id, req.body);
          res.json(template);
        } catch (err) {
          next(err);
        }
      },
      delete: async (req, res, next) => {
        try {
          await configurationService.deleteTemplate(req.params.id);
          res.json({ message: 'Template deleted' });
        } catch (err) {
          next(err);
        }
      }
    };
  }
}

module.exports = new ConfigurationController();
