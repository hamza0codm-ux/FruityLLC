import { createCanvas } from '@napi-rs/canvas';

const WIDTH = 620;
const HEIGHT = 180;

const TILE_WIDTH = 105;
const TILE_HEIGHT = 55;
const GAP = 3;

const START_X = 42;
const START_Y = 18;

const COLORS = {
    background: '#2b2d31',
    hidden: '#78b35a',
    hiddenShadow: '#6aa04e',
    revealed: '#78b35a',
    red: '#d94b4b',
    failed: '#b83d3d',
    white: '#ffffff',
};

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
}

function drawApple(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍎', x, y);
}

function drawBanana(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍌', x, y);
}

function drawCherry(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍒', x, y);
}

function drawGrape(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍇', x, y);
}

function drawWatermelon(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍉', x, y);
}

function drawStrawberry(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍓', x, y);
}

function drawOrange(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍊', x, y);
}

function drawLemon(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍋', x, y);
}

function drawPineapple(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍍', x, y);
}

function drawKiwi(ctx, x, y) {
    ctx.font = '34px "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🥝', x, y);
}

const FRUITS = [
    drawApple,
    drawBanana,
    drawCherry,
    drawGrape,
    drawWatermelon,
    drawStrawberry,
    drawOrange,
    drawLemon,
    drawPineapple,
    drawKiwi,
];

export function createFruitGardenImage(tiles) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    tiles.forEach((tile, index) => {
        const row = Math.floor(index / 5);
        const column = index % 5;

        const x =
            START_X +
            column * (TILE_WIDTH + GAP);

        const y =
            START_Y +
            row * (TILE_HEIGHT + GAP);

        // Hidden green tile
        if (tile === 'hidden') {
            ctx.fillStyle = COLORS.hidden;

            drawRoundedRect(
                ctx,
                x,
                y,
                TILE_WIDTH,
                TILE_HEIGHT,
                7
            );

            return;
        }

        // Revealed fruit tile
        if (tile === 'fruit') {
            ctx.fillStyle = COLORS.revealed;

            drawRoundedRect(
                ctx,
                x,
                y,
                TILE_WIDTH,
                TILE_HEIGHT,
                7
            );

            const fruit =
                FRUITS[index % FRUITS.length];

            fruit(
                ctx,
                x + TILE_WIDTH / 2,
                y + TILE_HEIGHT / 2
            );

            return;
        }

        // Failed tile
        if (tile === 'failed') {
            ctx.fillStyle = COLORS.failed;

            drawRoundedRect(
                ctx,
                x,
                y,
                TILE_WIDTH,
                TILE_HEIGHT,
                7
            );

            ctx.font = '30px "Segoe UI Emoji"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                '💥',
                x + TILE_WIDTH / 2,
                y + TILE_HEIGHT / 2
            );

            return;
        }

        // Red tiles after failure
        if (tile === 'red') {
            ctx.fillStyle = COLORS.red;

            drawRoundedRect(
                ctx,
                x,
                y,
                TILE_WIDTH,
                TILE_HEIGHT,
                7
            );
        }
    });

    return canvas.toBuffer('image/png');
}
