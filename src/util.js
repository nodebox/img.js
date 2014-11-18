'use strict';

// UTILITIES.

function degrees(radians) {
    return radians * 180 / Math.PI;
}

function radians(degrees) {
    return degrees / 180 * Math.PI;
}

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

// Basic affine transform functionality limited to the following operations: scale, translate and rotate.
function transform() {
    // Identity matrix.
    var m = [1, 0, 0, 0, 1, 0, 0, 0, 1];

    // Performs the 3x3 matrix multiplication of the current matrix with the input matrix a.
    function _mmult(a) {
        var m0 = m[0],
            m1 = m[1],
            m2 = m[2],
            m3 = m[3],
            m4 = m[4],
            m5 = m[5],
            m6 = m[6],
            m7 = m[7],
            m8 = m[8];

        m[0] = a[0] * m0 + a[1] * m3;
        m[1] = a[0] * m1 + a[1] * m4;
        m[3] = a[3] * m0 + a[4] * m3;
        m[4] = a[3] * m1 + a[4] * m4;
        m[6] = a[6] * m0 + a[7] * m3 + m6;
        m[7] = a[6] * m1 + a[7] * m4 + m7;
    }

    return {
        scale: function (x, y) {
            if (y === undefined) {
                y = x;
            }
            _mmult([x, 0, 0, 0, y, 0, 0, 0, 1]);
        },

        translate: function (x, y) {
            _mmult([1, 0, 0, 0, 1, 0, x, y, 1]);
        },

        rotate: function (angle) {
            var c = Math.cos(radians(angle)),
                s = Math.sin(radians(angle));
            _mmult([c, s, 0, -s, c, 0, 0, 0, 1]);
        },

        transformPoint: function (point) {
            var x = point.x,
                y = point.y;
            return {x: x * m[0] + y * m[3] + m[6],
                y: x * m[1] + y * m[4] + m[7]};
        }
    };
}

exports.degrees = degrees;
exports.radians = radians;
exports.clamp = clamp;
exports.transform = transform;
