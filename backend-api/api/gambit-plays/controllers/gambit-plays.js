'use strict';


/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const {sanitizeEntity} = require('strapi-utils');

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Function which recalculates all CalculatedRewards, ProfitPerCards and BetAmounts based on custom token amount
function recalculateRewards(play, tokens) {

  ////////////// CONFIGURATION //////////////
  // Change percentage here if discount changes
  // NEEDS TO BE RECONFIGURED IF SB CHANGES COST OF GAMBIT CARD
  var CARD_COST = 1.00 * tokens;
  ////////////// CONFIGURATION //////////////

  // Magic to create one big array with all teams & respective names and reward
  var teams = [
    {
      'name': play.Team1.Name,
      'reward': play.Team1.Reward
    },
    {
      'name': play.Team2.Name,
      'reward': play.Team2.Reward
    },
    {
      'name': 'Draw',
      'reward': play.Draw.Reward
    }
  ]
  teams.sort(function (a, b) {
    return a.reward - b.reward;
  });

  //
  // The formulas below can be copy and pasted from models/gambit-plays.js, replacing instances of 'play' with 'play' and '300' with 'tokens'
  //

  // HighRisk
  play.Calc.HighRisk.CalculatedReward = tokens * teams[0]['reward'];
  // Need to add parsefloat to tokens, because tokens is a string
  play.Calc.HighRisk.BetAmount = parseFloat(tokens);
  play.Calc.HighRisk.ProfitPerCard = parseFloat((((play.Calc.HighRisk.CalculatedReward - CARD_COST) / CARD_COST) * 100).toFixed(2));

  // Need separate logic depending on if there is a draw
  if (play.Draw.Reward) {
    // MedRisk
    play.Calc.MedRisk.Team1BetAmount = Math.round((tokens * teams[1]['reward']) / (teams[1]['reward'] + teams[0]['reward']));
    play.Calc.MedRisk.Team2BetAmount = Math.round((tokens * teams[0]['reward']) / (teams[1]['reward'] + teams[0]['reward']));
    play.Calc.MedRisk.CalculatedReward = Math.min((play.Calc.MedRisk.Team1BetAmount * teams[0]['reward']), (play.Calc.MedRisk.Team2BetAmount * teams[1]['reward']));
    play.Calc.MedRisk.ProfitPerCard = parseFloat((((play.Calc.MedRisk.CalculatedReward - CARD_COST) / CARD_COST) * 100).toFixed(2));

    // NoRisk w/ Draw
    play.Calc.NoRisk.Team1BetAmount = Math.round((tokens * play.Team2.Reward * play.Draw.Reward) / ((play.Team1.Reward * play.Team2.Reward) + (play.Team2.Reward * play.Draw.Reward) + (play.Team1.Reward * play.Draw.Reward)));
    play.Calc.NoRisk.Team2BetAmount = Math.round((tokens * play.Team1.Reward * play.Draw.Reward) / ((play.Team1.Reward * play.Team2.Reward) + (play.Team2.Reward * play.Draw.Reward) + (play.Team1.Reward * play.Draw.Reward)));
    play.Calc.NoRisk.DrawBetAmount = Math.round((tokens * play.Team2.Reward * play.Team1.Reward) / ((play.Team1.Reward * play.Team2.Reward) + (play.Team2.Reward * play.Draw.Reward) + (play.Team1.Reward * play.Draw.Reward)));
    play.Calc.NoRisk.CalculatedReward = Math.min((play.Calc.NoRisk.Team1BetAmount * play.Team1.Reward), (play.Calc.NoRisk.Team2BetAmount * play.Team2.Reward), (play.Calc.NoRisk.DrawBetAmount * play.Draw.Reward));
    play.Calc.NoRisk.ProfitPerCard = parseFloat((((play.Calc.NoRisk.CalculatedReward - CARD_COST) / CARD_COST) * 100).toFixed(2));

  } else {
    // NoRisk w/o Draw
    play.Calc.NoRisk.Team1BetAmount = Math.round((tokens * play.Team2.Reward) / (play.Team1.Reward + play.Team2.Reward));
    play.Calc.NoRisk.Team2BetAmount = Math.round((tokens * play.Team1.Reward) / (play.Team1.Reward + play.Team2.Reward));
    play.Calc.NoRisk.CalculatedReward = Math.min((play.Calc.NoRisk.Team1BetAmount * play.Team1.Reward), (play.Calc.NoRisk.Team2BetAmount * play.Team2.Reward));
    play.Calc.NoRisk.ProfitPerCard = parseFloat((((play.Calc.NoRisk.CalculatedReward - CARD_COST) / CARD_COST) * 100).toFixed(2));
  }

  //
  // Set the profitable status based on the newly recalculated profits
  //

  if ((play.Calc.HighRisk.ProfitPerCard > 0) && (teams[0]['reward'] < 1.10)) {
    play.Calc.HighRisk.Recommended = true;
    // If Draw is defined AND the difference between the rewards of the two riskiest teams is greater than or equal to 1.50 (so the chance of the underdog winning is low)
  } else {
    play.Calc.HighRisk.Recommended = false;
  }
  if (play.Draw.Reward && play.Calc.MedRisk.ProfitPerCard > 0 && (teams[2]['reward'] - teams[1]['reward']) >= 1.50) {
    play.Calc.MedRisk.Recommended = true;
    // If none of the others (above) are true, and NoRisk is more profitable than Powerball
  } else {
    play.Calc.MedRisk.Recommended = false;
  }
  if (play.Calc.NoRisk.ProfitPerCard > 0) {
    play.Calc.NoRisk.Recommended = true;
  } else {
    play.Calc.NoRisk.Recommended = false;
  }

  play.Calc.Profitable = (play.Calc.HighRisk.Recommended == true || play.Calc.MedRisk.Recommended == true || play.Calc.NoRisk.Recommended == true);

  return play;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = {
  /* Custom functions for adjusting token amount in query */
  async findTokens(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services['gambit-plays'].search(ctx.query);
    } else {
      entities = await strapi.services['gambit-plays'].find(ctx.query);
    }
    const tokens = ctx.params.tokens;

    return entities.map(entity => {
      const play = sanitizeEntity(entity, {
        model: strapi.models['gambit-plays']
      });

      recalculateRewards(play, tokens);
      return play;
    });
  },
  async findOneTokens(ctx) {
    const {id} = ctx.params;
    const tokens = ctx.params.tokens;
    let entity;
    entity = await strapi.services['gambit-plays'].findOne({id});
    const play = sanitizeEntity(entity, {
      model: strapi.models['gambit-plays']
    });
    recalculateRewards(play, tokens);
    return play;
  },
};

