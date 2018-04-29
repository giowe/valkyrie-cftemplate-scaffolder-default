const templates = require('./templates.json');
const fs = require('fs');
const path = require("path");

const api = {};

const createStack = api.createStack = (cloudFormation, StackName, TemplateBody, Parameters) => {
  return cloudFormation.createStack({ StackName, TemplateBody, Parameters }).promise
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

const updateStack = api.updateStack = (cloudFormation, StackName, TemplateBody, Parameters) => {
  return cloudFormation.updateStack({ StackName, TemplateBody, Parameters }).promise
    .then(() => {
      return new Promise((resolve, rej) => {
        cloudFormation.waitFor('stackUpdateComplete', { StackName }, function(err, data) {
          if (err)
            rej(err);
          else
            resolve(data);
        });
      })
    });
};

const deleteStack = api.deleteStack = (cloudFormation, StackName) => {
  return cloudFormation.deleteStack({ StackName }).promise
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

const filterEnabledTemplates = api.filterEnabledTemplates = (templates, { Project: { Parameters: inputParameters } } ) => {
  return templates
    //Filters enabled templates (and required templates)
    .filter(({ name, required }) => inputParameters[name] && (inputParameters[name].enabled || required ))
    //Filters optional parameters linked to enabled templates (soft dependencies)
    .map(template => ({
        ...template,
        templatesParameters: template.templatesParameters && template.templatesParameters.filter(({ TemplateName }) => inputParameters[TemplateName] && (inputParameters[TemplateName].enabled !== false /*I have to accept enabled=undefined (for required fields)*/))
      })
    );
};

const sortTemplateDependencies = api.sortTemplateDependencies = (templates, callback) => {
  const promises = {};

  while(templates.length > 0) {
    const template = templates.shift();

    const { name, templatesParameters } = template;

    //If dependencies aren't loaded yet, it pushes the template at the end of the array -> it will be elaborated again when dependencies will be met.
    if(templatesParameters && templatesParameters.find(({ TemplateName }) => !promises[TemplateName])) {
      templates.push(template);
      continue;
    }

    promises[name] = callback(template, promises);
  }

  return promises;
};

//This method is used to resolve an object by using a string ex obj1.obj2.interestingKey
const resolve = api.resolve = function(path, obj) {
  return path.split('.').reduce(function(prev, curr) {
    return prev ? prev[curr] : undefined
  }, obj || self)
};

const createOrUpdateStacks = (cloudFormation, config, create = true) => {
  const { Project: { Parameters: inputParameters }, Environments } = config;

  return sortTemplateDependencies(filterEnabledTemplates(templates, config), (template, promises) => {
    const { name, templatesParameters, configParameters, customScript } = template;

    //Extracts useful information from parameters asked to the user (valk config)
    const { source: type, inputs } = inputParameters[name];
    const StackName = name;
    //Reads the CloudFormation Template body.
    const TemplateBody = fs.readFileSync(path.resolve(__dirname, `./src/cloudformation/${name}/${type || template['sources'][0]['template']}`), { encoding: 'utf8' });

    //Creates CloudFormation Parameters objects by merging input paramaters (valk config) + templates parameters (soft dependencies between templates) + config parameters (other general parameters from valk config ex projectName)
    const Parameters = (inputs && Object.keys(inputs).map(ParameterKey => ({ ParameterKey, ParameterValue: inputs[ParameterKey] }))) || [];
    Parameters.push(
      templatesParameters &&
      templatesParameters
        .map(({ ParameterKey, TemplateName }) => ({ ParameterKey, ParameterValue: TemplateName }))
    );
    Parameters.push(
      configParameters &&
      configParameters
        .map(({ ParameterKey, ConfigKey }) => ({ ParameterKey, ParameterValue: resolve(ConfigKey, config) }))
    );

    const promise = () =>
      customScript ?
        require(path.resolve(__dirname, `./src/scripts/${name}.js`))[create ? 'create' : 'update'](cloudFormation, StackName, TemplateBody, Parameters, promises, api)
        :
        (create ? createStack : updateStack)(cloudFormation, StackName, TemplateBody, Parameters);

    //If template has dependencies it must be executed when the parent template is created (or updated)
    if(templatesParameters) {
      return Promise
        .all(templatesParameters.map(dep => promises[dep]))
        .then(promise);
    } else {
      return promise;
    }
  })
};

module.exports = {
  create: (cloudFormation, config) => createOrUpdateStacks(cloudFormation, config, true),
  update: (cloudFormation, config) => createOrUpdateStacks(cloudFormation, config, false),
  delete: (cloudFormation, config) => {
    return sortTemplateDependencies(filterEnabledTemplates(templates, config), (template, promises) => {
      const { name, templatesParameters, customScript } = template;

      const StackName = name;

      const promise = () =>
        customScript ?
          require(path.resolve(__dirname, `./src/scripts/${name}.js`)).delete(cloudFormation, config, promises, api)
          :
          deleteStack(cloudFormation, StackName);

      if(templatesParameters) {
        return Promise
          .all(templatesParameters.map(dep => promises[dep]))
          .then(promise);
      } else {
        return promise;
      }
    });
  },
  templates
};
