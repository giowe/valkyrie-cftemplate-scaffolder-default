module.exports = {
    templates: [
        {
            name: 'vpc',
            required: false,
            default: false,
            sources: [
                {
                    template: 'vpc-2azs.yaml',
                    inputs: [
                        { type: 'input', name: 'ClassB', message: 'class B:' }
                    ]
                },
                {
                    template: 'vpc-3azs.yaml',
                    inputs: [
                        { type: 'input', name: 'ClassB', message: 'class B:' }
                    ]
                },
                {
                    template: 'vpc-4azs.yaml',
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
            sources: [
                {
                    template: 'vpc-nat-gateway.yaml',
                    inputs: []
                },
                {
                    template: 'vpc-nat-instance.yaml',
                    inputs: [
                        { type: 'list', name: 'NATInstanceType', message: 'Instance type of the NAT instance:', choices: ['t2.nano', 't2.micro', 'TODO'] }
                    ]
                }
            ]
        },
        {
            name: 'security-groups',
            dependsOn: 'vpc',
            required: false,
            default: true,
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
                        { type: 'list', name: 'Runtime', message: 'memory size:', choices: ['nodejs6.10']},
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