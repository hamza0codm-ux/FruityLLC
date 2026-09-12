// src/commands/Economy/fg.js

import { SlashCommandBuilder } from 'discord.js';

import {
    getEconomyData,
} from '../../utils/economy.js';

import {
    withErrorHandling,
    createError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
    startFruitGarden,
    buildFruitGardenEmbed,
    buildFruitGardenComponents,
} from '../../services/fruitGardenService.js';


export default {
    data: new SlashCommandBuilder()
        .setName('fg')
        .setDescription('Play Fruit Garden and risk your cash for a bigger payout.')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of cash to put into Fruit Garden')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(
        async (interaction, config, client) => {
            const deferred =
                await InteractionHelper.safeDefer(
                    interaction,
                    {
                        ephemeral: false,
                    }
                );

            if (!deferred) {
                return;
            }

            const guildId =
                interaction.guildId;

            const userId =
                interaction.user.id;

            const betAmount =
                interaction.options.getInteger(
                    'amount'
                );

            if (!guildId) {
                throw createError(
                    'Fruit Garden requires a guild',
                    ErrorTypes.VALIDATION,
                    'Fruit Garden can only be played inside a server.'
                );
            }

            if (!Number.isSafeInteger(betAmount) || betAmount <= 0) {
                throw createError(
                    'Invalid Fruit Garden bet',
                    ErrorTypes.VALIDATION,
                    'Please enter a valid positive bet amount.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Check economy data before starting
            |--------------------------------------------------------------------------
            */

            const userData =
                await getEconomyData(
                    client,
                    guildId,
                    userId
                );

            if (
                userData?.fruitGarden?.active
            ) {
                throw createError(
                    'Fruit Garden already active',
                    ErrorTypes.VALIDATION,
                    'You already have an active Fruit Garden game. Finish it before starting another one.'
                );
            }

            if (
                Number(userData.wallet || 0) <
                betAmount
            ) {
                throw createError(
                    'Insufficient Fruit Garden balance',
                    ErrorTypes.VALIDATION,
                    `You only have **$${Number(userData.wallet || 0).toLocaleString()}** cash, but your bet is **$${betAmount.toLocaleString()}**.`
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Start Fruit Garden
            |--------------------------------------------------------------------------
            */

            const garden =
                await startFruitGarden(
                    client,
                    guildId,
                    userId,
                    betAmount
                );

            /*
            |--------------------------------------------------------------------------
            | Initial Game Message
            |--------------------------------------------------------------------------
            */

            const embed =
                buildFruitGardenEmbed(
                    interaction.user,
                    garden
                );

            const components =
                buildFruitGardenComponents(
                    garden
                );

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [embed],
                    components,
                }
            );
        },
        {
            command: 'fg',
        }
    ),
};
