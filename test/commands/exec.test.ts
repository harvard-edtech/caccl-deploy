import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('exec', () => {
  it('runs exec cmd', async () => {
    const {stdout} = await runCommand('exec')
    expect(stdout).to.contain('hello world')
  })

  it('runs exec --name oclif', async () => {
    const {stdout} = await runCommand('exec --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
