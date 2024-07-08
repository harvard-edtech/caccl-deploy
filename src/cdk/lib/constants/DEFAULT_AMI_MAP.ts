// TODO: this will need to be expanded if this project is to be used outside of DCE
const DEFAULT_AMI_MAP = {
  // this value should be updated on a regular basis.
  // the latest amazon linux ami is recorded in the public parameter store entry
  // /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2
  'us-east-1': 'ami-02b972fec07f1e659',
};

export default DEFAULT_AMI_MAP;
