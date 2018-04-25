const templates = require('./templates.json');
const fs = require('fs');

const createStack = (StackName, TemplateBody, Parameters) => {
  cloudFormation.createStack({ StackName, TemplateBody, Parameters }).promise
    .then(() => {
      return new Promise((resolve, rej) => {
        cloudFormation.waitFor('stackCreateComplete', { StackName }, function(err, data) {
          if (err)
            rej(err);
          else
            resolve(data);
        });
      })
    });
};

const deleteStack = (StackName) => {
  cloudFormation.deleteStack({ StackName }).promise
    .then(() => {
      return new Promise((resolve, rej) => {
        cloudFormation.waitFor('stackDeleteComplete', { StackName }, function(err, data) {
          if (err)
            rej(err);
          else
            resolve(data);
        });
      })
    });
};

const resolve = function(path, obj) {
  return path.split('.').reduce(function(prev, curr) {
    return prev ? prev[curr] : undefined
  }, obj || self)
};

module.exports = {
  create: (cloudFormation, config) => {
    const promises = {};
    const filteredTemplate =
      templates
        .filter(({ name }) => config[name] && config[name].enabled)
        .map(template => {
          template.templatesParameters = templatesParameters && templatesParameters.filter(({ TemplateName }) => config[TemplateName].enabled);
          return template;
        });

    while(filteredTemplate) {
      const template = filteredTemplate.shift();
      const { name, parameters, templatesParameters, configParameters } = template;

      if(templatesParameters && templatesParameters.find(({ TemplateName }) => !promises[TemplateName])) {
        filteredTemplate.push(template);
        continue;
      }

      const { type } = config[name];
      const StackName = type || name;
      const TemplateBody = fs.readFileSync(`vpc/${StackName}.yaml`);
      const Parameters =
        Object.keys(parameters).map(ParameterKey => ({ ParameterKey, ParameterValue: parameters[ParameterKey] }))
          .push(
            templatesParameters &&
            templatesParameters
              .map(({ ParameterKey, TemplateName }) => ({ ParameterKey, ParameterValue: config[TemplateName].type || TemplateName }))
          )
          .push(
            configParameters &&
            configParameters
              .map(({ ParameterKey, ConfigKey }) => ({ ParameterKey, ParameterValue: resolve(ConfigKey, config) }))
          );

      if(templatesParameters) {
        promises[name] = Promise
          .all(templatesParameters.map(dep => promises[dep]))
          .then(() => createStack(StackName, TemplateBody, Parameters));
      } else {
        promises[name] = createStack(StackName, TemplateBody, Parameters);
      }
    }
  },
  update: (cloudFormation, config) => {},
  delete: (cloudFormation, config) => {
    const promises = {};
    const filteredTemplate =
      templates
        .filter(({ name }) => config[name] && config[name].enabled)
        .map(template => {
          template.templatesParameters = templatesParameters && templatesParameters.filter(({ TemplateName }) => config[TemplateName].enabled);
          return template;
        });

    while(filteredTemplate) {
      const template = filteredTemplate.shift();
      const { name, templatesParameters } = template;

      if (templatesParameters && templatesParameters.find(({ TemplateName }) => !promises[TemplateName])) {
        filteredTemplate.push(template);
        continue;
      }

      const { type } = config[name];
      const StackName = type || name;

      if(templatesParameters) {
        promises[name] = Promise
          .all(templatesParameters.map(dep => promises[dep]))
          .then(() => deleteStack(StackName));
      } else {
        promises[name] = deleteStack(StackName);
      }
    }
  },
  templates
};
