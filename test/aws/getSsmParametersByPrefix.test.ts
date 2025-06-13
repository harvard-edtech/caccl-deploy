import { expect } from 'chai';

import { getSsmParametersByPrefix } from '../../src/aws/index.js';

describe('getSsmParametersByPrefix', () => {
  it('retrieves the SSM parameters', async () => {
    // Arrange
    global.awsMocks.SSM.resolves({
      Parameters: [
        {
          Name: '/caccl-deploy/test/test-1',
          Value: 'test-1',
        },
        {
          Name: '/caccl-deploy/test/test-2',
          Value: 'test-2',
        },
        {
          Name: '/caccl-deploy/test/test-3',
          Value: 'test-3',
        },
      ],
    });

    // Act
    const params = await getSsmParametersByPrefix('/caccl-deploy/test');

    // Assert
    expect(params).to.not.be.null;
    expect(global.awsMocks.SSM.calledOnce).to.be.true;

    expect(params[0].Name).to.eq('/caccl-deploy/test/test-1');
    expect(params[1].Value).to.eq('test-2');

    global.awsMocks.SSM.reset();
  });
});
