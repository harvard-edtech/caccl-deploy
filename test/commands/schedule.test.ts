import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('schedule', () => {
  it('runs schedule cmd', async () => {
    const {stdout} = await runCommand('schedule')
    expect(stdout).to.contain('hello world')
  })

  it('runs schedule --name oclif', async () => {
    const {stdout} = await runCommand('schedule --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
