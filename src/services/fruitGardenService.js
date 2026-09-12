// src/services/fruitGardenService.js

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';

import {
    getEconomyData,
    setEconomyData,
} from '../utils/economy.js';

import {
    createError,
    ErrorTypes,
} from '../utils/errorHandler.js';


const MAX_STEPS = 10;

const FAILURE_CHANCE = 0.20;

const GROWTH_MULTIPLIER = 1.17;

const MIN_BET = 1;


/*
|--------------------------------------------------------------------------
| Fruits
|--------------------------------------------------------------------------
*/

const FRUITS = [
    '🍎',
    '🍊',
    '🍋',
    '🍉',
    '🍇',
    '🍓',
    '🫐',
    '🍒',
    '🍑',
    '🍐',
    '🥝',
    '🍍',
    '🥭',
    '🍌',
    '🥥',
];


/*
|--------------------------------------------------------------------------
| Locks
|--------------------------------------------------------------------------
*/

const gardenLocks =
    new Set();


function getLockKey(
    guildId,
    userId
) {
    return `${guildId}:${userId}`;
}


function acquireLock(
    guildId,
    userId
) {
    const key =
        getLockKey(
            guildId,
            userId
        );

    if (
        gardenLocks.has(key)
    ) {
        throw createError(
            'Fruit Garden busy',
            ErrorTypes.RATE_LIMIT,
            'Your Fruit Garden is already processing an action. Please wait a moment.'
        );
    }

    gardenLocks.add(key);

    return () => {
        gardenLocks.delete(key);
    };
}


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function formatMoney(
    amount
) {
    return `$${Math.floor(
        Number(amount || 0)
    ).toLocaleString()}`;
}


function formatPercent(
    value
) {
    return `${(
        Number(value || 0) * 100
    ).toFixed(2)}%`;
}


function calculateNextPayout(
    bet,
    steps
) {
    return Math.floor(
        Number(bet || 0) *
        Math.pow(
            GROWTH_MULTIPLIER,
            Number(steps || 0) + 1
        )
    );
}


function calculateCurrentPayout(
    bet,
    steps
) {
    if (
        Number(steps || 0) <= 0
    ) {
        return 0;
    }

    return Math.floor(
        Number(bet || 0) *
        Math.pow(
            GROWTH_MULTIPLIER,
            Number(steps || 0)
        )
    );
}


/*
|--------------------------------------------------------------------------
| Garden
|--------------------------------------------------------------------------
|
| Always exactly:
|
| 5 fruits
| 5 fruits
| 5 fruits
|
|--------------------------------------------------------------------------
*/

function generateGardenDisplay(
    steps = 0
) {
    const planted =
        Math.min(
            Math.max(
                Number(steps || 0),
                0
            ),
            15
        );

    const slots = [];

    for (
        let index = 0;
        index < 15;
        index += 1
    ) {
        if (
            index < planted
        ) {
            const fruit =
                FRUITS[
                    Math.floor(
                        Math.random() *
                        FRUITS.length
                    )
                ];

            slots.push(
                fruit
            );
        } else {
            slots.push(
                '🌱'
            );
        }
    }

    return [
        slots.slice(0, 5).join(' '),
        slots.slice(5, 10).join(' '),
        slots.slice(10, 15).join(' '),
    ].join('\n');
}


/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

export async function startFruitGarden(
    client,
    guildId,
    userId,
    betAmount
) {
    if (
        !Number.isSafeInteger(
            betAmount
        ) ||
        betAmount < MIN_BET
    ) {
        throw createError(
            'Invalid Fruit Garden bet',
            ErrorTypes.VALIDATION,
            'Please enter a valid positive bet.'
        );
    }

    const release =
        acquireLock(
            guildId,
            userId
        );

    try {
        const userData =
            await getEconomyData(
                client,
                guildId,
                userId
            );

        const wallet =
            Number(
                userData?.wallet || 0
            );

        if (
            wallet < betAmount
        ) {
            throw createError(
                'Insufficient cash',
                ErrorTypes.VALIDATION,
                `You only have **${formatMoney(wallet)}** cash.`
            );
        }

        if (
            userData?.fruitGarden?.active
        ) {
            throw createError(
                'Garden already active',
                ErrorTypes.VALIDATION,
                'You already have an active Fruit Garden.'
            );
        }

        userData.wallet =
            wallet -
            betAmount;

        const garden = {
            active: true,

            bet:
                betAmount,

            steps: 0,

            maxSteps:
                MAX_STEPS,

            failureChance:
                FAILURE_CHANCE,

            currentPayout:
                0,

            nextPayout:
                calculateNextPayout(
                    betAmount,
                    0
                ),

            display:
                generateGardenDisplay(
                    0
                ),

            startedAt:
                Date.now(),

            lastActionAt:
                Date.now(),
        };

        userData.fruitGarden =
            garden;

        const saved =
            await setEconomyData(
                client,
                guildId,
                userId,
                userData
            );

        if (!saved) {
            throw createError(
                'Fruit Garden save failed',
                ErrorTypes.DATABASE,
                'I could not save your Fruit Garden. Please try again.'
            );
        }

        return garden;

    } finally {
        release();
    }
}


/*
|--------------------------------------------------------------------------
| Plant
|--------------------------------------------------------------------------
*/

export async function growFruitGarden(
    client,
    guildId,
    userId
) {
    const release =
        acquireLock(
            guildId,
            userId
        );

    try {
        const userData =
            await getEconomyData(
                client,
                guildId,
                userId
            );

        const garden =
            userData?.fruitGarden;

        if (
            !garden?.active
        ) {
            throw createError(
                'No active Fruit Garden',
                ErrorTypes.VALIDATION,
                'You do not have an active Fruit Garden.'
            );
        }

        const steps =
            Number(
                garden.steps || 0
            );

        if (
            steps >= MAX_STEPS
        ) {
            throw createError(
                'Garden complete',
                ErrorTypes.VALIDATION,
                'Your Fruit Garden is fully grown. Cash out your payout!'
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Failure
        |--------------------------------------------------------------------------
        */

        const failed =
            Math.random() <
            FAILURE_CHANCE;

        if (failed) {
            garden.active =
                false;

            garden.failedAt =
                Date.now();

            garden.lastActionAt =
                Date.now();

            garden.currentPayout =
                0;

            garden.nextPayout =
                0;

            garden.display =
                generateGardenDisplay(
                    steps
                );

            userData.fruitGarden =
                garden;

            await setEconomyData(
                client,
                guildId,
                userId,
                userData
            );

            return {
                result:
                    'failed',

                garden,

                lostAmount:
                    Number(
                        garden.bet || 0
                    ),

                wallet:
                    Number(
                        userData.wallet || 0
                    ),
            };
        }

        /*
        |--------------------------------------------------------------------------
        | Successful Plant
        |--------------------------------------------------------------------------
        */

        const newSteps =
            steps + 1;

        garden.steps =
            newSteps;

        garden.currentPayout =
            calculateCurrentPayout(
                garden.bet,
                newSteps
            );

        garden.nextPayout =
            calculateNextPayout(
                garden.bet,
                newSteps
            );

        garden.display =
            generateGardenDisplay(
                newSteps
            );

        garden.lastActionAt =
            Date.now();

        userData.fruitGarden =
            garden;

        await setEconomyData(
            client,
            guildId,
            userId,
            userData
        );

        return {
            result:
                'success',

            garden,

            wallet:
                Number(
                    userData.wallet || 0
                ),
        };

    } finally {
        release();
    }
}


/*
|--------------------------------------------------------------------------
| Cash Out
|--------------------------------------------------------------------------
*/

export async function cashOutFruitGarden(
    client,
    guildId,
    userId
) {
    const release =
        acquireLock(
            guildId,
            userId
        );

    try {
        const userData =
            await getEconomyData(
                client,
                guildId,
                userId
            );

        const garden =
            userData?.fruitGarden;

        if (
            !garden?.active
        ) {
            throw createError(
                'No active Fruit Garden',
                ErrorTypes.VALIDATION,
                'You do not have an active Fruit Garden.'
            );
        }

        const payout =
            Number(
                garden.currentPayout || 0
            );

        if (
            payout <= 0
        ) {
            throw createError(
                'Nothing to cash out',
                ErrorTypes.VALIDATION,
                'You need to successfully plant at least once before cashing out.'
            );
        }

        userData.wallet =
            Number(
                userData.wallet || 0
            ) +
            payout;

        garden.active =
            false;

        garden.cashedOutAt =
            Date.now();

        garden.lastActionAt =
            Date.now();

        userData.fruitGarden =
            garden;

        await setEconomyData(
            client,
            guildId,
            userId,
            userData
        );

        return {
            result:
                'cashed_out',

            garden,

            payout,

            wallet:
                Number(
                    userData.wallet || 0
                ),
        };

    } finally {
        release();
    }
}


/*
|--------------------------------------------------------------------------
| Embed
|--------------------------------------------------------------------------
*/

export function buildFruitGardenEmbed(
    user,
    garden,
    result = null
) {
    const bet =
        Number(
            garden?.bet || 0
        );

    const steps =
        Number(
            garden?.steps || 0
        );

    const currentPayout =
        Number(
            garden?.currentPayout || 0
        );

    const nextPayout =
        result === 'failed'
            ? 0
            : Number(
                garden?.nextPayout ||
                calculateNextPayout(
                    bet,
                    steps
                )
            );

    const failureChance =
        Number(
            garden?.failureChance ??
            FAILURE_CHANCE
        );

    const display =
        garden?.display ||
        generateGardenDisplay(
            steps
        );

    let title =
        `🐌 ${user}'s fruit garden is planting a garden.`;

    let color =
        0xF8D568;

    if (
        result === 'failed'
    ) {
        title =
            `💥 ${user}'s fruit garden failed!`;

        color =
            0xED4245;
    }

    if (
        result === 'cashed_out'
    ) {
        title =
            `💰 ${user}'s fruit garden.`;

        color =
            0x57F287;
    }

    let description =
        `Bet: **${bet.toLocaleString()}**   ` +
        `Steps: **${steps}**   ` +
        `Failure Chance: **${formatPercent(failureChance)}**\n` +

        `Cash Out: **${currentPayout.toLocaleString()}** ` +
        `(${bet > 0 ? (currentPayout / bet).toFixed(2) : '0.00'}x)   ` +

        `Next: **${nextPayout.toLocaleString()}** ` +
        `(${bet > 0 ? (nextPayout / bet).toFixed(2) : '0.00'}x)\n\n` +

        `${display}`;

    if (
        result === 'failed'
    ) {
        description =
            `Bet: **${bet.toLocaleString()}**   ` +
            `Steps: **${steps}**   ` +
            `Failure Chance: **${formatPercent(failureChance)}**\n` +

            `Cash Out: **0** (0x)   ` +
            `Next: **0** (0x)\n\n` +

            `${display}\n\n` +

            `💥 The garden failed. You lost **${formatMoney(bet)}**.`;
    }

    if (
        result === 'cashed_out'
    ) {
        description =
            `Bet: **${bet.toLocaleString()}**   ` +
            `Steps: **${steps}**   ` +
            `Failure Chance: **${formatPercent(failureChance)}**\n` +

            `Cash Out: **${currentPayout.toLocaleString()}** ` +
            `(${bet > 0 ? (currentPayout / bet).toFixed(2) : '0.00'}x)\n\n` +

            `${display}\n\n` +

            `💰 You cashed out **${formatMoney(currentPayout)}**.`;
    }

    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description);
}


/*
|--------------------------------------------------------------------------
| Buttons
|--------------------------------------------------------------------------
*/

export function buildFruitGardenComponents(
    garden
) {
    if (
        !garden?.active
    ) {
        return [];
    }

    const steps =
        Number(
            garden.steps || 0
        );

    const currentPayout =
        Number(
            garden.currentPayout || 0
        );

    const nextPayout =
        Number(
            garden.nextPayout ||
            calculateNextPayout(
                garden.bet,
                steps
            )
        );

    const increase =
        Math.max(
            0,
            nextPayout -
            currentPayout
        );

    const plantButton =
        new ButtonBuilder()
            .setCustomId(
                'fg_grow'
            )
            .setEmoji(
                '🌱'
            )
            .setLabel(
                `Plant (+${increase.toLocaleString()})`
            )
            .setStyle(
                ButtonStyle.Primary
            )
            .setDisabled(
                steps >= MAX_STEPS
            );

    const cashOutButton =
        new ButtonBuilder()
            .setCustomId(
                'fg_cashout'
            )
            .setLabel(
                'Cash Out'
            )
            .setStyle(
                ButtonStyle.Success
            )
            .setDisabled(
                currentPayout <= 0
            );

    return [
        new ActionRowBuilder()
            .addComponents(
                plantButton,
                cashOutButton
            ),
    ];
}
