import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('images', () => {
  it('runs images cmd', async () => {
    const {stdout} = await runCommand('images')
    expect(stdout).to.contain('hello world')
  })

  it('runs images --name oclif', async () => {
    const {stdout} = await runCommand('images --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
