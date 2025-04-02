import { ECRClient } from '@aws-sdk/client-ecr';
import { runCommand } from '@oclif/test';
import { expect } from 'chai';
import { stub } from 'sinon';
import { table } from 'table';

describe('repos', () => {
  it('lists all repos', async () => {
    // Arrange
    const stubbedECRClientSend = stub(ECRClient.prototype, 'send');
    stubbedECRClientSend.onFirstCall().resolves({
      repositories: [
        {
          repositoryName: 'test-1',
          repositoryArn: 'fake-arn',
        },
        {
          repositoryName: 'test-2',
          repositoryArn: 'fake-arn',
        },
        {
          repositoryName: 'test-3',
          repositoryArn: 'fake-arn',
        },
      ],
    });
    stubbedECRClientSend.resolves({
      tags: [
        {
          Key: 'product',
          Value: 'edtech-apps',
        },
      ],
    });

    // Act
    const { stdout, error, stderr } = await runCommand('repos');

    //Assert
    // No errors
    expect(stderr).to.equal('');
    if (!!error) {
      // Process exited with 0
      expect(error.message).to.equal('EEXIT: 0');
    }
    expect(stdout).to.contain(
      table([['Repository Name'], ['test-1'], ['test-2'], ['test-3']]),
    );

    stubbedECRClientSend.restore();
  });
});
