import produce, {Draft} from 'immer'
import * as React from 'react'

import {
  Props as RootProps,
} from './components/Root'
import {
  CardProps,
  CreatureOnElementProps,
  Props as BattlePageProps,
} from './components/pages/BattlePage'
import {
  ApplicationState,
  BattleFieldElement,
  BattlePage,
  CreatureWithParty,
  CreatureWithPartyOnBattleFieldElement,
  GlobalPosition,
  SkillCategoryId,
  areGlobalPositionsEqual,
  calculateRangeAndTargeteesOfAutoAttack,
  creatureUtils,
  determineRelationshipBetweenFactions,
  findBattleFieldElementsByRange,
  findCardByCreatureId,
  findCreatureById,
  findCreatureWithParty,
} from './utils'
import {
  proceedTurn,
  runAutoAttackPhase,
  selectBattleFieldElement,
  selectCardOnPlayersHand,
} from './reducers'

export type ReactSetState = React.Dispatch<React.SetStateAction<ApplicationState>>

const jobIdToDummyImage = (jobId: string): string => {
  const mapping: {
    [key: string]: string,
  } = {
    archer: '弓',
    fighter: '戦',
    goblin: 'ゴ',
    gunner: '銃',
    knight: '重',
    mage: '魔',
    priest: '聖',
    orc: 'オ',
  }
  return mapping[jobId] || '？'
}

const skillCategoryIdToDummyImage = (skillCategoryId: SkillCategoryId): string => {
  const skillCategoryMapping: {
    [key: string]: string,
  } = {
    attack: 'A',
    defense: 'D',
    support: 'S',
  }
  return skillCategoryMapping[skillCategoryId]
}

// TODO: Memoize some props for React.memo

function mapBattlePageStateToProps(
  battlePage: BattlePage,
  setState: ReactSetState
): BattlePageProps {
  const game = battlePage.game

  let cursoredElement: {
    creatureWithParty?: CreatureWithParty,
    battleFieldElement?: BattleFieldElement,
  } = {}

  const boardProps: BattlePageProps['battleFieldBoard']['board'] = game.battleFieldMatrix.map(row => {
    return row.map(element => {
      const creatureWithParty = element.creatureId !== undefined
        ? findCreatureWithParty(game.creatures, game.parties, element.creatureId) : undefined
      const isSelected = game.cursor
        ? areGlobalPositionsEqual(element.globalPosition, game.cursor.globalPosition)
        : false
      if (isSelected) {
        cursoredElement = {
          ...(creatureWithParty ? {creatureWithParty} : {}),
          battleFieldElement: element,
        }
      }

      let creatureProps: CreatureOnElementProps | undefined = undefined
      if (creatureWithParty) {
        creatureProps = {
          image: jobIdToDummyImage(creatureWithParty.creature.jobId),
          factionRelationshipId: determineRelationshipBetweenFactions(
            'player', creatureWithParty.party.factionId),
          lifePoints: creatureWithParty.creature.lifePoints.toString(),
          turnsUntilRaid: creatureUtils.getTurnsUntilRaid(creatureWithParty.creature, game.constants),
        }
      }

      return {
        y: element.position.y,
        x: element.position.x,
        creature: creatureProps,
        isSelected,
        isWithinRange: false,
        isTarget: false,
        targetPriority: undefined,
      }
    })
  })

  // マスへカーソルが当たっている、かつ、クリーチャーが存在するとき。
  if (cursoredElement.battleFieldElement && cursoredElement.creatureWithParty) {
    const {rangedBattleFieldElements, targetees} = calculateRangeAndTargeteesOfAutoAttack(
      game.constants,
      game.creatures,
      game.parties,
      game.battleFieldMatrix,
      cursoredElement.creatureWithParty.creature.id
    )

    // 範囲内のマスリストへ範囲内フラグを立てる。
    for (const element of rangedBattleFieldElements) {
      boardProps[element.position.y][element.position.x].isWithinRange = true
    }

    // 攻撃対象のマスへ対象フラグを立てる。
    // 攻撃対象のマスへ優先順位を表示する。
    for (let i = 0; i < targetees.length; i++) {
      const targetee = targetees[i]
      const element = targetee.battleFieldElement
      boardProps[element.position.y][element.position.x].isTarget = true
      boardProps[element.position.y][element.position.x].targetPriority = i + 1
    }
  }

  const cardsProps: CardProps[] = game.cardsOnPlayersHand
    .map(({creatureId}, index) => {
      const card = findCardByCreatureId(game.cards, creatureId)
      const creature = findCreatureById(game.creatures, creatureId)
      const asGlobalPosition: GlobalPosition = {
        globalPlacementId: 'cardsOnPlayersHand',
        creatureId,
      }
      const isSelected = game.cursor
        ? areGlobalPositionsEqual(asGlobalPosition, game.cursor.globalPosition)
        : false
      return {
        uid: card.creatureId,
        creatureId,
        creatureImage: jobIdToDummyImage(creature.jobId),
        skillCategorySymbol: skillCategoryIdToDummyImage(card.skillCategoryId),
        isFirst: index === 0,
        isSelected,
        handleTouch: (creatureId: string) => {
          setState(s => selectCardOnPlayersHand(s, creatureId))
        },
      }
    })

  const progressButton = game.battleResult.victoryOrDefeatId === 'pending'
    ? game.completedAutoAttackPhase
      ? {
        label: 'Next',
        handleTouch: () => {
          setState(s => proceedTurn(s))
        },
      }
      : {
        label: 'Auto-Attack',
        handleTouch: () => {
          setState(s => runAutoAttackPhase(s))
        },
      }
    : game.battleResult.victoryOrDefeatId === 'victory'
      ? {
        label: 'Victory!',
        handleTouch: () => {},
      }
      : {
        label: 'Defeat...',
        handleTouch: () => {},
      }

  return {
    battleFieldBoard: {
      board: boardProps,
      handleTouch({y, x}) {
        setState(s => selectBattleFieldElement(s, y, x))
      },
      updatesAreProhibited: game.battleResult.victoryOrDefeatId !== 'pending' || game.completedAutoAttackPhase,
    },
    cardsOnPlayersHand: {
      cards: cardsProps
    },
    headquartersLifePoints: game.headquartersLifePoints,
    actionPoints: game.actionPoints,
    turnNumber: game.turnNumber,
    progressButton,
  }
}

export function mapStateToProps(
  state: ApplicationState,
  setState: ReactSetState
): RootProps {
  if (state.pages.battle) {
    return {
      pages: {
        battle: mapBattlePageStateToProps(state.pages.battle, setState),
      },
    }
  }

  throw new Error('Received invalid state.')
}
