/**
 * @fileoverview Tests for UserTeamModel custom queries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserTeamModel } from '../../src/modules/teams/user-team.model.js'

const makeBuilder = (rows: any[] = []) => {
  const calls: any[] = []
  const builder: any = {
    calls,
    select: vi.fn(() => builder),
    where: vi.fn((arg: any, arg2?: any) => {
      calls.push({ type: 'where', arg, arg2 })
      return builder
    }),
    whereIn: vi.fn((col: string, vals: any[]) => {
      calls.push({ type: 'whereIn', col, vals })
      return builder
    }),
    join: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    onConflict: vi.fn(() => ({ merge: vi.fn(() => Promise.resolve()) })),
    insert: vi.fn(() => builder),
    delete: vi.fn(() => Promise.resolve()),
    first: vi.fn(() => Promise.resolve(rows[0])),
    then: (resolve: any) => Promise.resolve(rows).then(resolve),
  }
  return builder
}

describe('UserTeamModel', () => {
  let model: UserTeamModel
  let builder: any
  let mockKnex: any

  const setup = (rows: any[]) => {
    builder = makeBuilder(rows)
    mockKnex = vi.fn(() => builder)
    model = new UserTeamModel()
    ;(model as any).knex = mockKnex
  }

  beforeEach(() => {
    setup([])
  })

  it('findTeamsByUserId returns team ids', async () => {
    setup([{ team_id: 't1' }, { team_id: 't2' }])

    const teams = await model.findTeamsByUserId('u1')

    expect(mockKnex).toHaveBeenCalledWith('user_teams')
    expect(builder.select).toHaveBeenCalledWith('team_id')
    expect(builder.where).toHaveBeenCalledWith({ user_id: 'u1' })
    expect(teams).toEqual(['t1', 't2'])
  })

  it('upsert merges on conflict', async () => {
    await model.upsert('u1', 't1', 'leader')

    expect(mockKnex).toHaveBeenCalledWith('user_teams')
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', team_id: 't1', role: 'leader' })
    expect(builder.onConflict).toHaveBeenCalledWith(['user_id', 'team_id'])
  })

  it('deleteByUserAndTeam deletes with both ids', async () => {
    await model.deleteByUserAndTeam('u1', 't1')

    expect(builder.where).toHaveBeenCalledWith({ user_id: 'u1', team_id: 't1' })
    expect(builder.delete).toHaveBeenCalled()
  })

  it('findMembersByTeamId joins users and orders', async () => {
    await model.findMembersByTeamId('team-1')

    expect(mockKnex).toHaveBeenCalledWith('user_teams')
    expect(builder.join).toHaveBeenCalledWith('users', 'users.id', 'user_teams.user_id')
    expect(builder.where).toHaveBeenCalledWith('user_teams.team_id', 'team-1')
    expect(builder.orderBy).toHaveBeenCalled()
  })

  it('findTeamsWithDetailsByUserId queries teams join', async () => {
    await model.findTeamsWithDetailsByUserId('u1')

    expect(mockKnex).toHaveBeenCalledWith('teams')
    expect(builder.join).toHaveBeenCalledWith('user_teams', 'teams.id', 'user_teams.team_id')
    expect(builder.where).toHaveBeenCalledWith('user_teams.user_id', 'u1')
  })

  it('findUsersByIds returns empty when no ids', async () => {
    const users = await model.findUsersByIds([])

    expect(users).toEqual([])
    expect(mockKnex).not.toHaveBeenCalled()
  })

  it('findUsersByIds queries when ids provided', async () => {
    await model.findUsersByIds(['a', 'b'])

    expect(mockKnex).toHaveBeenCalledWith('users')
    expect(builder.whereIn).toHaveBeenCalledWith('id', ['a', 'b'])
  })
})
