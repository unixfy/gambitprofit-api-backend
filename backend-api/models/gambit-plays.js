'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

/**
 * PROPRIETARY SOFTWARE - Copyright 2020 Unixfy
 * The custom fields calculator for the GambitProfit.com PLAYS API
 * This file is to be placed at /opt/strapi1/app/api/gambit-plays/models/gambit-plays.js.
 */

// Reward calculation function
function calculateRewards(data) {
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Magic to create one big array with all teams & respective names and reward
    var teams = [
        {
            'name': data.Team1.Name,
            'reward': data.Team1.Reward
        },
        {
            'name': data.Team2.Name,
            'reward': data.Team2.Reward
        },
        {
            'name': 'Draw',
            'reward': data.Draw.Reward
        }
    ]
    // Sort teams lowest reward to highest reward
    teams.sort(function(a, b){ return a.reward - b.reward; });
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Calculations for Risky betting (we put this here because it works the same regardless of if there is draw)

    // Calculate profit of bet in Gambit tokens (100 = $1 usd)
    data.Calc.HighRisk.CalculatedReward = 300 * teams[0]['reward'];
    // Just convert the token revenue to profit in percentage
    data.Calc.HighRisk.ProfitPerCard = parseFloat((((data.Calc.HighRisk.CalculatedReward - 264) / 264) * 100).toFixed(2));
    // Name of the team to bet on
    data.Calc.HighRisk.TeamToBetOn = teams[0]['name'];
    // This is always set to 300
    data.Calc.HighRisk.BetAmount = 300;
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Begin logic for med/high risk
    // Logic if Draw does exist
    if(data.Draw.Reward) {
        // Calculations for Med-Risk betting

        // Names of the 2 teams to bet on (i.e. the two teams with the lowest risk, as ID'd by the sort function above)
        // Team1 is the lowest risk team, while Team2 is the 2nd lowest risk team.
        data.Calc.MedRisk.Team1ToBetOn = teams[0]['name'];
        data.Calc.MedRisk.Team2ToBetOn = teams[1]['name'];
        // Calculate amount of tokens to bet on each team (formula is the same as no-risk for 2 teams)
        data.Calc.MedRisk.Team1BetAmount = Math.round((300 * teams[1]['reward']) / (teams[1]['reward'] + teams[0]['reward']));
        data.Calc.MedRisk.Team2BetAmount = Math.round((300 * teams[0]['reward']) / (teams[1]['reward'] + teams[0]['reward']));
        // Calculate profit of bet in Gambit tokens (100 = $1 usd)
        data.Calc.MedRisk.CalculatedReward = Math.min((data.Calc.MedRisk.Team1BetAmount * teams[0]['reward']), (data.Calc.MedRisk.Team2BetAmount * teams[1]['reward']));
        // Just convert the token revenue to profit in percentage
        data.Calc.MedRisk.ProfitPerCard = parseFloat((((data.Calc.MedRisk.CalculatedReward - 264) / 264) * 100).toFixed(2));


        // Calculations for No-Risk betting

        // Calculate amount of tokens to bet on each team (note: using the 3 team formula)
        data.Calc.NoRisk.Team1BetAmount = Math.round((300 * data.Team2.Reward * data.Draw.Reward) / ((data.Team1.Reward * data.Team2.Reward) + (data.Team2.Reward * data.Draw.Reward) + (data.Team1.Reward * data.Draw.Reward)));
        data.Calc.NoRisk.Team2BetAmount = Math.round((300 * data.Team1.Reward * data.Draw.Reward) / ((data.Team1.Reward * data.Team2.Reward) + (data.Team2.Reward * data.Draw.Reward) + (data.Team1.Reward * data.Draw.Reward)));
        data.Calc.NoRisk.DrawBetAmount = Math.round((300 * data.Team2.Reward * data.Team1.Reward) / ((data.Team1.Reward * data.Team2.Reward) + (data.Team2.Reward * data.Draw.Reward) + (data.Team1.Reward * data.Draw.Reward)));
        // Calculate profit of bet in Gambit tokens (100 = $1 usd)
        data.Calc.NoRisk.CalculatedReward = Math.min((data.Calc.NoRisk.Team1BetAmount * data.Team1.Reward), (data.Calc.NoRisk.Team2BetAmount * data.Team2.Reward), (data.Calc.NoRisk.DrawBetAmount * data.Draw.Reward));
        // Just convert the token revenue to profit in percentage
        data.Calc.NoRisk.ProfitPerCard = parseFloat((((data.Calc.NoRisk.CalculatedReward - 264) / 264) * 100).toFixed(2));
    } else {
        // Calculations for No-Risk betting if Draw doesn't exist

        // Calculate amount of tokens to bet on each team (note: using the 2 team formula); Calc.NoRisk.DrawBetAmount will return null/undefined
        data.Calc.NoRisk.Team1BetAmount = Math.round((300 * data.Team2.Reward) / (data.Team1.Reward + data.Team2.Reward));
        data.Calc.NoRisk.Team2BetAmount = Math.round((300 * data.Team1.Reward) / (data.Team1.Reward + data.Team2.Reward));
        // Calculate profit of bet in Gambit tokens (100 = $1 usd)
        data.Calc.NoRisk.CalculatedReward = Math.min((data.Calc.NoRisk.Team1BetAmount * data.Team1.Reward), (data.Calc.NoRisk.Team2BetAmount * data.Team2.Reward));
        // Just convert the token revenue to profit in percentage
        data.Calc.NoRisk.ProfitPerCard = parseFloat((((data.Calc.NoRisk.CalculatedReward - 264) / 264) * 100).toFixed(2));
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Set the profitable boolean as long as least 2 of the 3 methods are profitable with 264SB cost.
    if ((data.Calc.NoRisk.ProfitPerCard > 0.0 && data.Calc.MedRisk.ProfitPerCard > 0.0) || (data.Calc.HighRisk.ProfitPerCard > 0.0 && data.Calc.MedRisk.ProfitPerCard > 0.0) || (data.Calc.NoRisk.ProfitPerCard > 0.0 && data.Calc.HighRisk.ProfitPerCard > 0.0)) {
        data.Calc.Profitable = true;
    } else {
        data.Calc.Profitable = false;
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Automatically set the recommended Enumerable based on which bet method yields the most profit
    // ONLY EVALUATE if the bet is actually profitable
    if (data.Calc.Profitable == true) {
        // If the profit per card of HighRisk is greater than that of MedRisk and NoRisk AND the reward of the lowest-risk team is less than 1.10, then HighRisk is the recommended method
        if ((data.Calc.HighRisk.ProfitPerCard > data.Calc.NoRisk.ProfitPerCard) && (teams[0]['reward'] < 1.10)) {
            data.Calc.Recommended = "HighRisk";
            // If Draw is defined AND the difference between the rewards of the two riskiest teams is greater than or equal to 1.50 (so the chance of the underdog winning is low)
        } else if (data.Draw.Reward && data.Calc.MedRisk.ProfitPerCard > data.Calc.NoRisk.ProfitPerCard && (teams[2]['reward'] - teams[1]['reward']) >= 1.50) {
            data.Calc.Recommended = "MedRisk";
            // If none of the others (above) are true, and NoRisk is more profitable than Powerball
        } else if (data.Calc.NoRisk.ProfitPerCard > 0.0) {
            data.Calc.Recommended = "NoRisk";
            // Otherwise, tell the user not to bet on the play
        } else {
            data.Calc.Profitable = false;
        }
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    return;
}

module.exports = {
    lifecycles: {
        beforeCreate: async (data) => {
            calculateRewards(data);
        },
        beforeUpdate: async (params, data) => {
            calculateRewards(data);
        },
    },
};