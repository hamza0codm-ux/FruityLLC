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

            const betAmount =
                interaction.options.getInteger(
                    'amount'
                );

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
                    'You already have an active Fruit Garden. Plant or cash out your current garden first.'
                );
            }

            if (
                Number(userData.wallet || 0) <
                betAmount
            ) {
                throw createError(
                    'Insufficient Fruit Garden funds',
                    ErrorTypes.VALIDATION,
                    `You only have **$${Number(userData.wallet || 0).toLocaleString()}** cash, but your bet is **$${betAmount.toLocaleString()}**.`
                );
            }

            const garden =
                await startFruitGarden(
                    client,
                    guildId,
                    userId,
                    betAmount
                );

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
