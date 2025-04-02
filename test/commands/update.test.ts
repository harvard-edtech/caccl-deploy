// Import oclif test
import { runCommand } from '@oclif/test';

// Import AWS SDK mock
import AWSMock from 'aws-sdk-mock';

// Import char
import { expect } from 'chai';

// Import sinon, for stubbing
import * as sinon from 'sinon';

describe('update', () => {
  it('updates an SSM parameter', async () => {
    // Arrange
    const putParameterSpy = sinon.stub().returns({});
    AWSMock.mock('SSM', 'putParameter', putParameterSpy);

    AWSMock.mock('SSM', 'getParametersByPath', {
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
    const { error, stdout, stderr } = await runCommand(
      'update -a test key value',
    );

    // Assert
    expect(stdout).to.contain('ssm parameter /caccl-deploy/test/key created');

    const expectedPutParamsOpts = {
      Name: '/caccl-deploy/test/key',
      Value: 'value',
      Type: 'String',
      Overwrite: true,
      Description: 'Created and managed by caccl-deploy. ',
    };

    expect(putParameterSpy.calledOnce).to.be.true;
    expect(putParameterSpy.calledWithMatch(expectedPutParamsOpts)).to.be.true;

    // No errors
    expect(stderr).to.equal('');
    expect(error).to.be.null;
  });
});
