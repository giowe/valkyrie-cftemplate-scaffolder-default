module.exports = {
  templates: [
    {
      name: 'vpc',
      required: false,
      default: false,
      message: 'Do you want to setup a VPC?',
      sources: [
        {
          template: 'vpc-2azs.yaml',
          message: 'VPC with 2 AZs',
          inputs: [
            { type: 'input', name: 'ClassB', message: 'class B:' }
          ]
        },
        {
          template: 'vpc-3azs.yaml',
          message: 'VPC with 3 AZs',
          inputs: [
            { type: 'input', name: 'ClassB', message: 'class B:' }
          ]
        },
        {
          template: 'vpc-4azs.yaml',
          message: 'VPC with 4 AZs',
          inputs: [
            { type: 'input', name: 'ClassB', message: 'class B:' }
          ]
        }
      ]
    },
    {
      name: 'vpc-nat',
      dependsOn: 'vpc',
      required: false,
      default: false,
      message: 'Do you want to setup a VPC nat to allow your to connect to the Internet?',
      sources: [
        {
          template: 'vpc-nat-gateway.yaml',
          message: 'VPC NAT gateway',
          inputs: []
        },
        {
          template: 'vpc-nat-instance.yaml',
          message: 'VPC NAT instance',
          inputs: [
            { type: 'list', name: 'NATInstanceType', message: 'Instance type of the NAT instance:', choices: ['t2.nano', 't2.micro', 'TODO'], default: 0 }
          ]
        }
      ]
    },
    {
      name: 'security-groups',
      dependsOn: 'vpc',
      required: false,
      default: true,
      message: 'Do you want to setup a security group for your lambda?',
      sources: [
        {
          template: 'lambda-security-group.yaml',
          inputs: []
        }
      ]
    },
    {
      name: 'lambda',
      required: true,
      sources: [
        {
          template: 'lambda.yaml',
          inputs: [
            { type: 'input', name: 'MemorySize', message: 'memory size:' },
            { type: 'list', name: 'Runtime', message: 'lambda runtime:', choices: ['nodejs6.10', 'nodejs4.3'], default: 0},
            { type: 'input', name: 'Timeout', message: 'execution timeout:', default: 3}
          ]
        }
      ]
    },
    {
      name: 'apigateway',
      required: true,
      sources: [
        {
          template: 'apigateway.yaml',
          inputs: []
        }
      ]
    }
  ]
};
