import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('repos', () => {
  it('runs repos cmd', async () => {
    const {stdout} = await runCommand('repos')
    expect(stdout).to.contain('hello world')
  })

  it('runs repos --name oclif', async () => {
    const {stdout} = await runCommand('repos --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
