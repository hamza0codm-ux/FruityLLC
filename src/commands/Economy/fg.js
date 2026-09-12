import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
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
const FAILURE_INCREASE = 2;

const STARTING_MULTIPLIER = 1;
const MULTIPLIER_INCREASE = 0.17;

const FRUITS = [
    {
        key: 'strawberry',
        emoji: '🍓',
        name: 'Strawberry',
        weight: 30,
        value: 17,
    },
    {
        key: 'orange',
        emoji: '🍊',
        name: 'Orange',
        weight: 25,
        value: 20,
    },
    {
        key: 'apple',
        emoji: '🍎',
        name: 'Apple',
        weight: 20,
        value: 23,
    },
    {
        key: 'grapes',
        emoji: '🍇',
        name: 'Grapes',
        weight: 15,
        value: 27,
    },
    {
        key: 'watermelon',
        emoji: '🍉',
        name: 'Watermelon',
        weight: 8,
        value: 35,
    },
    {
        key: 'blueberry',
        emoji: '🫐',
        name: 'Blueberry',
        weight: 7,
        value: 40,
    },
    {
        key: 'banana',
        emoji: '🍌',
        name: 'Banana',
        weight: 6,
        value: 45,
    },
    {
        key: 'cherries',
        emoji: '🍒',
        name: 'Cherries',
        weight: 5,
        value: 55,
    },
    {
        key: 'peach',
        emoji: '🍑',
        name: 'Peach',
        weight: 4,
        value: 65,
    },
];

function pickFruit() {
    const totalWeight = FRUITS.reduce(
        (total, fruit) => total + fruit.weight,
        0,
    );

    let random = Math.random() * totalWeight;

    for (const fruit of FRUITS) {
        random -= fruit.weight;

        if (random <= 0) {
            return fruit;
        }
    }

    return FRUITS[0];
}

function createGardenLayout(garden = []) {
    const slots = Array.isArray(garden)
        ? garden.slice(-10)
        : [];

    while (slots.length < 10) {
        slots.push('empty');
    }

    return [
        slots.slice(0, 5),
        slots.slice(5, 10),
    ];
}

function renderGardenRow(row) {
    return row
        .map((fruit) => {
            if (!fruit || fruit === 'empty') {
                return '🌱';
            }

            const found = FRUITS.find(
                (item) => item.key === fruit.key,
            );

            return found?.emoji || '🌱';
        })
        .join(' ');
}

function formatGarden(garden) {
    const rows = createGardenLayout(garden);

    return [
        renderGardenRow(rows[0]),
        renderGardenRow(rows[1]),
    ].join('\n');
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatMultiplier(value) {
    return `${Number(value || 1).toFixed(2)}x`;
}

function calculateNextReward(bet, multiplier) {
    return Math.max(
        1,
        Math.floor(Number(bet) * Number(multiplier)),
    );
}

function calculateCurrentCashOut(bet, multiplier, steps) {
    if (!steps) {
        return 0;
    }

    return Math.max(
        0,
        Math.floor(
            Number(bet) *
            Math.max(0, Number(multiplier) - 1),
        ),
    );
}

function createButtons(guildId, userId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`fg_plant:${guildId}:${userId}`)
            .setLabel('Plant')
            .setEmoji('🌱')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),

        new ButtonBuilder()
            .setCustomId(`fg_cashout:${guildId}:${userId}`)
            .setLabel('Cash Out')
            .setEmoji('💰')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
    );
}

function createGardenEmbed(user, garden) {
    const bet = Number(garden.bet || 0);
    const steps = Number(garden.steps || 0);

    const multiplier = Number(
        garden.current_multiplier || STARTING_MULTIPLIER,
    );

    const failureChance = Number(
        garden.failure_chance || INITIAL_FAILURE_CHANCE,
    );

    const cashOut = Number(
        garden.cash_out ||
        calculateCurrentCashOut(
            bet,
            multiplier,
            steps,
        ),
    );

    const nextReward = calculateNextReward(
        bet,
        multiplier + MULTIPLIER_INCREASE,
    );

    const gardenDisplay = formatGarden(
        garden.garden || [],
    );

    const plantedFruit = garden.planted_fruit
        ? FRUITS.find(
            (fruit) =>
                fruit.key === garden.planted_fruit,
        )
        : null;

    const fruitText = plantedFruit
        ? `${plantedFruit.emoji} **${plantedFruit.name}**`
        : '🌱 Nothing planted yet';

    return {
        color: 0xF8D568,

        title: `🍓 ${user.username}'s fruit garden is growing!`,

        description:
            `**Bet:** \`${formatNumber(bet)}\`    ` +
            `**Steps:** \`${steps}\`    ` +
            `**Failure Chance:** \`${failureChance.toFixed(2)}%\`\n` +
            `**Cash Out:** \`${formatNumber(cashOut)}\` ` +
            `(\`${formatMultiplier(multiplier)}\`)    ` +
            `**Next:** \`${formatNumber(nextReward)}\` ` +
            `(\`${formatMultiplier(multiplier + MULTIPLIER_INCREASE)}\`)\n\n` +

            `${gardenDisplay}\n\n` +

            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🌱 **Growing:** ${fruitText}`,

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
        [guildId, userId],
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
            completed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
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

async function saveGarden(
    client,
    guildId,
    userId,
    garden,
) {
    const result = await client.db.pool.query(
        `
        UPDATE fruit_gardens
        SET
            steps = $3,
            current_multiplier = $4,
            cash_out = $5,
            failure_chance = $6,
            status = $7,
            garden = $8::jsonb,
            planted_fruit = $9,
            updated_at = CURRENT_TIMESTAMP,
            completed_at = CASE
                WHEN $7 IN ('failed', 'cashed_out', 'completed')
                    THEN CURRENT_TIMESTAMP
                ELSE completed_at
            END
        WHERE guild_id = $1
          AND user_id = $2
        RETURNING *
        `,
        [
            guildId,
            userId,
            garden.steps,
            garden.current_multiplier,
            garden.cash_out,
            garden.failure_chance,
            garden.status,
            JSON.stringify(garden.garden || []),
            garden.planted_fruit || null,
        ],
    );

    return result.rows[0] || null;
}

async function addFruitToInventory(
    client,
    guildId,
    userId,
    fruitKey,
) {
    await client.db.pool.query(
        `
        INSERT INTO fruit_garden_inventory (
            guild_id,
            user_id,
            fruit_key,
            quantity
        )
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (guild_id, user_id, fruit_key)
        DO UPDATE SET
            quantity = fruit_garden_inventory.quantity + 1,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
            guildId,
            userId,
            fruitKey,
        ],
    );
}

async function plantFruit(
    client,
    guildId,
    userId,
) {
    const garden = await getGarden(
        client,
        guildId,
        userId,
    );

    if (!garden) {
        throw createError(
            'Garden not found',
            ErrorTypes.VALIDATION,
            'You do not currently have a Fruity Garden. Use `/fg` to start one.',
        );
    }

    if (garden.status !== 'active') {
        throw createError(
            'Garden is not active',
            ErrorTypes.VALIDATION,
            'This garden is no longer active. Use `/fg` to start a new garden.',
        );
    }

    const failureChance = Number(
        garden.failure_chance ||
        INITIAL_FAILURE_CHANCE,
    );

    const failed =
        Math.random() * 100 < failureChance;

    if (failed) {
        garden.status = 'failed';
        garden.planted_fruit = null;

        const saved = await saveGarden(
            client,
            guildId,
            userId,
            garden,
        );

        return {
            success: false,
            garden: saved,
            fruit: null,
            reward: 0,
        };
    }

    const fruit = pickFruit();

    garden.steps =
        Number(garden.steps || 0) + 1;

    garden.current_multiplier =
        Number(garden.current_multiplier || 1) +
        MULTIPLIER_INCREASE;

    garden.failure_chance = Math.min(
        95,
        failureChance + FAILURE_INCREASE,
    );

    garden.planted_fruit = fruit.key;

    const reward = Math.max(
        fruit.value,
        calculateNextReward(
            Number(garden.bet),
            Number(garden.current_multiplier),
        ),
    );

    garden.cash_out =
        Number(garden.cash_out || 0) +
        reward;

    let currentGarden = [];

    try {
        currentGarden = Array.isArray(garden.garden)
            ? garden.garden
            : [];
    } catch {
        currentGarden = [];
    }

    currentGarden.push({
        key: fruit.key,
        emoji: fruit.emoji,
        step: garden.steps,
        value: reward,
    });

    garden.garden = currentGarden.slice(-10);

    await addFruitToInventory(
        client,
        guildId,
        userId,
        fruit.key,
    );

    const saved = await saveGarden(
        client,
        guildId,
        userId,
        garden,
    );

    return {
        success: true,
        garden: saved,
        fruit,
        reward,
    };
}

async function cashOutGarden(
    client,
    guildId,
    userId,
) {
    const garden = await getGarden(
        client,
        guildId,
        userId,
    );

    if (!garden) {
        throw createError(
            'Garden not found',
            ErrorTypes.VALIDATION,
            'You do not currently have a Fruity Garden.',
        );
    }

    if (garden.status !== 'active') {
        throw createError(
            'Garden is not active',
            ErrorTypes.VALIDATION,
            'This garden is no longer active.',
        );
    }

    const amount = Math.max(
        0,
        Number(garden.cash_out || 0),
    );

    if (amount <= 0) {
        throw createError(
            'Nothing to cash out',
            ErrorTypes.VALIDATION,
            'You have not grown anything yet. Plant some fruit first!',
        );
    }

    const economy = await getEconomyData(
        client,
        guildId,
        userId,
    );

    economy.wallet =
        Number(economy.wallet || 0) +
        amount;

    await setEconomyData(
        client,
        guildId,
        userId,
        economy,
    );

    garden.status = 'cashed_out';

    const saved = await saveGarden(
        client,
        guildId,
        userId,
        garden,
    );

    return {
        garden: saved,
        amount,
        wallet: economy.wallet,
    };
}

function createFinishedEmbed(
    user,
    garden,
    result,
) {
    if (result === 'failed') {
        return {
            color: 0xED4245,

            title: `💥 ${user.username}'s garden failed!`,

            description:
                `Your garden withered after **${formatNumber(
                    garden.steps,
                )}** successful step(s).\n\n` +

                `💸 **Bet:** ${formatNumber(garden.bet)}\n` +
                `🌱 **Steps:** ${formatNumber(garden.steps)}\n` +
                `❌ **Failure Chance:** ${Number(
                    garden.failure_chance,
                ).toFixed(2)}%\n\n` +

                `Your garden has been lost. Start a new one with \`/fg\`.`,
        };
    }

    return {
        color: 0x57F287,

        title: `💰 ${user.username} cashed out!`,

        description:
            `You harvested your Fruity Garden and received ` +
            `**${formatNumber(result.amount)}** coins!\n\n` +

            `🌱 **Steps:** ${formatNumber(garden.steps)}\n` +
            `📈 **Multiplier:** ${formatMultiplier(
                garden.current_multiplier,
            )}\n` +
            `💰 **Garden Payout:** ${formatNumber(
                result.amount,
            )}\n` +
            `💵 **New Wallet:** ${formatNumber(
                result.wallet,
            )}`,
    };
}

function disableButtons(row) {
    return new ActionRowBuilder().addComponents(
        row.components.map((component) =>
            ButtonBuilder.from(component).setDisabled(true),
        ),
    );
}

async function runGardenCollector(
    message,
    client,
    guildId,
    userId,
) {
    const collector = message.createMessageComponentCollector({
        time: 15 * 60 * 1000,
        filter: (interaction) => {
            const [type, buttonGuildId, buttonUserId] =
                interaction.customId.split(':');

            return (
                (type === 'fg_plant' ||
                    type === 'fg_cashout') &&
                buttonGuildId === guildId &&
                buttonUserId === userId
            );
        },
    });

    collector.on('collect', async (buttonInteraction) => {
        try {
            if (
                buttonInteraction.user.id !==
                userId
            ) {
                await buttonInteraction.reply({
                    content:
                        '🍓 This is not your Fruity Garden.',
                    ephemeral: true,
                });

                return;
            }

            if (
                buttonInteraction.customId.startsWith(
                    'fg_plant:',
                )
            ) {
                await buttonInteraction.deferUpdate();

                const result = await plantFruit(
                    client,
                    guildId,
                    userId,
                );

                if (!result.success) {
                    const failedEmbed =
                        createFinishedEmbed(
                            buttonInteraction.user,
                            result.garden,
                            'failed',
                        );

                    await buttonInteraction.editReply({
                        embeds: [failedEmbed],
                        components: [],
                    });

                    collector.stop('failed');

                    return;
                }

                const embed =
                    createGardenEmbed(
                        buttonInteraction.user,
                        result.garden,
                    );

                await buttonInteraction.editReply({
                    embeds: [embed],
                    components: [
                        createButtons(
                            guildId,
                            userId,
                        ),
                    ],
                });

                return;
            }

            if (
                buttonInteraction.customId.startsWith(
                    'fg_cashout:',
                )
            ) {
                await buttonInteraction.deferUpdate();

                const result =
                    await cashOutGarden(
                        client,
                        guildId,
                        userId,
                    );

                const embed =
                    createFinishedEmbed(
                        buttonInteraction.user,
                        result.garden,
                        result,
                    );

                await buttonInteraction.editReply({
                    embeds: [embed],
                    components: [],
                });

                collector.stop('cashed_out');
            }
        } catch (error) {
            logger.error(
                '[FRUITY GARDEN] Button interaction failed:',
                error,
            );

            if (
                buttonInteraction.deferred ||
                buttonInteraction.replied
            ) {
                await buttonInteraction.followUp({
                    content:
                        '❌ Something went wrong while processing your garden.',
                    ephemeral: true,
                }).catch(() => {});
            } else {
                await buttonInteraction.reply({
                    content:
                        '❌ Something went wrong while processing your garden.',
                    ephemeral: true,
                }).catch(() => {});
            }
        }
    });

    collector.on('end', async () => {
        try {
            const garden = await getGarden(
                client,
                guildId,
                userId,
            );

            if (
                !garden ||
                garden.status !== 'active'
            ) {
                return;
            }

            const currentMessage =
                await message.fetch().catch(() => null);

            if (!currentMessage) {
                return;
            }

            await currentMessage.edit({
                components: [
                    createButtons(
                        guildId,
                        userId,
                        true,
                    ),
                ],
            }).catch(() => {});
        } catch (error) {
            logger.debug(
                '[FRUITY GARDEN] Failed to disable expired buttons:',
                error.message,
            );
        }
    });
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

            const existingGarden =
                await getGarden(
                    client,
                    guildId,
                    userId,
                );

            /*
             * If the user already has an active garden,
             * resume it instead of charging another bet.
             */
            if (
                existingGarden &&
                existingGarden.status === 'active'
            ) {
                const embed =
                    createGardenEmbed(
                        interaction.user,
                        existingGarden,
                    );

                const message =
                    await InteractionHelper.safeEditReply(
                        interaction,
                        {
                            embeds: [embed],
                            components: [
                                createButtons(
                                    guildId,
                                    userId,
                                ),
                            ],
                        },
                    );

                if (message) {
                    const reply =
                        await interaction.fetchReply().catch(
                            () => null,
                        );

                    if (reply) {
                        runGardenCollector(
                            reply,
                            client,
                            guildId,
                            userId,
                        );
                    }
                }

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

            const wallet = Number(
                economy.wallet || 0,
            );

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
             * Remove the starting bet before creating
             * the garden so the wager is actually committed.
             */
            economy.wallet =
                wallet - bet;

            await setEconomyData(
                client,
                guildId,
                userId,
                economy,
            );

            const garden =
                await createGarden(
                    client,
                    guildId,
                    userId,
                    bet,
                );

            const embed =
                createGardenEmbed(
                    interaction.user,
                    garden,
                );

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [embed],
                    components: [
                        createButtons(
                            guildId,
                            userId,
                        ),
                    ],
                },
            );

            const reply =
                await interaction.fetchReply().catch(
                    () => null,
                );

            if (reply) {
                runGardenCollector(
                    reply,
                    client,
                    guildId,
                    userId,
                );
            }

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
