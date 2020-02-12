import produce, {Draft} from 'immer'
import * as React from 'react'

import {
  Props as RootProps,
} from './components/Root'
import {
  CardProps,
  CreatureOnSquareProps,
  Props as BattlePageProps,
} from './components/pages/BattlePage'
import {
  ApplicationState,
  BattlePageState,
  Card as CardState,
  Creature as CreatureState,
  GlobalPosition as GlobalPositionState,
  SkillCategoryId,
  areGlobalPositionsEqual,
  determineRelationshipBetweenFactions,
  findCardByCreatureId,
  findCreatureById,
  findCreatureWithParty,
} from './utils'
import {
  proceedTurn,
  touchBattleFieldElement,
  touchCardOnYourHand,
} from './reducers'

type ReactSetState = React.Dispatch<React.SetStateAction<ApplicationState>>

const jobIdToDummyImage = (jobId: string): string => {
  const mapping: {
    [key: string]: string,
  } = {
    archer: '弓',
    fighter: '戦',
    goblin: 'ゴ',
    knight: '重',
    mage: '魔',
    orc: 'オ',
  }
  return mapping[jobId] || '？'
}

const skillCategoryIdToDummyImage = (skillCategoryId: SkillCategoryId): string => {
  const skillCategoryMapping: {
    [key: string]: string,
  } = {
    attack: 'A',
    healing: 'H',
    support: 'S',
  }
  return skillCategoryMapping[skillCategoryId]
}

// TODO: Memoize some props for React.memo

function mapBattlePageStateToProps(
  battlePage: BattlePageState,
  setState: ReactSetState
): BattlePageProps {
  const game = battlePage.game

  const battleFieldBoard: BattlePageProps['battleFieldBoard'] = game.battleFieldMatrix.map(row => {
    return row.map(element => {
      const creatureWithParty = element.creatureId ?
        findCreatureWithParty(game.creatures, game.parties, element.creatureId) : undefined

      let creature: CreatureOnSquareProps | undefined = undefined
      if (creatureWithParty) {
        creature = {
          image: jobIdToDummyImage(creatureWithParty.creature.jobId),
          factionRelationshipId: determineRelationshipBetweenFactions(
            'player', creatureWithParty.party.factionId),
          lifePoint: creatureWithParty.creature.lifePoint.toString(),
        }
      }

      return {
        y: element.position.y,
        x: element.position.x,
        creature,
        isSelected: game.squareCursor
          ? areGlobalPositionsEqual(element.globalPosition, game.squareCursor.globalPosition)
          : false,
        handleTouch({y, x}) {
          setState(s => touchBattleFieldElement(s, y, x))
        },
      }
    })
  })

  const cardsProps: CardProps[] = game.cardCreatureIdsOnYourHand
    .map(creatureId => {
      const card = findCardByCreatureId(game.cards, creatureId)
      const creature = findCreatureById(game.creatures, creatureId)
      const asGlobalPosition: GlobalPositionState = {
        globalPlacementId: 'cardsOnYourHand',
        cardCreatureId: creatureId,
      }
      const isSelected = game.squareCursor
        ? areGlobalPositionsEqual(asGlobalPosition, game.squareCursor.globalPosition)
        : false
      return {
        uid: card.creatureId,
        creatureId,
        creatureImage: jobIdToDummyImage(creature.jobId),
        skillCategorySymbol: skillCategoryIdToDummyImage(card.skillCategoryId),
        isSelected,
        handleTouch: (creatureId: string) => {
          setState(s => touchCardOnYourHand(s, creatureId))
        },
      }
    })

  return {
    battleFieldBoard,
    cardsOnYourHand: {
      cards: cardsProps
    },
    handleClickNextButton: () => {
      setState(s => proceedTurn(s))
    },
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
