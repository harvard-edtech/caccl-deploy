const appImageIsValid = (val: string) => {
  if (!val.startsWith('arn:aws:ecr:us-east-1:542186135646:repository')) {
    return false;
  }

  if (val.split(':').at(-1)?.includes('/')) {
    return false;
  }

  return true;
};

export default appImageIsValid;
