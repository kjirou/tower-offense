import {
  ApplicationState,
  Card,
  Creature,
  FactionId,
  Game,
  Job,
  DEFAULT_PLACEMENT_ORDER,
  MAX_NUMBER_OF_PLAYERS_HAND,
  Party,
  createBattleFieldMatrix,
  determineRelationshipBetweenFactions,
  findCreatureWithParty,
} from './utils'
import {
  Props as BattlePageProps,
} from './components/pages/BattlePage'
import {
  Props as RootProps,
} from './components/Root'

/**
 * 整数を元にしたユニークIDを作成する関数を作成する
 *
 * ユニークIDの仕様は、呼び出し毎に整数として +1 され文字列化されたもの。
 * 例えば、0 を初期値とした初回の呼び出しは "1" 、次は "2" ... "10" ... 最大は "9007199254740991" である。
 * 最大の状態から呼び出した場合は例外を投げる。
 */
function createNumericUidCreator(startingCount: number): () => string {
  // Number.MAX_SAFE_INTEGER は IE に存在しないのでベタ書きする
  const maxSafeInteger = 9007199254740991
  let count = startingCount
  return () => {
    if (count >= maxSafeInteger) {
      throw new Error('It can no longer create UIDs')
    }
    count++
    return count.toString()
  };
}

const createUid = createNumericUidCreator(0)

export function createJob(): Job {
  return {
    id: 'dummy-job',
    attackPower: 1,
    maxLifePoints: 1,
    raidInterval: 0,
    raidPower: 1,
    autoAttackRange: {
      rangeShapeKey: 'circle',
      minReach: 1,
      maxReach: 1,
    },
    autoAttackTargets: 1,
  }
}

export function createConstants(): Game['constants'] {
  return {
    jobs: [
      createJob(),
    ],
  }
}

export function createCreature(): Creature {
  const job = createJob()
  return {
    id: createUid(),
    // TODO: jobs に存在するもののみに制約できるようにする。
    jobId: job.id,
    lifePoints: 1,
    raidCharge: 0,
    skillIds: [],
    autoAttackInvoked: false,
    placementOrder: DEFAULT_PLACEMENT_ORDER,
  }
}

export function findAllies(creatures: Creature[], parties: Party[], factionId: FactionId): Creature[] {
  const allies: Creature[] = []
  for (const creature of creatures) {
    const creatureWithParty = findCreatureWithParty(creatures, parties, creature.id)
    if (determineRelationshipBetweenFactions(factionId, creatureWithParty.party.factionId) === 'ally') {
      allies.push(creature)
    }
  }
  return allies
}

export function findFirstAlly(creatures: Creature[], parties: Party[], factionId: FactionId): Creature {
  const allies = findAllies(creatures, parties, factionId)
  if (allies.length > 0) {
    return allies[0]
  }
  throw new Error('Can not find an ally.')
}

export function ensureBattlePageProps(props: RootProps): BattlePageProps {
  const battlePage = props.pages.battle
  if (battlePage === undefined) {
    throw new Error('`props.pages.battle` does not exist.')
  }
  return battlePage
}

/**
 * 戦闘開始直後の BattlePage を想定した状態を生成する。
 */
export function createStateDisplayBattlePageAtStartOfGame(): ApplicationState {
  const constants = createConstants()
  const allies = Array.from({length: 10}).map(() => createCreature())
  const enemies = Array.from({length: 10}).map(() => createCreature())
  const creatures = allies.concat(enemies)
  const cards: Card[] = allies.map(creature => {
    return {
      creatureId: creature.id,
      skillCategoryId: 'attack',
    }
  })
  return {
    pages: {
      battle: {
        game: {
          constants,
          creatures,
          parties: [
            {
              factionId: 'player',
              creatureIds: allies.map(e => e.id),
            },
            {
              factionId: 'computer',
              creatureIds: enemies.map(e => e.id),
            },
          ],
          battleFieldMatrix: createBattleFieldMatrix(7, 7),
          cards,
          cardsInDeck: cards.slice(MAX_NUMBER_OF_PLAYERS_HAND).map(e => ({creatureId: e.creatureId})),
          cardsOnPlayersHand: cards.slice(0, MAX_NUMBER_OF_PLAYERS_HAND).map(e => ({creatureId: e.creatureId})),
          creatureAppearances: [],
          cursor: undefined,
          completedAutoAttackPhase: false,
          turnNumber: 1,
          battleResult: {
            victoryOrDefeatId: 'pending',
          },
          actionPoints: 2,
          actionPointsRecovery: 3,
          headquartersLifePoints: 1,
        },
      },
    },
  }
}
