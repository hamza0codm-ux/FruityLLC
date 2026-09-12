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


/*
|--------------------------------------------------------------------------
| Fruit Garden Configuration
|--------------------------------------------------------------------------
*/

const STARTING_FAILURE_CHANCE = 0.20;

const PAYOUT_MULTIPLIER = 1.25;

const MAX_STEPS = 50;

const MIN_BET = 1;


/*
|--------------------------------------------------------------------------
| Fruits
|--------------------------------------------------------------------------
|
| These are primarily visual, so each successful step makes the garden
| change as the player progresses.
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

const RARE_FRUITS = [
    '🍍',
    '🥭',
    '🍒',
    '🍉',
    '🍓',
];

const LEGENDARY_FRUITS = [
    '🍇',
    '🍍',
    '🥭',
];


/*
|--------------------------------------------------------------------------
| Active Game Locks
|--------------------------------------------------------------------------
|
| Prevents two button clicks arriving at nearly the same time from
| processing the same garden twice.
|--------------------------------------------------------------------------
*/

const gardenLocks = new Set();


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getGardenLockKey(
    guildId,
    userId
) {
    return `${guildId}:${userId}`;
}


function withGardenLock(
    guildId,
    userId
) {
    const key =
        getGardenLockKey(
            guildId,
            userId
        );

    if (gardenLocks.has(key)) {
        throw createError(
            'Fruit Garden action already processing',
            ErrorTypes.RATE_LIMIT,
            'Your Fruit Garden action is already being processed. Please wait a moment.'
        );
    }

    gardenLocks.add(key);

    return () => {
        gardenLocks.delete(key);
    };
}


function randomFruit() {
    const random =
        Math.random();

    if (random < 0.03) {
        return LEGENDARY_FRUITS[
            Math.floor(
                Math.random() *
                LEGENDARY_FRUITS.length
            )
        ];
    }

    if (random < 0.12) {
        return RARE_FRUITS[
            Math.floor(
                Math.random() *
                RARE_FRUITS.length
            )
        ];
    }

    return FRUITS[
        Math.floor(
            Math.random() *
            FRUITS.length
        )
    ];
}


function createGardenDisplay(
    steps
) {
    const fruitCount =
        Math.min(
            15,
            Math.max(
                5,
                5 + Math.floor(steps / 2)
            )
        );

    const fruits = [];

    for (
        let index = 0;
        index < fruitCount;
        index += 1
    ) {
        fruits.push(
            randomFruit()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Always keep the display visually consistent.
    |--------------------------------------------------------------------------
    */

    while (fruits.length < 15) {
        fruits.push('🌱');
    }

    return [
        fruits.slice(0, 5).join(' '),
        fruits.slice(5, 10).join(' '),
        fruits.slice(10, 15).join(' '),
    ].join('\n');
}


function calculateNextPayout(
    currentPayout
) {
    return Math.floor(
        currentPayout *
        PAYOUT_MULTIPLIER
    );
}


function formatCurrency(
    amount
) {
    return `$${Number(amount || 0).toLocaleString()}`;
}


function formatPercent(
    value
) {
    return `${Math.round(value * 100)}%`;
}


/*
|--------------------------------------------------------------------------
| Build Embed
|--------------------------------------------------------------------------
*/

export function buildFruitGardenEmbed(
    user,
    garden,
    result = null
) {
    const payout =
        Number(
            garden?.payout || 0
        );

    const bet =
        Number(
            garden?.bet || 0
        );

    const steps =
        Number(
            garden?.steps || 0
        );

    const failureChance =
        Number(
            garden?.failureChance ??
            STARTING_FAILURE_CHANCE
        );

    const nextPayout =
        calculateNextPayout(
            payout
        );

    const display =
        garden?.display ||
        createGardenDisplay(
            steps
        );

    let title =
        `🍓 ${user.username}'s Fruit Garden`;

    let description =
        '';

    let color =
        0xF8D568;

    if (result === 'success') {
        title =
            `🌱 ${user.username}'s Fruit Garden`;

        description =
            'Your garden survived another growth stage!\n' +
            'Keep planting for a bigger payout — or cash out before the garden fails.';
    }

    if (result === 'cashed_out') {
        title =
            `💰 ${user.username}'s Fruit Garden`;

        description =
            `You cashed out your Fruit Garden for **${formatCurrency(payout)}**!`;

        color =
            0x57F287;
    }

    if (result === 'failed') {
        title =
            `💥 ${user.username}'s Fruit Garden`;

        description =
            `The garden failed and your **${formatCurrency(bet)}** bet was lost.`;

        color =
            0xED4245;
    }

    if (!result) {
        description =
            'Plant your garden and see how far you can grow the payout.';
    }

    const embed =
        new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(
                `${description}\n\n` +
                `**Bet:** ${formatCurrency(bet)}\n` +
                `**Steps:** ${steps}\n` +
                `**Failure Chance:** ${formatPercent(failureChance)}\n\n` +
                `**Cash Out:** ${formatCurrency(payout)}\n` +
                `**Next:** ${formatCurrency(nextPayout)}\n\n` +
                `${display}`
            );

    if (result === 'success') {
        const increase =
            nextPayout -
            payout;

        embed.addFields({
            name: '🌱 Next Plant',
            value:
                `Potential increase: **+${formatCurrency(increase)}**`,
            inline: false,
        });
    }

    if (result === 'cashed_out') {
        embed.addFields({
            name: '💵 Winnings',
            value:
                formatCurrency(payout),
            inline: true,
        });
    }

    if (result === 'failed') {
        embed.addFields({
            name: '💸 Lost',
            value:
                formatCurrency(bet),
            inline: true,
        });
    }

    embed.setFooter({
        text:
            result === 'cashed_out'
                ? 'Fruit Garden • Payout added to your wallet'
                : result === 'failed'
                    ? 'Fruit Garden • Better luck next time!'
                    : 'Fruit Garden • Risk more for a bigger payout',
    });

    return embed;
}


/*
|--------------------------------------------------------------------------
| Build Components
|--------------------------------------------------------------------------
*/

export function buildFruitGardenComponents(
    garden,
    disabled = false
) {
    if (
        !garden?.active ||
        disabled
    ) {
        return [];
    }

    const payout =
        Number(
            garden.payout || 0
        );

    const nextPayout =
        calculateNextPayout(
            payout
        );

    const increase =
        nextPayout -
        payout;

    const plantButton =
        new ButtonBuilder()
            .setCustomId(
                'fg_grow'
            )
            .setLabel(
                `Plant (+${increase.toLocaleString()})`
            )
            .setEmoji('🌱')
            .setStyle(
                ButtonStyle.Primary
            );

    const cashOutButton =
        new ButtonBuilder()
            .setCustomId(
                'fg_cashout'
            )
            .setLabel(
                `Cash Out ${payout.toLocaleString()}`
            )
            .setEmoji('💰')
            .setStyle(
                ButtonStyle.Success
            );

    return [
        new ActionRowBuilder()
            .addComponents(
                plantButton,
                cashOutButton
            ),
    ];
}


/*
|--------------------------------------------------------------------------
| Start Fruit Garden
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
            `Your Fruit Garden bet must be at least **${formatCurrency(MIN_BET)}**.`
        );
    }

    const release =
        withGardenLock(
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
                userData.wallet || 0
            );

        if (
            wallet <
            betAmount
        ) {
            throw createError(
                'Insufficient cash',
                ErrorTypes.VALIDATION,
                `You only have **${formatCurrency(wallet)}** cash, but you need **${formatCurrency(betAmount)}** to start Fruit Garden.`
            );
        }

        if (
            userData?.fruitGarden?.active
        ) {
            throw createError(
                'Fruit Garden already active',
                ErrorTypes.VALIDATION,
                'You already have an active Fruit Garden game.'
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Deduct the bet immediately.
        |--------------------------------------------------------------------------
        */

        userData.wallet =
            wallet -
            betAmount;

        const garden = {
            active: true,
            bet: betAmount,
            payout: betAmount,
            steps: 0,
            failureChance:
                STARTING_FAILURE_CHANCE,
            display:
                createGardenDisplay(0),
            startedAt:
                Date.now(),
            lastActionAt:
                Date.now(),
        };

        userData.fruitGarden =
            garden;

        await setEconomyData(
            client,
            guildId,
            userId,
            userData
        );

        return garden;
    } finally {
        release();
    }
}


/*
|--------------------------------------------------------------------------
| Grow / Plant
|--------------------------------------------------------------------------
*/

export async function growFruitGarden(
    client,
    guildId,
    userId
) {
    const release =
        withGardenLock(
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
                'You do not have an active Fruit Garden game.'
            );
        }

        if (
            Number(garden.steps || 0) >=
            MAX_STEPS
        ) {
            throw createError(
                'Maximum Fruit Garden steps reached',
                ErrorTypes.VALIDATION,
                'Your Fruit Garden has reached the maximum number of steps. Please cash out.'
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Roll failure BEFORE increasing payout.
        |--------------------------------------------------------------------------
        */

        const failure =
            Math.random() <
            Number(
                garden.failureChance ??
                STARTING_FAILURE_CHANCE
            );

        if (failure) {
            const lostBet =
                Number(
                    garden.bet || 0
                );

            garden.active =
                false;

            garden.failedAt =
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
                result: 'failed',
                garden,
                lostAmount: lostBet,
                wallet:
                    Number(
                        userData.wallet || 0
                    ),
            };
        }

        /*
        |--------------------------------------------------------------------------
        | Successful growth
        |--------------------------------------------------------------------------
        */

        garden.steps =
            Number(
                garden.steps || 0
            ) + 1;

        garden.payout =
            calculateNextPayout(
                Number(
                    garden.payout ||
                    garden.bet ||
                    0
                )
            );

        garden.lastActionAt =
            Date.now();

        garden.display =
            createGardenDisplay(
                garden.steps
            );

        /*
        |--------------------------------------------------------------------------
        | Failure chance stays at 20%, matching the requested game style.
        |--------------------------------------------------------------------------
        */

        garden.failureChance =
            STARTING_FAILURE_CHANCE;

        userData.fruitGarden =
            garden;

        await setEconomyData(
            client,
            guildId,
            userId,
            userData
        );

        return {
            result: 'success',
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
        withGardenLock(
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
                'You do not have an active Fruit Garden game.'
            );
        }

        const payout =
            Math.max(
                0,
                Math.floor(
                    Number(
                        garden.payout ||
                        garden.bet ||
                        0
                    )
                )
            );

        if (
            payout <= 0
        ) {
            throw createError(
                'Invalid Fruit Garden payout',
                ErrorTypes.UNKNOWN,
                'The Fruit Garden payout could not be calculated.'
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Add payout to wallet and close the game.
        |--------------------------------------------------------------------------
        */

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
            result: 'cashed_out',
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
