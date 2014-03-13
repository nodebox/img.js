/*jslint nomen: true, bitwise: true */
/*global module, console, require, define, window, self */

(function () {
    'use strict';

    var blend_fn, blend, R, G, B;

    /*R = 0.299;
    G = 0.587;
    B = 0.114;*/

    R = 0.2126;
    G = 0.7152;
    B = 0.0722;

    /** This is the formula used by Photoshop to convert a color from
     * RGB (Red, Green, Blue) to HSY (Hue, Saturation, Luminosity).
     * The hue is calculated using the exacone approximation of the saturation
     * cone.
     * @param rgb The input color RGB normalized components.
     * @param hsy The output color HSY normalized components.
     */
    function rgbToHsy(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        var h, s, y;

        // For saturation equals to 0 any value of hue are valid.
        // In this case we choose 0 as a default value.

        if (r === g && g === b) {            // Limit case.
            s = 0;
            h = 0;
        } else if ((r >= g) && (g >= b)) { // Sector 0: 0° - 60°
            s = r - b;
            h = 60 * (g - b) / s;
        } else if ((g > r) && (r >= b)) {  // Sector 1: 60° - 120°
            s = g - b;
            h = 60 * (g - r) / s  + 60;
        } else if ((g >= b) && (b > r)) {  // Sector 2: 120° - 180°
            s = g - r;
            h = 60 * (b - r) / s + 120;
        } else if ((b > g) && (g > r)) {   // Sector 3: 180° - 240°
            s = b - r;
            h = 60 * (b - g) / s + 180;
        } else if ((b > r) && (r >= g)) {  // Sector 4: 240° - 300°
            s = b - g;
            h = 60 * (r - g) / s + 240;
        } else {                           // Sector 5: 300° - 360°
            s = r - g;
            h = 60 * (r - b) / s + 300;
        }

        y = R * r + G * g + B * b;

        // Approximations erros can cause values to exceed bounds.

        return [h % 360,
            Math.min(Math.max(s, 0), 1),
            Math.min(Math.max(y, 0), 1)];
    }

    /**
     * This is the formula used by Photoshop to convert a color from
     * HSY (Hue, Saturation, Luminosity) to RGB (Red, Green, Blue).
     * The hue is calculated using the exacone approximation of the saturation
     * cone.
     * @param hsy The input color HSY normalized components.
     * @param rgb The output color RGB normalized components.
     */
    function hsyToRgb(h, s, y) {

        h = h % 360;
        var r, g, b, k; // Intermediate variable.

        if (h >= 0 && h < 60) {           // Sector 0: 0° - 60°
            k = s * h / 60;
            b = y - R * s - G * k;
            r = b + s;
            g = b + k;
        } else if (h >= 60 && h < 120) {  // Sector 1: 60° - 120°
            k = s * (h - 60) / 60;
            g = y + B * s + R * k;
            b = g - s;
            r = g - k;
        } else if (h >= 120 && h < 180) { // Sector 2: 120° - 180°
            k = s * (h - 120) / 60;
            r = y - G * s - B * k;
            g = r + s;
            b = r + k;
        } else if (h >= 180 && h < 240) { // Sector 3: 180° - 240°
            k = s * (h - 180) / 60;
            b = y + R * s + G * k;
            r = b - s;
            g = b - k;
        } else if (h >= 240 && h < 300) { // Sector 4: 240° - 300°
            k = s * (h - 240) / 60;
            g = y - B * s - R * k;
            b = g + s;
            r = g + k;
        } else {                          // Sector 5: 300° - 360°
            k = s * (h - 300) / 60;
            r = y + G * s + B * k;
            g = r - s;
            b = r - k;
        }

        // Approximations erros can cause values to exceed bounds.

        r = Math.min(Math.max(r, 0), 1) * 255;
        g = Math.min(Math.max(g, 0), 1) * 255;
        b = Math.min(Math.max(b, 0), 1) * 255;
        return [r, g, b];
    }

    function _normal(inData, outData, data2, pix, pixIn) {
        outData[pix] = data2[pixIn];
        outData[pix + 1] = data2[pixIn + 1];
        outData[pix + 2] = data2[pixIn + 2];
    }

    function _multiply(inData, outData, data2, pix, pixIn) {
        outData[pix] = inData[pix] * data2[pixIn] / 255;
        outData[pix + 1] = inData[pix + 1] * data2[pixIn + 1] / 255;
        outData[pix + 2] = inData[pix + 2] * data2[pixIn + 2] / 255;
    }

    function _subtract(inData, outData, data2, pix, pixIn) {
        var r = inData[pix] - data2[pixIn],
            g = inData[pix + 1] - data2[pixIn + 1],
            b = inData[pix + 2] - data2[pixIn + 2];
        outData[pix] = r < 0 ? 0 : r;
        outData[pix + 1] = g < 0 ? 0 : g;
        outData[pix + 2] = b < 0 ? 0 : b;
    }

    function _divide(inData, outData, data2, pix, pixIn) {
        var r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2];
        outData[pix] = r2 === 0 ? 0 : r1 / r2 * 255;
        outData[pix + 1] = g2 === 0 ? 0 : g1 / g2 * 255;
        outData[pix + 2] = b2 === 0 ? 0 : b1 / b2 * 255;
    }

    function _screen(inData, outData, data2, pix, pixIn) {
        outData[pix] = (255 - (((255 - inData[pix]) * (255 - data2[pixIn])) >> 8));
        outData[pix + 1] = (255 - (((255 - inData[pix + 1]) * (255 - data2[pixIn + 1])) >> 8));
        outData[pix + 2] = (255 - (((255 - inData[pix + 2]) * (255 - data2[pixIn + 2])) >> 8));
    }

    function _lighten(inData, outData, data2, pix, pixIn) {
        var r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2];
        outData[pix] = r1 > r2 ? r1 : r2;
        outData[pix + 1] = g1 > g2 ? g1 : g2;
        outData[pix + 2] = b1 > b2 ? b1 : b2;
    }

    function _darken(inData, outData, data2, pix, pixIn) {
        var r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2];
        outData[pix] = r1 < r2 ? r1 : r2;
        outData[pix + 1] = g1 < g2 ? g1 : g2;
        outData[pix + 2] = b1 < b2 ? b1 : b2;
    }

    function _darkercolor(inData, outData, data2, pix, pixIn) {
        var r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2];
        if (r1 * 0.3 + g1 * 0.59 + b1 * 0.11 <= r2 * 0.3 + g2 * 0.59 + b2 * 0.11) {
            outData[pix] = r1;
            outData[pix + 1] = g1;
            outData[pix + 2] = b1;
        } else {
            outData[pix] = r2;
            outData[pix + 1] = g2;
            outData[pix + 2] = b2;
        }
    }

    function _lightercolor(inData, outData, data2, pix, pixIn) {
        var r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2];
        if (r1 * 0.3 + g1 * 0.59 + b1 * 0.11 > r2 * 0.3 + g2 * 0.59 + b2 * 0.11) {
            outData[pix] = r1;
            outData[pix + 1] = g1;
            outData[pix + 2] = b1;
        } else {
            outData[pix] = r2;
            outData[pix + 1] = g2;
            outData[pix + 2] = b2;
        }
    }

    function _lineardodge(inData, outData, data2, pix, pixIn) {
        var r = inData[pix] + data2[pixIn],
            g = inData[pix + 1] + data2[pixIn + 1],
            b = inData[pix + 2] + data2[pixIn + 2];
        outData[pix] = r > 255 ? 255 : r;
        outData[pix + 1] = g > 255 ? 255 : g;
        outData[pix + 2] = b > 255 ? 255 : b;
    }

    function _linearburn(inData, outData, data2, pix, pixIn) {
        var r = inData[pix] + data2[pixIn],
            g = inData[pix + 1] + data2[pixIn + 1],
            b = inData[pix + 2] + data2[pixIn + 2];
        outData[pix] = r < 255 ? 0 : (r - 255);
        outData[pix + 1] = g < 255 ? 0 : (g - 255);
        outData[pix + 2] = b < 255 ? 0 : (b - 255);
    }

    function _difference(inData, outData, data2, pix, pixIn) {
        var r = inData[pix] - data2[pixIn],
            g = inData[pix + 1] - data2[pixIn + 1],
            b = inData[pix + 2] - data2[pixIn + 2];
        outData[pix] = r < 0 ? -r : r;
        outData[pix + 1] = g < 0 ? -g : g;
        outData[pix + 2] = b < 0 ? -b : b;
    }

    function _exclusion(inData, outData, data2, pix, pixIn) {
        var r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            div_2_255 = 2 / 255;
        outData[pix] = r1 - (r1 * div_2_255 - 1) * data2[pixIn];
        outData[pix + 1] = g1 - (g1 * div_2_255 - 1) * data2[pixIn + 1];
		outData[pix + 2] = b1 - (b1 * div_2_255 - 1) * data2[pixIn + 2];
    }

    function _overlay(inData, outData, data2, pix, pixIn) {
        var r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            div_2_255 = 2 / 255;

        if (r1 < 128) {
		    outData[pix] = data2[pixIn] * r1 * div_2_255;
        } else {
		    outData[pix] = 255 - (255 - data2[pixIn]) * (255 - r1) * div_2_255;
        }

        if (g1 < 128) {
		    outData[pix + 1] = data2[pixIn + 1] * g1 * div_2_255;
        } else {
		    outData[pix + 1] = 255 - (255 - data2[pixIn + 1]) * (255 - g1) * div_2_255;
        }

        if (b1 < 128) {
            outData[pix + 2] = data2[pixIn + 2] * b1 * div_2_255;
        } else {
		    outData[pix + 2] = 255 - (255 - data2[pixIn + 2]) * (255 - b1) * div_2_255;
        }
    }

    function _softlight(inData, outData, data2, pix, pixIn) {
        var r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            div_2_255 = 2 / 255;

        if (r1 < 128) {
		    outData[pix] = ((data2[pixIn] >> 1) + 64) * r1 * div_2_255;
        } else {
			outData[pix] = 255 - (191 - (data2[pixIn] >> 1)) * (255 - r1) * div_2_255;
        }

        if (g1 < 128) {
		    outData[pix + 1] = ((data2[pixIn + 1] >> 1) + 64) * g1 * div_2_255;
        } else {
			outData[pix + 1] = 255 - (191 - (data2[pixIn + 1] >> 1)) * (255 - g1) * div_2_255;
        }

		if (b1 < 128) {
		    outData[pix + 2] = ((data2[pixIn + 2] >> 1) + 64) * b1 * div_2_255;
        } else {
            outData[pix + 2] = 255 - (191 - (data2[pixIn + 2] >> 1)) * (255 - b1) * div_2_255;
        }
    }

    function _hardlight(inData, outData, data2, pix, pixIn) {
        var r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2],
            div_2_255 = 2 / 255;

        if (r2 < 128) {
            outData[pix] = inData[pix] * r2 * div_2_255;
        } else {
            outData[pix] = 255 - (255 - inData[pix]) * (255 - r2) * div_2_255;
        }

        if (g2 < 128) {
            outData[pix + 1] = inData[pix + 1] * g2 * div_2_255;
        } else {
            outData[pix + 1] = 255 - (255 - inData[pix + 1]) * (255 - g2) * div_2_255;
        }

        if (b2 < 128) {
            outData[pix + 2] = inData[pix + 2] * b2 * div_2_255;
        } else {
			outData[pix + 2] = 255 - (255 - inData[pix + 2]) * (255 - b2) * div_2_255;
        }
    }

    function _colordodge(inData, outData, data2, pix, pixIn) {
        var r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2],
            r1 = (inData[pix] << 8) / (255 - r2),
            g1 = (inData[pix + 1] << 8) / (255 - g2),
            b1 = (inData[pix + 2] << 8) / (255 - b2);
        outData[pix] = (r1 > 255 || r2 === 255) ? 255 : r1;
        outData[pix + 1] = (g1 > 255 || g2 === 255) ? 255 : g1;
        outData[pix + 2] = (b1 > 255 || b2 === 255) ? 255 : b1;
    }

    function _colorburn(inData, outData, data2, pix, pixIn) {
        var r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2],
            r1 = 255 - ((255 - inData[pix]) << 8) / r2,
            g1 = 255 - ((255 - inData[pix + 1]) << 8) / g2,
            b1 = 255 - ((255 - inData[pix + 2]) << 8) / b2;
        outData[pix] = (r1 < 0 || r2 === 0) ? 0 : r1;
        outData[pix + 1] = (g1 < 0 || g2 === 0) ? 0 : g1;
        outData[pix + 2] = (b1 < 0 || b2 === 0) ? 0 : b1;
    }

    function _linearlight(inData, outData, data2, pix, pixIn) {
        var r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2],
            r1 = 2 * r2 + inData[pix] - 256,
            g1 = 2 * g2 + inData[pix + 1] - 256,
            b1 = 2 * b2 + inData[pix + 2] - 256;
        outData[pix] = (r1 < 0 || (r2 < 128 && r1 < 0)) ? 0 : (r1 > 255 ? 255 : r1);
        outData[pix + 1] = (g1 < 0 || (g2 < 128 && g1 < 0)) ? 0 : (g1 > 255 ? 255 : g1);
        outData[pix + 2] = (b1 < 0 || (b2 < 128 && b1 < 0)) ? 0 : (b1 > 255 ? 255 : b1);
    }

    function _vividlight(inData, outData, data2, pix, pixIn) {
        var a,
            r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2];

        if (r2 < 128) {
            if (r2) {
                a = 255 - ((255 - r1) << 8) / (2 * r2);
                outData[pix] = a < 0 ? 0 : a;
            } else {
			    outData[pix] = 0;
			}
        } else {
            a = 2 * r2 - 256;
            if (a < 255) {
                a = (r1 << 8) / (255 - a);
                outData[pix] = a > 255 ? 255 : a;
            } else {
                outData[pix] = a < 0 ? 0 : a;
            }
        }

        if (g2 < 128) {
            if (g2) {
                a = 255 - ((255 - g1) << 8) / (2 * g2);
                outData[pix + 1] = a < 0 ? 0 : a;
            } else {
			    outData[pix + 1] = 0;
			}
        } else {
            a = 2 * g2 - 256;
            if (a < 255) {
                a = (g1 << 8) / (255 - a);
                outData[pix + 1] = a > 255 ? 255 : a;
            } else {
                outData[pix + 1] = a < 0 ? 0 : a;
			}
        }

        if (b2 < 128) {
		    if (b2) {
                a = 255 - ((255 - b1) << 8) / (2 * b2);
                outData[pix + 2] = a < 0 ? 0 : a;
            } else {
			    outData[pix + 2] = 0;
			}
        } else {
            a = 2 * b2 - 256;
            if (a < 255) {
                a = (b1 << 8) / (255 - a);
                outData[pix + 2] = a > 255 ? 255 : a;
            } else {
                outData[pix + 2] = a < 0 ? 0 : a;
			}
        }
    }

    function _pinlight(inData, outData, data2, pix, pixIn) {
        var a,
            r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2];

        if (r2 < 128) {
            a = 2 * r2;
            outData[pix] = r1 < a ? r1 : a;
        } else {
            a = 2 * r2 - 256;
            outData[pix] = r1 > a ? r1 : a;
        }

        if (g2 < 128) {
            a = 2 * g2;
            outData[pix + 1] = g1 < a ? g1 : a;
        } else {
            a = 2 * g2 - 256;
            outData[pix + 1] = g1 > a ? g1 : a;
        }

        if (b2 < 128) {
            a = 2 * b2;
            outData[pix + 2] = b1 < a ? b1 : a;
        } else {
            a = 2 * b2 - 256;
            outData[pix + 2] = b1 > a ? b1 : a;
        }
    }

    function _hardmix(inData, outData, data2, pix, pixIn) {
        var a,
            r1 = inData[pix],
            g1 = inData[pix + 1],
            b1 = inData[pix + 2],
            r2 = data2[pixIn],
            g2 = data2[pixIn + 1],
            b2 = data2[pixIn + 2];

        if (r2 < 128) {
            outData[pix] = (255 - ((255 - r1) << 8) / (2 * r2) < 128 || r2 === 0) ? 0 : 255;
        } else {
            a = 2 * r2 - 256;
            outData[pix] = (a < 255 && (r1 << 8) / (255 - a) < 128) ? 0 : 255;
        }

        if (g2 < 128) {
            outData[pix + 1] = (255 - ((255 - g1) << 8) / (2 * g2) < 128 || g2 === 0) ? 0 : 255;
        } else {
            a = 2 * g2 - 256;
            outData[pix + 1] = (a < 255 && (g1 << 8) / (255 - a) < 128) ? 0 : 255;
        }

        if (b2 < 128) {
            outData[pix + 2] = (255 - ((255 - b1) << 8) / (2 * b2) < 128 || b2 === 0) ? 0 : 255;
        } else {
            a = 2 * b2 - 256;
            outData[pix + 2] = (a < 255 && (b1 << 8) / (255 - a) < 128) ? 0 : 255;
        }
    }

    function _hue(inData, outData, data2, pix, pixIn) {
        var hcl1 = rgbToHsy(inData[pix], inData[pix + 1], inData[pix + 2]),
            hcl2 = rgbToHsy(data2[pixIn], data2[pixIn + 1], data2[pixIn + 2]),
            rgb = hsyToRgb(hcl2[0], hcl1[1], hcl1[2]);
        outData[pix] = rgb[0];
        outData[pix + 1] = rgb[1];
        outData[pix + 2] = rgb[2];
    }

    function _saturation(inData, outData, data2, pix, pixIn) {
        var hsl1 = rgbToHsy(inData[pix], inData[pix + 1], inData[pix + 2]),
            hsl2 = rgbToHsy(data2[pixIn], data2[pixIn + 1], data2[pixIn + 2]),
            rgb = hsyToRgb(hsl1[0], hsl2[1], hsl1[2]);
        outData[pix] = rgb[0];
        outData[pix + 1] = rgb[1];
        outData[pix + 2] = rgb[2];
    }

    function _lightness(inData, outData, data2, pix, pixIn) {
        var hsl1 = rgbToHsy(inData[pix], inData[pix + 1], inData[pix + 2]),
            hsl2 = rgbToHsy(data2[pixIn], data2[pixIn + 1], data2[pixIn + 2]),
            rgb = hsyToRgb(hsl1[0], hsl1[1], hsl2[2]);
        outData[pix] = rgb[0];
        outData[pix + 1] = rgb[1];
        outData[pix + 2] = rgb[2];
    }

    function _color(inData, outData, data2, pix, pixIn) {
        var hsl1 = rgbToHsy(inData[pix], inData[pix + 1], inData[pix + 2]),
            hsl2 = rgbToHsy(data2[pixIn], data2[pixIn + 1], data2[pixIn + 2]),
            rgb = hsyToRgb(hsl2[0], hsl2[1], hsl1[2]);
        outData[pix] = rgb[0];
        outData[pix + 1] = rgb[1];
        outData[pix + 2] = rgb[2];
    }

    function _blend(inData, outData, width, height, options) {
        var pix, pixIn, x, y, a, a2,
            w = Math.min(width, options.width),
            h = Math.min(height, options.height),
            data2 = options.data,
            amount = options.amount || 1,
            fn = blend_fn[options.type || "normal"],
            dx = options.dx || 0,
            dy = options.dy || 0;

        for (y = 0; y < height; y += 1) {
            for (x = 0; x < width; x += 1) {
                if (y >= dy && y < Math.max(height, h + dy) && x >= dx && x < Math.max(width, w + dx)) {
                    pix = (y * width + x) * 4;
                    pixIn = ((y - dy) * options.width + x - dx) * 4;
                    fn(inData, outData, data2, pix, pixIn);
                    outData[pix + 3] = inData[pix + 3];
                    a = amount * data2[pixIn + 3] / 255;
                    if (a < 1) {
                        a2 = 1 - a;
                        outData[pix] = (inData[pix] * a2 + outData[pix] * a);
                        outData[pix + 1] = (inData[pix + 1] * a2 + outData[pix + 1] * a);
                        outData[pix + 2] = (inData[pix + 2] * a2 + outData[pix + 2] * a);
                    }
                } else {
                    pix = (y * width + x) * 4;
                    outData[pix] = inData[pix];
                    outData[pix + 1] = inData[pix + 1];
                    outData[pix + 2] = inData[pix + 2];
                    outData[pix + 3] = inData[pix + 3];
                }
            }
        }
    }

    function _wrap(type) {
        return function (inData, outData, width, height, options) {
            options.type = type;
            _blend(inData, outData, width, height, options);
        };
    }

    blend_fn = {
        "normal": _normal,
        "multiply": _multiply,
        "subtract": _subtract,
        "divide": _divide,
        "screen": _screen,
        "lighten": _lighten,
        "darken": _darken,
        "darkercolor": _darkercolor,
        "lightercolor": _lightercolor,
        "lineardodge": _lineardodge,
        "linearburn": _linearburn,
        "difference": _difference,
        "exclusion": _exclusion,
        "overlay": _overlay,
        "softlight": _softlight,
        "hardlight": _hardlight,
        "colordodge": _colordodge,
        "colorburn": _colorburn,
        "linearlight": _linearlight,
        "vividlight": _vividlight,
        "pinlight": _pinlight,
        "hardmix": _hardmix,
        "hue": _hue,
        "saturation": _saturation,
        "lightness": _lightness,
        "color": _color
    };

    blend = {
        blend: _blend,
        normal: _wrap("normal"),
        multiply: _wrap("multiply"),
        subtract: _wrap("subtract"),
        divide: _wrap("divide"),
        screen: _wrap("screen"),
        lighten: _wrap("lighten"),
        darken: _wrap("darken"),
        darkercolor: _wrap("darkercolor"),
        lightercolor: _wrap("lightercolor"),
        lineardodge: _wrap("lineardodge"),
        linearburn: _wrap("linearburn"),
        difference: _wrap("difference"),
        exclusion: _wrap("exclusion"),
        overlay: _wrap("overlay"),
        softlight: _wrap("softlight"),
        hardlight: _wrap("hardlight"),
        colordodge: _wrap("colordodge"),
        colorburn: _wrap("colorburn"),
        linearlight: _wrap("linearlight"),
        vividlight: _wrap("vividlight"),
        pinlight: _wrap("pinlight"),
        hardmix: _wrap("hardmix"),
        hue: _wrap("hue"),
        saturation: _wrap("saturation"),
        lightness: _wrap("lightness"),
        color: _wrap("color")
    };

    // MODULE SUPPORT ///////////////////////////////////////////////////////

    if (typeof module !== 'undefined') {
        module.exports = blend;
    } else if (typeof define !== 'undefined') {
        define('blend', ['underscore'], function () {
            return blend;
        });
    } else if (typeof self !== 'undefined') {
        self.blend = blend;
    } else {
        window.blend = blend;
    }

}());
