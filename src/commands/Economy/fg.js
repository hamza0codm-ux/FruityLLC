import {
    SlashCommandBuilder,
} from 'discord.js';

import {
    getEconomyData,
    setEconomyData,
} from '../../utils/economy.js';

import {
    withErrorHandling,
    createError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

const DEFAULT_BET = 100;
const MIN_BET = 10;
const MAX_BET = 100000;

const INITIAL_FAILURE_CHANCE = 20;
const STARTING_MULTIPLIER = 1;

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatMultiplier(value) {
    return `${Number(value || 1).toFixed(2)}x`;
}

function createGardenDisplay(garden) {
    const slots = Array.isArray(garden)
        ? garden.slice(-10)
        : [];

    while (slots.length < 10) {
        slots.push(null);
    }

    const emojis = slots.map((fruitKey) => {
        if (!fruitKey) {
            return '🌱';
        }

        const fruitEmojis = {
            strawberry: '🍓',
            orange: '🍊',
            apple: '🍎',
            grapes: '🍇',
            watermelon: '🍉',
            blueberry: '🫐',
            banana: '🍌',
            cherries: '🍒',
            peach: '🍑',
        };

        return fruitEmojis[fruitKey] || '🌱';
    });

    return [
        emojis.slice(0, 5).join(' '),
        emojis.slice(5, 10).join(' '),
    ].join('\n');
}

function createGardenEmbed(user, garden) {
    const bet = Number(garden.bet || DEFAULT_BET);
    const steps = Number(garden.steps || 0);

    const multiplier = Number(
        garden.current_multiplier || STARTING_MULTIPLIER,
    );

    const failureChance = Number(
        garden.failure_chance || INITIAL_FAILURE_CHANCE,
    );

    const cashOut = Number(
        garden.cash_out || 0,
    );

    const nextMultiplier = multiplier + 0.17;

    const nextReward = Math.max(
        1,
        Math.floor(bet * nextMultiplier),
    );

    const gardenDisplay = createGardenDisplay(
        garden.garden || [],
    );

    const fruitNames = {
        strawberry: '🍓 Strawberry',
        orange: '🍊 Orange',
        apple: '🍎 Apple',
        grapes: '🍇 Grapes',
        watermelon: '🍉 Watermelon',
        blueberry: '🫐 Blueberry',
        banana: '🍌 Banana',
        cherries: '🍒 Cherries',
        peach: '🍑 Peach',
    };

    const growingFruit =
        garden.planted_fruit
            ? fruitNames[garden.planted_fruit] ||
              `🌱 ${garden.planted_fruit}`
            : '🌱 Nothing planted yet';

    return {
        color: 0xF8D568,

        title: `🍓 ${user.username}'s fruit garden is growing!`,

        description:
            `**Bet:** \`${formatNumber(bet)}\`    ` +
            `**Steps:** \`${formatNumber(steps)}\`    ` +
            `**Failure Chance:** \`${failureChance.toFixed(1)}%\`\n\n` +

            `**💰 Cash Out:** \`${formatNumber(cashOut)}\`    ` +
            `📈 **Multiplier:** \`${formatMultiplier(multiplier)}\`\n` +

            `**🌿 Next Reward:** \`${formatNumber(nextReward)}\`    ` +
            `📈 **Next Multiplier:** \`${formatMultiplier(nextMultiplier)}\`\n\n` +

            `${gardenDisplay}\n\n` +

            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🌱 **Growing:** ${growingFruit}`,

        footer: {
            text: 'Fruity Garden • Keep planting to grow your reward!',
        },
    };
}

async function getGarden(client, guildId, userId) {
    if (!client?.db?.pool) {
        throw createError(
            'Garden database unavailable',
            ErrorTypes.DATABASE,
            'The Fruity Garden database is currently unavailable.',
        );
    }

    const result = await client.db.pool.query(
        `
        SELECT
            guild_id,
            user_id,
            bet,
            steps,
            current_multiplier,
            cash_out,
            failure_chance,
            status,
            garden,
            planted_fruit,
            started_at,
            updated_at,
            completed_at
        FROM fruit_gardens
        WHERE guild_id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [
            guildId,
            userId,
        ],
    );

    return result.rows[0] || null;
}

async function createGarden(
    client,
    guildId,
    userId,
    bet,
) {
    const result = await client.db.pool.query(
        `
        INSERT INTO fruit_gardens (
            guild_id,
            user_id,
            bet,
            steps,
            current_multiplier,
            cash_out,
            failure_chance,
            status,
            garden,
            planted_fruit
        )
        VALUES (
            $1,
            $2,
            $3,
            0,
            $4,
            0,
            $5,
            'active',
            '[]'::jsonb,
            NULL
        )
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET
            bet = EXCLUDED.bet,
            steps = 0,
            current_multiplier = EXCLUDED.current_multiplier,
            cash_out = 0,
            failure_chance = EXCLUDED.failure_chance,
            status = 'active',
            garden = '[]'::jsonb,
            planted_fruit = NULL,
            started_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            completed_at = NULL
        RETURNING *
        `,
        [
            guildId,
            userId,
            bet,
            STARTING_MULTIPLIER,
            INITIAL_FAILURE_CHANCE,
        ],
    );

    return result.rows[0];
}

export default {
    data: new SlashCommandBuilder()
        .setName('fg')
        .setDescription('Grow your own Fruity Garden')
        .addIntegerOption((option) =>
            option
                .setName('bet')
                .setDescription(
                    'How much money to put into your garden',
                )
                .setMinValue(MIN_BET)
                .setMaxValue(MAX_BET)
                .setRequired(false),
        ),

    execute: withErrorHandling(
        async (interaction, config, client) => {
            const deferred =
                await InteractionHelper.safeDefer(
                    interaction,
                );

            if (!deferred) {
                return;
            }

            const guildId =
                interaction.guildId;

            const userId =
                interaction.user.id;

            if (!guildId) {
                throw createError(
                    'Guild required',
                    ErrorTypes.VALIDATION,
                    'Fruity Garden can only be used inside a server.',
                );
            }

            /*
             * If the user already has an active garden,
             * resume it without charging another bet.
             */
            const existingGarden =
                await getGarden(
                    client,
                    guildId,
                    userId,
                );

            if (
                existingGarden &&
                existingGarden.status === 'active'
            ) {
                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        embeds: [
                            createGardenEmbed(
                                interaction.user,
                                existingGarden,
                            ),
                        ],

                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        custom_id:
                                            `fg_plant:${guildId}:${userId}`,
                                        label: 'Plant',
                                        emoji: {
                                            name: '🌱',
                                        },
                                        style: 3,
                                    },
                                    {
                                        type: 2,
                                        custom_id:
                                            `fg_cashout:${guildId}:${userId}`,
                                        label: 'Cash Out',
                                        emoji: {
                                            name: '💰',
                                        },
                                        style: 1,
                                    },
                                ],
                            },
                        ],
                    },
                );

                return;
            }

            const requestedBet =
                interaction.options.getInteger(
                    'bet',
                ) ?? DEFAULT_BET;

            const bet = Math.max(
                MIN_BET,
                Math.min(
                    MAX_BET,
                    requestedBet,
                ),
            );

            const economy =
                await getEconomyData(
                    client,
                    guildId,
                    userId,
                );

            const wallet =
                Number(economy.wallet || 0);

            if (wallet < bet) {
                throw createError(
                    'Insufficient funds',
                    ErrorTypes.VALIDATION,
                    `You need **${formatNumber(
                        bet,
                    )}** coins to start a garden, but you only have **${formatNumber(
                        wallet,
                    )}**.`,
                );
            }

            /*
             * Take the starting bet.
             */
            economy.wallet =
                wallet - bet;

            const savedEconomy =
                await setEconomyData(
                    client,
                    guildId,
                    userId,
                    economy,
                );

            if (!savedEconomy) {
                throw createError(
                    'Economy save failed',
                    ErrorTypes.DATABASE,
                    'Your garden could not be started because your balance could not be saved.',
                );
            }

            /*
             * Create the actual garden.
             */
            const garden =
                await createGarden(
                    client,
                    guildId,
                    userId,
                    bet,
                );

            /*
             * IMPORTANT:
             * There is NO collector here.
             *
             * The buttons are handled by:
             * src/interactions/buttons/fruitGarden.js
             *
             * This means they continue working after
             * bot restarts.
             */
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        createGardenEmbed(
                            interaction.user,
                            garden,
                        ),
                    ],

                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    custom_id:
                                        `fg_plant:${guildId}:${userId}`,
                                    label: 'Plant',
                                    emoji: {
                                        name: '🌱',
                                    },
                                    style: 3,
                                },
                                {
                                    type: 2,
                                    custom_id:
                                        `fg_cashout:${guildId}:${userId}`,
                                    label: 'Cash Out',
                                    emoji: {
                                        name: '💰',
                                    },
                                    style: 1,
                                },
                            ],
                        },
                    ],
                },
            );

            logger.info(
                '[FRUITY GARDEN] Garden started',
                {
                    guildId,
                    userId,
                    bet,
                },
            );
        },
        {
            command: 'fg',
        },
    ),
};
