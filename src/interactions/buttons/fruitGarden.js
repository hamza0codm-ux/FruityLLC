import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';
import {
    getEconomyData,
    setEconomyData,
} from '../../utils/economy.js';

import { logger } from '../../utils/logger.js';

const DEFAULT_BET = 100;

const INITIAL_FAILURE_CHANCE = 20;
const FAILURE_INCREASE = 2;

const STARTING_MULTIPLIER = 1;
const MULTIPLIER_INCREASE = 0.17;

const MAX_FAILURE_CHANCE = 95;

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

function getFruit(key) {
    return (
        FRUITS.find(
            (fruit) => fruit.key === key,
        ) || null
    );
}

function chooseFruit() {
    const totalWeight =
        FRUITS.reduce(
            (total, fruit) =>
                total + fruit.weight,
            0,
        );

    let random =
        Math.random() * totalWeight;

    for (const fruit of FRUITS) {
        random -= fruit.weight;

        if (random <= 0) {
            return fruit;
        }
    }

    return FRUITS[0];
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatMultiplier(value) {
    return `${Number(value || 1).toFixed(2)}x`;
}

function createGardenButtons(
    guildId,
    userId,
    disabled = false,
) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `fg_plant:${guildId}:${userId}`,
                )
                .setLabel('Plant')
                .setEmoji('🌱')
                .setStyle(ButtonStyle.Success)
                .setDisabled(disabled),

            new ButtonBuilder()
                .setCustomId(
                    `fg_cashout:${guildId}:${userId}`,
                )
                .setLabel('Cash Out')
                .setEmoji('💰')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled),
        ),
    ];
}

function createGardenDisplay(garden) {
    const slots =
        Array.isArray(garden.garden)
            ? garden.garden
            : [];

    const display = [];

    for (let i = 0; i < 10; i += 1) {
        const fruitKey =
            slots[i] || null;

        if (!fruitKey) {
            display.push('🌱');
            continue;
        }

        const fruit =
            getFruit(
                typeof fruitKey === 'string'
                    ? fruitKey
                    : fruitKey.key,
            );

        display.push(
            fruit?.emoji || '🌱',
        );
    }

    return [
        display
            .slice(0, 5)
            .join(' '),

        display
            .slice(5, 10)
            .join(' '),
    ].join('\n');
}

function getNextReward(garden) {
    const multiplier =
        Number(
            garden.current_multiplier ||
            STARTING_MULTIPLIER,
        );

    const bet =
        Number(
            garden.bet ||
            DEFAULT_BET,
        );

    return Math.max(
        1,
        Math.floor(
            bet * (
                multiplier +
                MULTIPLIER_INCREASE
            ),
        ),
    );
}

function createGardenEmbed(
    interaction,
    garden,
    result = null,
) {
    const username =
        interaction.member?.displayName ||
        interaction.user?.globalName ||
        interaction.user?.username ||
        'User';

    const failureChance =
        Number(
            garden.failure_chance ||
            INITIAL_FAILURE_CHANCE,
        );

    const multiplier =
        Number(
            garden.current_multiplier ||
            STARTING_MULTIPLIER,
        );

    const nextMultiplier =
        multiplier +
        MULTIPLIER_INCREASE;

    const nextReward =
        getNextReward(garden);

    let description = [
        '🌱 **Your fruit garden is growing!**',
        '',
        createGardenDisplay(garden),
    ].join('\n');

    if (result?.success) {
        description += [
            '',
            `${result.fruit.emoji} You grew a **${result.fruit.name}**!`,
            `💰 Added **${formatNumber(result.reward)}** to your cash out.`,
        ].join('\n');
    }

    if (result?.failed) {
        description += [
            '',
            '💥 **Your garden failed!**',
            '',
            'The plants were lost and your bet could not be recovered.',
        ].join('\n');
    }

    if (garden.status === 'cashed_out') {
        description += [
            '',
            `💰 **You cashed out ${formatNumber(
                garden.cash_out,
            )}!**`,
        ].join('\n');
    }

    return createEmbed({
        title:
            `🍓 ${username}'s fruit garden is growing!`,

        description,

        color:
            garden.status === 'failed'
                ? '#ED4245'
                : garden.status === 'cashed_out'
                    ? '#57F287'
                    : '#F8D568',
    }).addFields(
        {
            name: '💵 Bet',
            value:
                `\`${formatNumber(
                    garden.bet,
                )}\``,
            inline: true,
        },

        {
            name: '🌱 Steps',
            value:
                `\`${formatNumber(
                    garden.steps,
                )}\``,
            inline: true,
        },

        {
            name: '💀 Failure Chance',
            value:
                `\`${failureChance.toFixed(
                    1,
                )}%\``,
            inline: true,
        },

        {
            name: '💰 Cash Out',
            value:
                `\`${formatNumber(
                    garden.cash_out,
                )}\``,
            inline: true,
        },

        {
            name: '📈 Multiplier',
            value:
                `\`${formatMultiplier(
                    multiplier,
                )}\``,
            inline: true,
        },

        {
            name: '🌿 Next Reward',
            value:
                `\`${formatNumber(
                    nextReward,
                )}\``,
            inline: true,
        },

        {
            name: '📈 Next Multiplier',
            value:
                `\`${formatMultiplier(
                    nextMultiplier,
                )}\``,
            inline: true,
        },

        {
            name: '🍓 Growing Fruit',
            value:
                garden.planted_fruit
                    ? `${
                        getFruit(
                            garden.planted_fruit,
                        )?.emoji || '🌱'
                    } ${
                        getFruit(
                            garden.planted_fruit,
                        )?.name ||
                        garden.planted_fruit
                    }`
                    : '🌱 Nothing yet',

            inline: true,
        },
    );
}

async function getGarden(
    client,
    guildId,
    userId,
    forUpdate = false,
    dbClient = null,
) {
    const executor =
        dbClient ||
        client.db.pool;

    const result =
        await executor.query(
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
            ${forUpdate ? 'FOR UPDATE' : ''}
            `,
            [
                guildId,
                userId,
            ],
        );

    return result.rows[0] || null;
}

async function saveGarden(
    dbClient,
    garden,
) {
    const result =
        await dbClient.query(
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
                    WHEN $7 IN (
                        'failed',
                        'cashed_out',
                        'completed'
                    )
                        THEN CURRENT_TIMESTAMP
                    ELSE completed_at
                END
            WHERE guild_id = $1
              AND user_id = $2
            RETURNING *
            `,
            [
                garden.guild_id,
                garden.user_id,
                garden.steps,
                garden.current_multiplier,
                garden.cash_out,
                garden.failure_chance,
                garden.status,
                JSON.stringify(
                    garden.garden || [],
                ),
                garden.planted_fruit ||
                    null,
            ],
        );

    return result.rows[0] || null;
}

async function addFruitToInventory(
    dbClient,
    guildId,
    userId,
    fruitKey,
) {
    await dbClient.query(
        `
        INSERT INTO fruit_garden_inventory (
            guild_id,
            user_id,
            fruit_key,
            quantity
        )
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (
            guild_id,
            user_id,
            fruit_key
        )
        DO UPDATE SET
            quantity =
                fruit_garden_inventory.quantity + 1,
            updated_at =
                CURRENT_TIMESTAMP
        `,
        [
            guildId,
            userId,
            fruitKey,
        ],
    );
}

async function plantFruit(
    interaction,
    client,
    guildId,
    userId,
) {
    const dbClient =
        await client.db.pool.connect();

    try {
        await dbClient.query(
            'BEGIN',
        );

        const garden =
            await getGarden(
                client,
                guildId,
                userId,
                true,
                dbClient,
            );

        if (!garden) {
            await dbClient.query(
                'ROLLBACK',
            );

            await interaction.reply({
                content:
                    '❌ You do not have a Fruity Garden.',
                ephemeral: true,
            });

            return;
        }

        if (garden.status !== 'active') {
            await dbClient.query(
                'ROLLBACK',
            );

            await interaction.reply({
                content:
                    '❌ This Fruity Garden is no longer active.',
                ephemeral: true,
            });

            return;
        }

        const failureChance =
            Number(
                garden.failure_chance ||
                INITIAL_FAILURE_CHANCE,
            );

        const failed =
            Math.random() * 100 <
            failureChance;

        if (failed) {
            garden.status =
                'failed';

            garden.planted_fruit =
                null;

            const saved =
                await saveGarden(
                    dbClient,
                    garden,
                );

            await dbClient.query(
                'COMMIT',
            );

            await interaction.update({
                embeds: [
                    createGardenEmbed(
                        interaction,
                        saved,
                        {
                            failed: true,
                        },
                    ),
                ],

                components:
                    createGardenButtons(
                        guildId,
                        userId,
                        true,
                    ),
            });

            return;
        }

        const fruit =
            chooseFruit();

        garden.steps =
            Number(
                garden.steps || 0,
            ) + 1;

        garden.current_multiplier =
            Number(
                (
                    Number(
                        garden.current_multiplier ||
                        STARTING_MULTIPLIER,
                    ) +
                    MULTIPLIER_INCREASE
                ).toFixed(4),
            );

        garden.failure_chance =
            Math.min(
                MAX_FAILURE_CHANCE,
                Number(
                    (
                        failureChance +
                        FAILURE_INCREASE
                    ).toFixed(3),
                ),
            );

        garden.planted_fruit =
            fruit.key;

        const reward =
            Math.max(
                Number(
                    fruit.value || 0,
                ),

                Math.floor(
                    Number(
                        garden.bet ||
                        DEFAULT_BET,
                    ) *
                    Number(
                        garden.current_multiplier ||
                        1,
                    ),
                ),
            );

        garden.cash_out =
            Number(
                garden.cash_out || 0,
            ) + reward;

        const currentGarden =
            Array.isArray(
                garden.garden,
            )
                ? garden.garden
                : [];

        currentGarden.push(
            fruit.key,
        );

        garden.garden =
            currentGarden.slice(-10);

        await addFruitToInventory(
            dbClient,
            guildId,
            userId,
            fruit.key,
        );

        const saved =
            await saveGarden(
                dbClient,
                garden,
            );

        await dbClient.query(
            'COMMIT',
        );

        await interaction.update({
            embeds: [
                createGardenEmbed(
                    interaction,
                    saved,
                    {
                        success: true,
                        fruit,
                        reward,
                    },
                ),
            ],

            components:
                createGardenButtons(
                    guildId,
                    userId,
                    false,
                ),
        });
    } catch (error) {
        await dbClient.query(
            'ROLLBACK',
        ).catch(() => {});

        logger.error(
            `[FRUITY GARDEN] Plant failed for ${userId}:`,
            error,
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                content:
                    '❌ Something went wrong while planting your fruit.',
                ephemeral: true,
            }).catch(() => {});
        } else {
            await interaction.followUp({
                content:
                    '❌ Something went wrong while planting your fruit.',
                ephemeral: true,
            }).catch(() => {});
        }
    } finally {
        dbClient.release();
    }
}

async function cashOutGarden(
    interaction,
    client,
    guildId,
    userId,
) {
    const dbClient =
        await client.db.pool.connect();

    try {
        await dbClient.query(
            'BEGIN',
        );

        const garden =
            await getGarden(
                client,
                guildId,
                userId,
                true,
                dbClient,
            );

        if (!garden) {
            await dbClient.query(
                'ROLLBACK',
            );

            await interaction.reply({
                content:
                    '❌ You do not have a Fruity Garden.',
                ephemeral: true,
            });

            return;
        }

        if (garden.status !== 'active') {
            await dbClient.query(
                'ROLLBACK',
            );

            await interaction.reply({
                content:
                    '❌ This Fruity Garden has already been finished.',
                ephemeral: true,
            });

            return;
        }

        const amount =
            Math.max(
                0,
                Number(
                    garden.cash_out || 0,
                ),
            );

        if (amount <= 0) {
            await dbClient.query(
                'ROLLBACK',
            );

            await interaction.reply({
                content:
                    '❌ There is nothing to cash out yet. Plant some fruit first!',
                ephemeral: true,
            });

            return;
        }

        const economy =
            await getEconomyData(
                client,
                guildId,
                userId,
            );

        economy.wallet =
            Number(
                economy.wallet || 0,
            ) + amount;

        const savedEconomy =
            await setEconomyData(
                client,
                guildId,
                userId,
                economy,
            );

        if (!savedEconomy) {
            throw new Error(
                'Failed to save wallet during Fruity Garden cash out.',
            );
        }

        garden.status =
            'cashed_out';

        garden.completed_at =
            new Date();

        const savedGarden =
            await saveGarden(
                dbClient,
                garden,
            );

        await dbClient.query(
            'COMMIT',
        );

        const embed =
            createGardenEmbed(
                interaction,
                savedGarden,
            );

        embed.addFields({
            name: '💵 New Balance',
            value:
                `\`${formatNumber(
                    economy.wallet,
                )}\``,
            inline: true,
        });

        await interaction.update({
            embeds: [embed],

            components:
                createGardenButtons(
                    guildId,
                    userId,
                    true,
                ),
        });
    } catch (error) {
        await dbClient.query(
            'ROLLBACK',
        ).catch(() => {});

        logger.error(
            `[FRUITY GARDEN] Cash out failed for ${userId}:`,
            error,
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                content:
                    '❌ Something went wrong while cashing out your garden.',
                ephemeral: true,
            }).catch(() => {});
        } else {
            await interaction.followUp({
                content:
                    '❌ Something went wrong while cashing out your garden.',
                ephemeral: true,
            }).catch(() => {});
        }
    } finally {
        dbClient.release();
    }
}

function createHandler(
    name,
    handler,
) {
    return {
        name,

        async execute(
            interaction,
            client,
            args = [],
        ) {
            const [
                guildId,
                userId,
            ] = args;

            if (
                !guildId ||
                !userId
            ) {
                await interaction.reply({
                    content:
                        '❌ Invalid Fruity Garden button.',
                    ephemeral: true,
                }).catch(() => {});

                return;
            }

            if (
                interaction.guildId !==
                guildId
            ) {
                await interaction.reply({
                    content:
                        '❌ This garden belongs to another server.',
                    ephemeral: true,
                }).catch(() => {});

                return;
            }

            if (
                interaction.user.id !==
                userId
            ) {
                await interaction.reply({
                    content:
                        '❌ This is not your Fruity Garden.',
                    ephemeral: true,
                }).catch(() => {});

                return;
            }

            await handler(
                interaction,
                client,
                guildId,
                userId,
            );
        },
    };
}

export default [
    createHandler(
        'fg_plant',
        plantFruit,
    ),

    createHandler(
        'fg_cashout',
        cashOutGarden,
    ),
];
