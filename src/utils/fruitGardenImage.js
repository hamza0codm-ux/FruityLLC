import { deflateSync } from 'node:zlib';

const WIDTH = 900;
const HEIGHT = 330;

const TILE_WIDTH = 130;
const TILE_HEIGHT = 100;
const TILE_GAP = 8;

const GRID_X = 90;
const GRID_Y = 55;

const COLORS = {
    background: [43, 45, 49],
    hidden: [116, 179, 88],
    hiddenShadow: [100, 158, 74],
    red: [210, 65, 65],
    redDark: [175, 48, 48],
    white: [245, 245, 245],
    black: [35, 35, 35],
    orange: [255, 166, 30],
    yellow: [255, 205, 60],
    green: [67, 160, 71],
    blue: [65, 130, 220],
    purple: [155, 80, 190],
    pink: [235, 85, 125],
};


// ============================================================
// PNG HELPERS
// ============================================================

function crc32(buffer) {
    let crc = 0xffffffff;

    for (let i = 0; i < buffer.length; i++) {
        crc ^= buffer[i];

        for (let j = 0; j < 8; j++) {
            crc =
                (crc >>> 1) ^
                (0xedb88320 & -(crc & 1));
        }
    }

    return (crc ^ 0xffffffff) >>> 0;
}


function pngChunk(type, data) {
    const typeBuffer = Buffer.from(type);

    const output = Buffer.alloc(
        12 + data.length
    );

    output.writeUInt32BE(
        data.length,
        0
    );

    typeBuffer.copy(
        output,
        4
    );

    data.copy(
        output,
        8
    );

    output.writeUInt32BE(
        crc32(
            Buffer.concat([
                typeBuffer,
                data,
            ])
        ),
        8 + data.length
    );

    return output;
}


function createPNG(width, height, pixels) {
    const raw = Buffer.alloc(
        height * (width * 4 + 1)
    );

    for (
        let y = 0;
        y < height;
        y++
    ) {
        const rowStart =
            y * (width * 4 + 1);

        raw[rowStart] = 0;

        pixels.copy(
            raw,
            rowStart + 1,
            y * width * 4,
            (y + 1) * width * 4
        );
    }

    const header = Buffer.alloc(13);

    header.writeUInt32BE(
        width,
        0
    );

    header.writeUInt32BE(
        height,
        4
    );

    header[8] = 8;
    header[9] = 6;
    header[10] = 0;
    header[11] = 0;
    header[12] = 0;

    return Buffer.concat([
        Buffer.from([
            137,
            80,
            78,
            71,
            13,
            10,
            26,
            10,
        ]),

        pngChunk(
            'IHDR',
            header
        ),

        pngChunk(
            'IDAT',
            deflateSync(raw)
        ),

        pngChunk(
            'IEND',
            Buffer.alloc(0)
        ),
    ]);
}


// ============================================================
// DRAWING
// ============================================================

function setPixel(
    pixels,
    x,
    y,
    color
) {
    if (
        x < 0 ||
        y < 0 ||
        x >= WIDTH ||
        y >= HEIGHT
    ) {
        return;
    }

    const index =
        (y * WIDTH + x) * 4;

    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = 255;
}


function fillRect(
    pixels,
    x,
    y,
    width,
    height,
    color
) {
    const startX = Math.max(
        0,
        Math.floor(x)
    );

    const startY = Math.max(
        0,
        Math.floor(y)
    );

    const endX = Math.min(
        WIDTH,
        Math.ceil(x + width)
    );

    const endY = Math.min(
        HEIGHT,
        Math.ceil(y + height)
    );

    for (
        let py = startY;
        py < endY;
        py++
    ) {
        for (
            let px = startX;
            px < endX;
            px++
        ) {
            setPixel(
                pixels,
                px,
                py,
                color
            );
        }
    }
}


function fillRoundedRect(
    pixels,
    x,
    y,
    width,
    height,
    radius,
    color
) {
    const r = Math.min(
        radius,
        width / 2,
        height / 2
    );

    for (
        let py = y;
        py < y + height;
        py++
    ) {
        for (
            let px = x;
            px < x + width;
            px++
        ) {
            let inside = true;

            if (
                px < x + r &&
                py < y + r
            ) {
                const dx =
                    px - (x + r);

                const dy =
                    py - (y + r);

                inside =
                    dx * dx +
                    dy * dy <=
                    r * r;
            }

            else if (
                px > x + width - r &&
                py < y + r
            ) {
                const dx =
                    px -
                    (x + width - r);

                const dy =
                    py - (y + r);

                inside =
                    dx * dx +
                    dy * dy <=
                    r * r;
            }

            else if (
                px < x + r &&
                py > y + height - r
            ) {
                const dx =
                    px - (x + r);

                const dy =
                    py -
                    (y + height - r);

                inside =
                    dx * dx +
                    dy * dy <=
                    r * r;
            }

            else if (
                px > x + width - r &&
                py > y + height - r
            ) {
                const dx =
                    px -
                    (x + width - r);

                const dy =
                    py -
                    (y + height - r);

                inside =
                    dx * dx +
                    dy * dy <=
                    r * r;
            }

            if (inside) {
                setPixel(
                    pixels,
                    px,
                    py,
                    color
                );
            }
        }
    }
}


// ============================================================
// SIMPLE FRUIT ICONS
// ============================================================

function drawApple(
    pixels,
    centerX,
    centerY
) {
    fillRoundedRect(
        pixels,
        centerX - 24,
        centerY - 20,
        48,
        43,
        18,
        [225, 55, 55]
    );

    fillRect(
        pixels,
        centerX - 3,
        centerY - 34,
        7,
        17,
        [91, 57, 34]
    );

    fillRoundedRect(
        pixels,
        centerX + 3,
        centerY - 35,
        20,
        9,
        5,
        COLORS.green
    );
}


function drawOrange(
    pixels,
    centerX,
    centerY
) {
    fillRoundedRect(
        pixels,
        centerX - 23,
        centerY - 23,
        46,
        46,
        23,
        [245, 145, 35]
    );

    fillRect(
        pixels,
        centerX - 3,
        centerY - 32,
        6,
        12,
        [91, 57, 34]
    );
}


function drawWatermelon(
    pixels,
    centerX,
    centerY
) {
    fillRoundedRect(
        pixels,
        centerX - 31,
        centerY - 20,
        62,
        40,
        20,
        [62, 170, 75]
    );

    fillRoundedRect(
        pixels,
        centerX - 23,
        centerY - 12,
        46,
        24,
        12,
        [245, 65, 75]
    );

    for (
        let i = -2;
        i <= 2;
        i++
    ) {
        fillRoundedRect(
            pixels,
            centerX + i * 10 - 2,
            centerY - 5,
            5,
            10,
            2,
            [35, 100, 45]
        );
    }
}


function drawGrape(
    pixels,
    centerX,
    centerY
) {
    const circles = [
        [-14, -8],
        [0, -8],
        [14, -8],
        [-7, 7],
        [7, 7],
        [0, 21],
    ];

    for (const [x, y] of circles) {
        fillRoundedRect(
            pixels,
            centerX + x - 10,
            centerY + y - 10,
            20,
            20,
            10,
            COLORS.purple
        );
    }

    fillRect(
        pixels,
        centerX - 3,
        centerY - 32,
        6,
        14,
        [91, 57, 34]
    );
}


function drawStrawberry(
    pixels,
    centerX,
    centerY
) {
    fillRoundedRect(
        pixels,
        centerX - 25,
        centerY - 20,
        50,
        48,
        20,
        [235, 65, 90]
    );

    fillRoundedRect(
        pixels,
        centerX - 15,
        centerY - 33,
        30,
        15,
        7,
        COLORS.green
    );

    for (
        let i = -1;
        i <= 1;
        i++
    ) {
        fillRect(
            pixels,
            centerX + i * 12 - 2,
            centerY - 7,
            4,
            6,
            [255, 220, 90]
        );

        fillRect(
            pixels,
            centerX + i * 12 - 2,
            centerY + 9,
            4,
            6,
            [255, 220, 90]
        );
    }
}


function drawBanana(
    pixels,
    centerX,
    centerY
) {
    for (
        let i = -2;
        i <= 2;
        i++
    ) {
        fillRoundedRect(
            pixels,
            centerX - 28 + i * 9,
            centerY - 5 + Math.abs(i) * 3,
            35,
            13,
            6,
            COLORS.yellow
        );
    }
}


// ============================================================
// FRUIT SELECTOR
// ============================================================

function drawFruit(
    pixels,
    centerX,
    centerY,
    fruitIndex
) {
    switch (
        fruitIndex % 6
    ) {
        case 0:
            drawApple(
                pixels,
                centerX,
                centerY
            );
            break;

        case 1:
            drawOrange(
                pixels,
                centerX,
                centerY
            );
            break;

        case 2:
            drawWatermelon(
                pixels,
                centerX,
                centerY
            );
            break;

        case 3:
            drawGrape(
                pixels,
                centerX,
                centerY
            );
            break;

        case 4:
            drawStrawberry(
                pixels,
                centerX,
                centerY
            );
            break;

        case 5:
            drawBanana(
                pixels,
                centerX,
                centerY
            );
            break;
    }
}


// ============================================================
// FAILURE ICON
// ============================================================

function drawFailure(
    pixels,
    centerX,
    centerY
) {
    // Big X

    for (
        let i = -28;
        i <= 28;
        i++
    ) {
        for (
            let thickness = -4;
            thickness <= 4;
            thickness++
        ) {
            setPixel(
                pixels,
                centerX + i,
                centerY + i + thickness,
                COLORS.white
            );

            setPixel(
                pixels,
                centerX + i,
                centerY - i + thickness,
                COLORS.white
            );
        }
    }

    // Small bug body

    fillRoundedRect(
        pixels,
        centerX - 12,
        centerY + 22,
        24,
        17,
        8,
        COLORS.black
    );
}


// ============================================================
// SNAIL / GARDEN CHARACTER
// ============================================================

function drawSnail(
    pixels
) {
    const x = 38;
    const y = 108;

    // Body

    fillRoundedRect(
        pixels,
        x,
        y + 45,
        48,
        25,
        12,
        COLORS.orange
    );

    // Shell

    fillRoundedRect(
        pixels,
        x + 4,
        y,
        55,
        55,
        27,
        [255, 178, 40]
    );

    fillRoundedRect(
        pixels,
        x + 16,
        y + 12,
        30,
        30,
        15,
        [255, 205, 75]
    );

    // Eyes

    fillRoundedRect(
        pixels,
        x + 48,
        y + 39,
        7,
        7,
        3,
        COLORS.black
    );

    fillRoundedRect(
        pixels,
        x + 57,
        y + 37,
        7,
        7,
        3,
        COLORS.black
    );
}


// ============================================================
// MAIN IMAGE GENERATOR
// ============================================================
//
// tiles should contain:
//
// "hidden"
// "fruit"
// "failed"
// "red"
//
// Example:
//
// [
//   "fruit",
//   "hidden",
//   "hidden",
//   "hidden",
//   "hidden",
//   "hidden",
//   "hidden",
//   "hidden",
//   "hidden",
//   "hidden"
// ]
//

export function createFruitGardenImage(
    tiles
) {
    const pixels = Buffer.alloc(
        WIDTH * HEIGHT * 4
    );

    // Background

    fillRect(
        pixels,
        0,
        0,
        WIDTH,
        HEIGHT,
        COLORS.background
    );


    // Snail

    drawSnail(
        pixels
    );


    // Garden tiles

    tiles.forEach(
        (tile, index) => {

            const row =
                Math.floor(index / 5);

            const column =
                index % 5;

            const x =
                GRID_X +
                column *
                (TILE_WIDTH + TILE_GAP);

            const y =
                GRID_Y +
                row *
                (TILE_HEIGHT + TILE_GAP);


            // Hidden tile

            if (
                tile === 'hidden'
            ) {

                fillRoundedRect(
                    pixels,
                    x,
                    y,
                    TILE_WIDTH,
                    TILE_HEIGHT,
                    10,
                    COLORS.hidden
                );


                // Slight bottom shadow

                fillRoundedRect(
                    pixels,
                    x,
                    y + TILE_HEIGHT - 7,
                    TILE_WIDTH,
                    7,
                    7,
                    COLORS.hiddenShadow
                );

                return;
            }


            // Red tile

            if (
                tile === 'red'
            ) {

                fillRoundedRect(
                    pixels,
                    x,
                    y,
                    TILE_WIDTH,
                    TILE_HEIGHT,
                    10,
                    COLORS.red
                );

                return;
            }


            // Failed tile

            if (
                tile === 'failed'
            ) {

                fillRoundedRect(
                    pixels,
                    x,
                    y,
                    TILE_WIDTH,
                    TILE_HEIGHT,
                    10,
                    COLORS.redDark
                );

                drawFailure(
                    pixels,
                    x + TILE_WIDTH / 2,
                    y + TILE_HEIGHT / 2
                );

                return;
            }


            // Revealed fruit

            if (
                tile === 'fruit'
            ) {

                fillRoundedRect(
                    pixels,
                    x,
                    y,
                    TILE_WIDTH,
                    TILE_HEIGHT,
                    10,
                    [91, 145, 72]
                );


                drawFruit(
                    pixels,
                    x + TILE_WIDTH / 2,
                    y + TILE_HEIGHT / 2,
                    index
                );
            }
        }
    );


    return createPNG(
        WIDTH,
        HEIGHT,
        pixels
    );
}
