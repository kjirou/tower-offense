import * as assert from 'assert'
import {
  beforeEach,
  describe,
  it,
} from 'mocha'

import {
  ApplicationState,
  BattleFieldMatrix,
  BattlePage,
  Creature,
  CreatureAppearance,
  CreatureWithPartyOnBattleFieldElement,
  Game,
  Job,
  Party,
  createBattleFieldMatrix,
  creatureUtils,
  ensureBattlePage,
  findBattleFieldElementByCreatureId,
  findCreatureById,
  findPartyByCreatureId,
} from '../../utils'
import {
  createCreature,
  createConstants,
  createJob,
  createStateDisplayBattlePageAtStartOfGame,
  findAllies,
  findFirstAlly,
} from '../../test-utils'
import {
  determineVictoryOrDefeat,
  doesPlayerHaveDefeat,
  doesPlayerHaveVictory,
  increaseRaidChargeForEachComputerCreatures,
  invokeAutoAttack,
  invokeRaid,
  invokeSkill,
  placePlayerFactionCreature,
  refillCardsOnPlayersHand,
  removeDeadCreatures,
  sortAutoAttackersOrder,
  spawnCreatures,
} from '../utils'

describe('reducers/utils', function() {
  describe('doesPlayerHaveVictory', function() {
    const parties: Party[] = [
      {factionId: 'player', creatureIds: ['x']},
      {factionId: 'computer', creatureIds: ['a', 'b']},
    ]
    const creatureAppearances: CreatureAppearance[] = [
      {turnNumber: 1, creatureIds: ['a']},
      {turnNumber: 2, creatureIds: ['b']},
    ]

    describe('ターン数が、computer 側クリーチャーの出現する最後のターンのとき', function() {
      const currentTurnNumber = 2

      it('computer 側クリーチャーが盤上に存在するとき、勝利ではない', function() {
        const battleFieldMatrix = createBattleFieldMatrix(1, 1)
        battleFieldMatrix[0][0].creatureId = 'a'
        assert.strictEqual(
          doesPlayerHaveVictory(parties, battleFieldMatrix, creatureAppearances, currentTurnNumber),
          false
        )
      })

      describe('computer 側クリーチャーが盤上に存在しないとき', function() {
        it('player 側クリーチャーが盤上に存在するときでも、勝利である', function() {
          const battleFieldMatrix = createBattleFieldMatrix(1, 1)
          battleFieldMatrix[0][0].creatureId = 'x'
          assert.strictEqual(
            doesPlayerHaveVictory(parties, battleFieldMatrix, creatureAppearances, currentTurnNumber),
            true
          )
        })
      })
    })

    describe('ターン数が、computer 側クリーチャーの出現する最後のターン未満のとき', function() {
      const currentTurnNumber = 1

      it('computer 側クリーチャーが盤上に存在しないときでも、勝利ではない', function() {
        const battleFieldMatrix = createBattleFieldMatrix(1, 1)
        assert.strictEqual(
          doesPlayerHaveVictory(parties, battleFieldMatrix, creatureAppearances, currentTurnNumber),
          false
        )
      })
    })
  })

  describe('doesPlayerHaveDefeat', function() {
    it('works', function() {
      assert.strictEqual(doesPlayerHaveDefeat(0), true)
      assert.strictEqual(doesPlayerHaveDefeat(1), false)
    })
  })

  describe('determineVictoryOrDefeat', function() {
    it('勝利条件と敗北条件を同時に満たすときは勝利を返す', function() {
      const parties: Party[] = [
        {factionId: 'computer', creatureIds: ['a']},
      ]
      const battleFieldMatrix = createBattleFieldMatrix(1, 1)
      const creatureAppearances: CreatureAppearance[] = [
        {turnNumber: 1, creatureIds: ['a']},
      ]
      assert.strictEqual(
        determineVictoryOrDefeat(
          parties,
          battleFieldMatrix,
          creatureAppearances,
          1,
          0
        ),
        'victory'
      )
    })
  })

  describe('removeDeadCreatures', function() {
    let creatures: Creature[]
    let battleFieldMatrix: BattleFieldMatrix

    beforeEach(function() {
      creatures = [createCreature()]
      battleFieldMatrix = createBattleFieldMatrix(1, 1)
    })

    describe('死亡しているクリーチャーがいるとき', function() {
      describe('死亡しているクリーチャーが player へ所属するとき', function() {
        let parties: Party[]

        beforeEach(function() {
          creatures[0].lifePoints = 0
          battleFieldMatrix[0][0].creatureId = creatures[0].id
          parties = [{
            factionId: 'player',
            creatureIds: creatures.map(e => e.id),
          }]
        })

        it('盤上から削除する', function() {
          const result = removeDeadCreatures(creatures, parties, battleFieldMatrix, [])
          assert.strictEqual(result.battleFieldMatrix[0][0].creatureId, undefined)
        })

        it('山札の末尾へ戻る', function() {
          const result = removeDeadCreatures(creatures, parties, battleFieldMatrix, [])
          assert.strictEqual(result.cardsInDeck.length, 1)
          assert.strictEqual(result.cardsInDeck[0].creatureId, creatures[0].id)
        })
      })

      describe('死亡しているクリーチャーが computer へ所属するとき', function() {
        let parties: Party[]

        beforeEach(function() {
          creatures[0].lifePoints = 0
          battleFieldMatrix[0][0].creatureId = creatures[0].id
          parties = [{
            factionId: 'computer',
            creatureIds: creatures.map(e => e.id),
          }]
        })

        it('盤上から削除する', function() {
          const result = removeDeadCreatures(creatures, parties, battleFieldMatrix, [])
          assert.strictEqual(result.battleFieldMatrix[0][0].creatureId, undefined)
        })

        it('山札は変わらない', function() {
          const result = removeDeadCreatures(creatures, parties, battleFieldMatrix, [])
          assert.strictEqual(result.cardsInDeck.length, 0)
        })
      })
    })

    describe('死亡していないクリーチャーがいるとき', function() {
      let parties: Party[]

      beforeEach(function() {
        creatures[0].lifePoints = 1
        battleFieldMatrix[0][0].creatureId = creatures[0].id
        parties = [{
          factionId: 'player',
          creatureIds: creatures.map(e => e.id),
        }]
      })

      it('盤上から削除しない', function() {
        const result = removeDeadCreatures(creatures, parties, battleFieldMatrix, [])
        assert.strictEqual(result.battleFieldMatrix[0][0].creatureId, creatures[0].id)
      })
    })
  })

  describe('invokeRaid', function() {
    it('headquartersLifePoints は 0 未満にならない', function() {
      const constants = createConstants()
      const creatures = [
        {
          ...createCreature(),
          _raidPowerForTest: 2,
        },
      ]
      const result = invokeRaid(constants, creatures, creatures[0].id, 1)
      assert.strictEqual(result.headquartersLifePoints, 0)
    })
  })

  describe('sortAutoAttackersOrder', function() {
    let creatures: Creature[]
    let parties: Party[]
    let matrix: BattleFieldMatrix
    let attackers: CreatureWithPartyOnBattleFieldElement[]

    beforeEach(function() {
      creatures = [
        createCreature(),
        createCreature(),
        createCreature(),
        createCreature(),
      ]
      parties = [
        {
          factionId: 'computer',
          creatureIds: [creatures[0].id, creatures[2].id],
        },
        {
          factionId: 'player',
          creatureIds: [creatures[1].id, creatures[3].id],
        },
      ]
      matrix = createBattleFieldMatrix(1, creatures.length)
      for (let i = 0; i <  creatures.length; i++) {
        creatures[i].placementOrder = creatures.length - i
        matrix[0][i].creatureId = creatures[i].id
      }
      // [0] = computer 側 / 配置順 4
      // [1] =   player 側 / 配置順 3
      // [2] = computer 側 / 配置順 2
      // [3] =   player 側 / 配置順 1
      attackers = creatures.map(creature => {
        return {
          creature,
          party: findPartyByCreatureId(parties, creature.id),
          battleFieldElement: findBattleFieldElementByCreatureId(matrix, creature.id),
        }
      })
    })

    it('第 1 にplayer 側が先頭になるように、第 2 に配置順の昇順で、整列する', function() {
      const newAttackers = sortAutoAttackersOrder(attackers)
      assert.strictEqual(newAttackers[0].party.factionId, 'player')
      assert.strictEqual(newAttackers[1].party.factionId, 'player')
      assert.strictEqual(
        newAttackers[0].creature.placementOrder < newAttackers[1].creature.placementOrder,
        true
      )
      assert.strictEqual(newAttackers[2].party.factionId, 'computer')
      assert.strictEqual(newAttackers[3].party.factionId, 'computer')
      assert.strictEqual(
        newAttackers[2].creature.placementOrder < newAttackers[3].creature.placementOrder,
        true
      )
    })
  })

  describe('invokeAutoAttack', function() {
    describe('攻撃者の自動攻撃範囲内に敵が配置されている状況で、自動攻撃を行なったとき', function() {
      let state: ApplicationState
      let battlePage: BattlePage
      let attacker: Creature

      beforeEach(function() {
        state = createStateDisplayBattlePageAtStartOfGame()
        battlePage = ensureBattlePage(state)
        attacker = findCreatureById(battlePage.game.creatures, battlePage.game.cardsOnPlayersHand[0].creatureId)
        attacker._attackPowerForTest = 1
        battlePage.game.battleFieldMatrix[1][1].creatureId = attacker.id
      })

      describe('攻撃対象の敵が 1 体のみのとき', function() {
        let enemy: Creature
        let result: ReturnType<typeof invokeAutoAttack>

        beforeEach(function() {
          enemy = findFirstAlly(battlePage.game.creatures, battlePage.game.parties, 'computer')
          enemy._maxLifePointsForTest = 2
          enemy.lifePoints = 2
          battlePage.game.battleFieldMatrix[0][1].creatureId = enemy.id
          result = invokeAutoAttack(
            battlePage.game.constants,
            battlePage.game.creatures,
            battlePage.game.parties,
            battlePage.game.battleFieldMatrix,
            attacker.id,
          )
        })

        it('敵へダメージを与える', function() {
          const newEnemy = findCreatureById(result.creatures, enemy.id)
          assert.strictEqual(newEnemy.lifePoints < enemy.lifePoints, true)
        })

        it('攻撃者の自動攻撃発動済みフラグが true である', function() {
          const newAttacker = findCreatureById(result.creatures, attacker.id)
          assert.strictEqual(newAttacker.autoAttackInvoked, true)
        })
      })

      describe('攻撃対象の敵が複数体のとき', function() {
        let enemies: Creature[]

        beforeEach(function() {
          enemies = findAllies(battlePage.game.creatures, battlePage.game.parties, 'computer').slice(3)
          for (const enemy of enemies) {
            enemy._maxLifePointsForTest = 2
            enemy.lifePoints = 2
          }
          battlePage.game.battleFieldMatrix[0][1].creatureId = enemies[0].id
          battlePage.game.battleFieldMatrix[1][0].creatureId = enemies[1].id
          battlePage.game.battleFieldMatrix[1][2].creatureId = enemies[2].id
        })

        it('攻撃者の攻撃対象数が 1 のとき、配置順が最も低い攻撃対象のみを攻撃する', function() {
          attacker._autoAttackTargetsForTest = 1
          enemies[0].placementOrder = 2
          enemies[1].placementOrder = 1
          enemies[2].placementOrder = 3
          const result = invokeAutoAttack(
            battlePage.game.constants,
            battlePage.game.creatures,
            battlePage.game.parties,
            battlePage.game.battleFieldMatrix,
            attacker.id,
          )
          const newEnemies = enemies.map(e => findCreatureById(result.creatures, e.id))
          assert.strictEqual(newEnemies[0].lifePoints < 2, false)
          assert.strictEqual(newEnemies[1].lifePoints < 2, true)
          assert.strictEqual(newEnemies[2].lifePoints < 2, false)
        })

        it('攻撃者の攻撃対象数が複数のとき、配置順が低い順に複数の攻撃対象を攻撃する', function() {
          attacker._autoAttackTargetsForTest = 2
          enemies[0].placementOrder = 2
          enemies[1].placementOrder = 1
          enemies[2].placementOrder = 3
          const result = invokeAutoAttack(
            battlePage.game.constants,
            battlePage.game.creatures,
            battlePage.game.parties,
            battlePage.game.battleFieldMatrix,
            attacker.id,
          )
          const newEnemies = enemies.map(e => findCreatureById(result.creatures, e.id))
          assert.strictEqual(newEnemies[0].lifePoints < 2, true)
          assert.strictEqual(newEnemies[1].lifePoints < 2, true)
          assert.strictEqual(newEnemies[2].lifePoints < 2, false)
        })
      })
    })

    describe('攻撃者の自動攻撃範囲外に敵が配置されている状況で、自動攻撃を行なったとき', function() {
      let state: ApplicationState
      let battlePage: BattlePage
      let attacker: Creature
      let enemy: Creature
      let result: ReturnType<typeof invokeAutoAttack>

      beforeEach(function() {
        state = createStateDisplayBattlePageAtStartOfGame()
        battlePage = ensureBattlePage(state)
        attacker = findCreatureById(battlePage.game.creatures, battlePage.game.cardsOnPlayersHand[0].creatureId)
        attacker._attackPowerForTest = 1
        enemy = findFirstAlly(battlePage.game.creatures, battlePage.game.parties, 'computer')
        enemy._maxLifePointsForTest = 2
        enemy.lifePoints = 2
        battlePage.game.battleFieldMatrix[0][0].creatureId = attacker.id
        battlePage.game.battleFieldMatrix[0][2].creatureId = enemy.id
        result = invokeAutoAttack(
          battlePage.game.constants,
          battlePage.game.creatures,
          battlePage.game.parties,
          battlePage.game.battleFieldMatrix,
          attacker.id,
        )
      })

      it('敵へダメージを与えない', function() {
        const newEnemy = findCreatureById(result.creatures, enemy.id)
        assert.strictEqual(newEnemy.lifePoints, enemy.lifePoints)
      })

      it('攻撃者の自動攻撃発動済みフラグが false である', function() {
        const newAttacker = findCreatureById(result.creatures, attacker.id)
        assert.strictEqual(newAttacker.autoAttackInvoked, false)
      })
    })
  })

  describe('invokeSkill', function() {
    describe('Attack skill', function() {
      describe('When an invoker is adjacent to an enemy', function() {
        it('can attack the enemy', function() {
          const state = createStateDisplayBattlePageAtStartOfGame()
          const battlePage = ensureBattlePage(state)
          const invoker = findFirstAlly(battlePage.game.creatures, battlePage.game.parties, 'player')
          const enemy = findFirstAlly(battlePage.game.creatures, battlePage.game.parties, 'computer')
          battlePage.game.battleFieldMatrix[0][0].creatureId = invoker.id
          battlePage.game.battleFieldMatrix[0][1].creatureId = enemy.id
          const result = invokeSkill({
            constants: battlePage.game.constants,
            skill: {
              id: '',
              skillCategoryId: 'attack',
            },
            creatures: battlePage.game.creatures,
            parties: battlePage.game.parties,
            battleFieldMatrix: battlePage.game.battleFieldMatrix,
            invokerCreatureId: invoker.id,
          })
          const newEnemy = findCreatureById(result.creatures, enemy.id)
          assert.strictEqual(newEnemy.lifePoints < enemy.lifePoints, true)
        })
      })
    })
  })

  describe('placePlayerFactionCreature', function() {
    let a: Creature
    let creatures: Creature[]
    let matrix: BattleFieldMatrix

    beforeEach(function() {
      a = createCreature()
      creatures = [a]
      matrix = createBattleFieldMatrix(1, 1)
    })

    it('指定したマスにクリーチャーが存在するとき、例外を発生する', function() {
      matrix[0][0].creatureId = 'a'
      assert.throws(() => {
        placePlayerFactionCreature(creatures, matrix, [], a.id, {y: 0, x: 0})
      }, /creature exist/)
    })

    it('指定したクリーチャーが手札にないとき、例外を発生する', function() {
      assert.throws(() => {
        placePlayerFactionCreature(creatures, matrix, [], 'foo', {y: 0, x: 0})
      }, /does not exist/)
    })

    it('盤上へクリーチャーが配置される', function() {
      const result = placePlayerFactionCreature(creatures, matrix, [{creatureId: a.id}], a.id, {y: 0, x: 0})
      assert.strictEqual(result.battleFieldMatrix[0][0].creatureId, a.id)
    })

    it('指定したクリーチャーのカードが手札から削除される', function() {
      const result = placePlayerFactionCreature(
        creatures, matrix, [{creatureId: a.id}, {creatureId: 'foo'}], a.id, {y: 0, x: 0})
      assert.deepStrictEqual(result.cardsOnPlayersHand, [{creatureId: 'foo'}])
    })

    it('指定したクリーチャーの配置順を増加する', function() {
      const result = placePlayerFactionCreature(creatures, matrix, [{creatureId: a.id}], a.id, {y: 0, x: 0})
      assert.strictEqual(result.creatures[0].placementOrder > a.placementOrder, true)
    })
  })

  describe('refillCardsOnPlayersHand', function() {
    it('works', function() {
      const result = refillCardsOnPlayersHand(
        [
          {creatureId: 'a'},
          {creatureId: 'b'},
          {creatureId: 'c'},
          {creatureId: 'd'},
          {creatureId: 'e'},
        ],
        [
          {creatureId: 'x'},
          {creatureId: 'y'},
        ]
      )
      assert.deepStrictEqual(result.cardsInDeck, [
        {creatureId: 'd'},
        {creatureId: 'e'},
      ])
      assert.deepStrictEqual(result.cardsOnPlayersHand, [
        {creatureId: 'x'},
        {creatureId: 'y'},
        {creatureId: 'a'},
        {creatureId: 'b'},
        {creatureId: 'c'},
      ])
    })
  })

  describe('spawnCreatures', function() {
    let a: Creature
    let b: Creature
    let creatures: Creature[]
    let matrix: BattleFieldMatrix
    let creatureAppearances: CreatureAppearance[]

    beforeEach(function() {
      a = createCreature()
      b = createCreature()
      creatures = [a, b]
      matrix = createBattleFieldMatrix(3, 3)
      creatureAppearances = [
        {
          turnNumber: 2,
          creatureIds: [a.id, b.id],
        }
      ]
    })

    describe('出現が登録されているターン数を指定したとき', function() {
      const turnNumber = 2

      it('クリーチャーが盤上へ出現する', function() {
        const result = spawnCreatures(
          creatures, matrix, creatureAppearances, turnNumber, () => [matrix[0][0], matrix[0][1]])
        assert.strictEqual(result.battleFieldMatrix[0][0].creatureId, a.id)
        assert.strictEqual(result.battleFieldMatrix[0][1].creatureId, b.id)
      })

      it('出現したクリーチャーの配置順を増加する', function() {
        const result = spawnCreatures(
          creatures, matrix, creatureAppearances, turnNumber, () => [matrix[0][0], matrix[0][1]])
        const newA = findCreatureById(result.creatures, a.id)
        const newB = findCreatureById(result.creatures, b.id)
        assert.strictEqual(newA.placementOrder > a.placementOrder, true)
        assert.strictEqual(newB.placementOrder > b.placementOrder, true)
      })
    })
  })

  describe('increaseRaidChargeForEachComputerCreatures', function() {
    let constants: Game['constants']
    let creatures: Creature[]
    let c: Creature
    let p: Creature
    let parties: Party[]
    let battleFieldMatrix: BattleFieldMatrix

    beforeEach(function() {
      constants = createConstants()
      constants.jobs[0].raidInterval = 2
      c = {
        ...createCreature(),
        raidCharge: 0,
      },
      p = {
        ...createCreature(),
        raidCharge: 0,
      },
      creatures = [c, p]
      parties = [
        {
          factionId: 'computer',
          creatureIds: [c.id],
        },
        {
          factionId: 'player',
          creatureIds: [p.id],
        },
      ]
      battleFieldMatrix = createBattleFieldMatrix(1, 1)
    })

    it('配置されている player 側クリーチャーの raidCharge は増加しない', function() {
      battleFieldMatrix[0][0].creatureId = p.id
      const result = increaseRaidChargeForEachComputerCreatures(
        constants, creatures, parties, battleFieldMatrix)
      const newP = findCreatureById(result.creatures, p.id)
      assert.strictEqual(newP.raidCharge, p.raidCharge)
    })

    it('配置されていない computer 側クリーチャーの raidCharge は増加しない', function() {
      const result = increaseRaidChargeForEachComputerCreatures(
        constants, creatures, parties, battleFieldMatrix)
      const newC = findCreatureById(result.creatures, c.id)
      assert.strictEqual(newC.raidCharge, c.raidCharge)
    })

    describe('配置されている computer 側クリーチャーが存在するとき', function() {
      beforeEach(function() {
        battleFieldMatrix[0][0].creatureId = c.id
      })

      describe('そのクリーチャーの自動攻撃発動済みフラグが false のとき', function() {
        beforeEach(function() {
          c.autoAttackInvoked = false
        })

        it('そのクリーチャーの raidCharge を増加する', function() {
          const result = increaseRaidChargeForEachComputerCreatures(
            constants, creatures, parties, battleFieldMatrix)
          const newC = findCreatureById(result.creatures, c.id)
          assert.strictEqual(newC.raidCharge > c.raidCharge, true)
        })
      })

      describe('そのクリーチャーの自動攻撃発動済みフラグが true のとき', function() {
        beforeEach(function() {
          c.autoAttackInvoked = true
        })

        it('そのクリーチャーの raidCharge は変化しない', function() {
          const result = increaseRaidChargeForEachComputerCreatures(
            constants, creatures, parties, battleFieldMatrix)
          const newC = findCreatureById(result.creatures, c.id)
          assert.strictEqual(newC.raidCharge, c.raidCharge)
        })
      })
    })
  })
})
