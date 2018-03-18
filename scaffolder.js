const templates = require('./templates.json');
const fs = require('fs');

const toCloudFormationParameters = (configNode) => {
  return Object.keys(configNode).map(ParameterKey => ({
    ParameterKey,
    ParameterValue: configNode[ParameterKey]
  }));
};

module.exports = {
  create: (cloudFormation, config, s3Bucket, s3ObjectVersion) => {
    const { vpc, 'vpc-nat': vpcNat, 'security-groups': securityGroups, lambda, EnvironmentName, Description } = config;
    const { enabled: vpcEnabled, type: vpcType, parameters: vpcParameters } = vpc;
    const { enabled: vpcNatEnabled, type: vpcNatType, parameters: vpcNatParameters } = vpcNat;
    const { enabled: securityGroupEnabled  } = securityGroups;
    const { parameters: lambdaParameters } = lambda;

    if(vpcEnabled) {
      cloudFormation.createStack({
        StackName: vpcType,
        TemplateBody: fs.readFileSync(`vpc/${vpcType}.yaml`),
        Parameters: toCloudFormationParameters(vpcParameters)
      });

      if(vpcNatEnabled) {
        cloudFormation.createStack({
          StackName: vpcNatType,
          TemplateBody: fs.readFileSync(`vpc-nat/${vpcNatType}.yaml`),
          Parameters: toCloudFormationParameters(vpcNatParameters).push({ ParameterKey: 'ParentVPCStack', ParameterValue: vpcType })
        });
      }

      if(securityGroupEnabled) {
        cloudFormation.createStack({
          StackName: 'lambda-security-group',
          TemplateBody: fs.readFileSync(`security-groups/lambda-security-group.yaml`),
          Parameters: [
            {
              ParameterKey: 'EnvironmentName',
              ParameterValue: EnvironmentName
            },
            {
              ParameterKey: 'ParentVPCStack',
              ParameterValue: vpcType
            }
          ]
        });
      }

      cloudFormation.createStack({
        StackName: 'lambda',
        TemplateBody: fs.readFileSync(`lambda/lambda.yaml`),
        Parameters: toCloudFormationParameters(lambdaParameters)
          .concat([
            {
              ParameterKey: 'EnvironmentName',
              ParameterValue: EnvironmentName
            },
            {
              ParameterKey: 'LambdaDescription',
              ParameterValue: Description
            },
            {
              ParameterKey: 'ParentVPCStack',
              ParameterValue: vpcType
            },
            {
              ParameterKey: 'S3Bucket',
              ParameterValue: s3Bucket
            },
            {
              ParameterKey: 'S3ObjectVersion',
              ParameterValue: s3ObjectVersion
            },
            {
              ParameterKey: 'ParentSecurityGroupStack',
              ParameterValue: 'lambda-security-group'
            }
          ])
      })
    }
  },
  update: (cloudFormation, config) => {},
  delete: (cloudFormation, config) => {},
  templates
};
