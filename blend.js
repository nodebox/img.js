/*jslint nomen: true, bitwise: true */
/*global module, console, require, define, window, self */

(function () {
    'use strict';

    var blend, process;

    process = function (inData, outData, width, height, options) {

        var blend_fn, R, G, B,
            dr, dg, db,
            sr, sg, sb,
            or, og, ob,
            max = Math.max,
            min = Math.min,
            div_2_255 = 2 / 255;

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
                min(max(s, 0), 1),
                min(max(y, 0), 1)];
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

            r = min(max(r, 0), 1) * 255;
            g = min(max(g, 0), 1) * 255;
            b = min(max(b, 0), 1) * 255;
            return [r, g, b];
        }

        function _normal() {
            or = sr;
            og = sg;
            ob = sb;
        }

        function _multiply() {
            or = dr * sr / 255;
            og = dg * sg / 255;
            ob = db * sb / 255;
        }

        function _subtract() {
            or = max(dr - sr, 0);
            og = max(dg - sg, 0);
            ob = max(db - sb, 0);
        }

        function _divide() {
            or = sr === 0 ? 0 : dr / sr * 255;
            og = sg === 0 ? 0 : dg / sg * 255;
            ob = sb === 0 ? 0 : db / sb * 255;
        }

        function _screen() {
            or = (255 - (((255 - dr) * (255 - sr)) >> 8));
            og = (255 - (((255 - dg) * (255 - sg)) >> 8));
            ob = (255 - (((255 - db) * (255 - sb)) >> 8));
        }

        function _lighten() {
            or = dr > sr ? dr : sr;
            og = dg > sg ? dg : sg;
            ob = db > sb ? db : sb;
        }

        function _darken() {
            or = dr < sr ? dr : sr;
            og = dg < sg ? dg : sg;
            ob = db < sb ? db : sb;
        }

        function _darkercolor() {
            if (dr * 0.3 + dg * 0.59 + db * 0.11 <= sr * 0.3 + sg * 0.59 + sb * 0.11) {
                or = dr;
                og = dg;
                ob = db;
            } else {
                or = sr;
                og = sg;
                ob = sb;
            }
        }

        function _lightercolor() {
            if (dr * 0.3 + dg * 0.59 + db * 0.11 > sr * 0.3 + sg * 0.59 + sb * 0.11) {
                or = dr;
                og = dg;
                ob = db;
            } else {
                or = sr;
                og = sg;
                ob = sb;
            }
        }

        function _lineardodge() {
            or = min(dr + sr, 255);
            og = min(dg + sg, 255);
            ob = min(db + sb, 255);
        }

        function _linearburn() {
            or = dr + sr;
            og = dg + sg;
            ob = db + sb;

            or = or < 255 ? 0 : (or - 255);
            og = og < 255 ? 0 : (og - 255);
            ob = ob < 255 ? 0 : (ob - 255);
        }

        function _difference() {
            or = dr - sr;
            og = dg - sg;
            ob = db - sb;

            or = or < 0 ? -or : or;
            og = og < 0 ? -og : og;
            ob = ob < 0 ? -ob : ob;
        }

        function _exclusion() {
            or = dr - (dr * div_2_255 - 1) * sr;
            og = dg - (dg * div_2_255 - 1) * sg;
            ob = db - (db * div_2_255 - 1) * sb;
        }

        function _overlay() {
            if (dr < 128) {
                or = sr * dr * div_2_255;
            } else {
                or = 255 - (255 - sr) * (255 - dr) * div_2_255;
            }

            if (dg < 128) {
                og = sg * dg * div_2_255;
            } else {
                og = 255 - (255 - sg) * (255 - dg) * div_2_255;
            }

            if (db < 128) {
                ob = sb * db * div_2_255;
            } else {
                ob = 255 - (255 - sb) * (255 - db) * div_2_255;
            }
        }

        function _softlight() {
            if (dr < 128) {
                or = ((sr >> 1) + 64) * dr * div_2_255;
            } else {
                or = 255 - (191 - (sr >> 1)) * (255 - dr) * div_2_255;
            }

            if (dg < 128) {
                og = ((sg >> 1) + 64) * dg * div_2_255;
            } else {
                og = 255 - (191 - (sg >> 1)) * (255 - dg) * div_2_255;
            }

            if (db < 128) {
                ob = ((sb >> 1) + 64) * db * div_2_255;
            } else {
                ob = 255 - (191 - (sb >> 1)) * (255 - db) * div_2_255;
            }
        }

        function _hardlight() {
            if (sr < 128) {
                or = dr * sr * div_2_255;
            } else {
                or = 255 - (255 - dr) * (255 - sr) * div_2_255;
            }

            if (sg < 128) {
                og = dg * sg * div_2_255;
            } else {
                og = 255 - (255 - dg) * (255 - sg) * div_2_255;
            }

            if (sb < 128) {
                ob = db * sb * div_2_255;
            } else {
                ob = 255 - (255 - db) * (255 - sb) * div_2_255;
            }
        }

        function _colordodge() {
            var dr1 = (dr << 8) / (255 - sr),
                dg1 = (dg << 8) / (255 - sg),
                db1 = (db << 8) / (255 - sb);

            or = (dr1 > 255 || sr === 255) ? 255 : dr1;
            og = (dg1 > 255 || sg === 255) ? 255 : dg1;
            ob = (db1 > 255 || sb === 255) ? 255 : db1;
        }

        function _colorburn() {
            var dr1 = 255 - ((255 - dr) << 8) / sr,
                dg1 = 255 - ((255 - dg) << 8) / sg,
                db1 = 255 - ((255 - db) << 8) / sb;

            or = (dr1 < 0 || sr === 0) ? 0 : dr1;
            og = (dg1 < 0 || sg === 0) ? 0 : dg1;
            ob = (db1 < 0 || sb === 0) ? 0 : db1;
        }

        function _linearlight() {
            var dr1 = 2 * sr + dr - 256,
                dg1 = 2 * sg + dg - 256,
                db1 = 2 * sb + db - 256;

            or = (dr1 < 0 || (sr < 128 && dr1 < 0)) ? 0 : (dr1 > 255 ? 255 : dr1);
            og = (dg1 < 0 || (sg < 128 && dg1 < 0)) ? 0 : (dg1 > 255 ? 255 : dg1);
            ob = (db1 < 0 || (sb < 128 && db1 < 0)) ? 0 : (db1 > 255 ? 255 : db1);
        }

        function _vividlight() {
            var a;

            if (sr < 128) {
                if (sr) {
                    a = 255 - ((255 - dr) << 8) / (2 * sr);
                    or = a < 0 ? 0 : a;
                } else {
                    or = 0;
                }
            } else {
                a = 2 * sr - 256;
                if (a < 255) {
                    a = (dr << 8) / (255 - a);
                    or = a > 255 ? 255 : a;
                } else {
                    or = a < 0 ? 0 : a;
                }
            }

            if (sg < 128) {
                if (sg) {
                    a = 255 - ((255 - dg) << 8) / (2 * sg);
                    og = a < 0 ? 0 : a;
                } else {
                    og = 0;
                }
            } else {
                a = 2 * sg - 256;
                if (a < 255) {
                    a = (dg << 8) / (255 - a);
                    og = a > 255 ? 255 : a;
                } else {
                    og = a < 0 ? 0 : a;
                }
            }

            if (sb < 128) {
                if (sb) {
                    a = 255 - ((255 - db) << 8) / (2 * sb);
                    ob = a < 0 ? 0 : a;
                } else {
                    ob = 0;
                }
            } else {
                a = 2 * sb - 256;
                if (a < 255) {
                    a = (db << 8) / (255 - a);
                    ob = a > 255 ? 255 : a;
                } else {
                    ob = a < 0 ? 0 : a;
                }
            }
        }

        function _pinlight() {
            var a;

            if (sr < 128) {
                a = 2 * sr;
                or = dr < a ? dr : a;
            } else {
                a = 2 * sr - 256;
                or = dr > a ? dr : a;
            }

            if (sg < 128) {
                a = 2 * sg;
                og = dg < a ? dg : a;
            } else {
                a = 2 * sg - 256;
                og = dg > a ? dg : a;
            }

            if (sb < 128) {
                a = 2 * sb;
                ob = db < a ? db : a;
            } else {
                a = 2 * sb - 256;
                ob = db > a ? db : a;
            }
        }

        function _hardmix() {
            var a;

            if (sr < 128) {
                or = (255 - ((255 - dr) << 8) / (2 * sr) < 128 || sr === 0) ? 0 : 255;
            } else {
                a = 2 * sr - 256;
                or = (a < 255 && (dr << 8) / (255 - a) < 128) ? 0 : 255;
            }

            if (sg < 128) {
                og = (255 - ((255 - dg) << 8) / (2 * sg) < 128 || sg === 0) ? 0 : 255;
            } else {
                a = 2 * sg - 256;
                og = (a < 255 && (dg << 8) / (255 - a) < 128) ? 0 : 255;
            }

            if (sb < 128) {
                ob = (255 - ((255 - db) << 8) / (2 * sb) < 128 || sb === 0) ? 0 : 255;
            } else {
                a = 2 * sb - 256;
                ob = (a < 255 && (db << 8) / (255 - a) < 128) ? 0 : 255;
            }
        }

        function _hue() {
            var hcl1 = rgbToHsy(dr, dg, db),
                hcl2 = rgbToHsy(sr, sg, sb),
                rgb = hsyToRgb(hcl2[0], hcl1[1], hcl1[2]);
            or = rgb[0];
            og = rgb[1];
            ob = rgb[2];
        }

        function _saturation() {
            var hcl1 = rgbToHsy(dr, dg, db),
                hcl2 = rgbToHsy(sr, sg, sb),
                rgb = hsyToRgb(hcl1[0], hcl2[1], hcl1[2]);
            or = rgb[0];
            og = rgb[1];
            ob = rgb[2];
        }

        function _lightness() {
            var hcl1 = rgbToHsy(dr, dg, db),
                hcl2 = rgbToHsy(sr, sg, sb),
                rgb = hsyToRgb(hcl1[0], hcl1[1], hcl2[2]);
            or = rgb[0];
            og = rgb[1];
            ob = rgb[2];
        }

        function _color() {
            var hcl1 = rgbToHsy(dr, dg, db),
                hcl2 = rgbToHsy(sr, sg, sb),
                rgb = hsyToRgb(hcl2[0], hcl2[1], hcl1[2]);
            or = rgb[0];
            og = rgb[1];
            ob = rgb[2];
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

        (function () {
            var pix, pixIn, x, y, a, a2,
                w = min(width, options.width),
                h = min(height, options.height),
                data2 = options.data,
                amount = options.amount === 0 ? 0 : options.amount || 1,
                fn = blend_fn[options.type || "normal"],
                dx = options.dx || 0,
                dy = options.dy || 0;

            for (y = 0; y < height; y += 1) {
                for (x = 0; x < width; x += 1) {
                    if (y >= dy && y < max(height, h + dy) && x >= dx && x < max(width, w + dx)) {
                        pix = (y * width + x) * 4;
                        pixIn = ((y - dy) * options.width + x - dx) * 4;

                        dr = inData[pix];
                        dg = inData[pix + 1];
                        db = inData[pix + 2];

                        sr = data2[pixIn];
                        sg = data2[pixIn + 1];
                        sb = data2[pixIn + 2];

                        fn();

                        outData[pix] = or;
                        outData[pix + 1] = og;
                        outData[pix + 2] = ob;
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
        }());
    };

    function _blend(inData, outData, width, height, options) {
        process(inData, outData, width, height, options);
    }

    function _wrap(type) {
        return function (inData, outData, width, height, options) {
            options.type = type;
            _blend(inData, outData, width, height, options);
        };
    }

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
