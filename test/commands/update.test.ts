// import { SSMClient } from '@aws-sdk/client-ssm';
// import { runCommand } from '@oclif/test';
// import { expect } from 'chai';
// import { stub } from 'sinon';

// describe('update', () => {
//   it('updates an SSM parameter', async () => {
//     // Arrange
//     const stubbedSSMClientSend = stub(SSMClient.prototype, 'send');
//     stubbedSSMClientSend.onFirstCall().resolves({
//       Parameters: [
//         {
//           Name: '/caccl-deploy/test/test-1',
//           Value: 'test-1',
//         },
//         {
//           Name: '/caccl-deploy/test/test-2',
//           Value: 'test-2',
//         },
//         {
//           Name: '/caccl-deploy/test/test-3',
//           Value: 'test-3',
//         },
//       ],
//     });
//     stubbedSSMClientSend.resolves({});

//     // Act
//     const { error, stdout, stderr } = await runCommand(
//       'update -a test key value',
//     );

//     // Assert
//     // No errors
//     expect(stderr).to.equal('');
//     // expect(error).to.be.null;
//     expect(error?.message).to.be.null;
//     expect(stdout).to.contain('ssm parameter /caccl-deploy/test/key created');

//     // const expectedPutParamsOpts = {
//     //   Name: '/caccl-deploy/test/key',
//     //   Value: 'value',
//     //   Type: 'String',
//     //   Overwrite: true,
//     //   Description: 'Created and managed by caccl-deploy. ',
//     // };

//     expect(stubbedSSMClientSend.calledTwice).to.be.true;
//     // expect(putParameterSpy.calledWithMatch(expectedPutParamsOpts)).to.be.true;
//   });
// });
