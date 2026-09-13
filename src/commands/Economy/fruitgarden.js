import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import {
    withErrorHandling,
    createError,
    ErrorTypes,
} from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';


// ============================================================
// SETTINGS
// ============================================================

const DEFAULT_BET = 100;
const TOTAL_STEPS = 10;
const FAILURE_CHANCE = 0.20;
const INACTIVITY_TIMEOUT = 60_000;


// ============================================================
// PAYOUT MULTIPLIERS
// ============================================================

const MULTIPLIERS = [
    1.25,
    1.56,
    1.95,
    2.44,
    3.05,
    3.81,
    4.77,
    5.96,
    7.45,
    9.31,
];


// ============================================================
// FRUITS
// ============================================================

const FRUITS = [
    '🍎',
    '🍌',
    '🍒',
    '🍇',
    '🍉',
    '🍓',
    '🍊',
    '🍋',
    '🍍',
    '🥝',
    '🥭',
    '🍑',
];


// ============================================================
// MONEY
// ============================================================

function formatMoney(amount) {
    return Math.floor(amount).toLocaleString('en-US');
}


// ============================================================
// PAYOUT
// ============================================================

function getMultiplier(step) {
    return MULTIPLIERS[step - 1] ?? MULTIPLIERS[MULTIPLIERS.length - 1];
}


function getPayout(bet, step) {
    return Math.floor(bet * getMultiplier(step));
}


// ============================================================
// RANDOM FRUIT
// ============================================================

function getRandomFruit() {
    return FRUITS[Math.floor(Math.random() * FRUITS.length)];
}


// ============================================================
// GARDEN
// ============================================================
//
// 5 tiles per row:
//
// 🟩  🟩  🟩  🟩  🟩
// 🟩  🟩  🟩  🟩  🟩
//
// Tiles reveal from left to right.
//

function createGarden(tiles) {
    const row1 = tiles.slice(0, 5).join('   ');
    const row2 = tiles.slice(5, 10).join('   ');

    return [
        '```',
        row1,
        '',
        row2,
        '```',
    ].join('\n');
}


// ============================================================
// DESCRIPTION
// ============================================================

function createDescription(bet, step, tiles) {
    const currentPayout =
        step > 0
            ? getPayout(bet, step)
            : 0;

    const currentMultiplier =
        step > 0
            ? getMultiplier(step)
            : 0;

    const nextStep =
        step < TOTAL_STEPS
            ? step + 1
            : TOTAL_STEPS;

    const nextPayout =
        step < TOTAL_STEPS
            ? getPayout(bet, nextStep)
            : currentPayout;

    const nextMultiplier =
        step < TOTAL_STEPS
            ? getMultiplier(nextStep)
            : currentMultiplier;

    const currentText =
        `${formatMoney(currentPayout)} (${currentMultiplier.toFixed(2)}x)`;

    const nextText =
        step < TOTAL_STEPS
            ? `${formatMoney(nextPayout)} (${nextMultiplier.toFixed(2)}x)`
            : 'MAX';

    return [
        `**Bet:** ${formatMoney(bet)}   **Steps:** ${TOTAL_STEPS}   **Failure Chance:** ${(FAILURE_CHANCE * 100).toFixed(2)}%`,
        `**Cash Out:** ${currentText}   **Next:** ${nextText}`,
        '',
        createGarden(tiles),
    ].join('\n');
}


// ============================================================
// BUTTONS
// ============================================================

function createButtons(bet, step) {
    const currentPayout =
        step > 0
            ? getPayout(bet, step)
            : 0;

    const nextPayout =
        step < TOTAL_STEPS
            ? getPayout(bet, step + 1)
            : currentPayout;

    const payoutAdded =
        Math.max(
            0,
            nextPayout - currentPayout
        );


    // HARVEST

    const harvestButton =
        new ButtonBuilder()
            .setCustomId('fruitgarden_harvest')
            .setLabel(
                `Harvest (+${formatMoney(payoutAdded)})`
            )
            .setEmoji('🌻')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(step >= TOTAL_STEPS);


    // CASH OUT

    const cashOutButton =
        new ButtonBuilder()
            .setCustomId('fruitgarden_cashout')
            .setLabel(
                `Cash Out: ${formatMoney(currentPayout)}`
            )
            .setStyle(ButtonStyle.Success)
            .setDisabled(step <= 0);


    return new ActionRowBuilder()
        .addComponents(
            harvestButton,
            cashOutButton
        );
}


// ============================================================
// EMBED
// ============================================================

function createEmbed(
    user,
    bet,
    step,
    tiles,
    title = '🍎 Fruit Garden',
    color = 0x57F287
) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(
            createDescription(
                bet,
                step,
                tiles
            )
        )
        .setColor(color)
        .setFooter({
            text: `${user.username}'s Fruit Garden`,
        });
}


// ============================================================
// COMMAND
// ============================================================

export default {

    data: new SlashCommandBuilder()
        .setName('fruitgarden')
        .setDescription(
            'Play Fruit Garden and gamble your cash'
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription(
                    'Amount of cash to bet (default: 100)'
                )
                .setRequired(false)
                .setMinValue(1)
        ),


    // ========================================================
    // EXECUTE
    // ========================================================

    execute: withErrorHandling(
        async (interaction, config, client) => {

            const deferred =
                await InteractionHelper.safeDefer(
                    interaction
                );

            if (!deferred) {
                return;
            }


            const user =
                interaction.user;

            const userId =
                user.id;

            const guildId =
                interaction.guildId;


            // =================================================
            // GUILD CHECK
            // =================================================

            if (!guildId) {
                throw createError(
                    'Fruit Garden requires a guild',
                    ErrorTypes.VALIDATION,
                    'Fruit Garden can only be played inside a server.'
                );
            }


            // =================================================
            // BET
            // =================================================

            const suppliedAmount =
                interaction.options.getInteger('amount');

            const bet =
                suppliedAmount ?? DEFAULT_BET;


            if (
                !Number.isSafeInteger(bet) ||
                bet <= 0
            ) {
                throw createError(
                    'Invalid Fruit Garden bet',
                    ErrorTypes.VALIDATION,
                    'Your bet must be a positive whole number.'
                );
            }


            // =================================================
            // ECONOMY
            // =================================================

            const userData =
                await getEconomyData(
                    client,
                    guildId,
                    userId
                );

            const wallet =
                Number(userData.wallet) || 0;


            if (wallet < bet) {
                throw createError(
                    'Insufficient cash for Fruit Garden',
                    ErrorTypes.VALIDATION,
                    `You only have **$${formatMoney(wallet)}**, but your bet is **$${formatMoney(bet)}**.`,
                    {
                        required: bet,
                        current: wallet,
                    }
                );
            }


            // Take the bet.

            userData.wallet =
                wallet - bet;

            await setEconomyData(
                client,
                guildId,
                userId,
                userData
            );


            // =================================================
            // GAME STATE
            // =================================================

            let step = 0;
            let ended = false;


            // Ten hidden tiles.

            const tiles =
                Array(TOTAL_STEPS).fill('🟩');


            // =================================================
            // SEND GAME
            // =================================================

            const initialEmbed =
                createEmbed(
                    user,
                    bet,
                    step,
                    tiles
                );

            const initialButtons =
                createButtons(
                    bet,
                    step
                );


            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        initialEmbed
                    ],
                    components: [
                        initialButtons
                    ],
                }
            );


            const gameMessage =
                await interaction.fetchReply();


            // =================================================
            // COLLECTOR
            // =================================================

            const collector =
                gameMessage.createMessageComponentCollector({
                    time: INACTIVITY_TIMEOUT,
                });


            // =================================================
            // FINISH
            // =================================================

            const finish =
                async embed => {

                    ended = true;

                    collector.stop(
                        'finished'
                    );

                    await InteractionHelper.safeEditReply(
                        interaction,
                        {
                            embeds: [
                                embed
                            ],
                            components: [],
                        }
                    );
                };


            // =================================================
            // BUTTONS
            // =================================================

            collector.on(
                'collect',
                async buttonInteraction => {

                    // ------------------------------------------------
                    // ONLY OWNER CAN USE BUTTONS
                    // ------------------------------------------------

                    if (
                        buttonInteraction.user.id !==
                        userId
                    ) {

                        await buttonInteraction.reply({
                            content:
                                '❌ This is not your Fruit Garden game.',
                            ephemeral: true,
                        }).catch(() => {});

                        return;
                    }


                    // ------------------------------------------------
                    // ALREADY ENDED
                    // ------------------------------------------------

                    if (ended) {

                        await buttonInteraction.reply({
                            content:
                                '❌ This Fruit Garden game has already ended.',
                            ephemeral: true,
                        }).catch(() => {});

                        return;
                    }


                    // Reset 60 second timer.

                    collector.resetTimer();


                    await buttonInteraction
                        .deferUpdate()
                        .catch(() => {});


                    try {

                        // =================================================
                        // HARVEST
                        // =================================================

                        if (
                            buttonInteraction.customId ===
                            'fruitgarden_harvest'
                        ) {

                            if (
                                step >= TOTAL_STEPS
                            ) {
                                return;
                            }


                            // Move forward one tile.

                            step += 1;


                            // =================================================
                            // FAILURE
                            // =================================================

                            if (
                                Math.random() <
                                FAILURE_CHANCE
                            ) {

                                // Bad tile.

                                tiles[
                                    step - 1
                                ] = '💥🐛';


                                // All tiles to the right
                                // become red.

                                for (
                                    let i = step;
                                    i < TOTAL_STEPS;
                                    i++
                                ) {

                                    tiles[i] =
                                        '🟥';
                                }


                                const loseEmbed =
                                    createEmbed(
                                        user,
                                        bet,
                                        step,
                                        tiles,
                                        '🍎 Fruit Garden — Game Over',
                                        0xED4245
                                    );


                                loseEmbed.setDescription(
                                    `${createDescription(
                                        bet,
                                        step,
                                        tiles
                                    )}\n\n💥🐛 **You hit a bad tile!**\nYou lost **$${formatMoney(
                                        bet
                                    )}**.`
                                );


                                await finish(
                                    loseEmbed
                                );

                                return;
                            }


                            // =================================================
                            // SAFE TILE
                            // =================================================

                            tiles[
                                step - 1
                            ] =
                                getRandomFruit();


                            // =================================================
                            // COMPLETE GARDEN
                            // =================================================

                            if (
                                step ===
                                TOTAL_STEPS
                            ) {

                                const finalPayout =
                                    getPayout(
                                        bet,
                                        TOTAL_STEPS
                                    );


                                userData.wallet =
                                    (
                                        Number(
                                            userData.wallet
                                        ) || 0
                                    ) +
                                    finalPayout;


                                await setEconomyData(
                                    client,
                                    guildId,
                                    userId,
                                    userData
                                );


                                const winEmbed =
                                    createEmbed(
                                        user,
                                        bet,
                                        step,
                                        tiles,
                                        '🍎 Fruit Garden — Jackpot!',
                                        0xFEE75C
                                    );


                                winEmbed.setDescription(
                                    `${createDescription(
                                        bet,
                                        step,
                                        tiles
                                    )}\n\n🎉 **You harvested the entire garden!**\nYou received **$${formatMoney(
                                        finalPayout
                                    )}**.`
                                );


                                await finish(
                                    winEmbed
                                );

                                return;
                            }


                            // =================================================
                            // UPDATE GAME
                            // =================================================

                            const updatedEmbed =
                                createEmbed(
                                    user,
                                    bet,
                                    step,
                                    tiles
                                );


                            const updatedButtons =
                                createButtons(
                                    bet,
                                    step
                                );


                            await InteractionHelper.safeEditReply(
                                interaction,
                                {
                                    embeds: [
                                        updatedEmbed
                                    ],
                                    components: [
                                        updatedButtons
                                    ],
                                }
                            );


                            return;
                        }


                        // =================================================
                        // CASH OUT
                        // =================================================

                        if (
                            buttonInteraction.customId ===
                            'fruitgarden_cashout'
                        ) {

                            if (
                                step <= 0
                            ) {
                                return;
                            }


                            const payout =
                                getPayout(
                                    bet,
                                    step
                                );


                            userData.wallet =
                                (
                                    Number(
                                        userData.wallet
                                    ) || 0
                                ) +
                                payout;


                            await setEconomyData(
                                client,
                                guildId,
                                userId,
                                userData
                            );


                            const cashoutEmbed =
                                createEmbed(
                                    user,
                                    bet,
                                    step,
                                    tiles,
                                    '🍎 Fruit Garden — Cashed Out',
                                    0x57F287
                                );


                            cashoutEmbed.setDescription(
                                `${createDescription(
                                    bet,
                                    step,
                                    tiles
                                )}\n\n💰 **You cashed out $${formatMoney(
                                    payout
                                )}!**`
                            );


                            await finish(
                                cashoutEmbed
                            );

                            return;
                        }

                    } catch (error) {

                        console.error(
                            'Fruit Garden button error:',
                            error
                        );


                        await buttonInteraction
                            .followUp({
                                content:
                                    '❌ Something went wrong while processing your Fruit Garden game.',
                                ephemeral: true,
                            })
                            .catch(() => {});
                    }
                }
            );


            // =================================================
            // INACTIVITY TIMEOUT
            // =================================================

            collector.on(
                'end',
                async (_collected, reason) => {

                    if (
                        reason === 'finished' ||
                        ended
                    ) {
                        return;
                    }


                    ended = true;


                    // =================================================
                    // AUTO CASH OUT
                    // =================================================

                    if (
                        step > 0 &&
                        step < TOTAL_STEPS
                    ) {

                        const payout =
                            getPayout(
                                bet,
                                step
                            );


                        userData.wallet =
                            (
                                Number(
                                    userData.wallet
                                ) || 0
                            ) +
                            payout;


                        await setEconomyData(
                            client,
                            guildId,
                            userId,
                            userData
                        );


                        const timeoutEmbed =
                            createEmbed(
                                user,
                                bet,
                                step,
                                tiles,
                                '🍎 Fruit Garden — Timed Out',
                                0xFEE75C
                            );


                        timeoutEmbed.setDescription(
                            `${createDescription(
                                bet,
                                step,
                                tiles
                            )}\n\n⏰ **Game timed out.** Your current payout of **$${formatMoney(
                                payout
                            )}** was automatically cashed out.`
                        );


                        await InteractionHelper.safeEditReply(
                            interaction,
                            {
                                embeds: [
                                    timeoutEmbed
                                ],
                                components: [],
                            }
                        ).catch(() => {});


                        return;
                    }


                    // =================================================
                    // NO HARVEST
                    // =================================================

                    const timeoutEmbed =
                        createEmbed(
                            user,
                            bet,
                            step,
                            tiles,
                            '🍎 Fruit Garden — Timed Out',
                            0x95A5A6
                        );


                    timeoutEmbed.setDescription(
                        `${createDescription(
                            bet,
                            step,
                            tiles
                        )}\n\n⏰ **Fruit Garden timed out before you harvested a tile.**`
                    );


                    await InteractionHelper.safeEditReply(
                        interaction,
                        {
                            embeds: [
                                timeoutEmbed
                            ],
                            components: [],
                        }
                    ).catch(() => {});

                }
            );

        },
        {
            command: 'fruitgarden',
        }
    ),
};
