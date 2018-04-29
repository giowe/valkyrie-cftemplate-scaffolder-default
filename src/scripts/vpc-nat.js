const getNumberOfVpc = ({ Project: { Parameters: inputParameters } }) =>
  parseInt(inputParameters['vpc']['type'].charAt(4));

const createOrUpdateStack = (cloudFormation, config, TemplateBody, Parameters, api, create = true) => {
  const nVpcs = getNumberOfVpc(config);
  let subnet = 'A';
  const templatePromises = [];
  for(let i = 0; i < nVpcs; i ++) {
    templatePromises.push(
      api[create ? 'createStack' : 'updateStack'](cloudFormation, `vpc-nat-${subnet}`, TemplateBody, [...Parameters, { ParameterKey: 'SubnetZone', ParameterValue: subnet } ])
    );
    subnet++;
  }

  if(!create && nVpcs < 4) {
    for(let i = nVpcs; i < 4; i ++) {
      templatePromises.push(
        api.deleteStack(cloudFormation, `vpc-nat-${subnet}`)
          //TODO catch only errors caused by the absence of the stack (I try to delete stacks even if they do not exist)
          .catch(() => Promise.resolve())
      );
      subnet++;
    }
  }
  return templatePromises;
};

module.exports = {
  create: (cloudFormation, config, TemplateBody, Parameters, api) => createOrUpdateStack(cloudFormation, config, TemplateBody, Parameters, api),
  update: (cloudFormation, config, TemplateBody, Parameters, api) => createOrUpdateStack(cloudFormation, config, TemplateBody, Parameters, api, false),
  delete: (cloudFormation, config, api) => {
    const nVpcs = getNumberOfVpc(config);
    let subnet = 'A';
    const templatePromises = [];
    for(let i = 0; i < nVpcs; i ++) {
      templatePromises.push(
        api.deleteStack(cloudFormation, `vpc-nat-${subnet}`)
      );
      subnet++;
    }
    return templatePromises;
  }
};
