import { SSMClient } from '@aws-sdk/client-ssm';
import { runCommand } from '@oclif/test';
import { expect } from 'chai';
import { stub } from 'sinon';
import { table } from 'table';

describe('apps', () => {
  it('lists all apps', async () => {
    // Arrange
    const stubbedSSMClientSend = stub(SSMClient.prototype, 'send');
    stubbedSSMClientSend.resolves({
      Parameters: [
        {
          Name: '/caccl-deploy/test-app-1',
        },
        {
          Name: '/deploy/test-app-2',
        },
        {
          Name: '/caccl-deploy/test-app-3',
        },
      ],
    });

    // Act
    const { error, stdout, stderr } = await runCommand('apps');

    // Assert
    expect(stdout).to.contain(
      `${table([['App'], ['test-app-1'], ['test-app-3']])}\n`,
    );

    // No errors
    expect(stderr).to.equal('');
    if (!!error) {
      // Process exited with 0
      expect(error.message).to.equal('EEXIT: 0');
    }

    stubbedSSMClientSend.restore();
  });
});
