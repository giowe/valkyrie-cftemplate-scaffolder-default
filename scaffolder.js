const templates = require('./templates.json');
const fs = require('fs');
const path = require("path");

const createStack = (cloudFormation, StackName, TemplateBody, Parameters) => {
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

const updateStack = (cloudFormation, StackName, TemplateBody, Parameters) => {
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

const deleteStack = (cloudFormation, StackName) => {
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

const sortTemplateDependencies = (templates, callback) => {
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

const createOrUpdateStacks = (cloudFormation, config, create = true) => {
  const { Project: { Parameters: inputParameters }, Environments } = config;

  //Filters enabled templates
  const filteredTemplate =
    templates
      .filter(({ name, required }) => inputParameters[name] && (inputParameters[name].enabled || required ))
      //Filters enabled template parameters (soft dependencies)
      .map(template => ({
          ...template,
          templatesParameters: template.templatesParameters && template.templatesParameters.filter(({ TemplateName }) => inputParameters[TemplateName] && (inputParameters[TemplateName].enabled !== false /*I have to accept enabled=undefined (for required fields)*/))
        })
      );

  return sortTemplateDependencies(filteredTemplate, (template, promises) => {
    const { name, templatesParameters, configParameters } = template;

    //Extracts useful information from parameters asked to the user (valk config)
    const { source: type, inputs } = inputParameters[name];
    const StackName = name;
    //Reads the CloudFormation Template body.
    const TemplateBody = fs.readFileSync(path.resolve(__dirname, `./cloudformation/${name}/${type || template['sources'][0]['template']}`), { encoding: 'utf8' });

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

    //If template has dependencies it must be executed when the parent template is created (or updated)
    if(templatesParameters) {
      return Promise
        .all(templatesParameters.map(dep => promises[dep]))
        .then(() => (create ? createStack : updateStack)(cloudFormation, StackName, TemplateBody, Parameters));
    } else {
      return (create ? createStack : updateStack)(cloudFormation, StackName, TemplateBody, Parameters);
    }
  })
};

//This method is used to resolve an object by using a string ex obj1.obj2.interestingKey
const resolve = function(path, obj) {
  return path.split('.').reduce(function(prev, curr) {
    return prev ? prev[curr] : undefined
  }, obj || self)
};

module.exports = {
  create: (cloudFormation, config) => createOrUpdateStacks(cloudFormation, config, true),
  update: (cloudFormation, config) => createOrUpdateStacks(cloudFormation, config, false),
  delete: (cloudFormation, config) => {
    const { Project: { Parameters: inputParameters }, Environments } = config;

    //Filters enabled templates
    const filteredTemplate =
      templates
        .filter(({ name, required }) => inputParameters[name] && (inputParameters[name].enabled || required ))
        //Filters enabled template parameters (soft dependencies)
        .map(template => ({
            ...template,
            templatesParameters: template.templatesParameters && template.templatesParameters.filter(({ TemplateName }) => inputParameters[TemplateName] && (inputParameters[TemplateName].enabled !== false /*I have to accept enabled=undefined (for required fields)*/))
          })
        );

    return sortTemplateDependencies(filteredTemplate, (template, promises) => {
      const { name, templatesParameters } = template;

      const StackName = name;

      if(templatesParameters) {
        return Promise
          .all(templatesParameters.map(dep => promises[dep]))
          .then(() => deleteStack(StackName));
      } else {
        return deleteStack(StackName);
      }
    });
  },
  templates
};
