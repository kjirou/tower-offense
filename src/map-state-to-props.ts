import produce, {Draft} from 'immer';
import * as React from 'react';

import {RootProps} from './components/Root';
import {
  BattlePageProps,
  CardProps,
} from './components/pages/BattlePage';
import {ApplicationState} from './state-manager/application';
import {
  Card as CardState,
  areGlobalMatrixPositionsEqual,
  findCreatureByIdOrError,
  isCreatureCardType,
  isSkillCardType,
} from './state-manager/game';
import {
  BattlePageState,
  selectBattleFieldSquare,
} from './state-manager/pages/battle';

type ReactSetState<State> = (setStateAction: React.SetStateAction<State>) => void;
type Dispatcher<State> = (immerLikeCallback: (draft: Draft<State>) => void) => void;

function makeDispatcher<State, ScopedState>(
  setState: ReactSetState<State>,
  scoping: (state: Draft<State>) => Draft<ScopedState> | void,
): Dispatcher<ScopedState> {
  let callCount = 0;
  return function dispatcher(immerLikeCallback: (aPartOfDraft: Draft<ScopedState>) => void): void {
    if (callCount > 0) {
      throw new Error('Can only call the dispatcher once in one Flux cycle.');
    }
    callCount++;
    setState(applicationState => {
      return produce(applicationState, draft => {
        const scopedState = scoping(draft);
        if (scopedState) {
          immerLikeCallback(scopedState);
        } else {
          throw new Error('Invalid state scoping.');
        }
      });
    });
  }
}

function mapBattlePageStateToProps(
  state: BattlePageState,
  dispatcher: Dispatcher<BattlePageState>,
  setState: React.Dispatch<React.SetStateAction<ApplicationState>>,
): BattlePageProps {
  function jobIdToDummyImage(jobId: string): string {
    const mapping: {
      [key: string]: string,
    } = {
      archer: '弓',
      fighter: '戦',
      knight: '重',
      mage: '魔',
    };
    return mapping[jobId] || '？';
  }

  function cardStateToProps(cardState: CardState): CardProps {
    const cardProps = {
      uid: cardState.uid,
      label: '？',
    };

    if (isSkillCardType(cardState)) {
      const mapping: {
        [key: string]: string,
      } = {
        attack: 'A',
        healing: 'H',
        support: 'S',
      };
      cardProps.label = mapping[cardState.skillId];
    }

    return cardProps;
  }

  const battleFieldBoard: BattlePageProps['battleFieldBoard'] = state.game.battleFieldMatrix.map(row => {
    return row.map(element => {
      const creature = element.creatureId ?
        findCreatureByIdOrError(state.game.creatures, element.creatureId) : undefined;

      return {
        y: element.position.y,
        x: element.position.x,
        creature: creature
          ? {
            image: jobIdToDummyImage(creature.jobId),
          }
          : undefined,
        isSelected: state.game.squareCursor
          ? areGlobalMatrixPositionsEqual(element.position, state.game.squareCursor.position)
          : false,
        handleTouch({y, x}) {
          // TODO: So verbose
          setState(applicationState => {
            const pageState = applicationState.pages.battle;
            if (pageState) {
              return Object.assign({}, applicationState, {
                pages: {
                  battle: selectBattleFieldSquare(pageState, y, x),
                }
              });
            }
            return applicationState;
          });
        },
      };
    });
  });

  const cardsState = state.game.cardsOnYourHand.cards;
  const cardsOnYourHand: BattlePageProps['cardsOnYourHand'] = {
    cards: [
      cardStateToProps(cardsState[0]),
      cardStateToProps(cardsState[1]),
      cardStateToProps(cardsState[2]),
      cardStateToProps(cardsState[3]),
      cardStateToProps(cardsState[4]),
    ],
  };

  return {
    battleFieldBoard,
    cardsOnYourHand,
  };
}

export function mapStateToProps(
  state: ApplicationState,
  setState: ReactSetState<ApplicationState>
): RootProps {
  if (state.pages.battle) {
    const dispatcher = makeDispatcher<ApplicationState, BattlePageState>(
      setState,
      (state) => state.pages.battle
    );

    return {
      pages: {
        battle: mapBattlePageStateToProps(state.pages.battle, dispatcher, setState),
      },
    };
  }

  throw new Error('Received invalid state.');
}
