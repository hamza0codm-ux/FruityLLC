// src/commands/Economy/fg.js

import { SlashCommandBuilder } from 'discord.js';

import {
    withErrorHandling,
    createError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
    getEconomyData,
} from '../../utils/economy.js';

import {
    startFruitGarden,
    buildFruitGardenEmbed,
    buildFruitGardenComponents,
} from '../../services/fruitGardenService.js';


export default {
    data: new SlashCommandBuilder()
        .setName('fg')
        .setDescription('Play Fruit Garden and grow your payout.')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of cash to bet')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(
        async (interaction, config, client) => {
            const deferred =
                await InteractionHelper.safeDefer(
                    interaction
                );

            if (!deferred) {
                return;
            }

            if (!interaction.guildId) {
                throw createError(
                    'Fruit Garden outside guild',
                    ErrorTypes.VALIDATION,
                    'Fruit Garden can only be played inside a server.'
                );
            }

            const userId =
                interaction.user.id;

            const guildId =
                interaction.guildId;

            /*
            |--------------------------------------------------------------------------
            | Get Existing Economy Data
            |--------------------------------------------------------------------------
            */

            const userData =
                await getEconomyData(
                    client,
                    guildId,
                    userId
                );

            /*
            |--------------------------------------------------------------------------
            | EXISTING ACTIVE GARDEN
            |--------------------------------------------------------------------------
            |
            | If the user already has a garden, /fg simply resends the
            | current panel.
            |
            | It DOES NOT:
            | - take another bet
            | - create another garden
            | - reset the steps
            | - reset the fruits
            |
            |--------------------------------------------------------------------------
            */

            if (
                userData?.fruitGarden?.active
            ) {
                const garden =
                    userData.fruitGarden;

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
                        embeds: [
                            embed,
                        ],
                        components,
                    }
                );

                return;
            }

            /*
            |--------------------------------------------------------------------------
            | New Garden
            |--------------------------------------------------------------------------
            */

            const betAmount =
                interaction.options.getInteger(
                    'amount'
                );

            /*
            |--------------------------------------------------------------------------
            | Check Balance
            |--------------------------------------------------------------------------
            */

            if (
                Number(userData?.wallet || 0) <
                betAmount
            ) {
                throw createError(
                    'Insufficient Fruit Garden funds',
                    ErrorTypes.VALIDATION,
                    `You only have **$${Number(userData?.wallet || 0).toLocaleString()}** cash, but your bet is **$${betAmount.toLocaleString()}**.`
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Start Garden
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
            | Build Panel
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

            /*
            |--------------------------------------------------------------------------
            | Send Panel
            |--------------------------------------------------------------------------
            */

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        embed,
                    ],
                    components,
                }
            );
        },
        {
            command: 'fg',
        }
    ),
};
