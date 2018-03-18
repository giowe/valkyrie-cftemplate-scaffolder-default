const templates = require('./templates.json');
const fs = require('fs');
module.exports = {
  create: (cloudFormation, config) => {
    const { vpc, 'vpc-nat': vpcNat, lambda } = config;

    const { enabled: vpcEnabled, type: vpcType, parameters: { ClassB } } = vpc;
    const { enabled: vpcNatEnabled, type: vpcNatType, parameters: { ClassB } } = vpcNat;

    if(vpcEnabled) {
      cloudFormation.createStack({
        StackName: vpcType,
        TemplateBody: fs.readFileSync(`vpc/${vpcType}.yaml`),
        Parameters: [
          {
            ParameterKey: 'ClassB',
            ParameterValue: ClassB
          }
        ]
      })


    }




  },
  update: (cloudFormation, config) => {},
  delete: (cloudFormation, config) => {},
  templates
};
