// src/interactions/buttons/economy/fruitGarden.js

import {
    MessageFlags,
} from 'discord.js';

import {
    growFruitGarden,
    cashOutFruitGarden,
    buildFruitGardenEmbed,
    buildFruitGardenComponents,
} from '../../../services/fruitGardenService.js';

import {
    handleInteractionError,
} from '../../../utils/errorHandler.js';

import {
    InteractionHelper,
} from '../../../utils/interactionHelper.js';


/*
|--------------------------------------------------------------------------
| Fruit Garden Buttons
|--------------------------------------------------------------------------
*/

export default [
    {
        name: 'fg_grow',

        async execute(
            interaction,
            client
        ) {
            try {
                if (!interaction.guildId) {
                    await interaction.reply({
                        content:
                            'Fruit Garden can only be used inside a server.',
                        flags:
                            MessageFlags.Ephemeral,
                    });

                    return;
                }

                const deferred =
                    await InteractionHelper.safeDefer(
                        interaction,
                        {
                            flags:
                                MessageFlags.Ephemeral,
                        }
                    );

                if (!deferred) {
                    return;
                }

                const result =
                    await growFruitGarden(
                        client,
                        interaction.guildId,
                        interaction.user.id
                    );

                /*
                |--------------------------------------------------------------------------
                | Garden Failed
                |--------------------------------------------------------------------------
                */

                if (
                    result.result === 'failed'
                ) {
                    const embed =
                        buildFruitGardenEmbed(
                            interaction.user,
                            result.garden,
                            'failed'
                        );

                    await InteractionHelper.safeEditReply(
                        interaction,
                        {
                            embeds: [embed],
                            components: [],
                        }
                    );

                    return;
                }

                /*
                |--------------------------------------------------------------------------
                | Successful Growth
                |--------------------------------------------------------------------------
                */

                const embed =
                    buildFruitGardenEmbed(
                        interaction.user,
                        result.garden,
                        'success'
                    );

                const components =
                    buildFruitGardenComponents(
                        result.garden
                    );

                /*
                |--------------------------------------------------------------------------
                | Update the original game message.
                |--------------------------------------------------------------------------
                */

                await interaction.message.edit({
                    embeds: [embed],
                    components,
                });

                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '🌱 Your garden grew successfully!',
                    }
                );

            } catch (error) {
                await handleInteractionError(
                    interaction,
                    error,
                    {
                        type: 'button',
                        handler: 'fg_grow',
                        customId:
                            interaction.customId,
                    }
                );
            }
        },
    },

    {
        name: 'fg_cashout',

        async execute(
            interaction,
            client
        ) {
            try {
                if (!interaction.guildId) {
                    await interaction.reply({
                        content:
                            'Fruit Garden can only be used inside a server.',
                        flags:
                            MessageFlags.Ephemeral,
                    });

                    return;
                }

                const deferred =
                    await InteractionHelper.safeDefer(
                        interaction,
                        {
                            flags:
                                MessageFlags.Ephemeral,
                        }
                    );

                if (!deferred) {
                    return;
                }

                const result =
                    await cashOutFruitGarden(
                        client,
                        interaction.guildId,
                        interaction.user.id
                    );

                const embed =
                    buildFruitGardenEmbed(
                        interaction.user,
                        result.garden,
                        'cashed_out'
                    );

                /*
                |--------------------------------------------------------------------------
                | Update the game message and remove the buttons.
                |--------------------------------------------------------------------------
                */

                await interaction.message.edit({
                    embeds: [embed],
                    components: [],
                });

                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            `💰 You cashed out **$${result.payout.toLocaleString()}**! Your new balance is **$${result.wallet.toLocaleString()}**.`,
                    }
                );

            } catch (error) {
                await handleInteractionError(
                    interaction,
                    error,
                    {
                        type: 'button',
                        handler: 'fg_cashout',
                        customId:
                            interaction.customId,
                    }
                );
            }
        },
    },
];
