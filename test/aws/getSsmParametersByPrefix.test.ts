// import { SSMClient } from '@aws-sdk/client-ssm';
// import { expect } from 'chai';
// import { stub } from 'sinon';

// import { getSsmParametersByPrefix } from '../../src/aws/index.js';

// describe('getSsmParametersByPrefix', () => {
//   it('retrieves the SSM parameters', async () => {
//     // Arrange
//     const stubbedSSMClientSend = stub(SSMClient.prototype, 'send');
//     stubbedSSMClientSend.resolves({
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

//     // Act
//     const params = await getSsmParametersByPrefix('/caccl-deploy/test');

//     // Assert
//     expect(params).to.be.null

//     expect(stubbedSSMClientSend.calledOnce).to.be.true;

//     stubbedSSMClientSend.restore();
//   });
// });
