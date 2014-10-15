/*jslint nomen:true */
/*global _, console, Image, HTMLCanvasElement, document, module, define, require, window */

(function () {
    'use strict';

    var async = require('async');
    var blend = require('./blend');
    var process = require('./process');

    var img, ImageCanvas, Layer, CanvasRenderer;

    var DEFAULT_WIDTH = 800;
    var DEFAULT_HEIGHT = 800;

    // Different layer types.
    var TYPE_PATH = 'path';
    var TYPE_IMAGE = 'image';
    var TYPE_HTML_CANVAS = 'htmlCanvas';
    var TYPE_IMAGE_CANVAS = 'iCanvas';
    var TYPE_FILL = 'fill';
    var TYPE_GRADIENT = 'gradient';

    // Named colors supported by all browsers.
    // See: http://www.w3schools.com/html/html_colornames.asp
    var colors = ['aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'transparent', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen'];

    // Dictionary of blend modes that the client browser does or does not support.
    var nativeBlendModes = blend.getNativeModes();

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

    // Utility function that passes its input (normally a html canvas) to the next function.
    function passThrough(canvas, callback) {
        callback(null, canvas);
    }

    // Converts a number of arguments to a type of color argument that the html canvas context can understand:
    // a named color, a hex color or a string in the form of rgba(r, g, b, a)
    function toColor(v1, v2, v3, v4, v5) {
        var _r, _g, _b, _a, R, G, B, rgb, options;
        if (v1 === undefined) {
            _r = _g = _b = 0;
            _a = 1;
        } else if (Array.isArray(v1)) {
            options = v2 || {};
            _r = v1[0] !== undefined ? v1[0] : 0;
            _g = v1[1] !== undefined ? v1[1] : 0;
            _b = v1[2] !== undefined ? v1[2] : 0;
            _a = v1[3] !== undefined ? v1[3] : options.base || 1;
        } else if (v1.r !== undefined) {
            options = v2 || {};
            _r = v1.r;
            _g = v1.g;
            _b = v1.b;
            _a = v1.a !== undefined ? v1.a : options.base || 1;
        } else if (typeof v1 === 'string') {
            if (v1.indexOf('#') === 0) {
                return v1;
            }
            if (v1.indexOf('rgb') === 0) {
                return v1;
            }
            if (colors.indexOf(v1) !== -1) {
                return v1;
            }
        } else if (typeof v1 === 'number') {
            if (arguments.length === 1) { // Grayscale value
                _r = _g = _b = v1;
                _a = 1;
            } else if (arguments.length === 2) { // Gray and alpha or options
                _r = _g = _b = v1;
                if (typeof v2 === 'number') {
                    _a = v2;
                } else {
                    options = v2;
                    _a = options.base || 1;
                }
            } else if (arguments.length === 3) { // RGB or gray, alpha and options
                if (typeof v3 === 'number') {
                    _r = v1;
                    _g = v2;
                    _b = v3;
                    _a = 1;
                } else {
                    _r = _g = _b = v1;
                    _a = v2;
                    options = v3;
                }
            } else if (arguments.length === 4) { // RGB and alpha or options
                _r = v1;
                _g = v2;
                _b = v3;
                if (typeof v4 === 'number') {
                    _a = v4;
                } else {
                    options = v4 || {};
                    _a = options.base || 1;
                }
            } else { // RGBA + options
                _r = v1;
                _g = v2;
                _b = v3;
                _a = v4;
                options = v5;
            }
        }

        if (!(typeof _r === 'number' &&
            typeof _g === 'number' &&
            typeof _b === 'number' &&
            typeof _a === 'number')) {
            throw new Error('Invalid color arguments');
        }

        options = options || {};

        // The base option allows you to specify values in a different range.
        if (options.base !== undefined) {
            _r /= options.base;
            _g /= options.base;
            _b /= options.base;
            _a /= options.base;
        }
        R = Math.round(_r * 255);
        G = Math.round(_g * 255);
        B = Math.round(_b * 255);
        return 'rgba(' + R + ', ' + G + ', ' + B + ', ' + _a + ')';
    }

    // Converts a number of arguments into a dictionary of gradient information that is understood by the renderer.
    function toGradientData(v1, v2, v3, v4, v5) {
        var startColor, endColor, type, rotation, spread, d,
            data = {};

        if (arguments.length === 1) { // The argument is a dictionary or undefined.
            d = v1 || {};
            startColor = d.startColor;
            endColor = d.endColor;
            type = d.type;
            rotation = d.rotation;
            spread = d.spread;
        } else if (arguments.length >= 2) { // The first two arguments are a start color and an end color.
            startColor = v1;
            endColor = v2;
            type = 'linear';
            rotation = 0;
            spread = 0;
            if (arguments.length === 3) {
                if (typeof v3 === 'string') { // The type can be either linear or radial.
                    type = v3;
                } else if (typeof v3 === 'number') { // The type is implicitly linear and the third argument is the rotation angle.
                    rotation = v3;
                }
            } else if (arguments.length === 4) {
                if (typeof v3 === 'number') { // The type is implicitly linear and the third/forth arguments are the rotation angle and gradient spread.
                    rotation = v3;
                    spread = v4;
                } else if (v3 === 'linear') { // The type is explicitly linear and the forth argument is the rotation angle.
                    rotation = v4;
                } else if (v3 === 'radial') { // The type is explicitly radial and the forth argument is the gradient spread.
                    type = v3;
                    spread = v4;
                } else {
                    throw new Error('Wrong argument provided: ' + v3);
                }
            } else if (arguments.length === 5) { // Type, rotation (unused in case of radial type gradient), and gradient spread.
                type = v3;
                rotation = v4;
                spread = v5;
            }
        }

        if (!startColor && startColor !== 0) {
            throw new Error('No startColor was given.');
        }
        if (!endColor && endColor !== 0) {
            throw new Error('No endColor was given.');
        }

        try {
            data.startColor = toColor(startColor);
        } catch (e1) {
            throw new Error('startColor is not a valid color: ' + startColor);
        }

        try {
            data.endColor = toColor(endColor);
        } catch (e2) {
            throw new Error('endColor is not a valid color: ' + endColor);
        }

        if (type === undefined) {
            type = 'linear';
        }
        if (type !== 'linear' && type !== 'radial') {
            throw new Error('Unknown gradient type: ' + type);
        }

        data.type = type;

        if (spread === undefined) {
            spread = 0;
        }
        if (typeof spread !== 'number') {
            throw new Error('Spread value is not a number: ' + spread);
        }

        if (type === 'linear') {
            if (rotation === undefined) {
                rotation = 0;
            }
            if (typeof rotation !== 'number') {
                throw new Error('Rotation value is not a number: ' + rotation);
            }
            data.rotation = rotation;
        }

        data.spread = clamp(spread, 0, 0.99);

        return data;
    }

    function createImageData(ctx, width, height) {
        if (ctx.createImageData) {
            return ctx.createImageData(width, height);
        } else {
            return ctx.getImageData(0, 0, width, height);
        }
    }

    function findType(data) {
        if (typeof data === 'string') {
            return TYPE_PATH;
        } else if (data instanceof Image) {
            return TYPE_IMAGE;
        } else if (data instanceof HTMLCanvasElement) {
            return TYPE_HTML_CANVAS;
        } else if (data instanceof ImageCanvas) {
            return TYPE_IMAGE_CANVAS;
        } else if (data.r !== undefined && data.g !== undefined && data.b !== undefined && data.a !== undefined) {
            return TYPE_FILL;
        } else if (data.startColor !== undefined && data.endColor !== undefined) {
            return TYPE_GRADIENT;
        }
        throw new Error('Cannot establish type for data ', data);
    }


    // IMAGE LAYER.

    Layer = function (data, type) {
        if (!type) {
            type = findType(data);
        }
        this.data = data;
        this.type = type;

        // Compositing.
        this.opacity = 1.0;
        this.blendmode = 'source-over';

        // Transformations.
        this.tx = 0;
        this.ty = 0;
        this.sx = 1.0;
        this.sy = 1.0;
        this.rot = 0;
        this.flip_h = false;
        this.flip_v = false;

        // An alpha mask hides parts of the masked layer where the mask is darker.
        this.mask = new ImageCanvas();

        this.filters = [];
    };

    // Sets the opacity of the layer (requires a number in the range 0.0-1.0).
    Layer.prototype.setOpacity = function (opacity) {
        this.opacity = clamp(opacity, 0, 1);
    };

    // Within an image canvas, a layer is by default positioned in the center.
    // Translating moves the layer away from this center.
    // Each successive call to the translate function performs an additional translation, it doesn't replace the previous one.
    Layer.prototype.translate = function (tx, ty) {
        this.tx += tx;
        this.ty += ty === undefined ? 0 : ty;
    };

    // A layer is scaled around its own center.
    // Scaling happens relatively in a 0.0-1.0 based range where 1.0 stands for 100%.
    // Each successive call to the scale function performs an additional scaling operation, it doesn't replace the previous one.
    // If only one parameter is supplied, the layer is scaled proportionally.
    Layer.prototype.scale = function (sx, sy) {
        this.sx *= sx;
        this.sy *= sy === undefined ? sx : sy;
    };

    // A layer is rotated around its own center.
    // The supplied parameter should be in degrees (not radians).
    // Each successive call to the rotation function performs an additional rotation, it doesn't replace the previous one.
    Layer.prototype.rotate = function (rot) {
        this.rot += rot;
    };

    // Flips the layer horizontally.
    Layer.prototype.flipHorizontal = function (arg) {
        if (arg !== undefined) {
            this.flip_h = arg;
        } else {
            this.flip_h = !this.flip_h;
        }
    };

    // Flips the layer vertically.
    Layer.prototype.flipVertical = function (arg) {
        if (arg !== undefined) {
            this.flip_v = arg;
        } else {
            this.flip_v = !this.flip_v;
        }
    };

    Layer.prototype.addFilter = function (filter, options) {
        this.filters.push({
            name: filter,
            options: options
        });
    };

    Layer.fromFile = function (filename) {
        return new Layer(filename, TYPE_PATH);
    };

    Layer.fromImage = function (image) {
        return new Layer(image, TYPE_IMAGE);
    };

    Layer.fromCanvas = function (canvas) {
        if (canvas instanceof HTMLCanvasElement) {
            return Layer.fromHtmlCanvas(canvas);
        }
        return Layer.fromImageCanvas(canvas);
    };

    Layer.fromHtmlCanvas = function (canvas) {
        return new Layer(canvas, TYPE_HTML_CANVAS);
    };

    Layer.fromImageCanvas = function (iCanvas) {
        return new Layer(iCanvas, TYPE_IMAGE_CANVAS);
    };

    Layer.fromColor = function (color) {
        return new Layer(toColor(color), TYPE_FILL);
    };

    Layer.fromGradient = function () {
        return new Layer(toGradientData.apply(null, arguments), TYPE_GRADIENT);
    };


    // IMAGE CANVAS.

    ImageCanvas = function (width, height) {
        if (!width) {
            width = DEFAULT_WIDTH;
        }
        if (!height) {
            height = DEFAULT_HEIGHT;
        }

        this.width = width;
        this.height = height;
        this.layers = [];
    };

    // Creates a new layer from figuring out the given argument(s) and adds it to the canvas.
    ImageCanvas.prototype.addLayer = function (arg0) {
        var layer;

        try {
            return this.addGradientLayer.apply(this, arguments);
        } catch (e1) {
        }

        try {
            return this.addColorLayer.apply(this, arguments);
        } catch (e2) {
        }

        if (arguments.length === 1) {
            if (typeof arg0 === 'string') {
                layer = new Layer(arg0, TYPE_PATH);
            } else if (arg0 instanceof HTMLCanvasElement) {
                layer = new Layer(arg0, TYPE_HTML_CANVAS);
            } else if (arg0 instanceof Image) {
                layer = new Layer(arg0, TYPE_IMAGE);
            } else if (arg0 instanceof ImageCanvas) {
                layer = new Layer(arg0, TYPE_IMAGE_CANVAS);
            }
        }

        if (!layer) {
            throw new Error('Error creating layer.');
        }

        this.layers.push(layer);
        return layer;
    };

    // Adds a new color layer to the canvas.
    ImageCanvas.prototype.addColorLayer = function () {
        var c = toColor.apply(null, arguments),
            layer = new Layer(c, TYPE_FILL);
        this.layers.push(layer);
        return layer;
    };

    // Adds a new gradient layer to the canvas.
    ImageCanvas.prototype.addGradientLayer = function () {
        var c = toGradientData.apply(null, arguments),
            layer = new Layer(c, TYPE_GRADIENT);
        this.layers.push(layer);
        return layer;
    };

    // Renders the canvas and passes the result (a html canvas) to the given callback function.
    ImageCanvas.prototype.render = function (callback) {
        CanvasRenderer.render(this, callback);
    };


    // RENDERING.

    // The Layer and ImageCanvas objects don't do any actual pixel operations themselves,
    // they only contain information about the operations. The actual rendering is done
    // by a Renderer object. Currently there is only one kind available, the CanvasRenderer,
    // which uses the HTML Canvas object (containing the pixel data) and a 2D context that
    // acts on this canvas object. In the future, a webgl renderer might be added as well.

    CanvasRenderer = {};

    // Renders a html canvas as an html Image. Currently unused.
    CanvasRenderer.toImage = function () {
        return function (canvas, callback) {
            var img = new Image();
            img.width = canvas.width;
            img.height = canvas.height;
            img.src = canvas.toDataURL();
            callback(null, img);
        };
    };


    // 'LOADING' OF LAYERS.

    // Returns a html canvas dependent on the type of the layer provided.
    CanvasRenderer.load = function (iCanvas, layer) {
        if (layer.type === TYPE_PATH) {
            return CanvasRenderer.loadFile(layer.data);
        } else if (layer.type === TYPE_FILL) {
            return CanvasRenderer.generateColor(iCanvas, layer);
        } else if (layer.type === TYPE_GRADIENT) {
            return CanvasRenderer.generateGradient(iCanvas, layer);
        } else if (layer.type === TYPE_HTML_CANVAS) {
            return CanvasRenderer.loadHtmlCanvas(layer.data);
        } else if (layer.type === TYPE_IMAGE) {
            return CanvasRenderer.loadImage(layer.data);
        } else if (layer.type === TYPE_IMAGE_CANVAS) {
            return CanvasRenderer.loadImageCanvas(layer.data);
        }
    };

    // Returns a html canvas from an image file location.
    CanvasRenderer.loadFile = function (src) {
        return function (_, callback) {
            var source = new Image(),
                canvas = document.createElement('canvas'),
                ctx = canvas.getContext('2d');

            source.onload = function () {
                canvas.width = source.width;
                canvas.height = source.height;
                ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
                callback(null, canvas);
            };
            source.src = src;
        };
    };

    // Passes a html canvas.
    CanvasRenderer.loadHtmlCanvas = function (canvas) {
        return function (_, callback) {
            callback(null, canvas);
        };
    };

    // Returns a html canvas from rendering an ImageCanvas.
    CanvasRenderer.loadImageCanvas = function (iCanvas) {
        return function (_, callback) {
            iCanvas.render(function (canvas) {
                callback(null, canvas);
            });
        };
    };

    // Returns a html canvas from rendering a stored Image file.
    CanvasRenderer.loadImage = function (img) {
        return function (_, callback) {
            var canvas = document.createElement('canvas'),
                ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(null, canvas);
        };
    };

    // Returns a html canvas with a solid fill color.
    CanvasRenderer.generateColor = function (iCanvas, layer) {
        return function (_, callback) {
            var width = layer.width !== undefined ? layer.width : iCanvas.width,
                height = layer.height !== undefined ? layer.height : iCanvas.height,
                canvas = document.createElement('canvas'),
                ctx = canvas.getContext('2d');

            canvas.width = width;
            canvas.height = height;
            ctx.fillStyle = layer.data;
            ctx.fillRect(0, 0, width, height);
            callback(null, canvas);
        };
    };

    // Returns a html canvas with a gradient.
    CanvasRenderer.generateGradient = function (iCanvas, layer) {
        return function (_, callback) {
            var grd, x1, y1, x2, y2,
                width = layer.width !== undefined ? layer.width : iCanvas.width,
                height = layer.height !== undefined ? layer.height : iCanvas.height,
                cx = width / 2,
                cy = height / 2,
                canvas = document.createElement('canvas'),
                ctx = canvas.getContext('2d'),
                data = layer.data,
                type = data.type || 'linear',
                rotateDegrees = data.rotation || 0;

            if (type === 'radial') {
                grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) / 2);
            } else {
                // Rotation code taken from html5-canvas-gradient-creator:
                // Website: http://victorblog.com/html5-canvas-gradient-creator/
                // Code: https://github.com/evictor/html5-canvas-gradient-creator/blob/master/js/src/directive/previewCanvas.coffee
                if (rotateDegrees < 0) {
                    rotateDegrees += 360;
                }
                if ((0 <= rotateDegrees && rotateDegrees < 45)) {
                    x1 = 0;
                    y1 = height / 2 * (45 - rotateDegrees) / 45;
                    x2 = width;
                    y2 = height - y1;
                } else if ((45 <= rotateDegrees && rotateDegrees < 135)) {
                    x1 = width * (rotateDegrees - 45) / (135 - 45);
                    y1 = 0;
                    x2 = width - x1;
                    y2 = height;
                } else if ((135 <= rotateDegrees && rotateDegrees < 225)) {
                    x1 = width;
                    y1 = height * (rotateDegrees - 135) / (225 - 135);
                    x2 = 0;
                    y2 = height - y1;
                } else if ((225 <= rotateDegrees && rotateDegrees < 315)) {
                    x1 = width * (1 - (rotateDegrees - 225) / (315 - 225));
                    y1 = height;
                    x2 = width - x1;
                    y2 = 0;
                } else if (315 <= rotateDegrees) {
                    x1 = 0;
                    y1 = height - height / 2 * (rotateDegrees - 315) / (360 - 315);
                    x2 = width;
                    y2 = height - y1;
                }
                grd = ctx.createLinearGradient(x1, y1, x2, y2);
            }
            grd.addColorStop(data.spread || 0, data.startColor);
            grd.addColorStop(1, data.endColor);

            canvas.width = width;
            canvas.height = height;
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, width, height);
            callback(null, canvas);
        };
    };


    // PROCESSING OF LAYERS.

    // Performs a number of filtering operations on an html image.
    // This method executes on the main thread if web workers aren't available on the current system.
    CanvasRenderer.processImage = function (filters) {
        if (filters.length === 0) {
            return passThrough;
        }

        return function (canvas, callback) {
            var i, filter, tmpData,
                ctx = canvas.getContext('2d'),
                width = canvas.width,
                height = canvas.height,
                inData = ctx.getImageData(0, 0, width, height),
                outData = createImageData(ctx, width, height);

            for (i = 0; i < filters.length; i += 1) {
                if (i > 0) {
                    tmpData = inData;
                    inData = outData;
                    outData = tmpData;
                }
                filter = filters[i];
                process[filter.name](inData.data, outData.data, width, height, filter.options);
            }

            ctx.putImageData(outData, 0, 0);
            callback(null, canvas);
        };
    };

    // Renders the layer mask and applies it to the layer that it is supposed to mask.
    CanvasRenderer.processMask = function (mask) {
        if (mask.layers.length === 0) {
            return passThrough;
        }
        return function (canvas, callback) {
            mask.width = canvas.width;
            mask.height = canvas.height;

            // First, make a black and white version of the masking canvas and pass
            // the result to the masking operation.
            CanvasRenderer.renderBW(mask, function (c) {
                var data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
                    maskFilter = {name: 'mask', options: {data: data, x: 0, y: 0, width: c.width, height: c.height} },
                    fn = CanvasRenderer.processImage([maskFilter]);
                fn(canvas, callback);
            });
        };
    };

    // Processes a single layer. First the layer image is loaded, then a mask (if applicable) is applied to it,
    // and finally the filters (if any) are applied to it.
    function processLayers(iCanvas) {
        return function (layer, callback) {
            async.compose(
                CanvasRenderer.processImage(layer.filters),
                CanvasRenderer.processMask(layer.mask),
                CanvasRenderer.load(iCanvas, layer)
            )(null, callback);
        };
    }


    // LAYER TRANFORMATIONS.

    // Transforms the 2d context that acts upon this layer's image. Utility function. -> Rename this?
    function transformLayer(ctx, iCanvas, layer) {
        var translate = layer.tx !== 0 || layer.ty !== 0,
            scale = layer.sx !== 1 || layer.sy !== 1,
            rotate = layer.rot !== 0,
            flip = layer.flip_h || layer.flip_v;

        if (translate) {
            ctx.translate(layer.tx, layer.ty);
        }
        if (scale || rotate || flip) {
            ctx.translate(iCanvas.width / 2, iCanvas.height / 2);
            if (rotate) {
                ctx.rotate(radians(layer.rot));
            }
            if (scale) {
                ctx.scale(layer.sx, layer.sy);
            }
            if (flip) {
                ctx.scale(layer.flip_h ? -1 : 1, layer.flip_v ? -1 : 1);
            }
            ctx.translate(-iCanvas.width / 2, -iCanvas.height / 2);
        }
    }

    // Transforms the bounds of a layer (the bounding rectangle) and returns the bounding rectangle
    // that encloses this transformed rectangle.
    function transformRect(iCanvas, layer) {
        var i, pt, minx, miny, maxx, maxy, t,
            width = layer.img.width,
            height = layer.img.height,
            p1 = {x: 0, y: 0},
            p2 = {x: width, y: 0},
            p3 = {x: 0, y: height},
            p4 = {x: width, y: height},
            points = [p1, p2, p3, p4];

        t = transform();
        t.translate((iCanvas.width - width) / 2, (iCanvas.height - height) / 2);
        t.translate(layer.tx, layer.ty);
        t.translate(width / 2, height / 2);
        t.rotate(layer.rot);
        t.scale(layer.sx, layer.sy);
        t.translate(-width / 2, -height / 2);

        for (i = 0; i < 4; i += 1) {
            pt = t.transformPoint(points[i]);
            if (i === 0) {
                minx = maxx = pt.x;
                miny = maxy = pt.y;
            } else {
                if (pt.x < minx) {
                    minx = pt.x;
                }
                if (pt.x > maxx) {
                    maxx = pt.x;
                }
                if (pt.y < miny) {
                    miny = pt.y;
                }
                if (pt.y > maxy) {
                    maxy = pt.y;
                }
            }
        }
        return {x: minx, y: miny, width: maxx - minx, height: maxy - miny};
    }

    // Calculates the intersecting rectangle of two input rectangles.
    function rectIntersect(r1, r2) {
        var right1 = r1.x + r1.width,
            bottom1 = r1.y + r1.height,
            right2 = r2.x + r2.width,
            bottom2 = r2.y + r2.height,

            x = Math.max(r1.x, r2.x),
            y = Math.max(r1.y, r2.y),
            w = Math.max(Math.min(right1, right2) - x, 0),
            h = Math.max(Math.min(bottom1, bottom2) - y, 0);
        return {x: x, y: y, width: w, height: h};
    }

    // Calculates the mimimal area that a transformed layer needs so that it
    // can still be drawn on the canvas. Returns a rectangle.
    function calcLayerRect(iCanvas, layer) {
        var rect = transformRect(iCanvas, layer);
        rect = rectIntersect(rect, {x: 0, y: 0, width: iCanvas.width, height: iCanvas.height});
        return { x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height)};
    }

    // Transforms a layer and returns the resulting pixel data.
    function getTransformedLayerData(iCanvas, layer, rect) {
        var canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d');
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.translate(-rect.x, -rect.y);
        transformLayer(ctx, iCanvas, layer);
        ctx.drawImage(layer.img, layer.x, layer.y);
        return ctx.getImageData(0, 0, rect.width, rect.height);
    }


    // LAYER BLENDING.

    // Blends the subsequent layer images with the base layer and returns a single image.
    // This method is used when web workers aren't available for use on this system.
    CanvasRenderer.mergeManualBlend = function (iCanvas, layerData) {
        return function (canvas, callback) {
            var i, layer, blendData, tmpData, layerOptions, rect,
                ctx = canvas.getContext('2d'),
                width = iCanvas.width,
                height = iCanvas.height,
                baseData = ctx.getImageData(0, 0, width, height),
                outData = createImageData(ctx, width, height);
            for (i = 0; i < layerData.length; i += 1) {
                layer = layerData[i];
                rect = calcLayerRect(iCanvas, layer);
                if (rect.width > 0 && rect.height > 0) {
                    if (i > 0) {
                        tmpData = baseData;
                        baseData = outData;
                        outData = tmpData;
                    }
                    blendData = getTransformedLayerData(iCanvas, layer, rect);
                    layerOptions = {data: blendData.data, width: rect.width, height: rect.height, opacity: layer.opacity, dx: rect.x, dy: rect.y};
                    if (blend[layer.blendmode] === undefined) {
                        throw new Error('No blend mode named \'' + layer.blendmode + '\'');
                    }
                    blend[layer.blendmode](baseData.data, outData.data, width, height, layerOptions);
                }
            }
            ctx.putImageData(outData, 0, 0);
            callback(null, canvas);
        };
    };

    // Renders a single layer. This is useful when there's only one layer available (and no blending is needed)
    // or to render the base layer on which subsequent layers are blended.
    CanvasRenderer.singleLayerWithOpacity = function (iCanvas, layer) {
        var canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d');

        canvas.width = iCanvas.width;
        canvas.height = iCanvas.height;

        ctx.save();
        transformLayer(ctx, iCanvas, layer);
        if (layer.opacity !== 1) {
            ctx.globalAlpha = layer.opacity;
        }
        ctx.drawImage(layer.img, layer.x, layer.y);
        ctx.restore();
        return canvas;
    };

    // Blends the subsequent layer images with the base layer and returns the resulting image.
    // This method is used when the system supports the requested blending mode(s).
    CanvasRenderer.mergeNativeBlend = function (iCanvas, layerData) {
        return function (canvas, callback) {
            var i, layer,
                ctx = canvas.getContext('2d');
            for (i = 0; i < layerData.length; i += 1) {
                layer = layerData[i];
                ctx.save();
                transformLayer(ctx, iCanvas, layer);
                if (layer.opacity !== 1) {
                    ctx.globalAlpha = layer.opacity;
                }
                if (layer.blendmode !== 'source-over') {
                    ctx.globalCompositeOperation = layer.blendmode;
                }
                ctx.drawImage(layer.img, layer.x, layer.y);
                ctx.restore();
            }
            callback(null, canvas);
        };
    };

    // Merges the different canvas layers together in a single image and returns this as a html canvas.
    CanvasRenderer.merge = function (iCanvas, layerData, callback) {
        var i, mode, useNative, currentList,
            layer = layerData[0],
            canvas = CanvasRenderer.singleLayerWithOpacity(iCanvas, layer),
            renderPipe = [function (_, cb) {
                cb(null, canvas);
            }];

        function pushList() {
            if (useNative !== undefined) {
                var fn = useNative ? CanvasRenderer.mergeNativeBlend : CanvasRenderer.mergeManualBlend;
                renderPipe.unshift(fn(iCanvas, currentList));
            }
        }

        for (i = 1; i < layerData.length; i += 1) {
            layer = layerData[i];
            mode = layer.blendmode;
            // todo: handle blendmode aliases.
            if (useNative === undefined || useNative !== nativeBlendModes[mode]) {
                pushList();
                currentList = [];
            }
            currentList.push(layer);
            useNative = nativeBlendModes[mode];
            if (i === layerData.length - 1) {
                pushList();
            }
        }

        async.compose.apply(null, renderPipe)(null, function () {
            callback(canvas);
        });
    };

    CanvasRenderer.composite = function (iCanvas, layerData, callback) {
        if (!layerData || layerData.length === 0) {
            callback(null);
            return;
        }
        if (layerData.length === 1) {
            callback(CanvasRenderer.singleLayerWithOpacity(iCanvas, layerData[0]));
            return;
        }

        CanvasRenderer.merge(iCanvas, layerData, callback);
    };

    // Returns an object with additional layer information as well as the input images
    // to be passed to the different processing functions.
    function getLayerData(iCanvas, layerImages) {
        var i, d, x, y, layer, layerImg, layerData = [];
        for (i = 0; i < layerImages.length; i += 1) {
            layer = iCanvas.layers[i];
            layerImg = layerImages[i];
            x = (iCanvas.width - layerImg.width) / 2;
            y = (iCanvas.height - layerImg.height) / 2;
            d = { img: layerImg, x: x, y: y,
                opacity: layer.opacity,
                blendmode: layer.blendmode,
                tx: layer.tx, ty: layer.ty,
                sx: layer.sx, sy: layer.sy,
                rot: layer.rot,
                flip_h: layer.flip_h, flip_v: layer.flip_v
            };
            layerData.push(d);
        }
        return layerData;
    }

    // Renders the image canvas. Top level.
    CanvasRenderer.render = function (iCanvas, callback) {
        async.map(iCanvas.layers,
            processLayers(iCanvas), function (err, layerImages) {
                if (callback) {
                    CanvasRenderer.composite(iCanvas, getLayerData(iCanvas, layerImages), callback);
                }
            });
    };

    // Renders the image canvas and turns it into a black and white image. Useful for rendering a layer mask.
    CanvasRenderer.renderBW = function (iCanvas, callback) {
        CanvasRenderer.render(iCanvas, function (canvas) {
            var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
                bwFilter = {name: 'luminancebw'},
                fn = CanvasRenderer.processImage([bwFilter]);
            fn(canvas, function (err, c) {
                callback(c);
            });
        });
    };

    img = {};
    img.Layer = Layer;
    img.ImageCanvas = ImageCanvas;

    // MODULE SUPPORT ///////////////////////////////////////////////////////

    module.exports = img;

}());