/*jslint nomen:true */
/*global _, async, console, Image, HTMLCanvasElement, document, module, define, require, window, process */

(function () {
    'use strict';

    var Canvas, CanvasRenderer, Layer, img, colors,
        DEFAULT_WIDTH = 800,
        DEFAULT_HEIGHT = 800,

        TYPE_PATH = "path",
        TYPE_IMAGE = "image",
        TYPE_CANVAS = "canvas",
        TYPE_FILL = "fill",
        TYPE_RADIAL = "radial";

    colors = ['aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'transparent', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen'];

    function clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

    function passThrough(canvas, callback) {
        callback(null, canvas);
    }

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
            if (v1.indexOf('#') === 0) { return v1; }
            if (v1.indexOf('rgb') === 0) { return v1; }
            if (colors.indexOf(v1) !== -1) { return v1; }
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

        if (!(typeof _r === "number" &&
            typeof _g === "number" &&
            typeof _b === "number" &&
            typeof _a === "number")) {
            throw new Error("Invalid color arguments");
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

    function toRadialGradientData(v1, v2, v3) {
        var startColor, endColor, spread, d,
            data = {};

        if (arguments.length === 1) {
            d = v1 || {};
            startColor = d.startColor;
            endColor = d.endColor;
            spread = d.spread;
        } else {
            startColor = v1;
            endColor = v2;
            spread = v3;
        }

        if (!startColor && startColor !== 0) { throw new Error("No startColor was given."); }
        if (!endColor && endColor !== 0) { throw new Error("No endColor was given."); }

        try {
            data.startColor = toColor(startColor);
        } catch (err) {
            throw new Error("startColor is not a valid color: " + startColor);
        }

        try {
            data.endColor = toColor(endColor);
        } catch (err) {
            throw new Error("endColor is not a valid color: " + endColor);
        }

        data.spread = spread === undefined ? 0 : clamp(spread, 0, 0.99);

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
            return TYPE_CANVAS;
        } else if (data.r !== undefined && data.g !== undefined && data.b !== undefined && data.a !== undefined) {
            return TYPE_FILL;
        }
        throw new Error("Cannot establish type for data ", data);
    }

    Layer = function (data, type) {
        if (!type) { type = findType(data); }
        this.data = data;
        this.type = type;
        this.opacity = 1.0;
        this.blendmode = "normal";
        this.mask = new Canvas();
        this.filters = [];
    };

    Layer.prototype.setOpacity = function (opacity) {
        this.opacity = clamp(opacity, 0, 1);
    };

    Layer.prototype.addFilter = function (filter, options) {
        this.filters.push({
            layer: this,
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

    Layer.fromCanvas = function (dcanvas) {
        return new Layer(dcanvas, TYPE_CANVAS);
    };

    Layer.fromColor = function (color) {
        return new Layer(toColor(color), TYPE_FILL);
    };

    Layer.fromRadialGradient = function () {
        return new Layer(toRadialGradientData.apply(null, arguments), TYPE_RADIAL);
    };

    Canvas = function (width, height) {
        if (!width) { width = DEFAULT_WIDTH; }
        if (!height) { height = DEFAULT_HEIGHT; }

        this.width = width;
        this.height = height;
        this.layers = [];
    };

    Canvas.prototype.addLayer = function (arg0) {
        var layer;

        try {
            return this.addRadialGradientLayer.apply(this, arguments);
        } catch (err) {
        }

        try {
            return this.addColorLayer.apply(this, arguments);
        } catch (err) {
        }

        if (arguments.length === 1) {
            if (typeof arg0 === "string") {
                layer = new Layer(arg0, TYPE_PATH);
            }
        }

        if (!layer) {
            throw new Error("Error creating layer.");
        }

        this.layers.push(layer);
        return layer;
    };

    Canvas.prototype.addColorLayer = function () {
        var c = toColor.apply(null, arguments),
            layer = new Layer(c, TYPE_FILL);
        this.layers.push(layer);
        return layer;
    };

    Canvas.prototype.addRadialGradientLayer = function () {
        var c = toRadialGradientData.apply(null, arguments),
            layer = new Layer(c, TYPE_RADIAL);
        this.layers.push(layer);
        return layer;
    };

    Canvas.prototype.render = function (callback) {
        CanvasRenderer.render(this, callback);
    };

    CanvasRenderer = {};

    CanvasRenderer.loadFile = function (src) {
        return function (_, callback) {
            var source = new Image(),
                dCanvas = document.createElement('canvas'),
                ctx = dCanvas.getContext('2d');

            source.onload = function () {
                dCanvas.width = source.width;
                dCanvas.height = source.height;
                ctx.drawImage(source, 0, 0, dCanvas.width, dCanvas.height);
                callback(null, dCanvas);
            };
            source.src = src;
        };
    };

    CanvasRenderer.generateColor = function (canvas, layer) {
        return function (_, callback) {
            var width = layer.width !== undefined ? layer.width : canvas.width,
                height = layer.height !== undefined ? layer.height : canvas.height,
                dCanvas = document.createElement('canvas'),
                ctx = dCanvas.getContext('2d');

            dCanvas.width = width;
            dCanvas.height = height;
            ctx.fillStyle = layer.data;
            ctx.fillRect(0, 0, width, height);
            callback(null, dCanvas);
        };
    };

    CanvasRenderer.generateRadialGradient = function (canvas, layer) {
        return function (_, callback) {
            var width = layer.width !== undefined ? layer.width : canvas.width,
                height = layer.height !== undefined ? layer.height : canvas.height,
                cx = width / 2,
                cy = height / 2,
                dCanvas = document.createElement('canvas'),
                ctx = dCanvas.getContext('2d'),
                data = layer.data,
                grd;

            grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) / 2);
            grd.addColorStop(data.spread || 0, data.startColor);
            grd.addColorStop(1, data.endColor);

            dCanvas.width = width;
            dCanvas.height = height;
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, width, height);
            callback(null, dCanvas);
        };
    };

    CanvasRenderer.load = function (canvas, layer) {
        if (layer.type === TYPE_PATH) {
            return CanvasRenderer.loadFile(layer.data);
        } else if (layer.type === TYPE_FILL) {
            return CanvasRenderer.generateColor(canvas, layer);
        } else if (layer.type === TYPE_RADIAL) {
            return CanvasRenderer.generateRadialGradient(canvas, layer);
        }
    };

    CanvasRenderer._processNoWorker = function (filters) {
        if (filters.length === 0) { return passThrough; }

        return function (dCanvas, callback) {
            var i, filter, tmpData,
                ctx = dCanvas.getContext('2d'),
                width = dCanvas.width,
                height = dCanvas.height,
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
            callback(null, dCanvas);
        };
    };

    CanvasRenderer._processWithWorker = function (filters) {
        if (filters.length === 0) { return passThrough; }

        return function (dCanvas, callback) {
            var ctx = dCanvas.getContext('2d'),
                width = dCanvas.width,
                height = dCanvas.height,
                inData = ctx.getImageData(0, 0, width, height),
                outData = createImageData(ctx, width, height),
                worker = new window.Worker('img.worker.control.js');

            worker.onmessage = function (e) {
                outData = e.data.result;
                ctx.putImageData(outData, 0, 0);
                callback(null, dCanvas);
            };

            worker.postMessage({ inData: inData,
                                 outData: outData,
                                 width: width,
                                 height: height,
                                 filters: filters });
        };
    };

    CanvasRenderer.toImage = function () {
        return function (dCanvas, callback) {
            var img = new Image();
            img.width = dCanvas.width;
            img.height = dCanvas.height;
            img.src = dCanvas.toDataURL();
            callback(null, img);
        };
    };

    if (!window.Worker) {
        CanvasRenderer.processImage = CanvasRenderer._processNoWorker;
    } else {
        CanvasRenderer.processImage = CanvasRenderer._processWithWorker;
    }

    CanvasRenderer.processMask = function (mask) {
        if (mask.layers.length === 0) { return passThrough; }
        return function (dCanvas, callback) {
            mask.width = dCanvas.width;
            mask.height = dCanvas.height;
            CanvasRenderer.renderBW(mask, function (c) {
                var data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
                    maskFilter = {name: "mask", options: {data: data, x: 0, y: 0, width: c.width, height: c.height} },
                    fn = CanvasRenderer.processImage([maskFilter]);
                fn(dCanvas, callback);
            });
        };
    };

    function processLayers(canvas) {
        return function (layer, callback) {
            async.compose(
                CanvasRenderer.processImage(layer.filters),
                CanvasRenderer.processMask(layer.mask),
                CanvasRenderer.load(canvas, layer)
            )(null, callback);
        };
    }

    CanvasRenderer.composite = function (canvas, layerImages, callback) {
        if (!layerImages) { callback(null); }
        if (layerImages.length === 0) { callback(null); }

        var i, x, y, layer, layerImg,
            dCanvas = document.createElement('canvas'),
            ctx = dCanvas.getContext('2d'),
            layers = canvas.layers;

        dCanvas.width = canvas.width;
        dCanvas.height = canvas.height;

        for (i = 0; i < layerImages.length; i += 1) {
            ctx.save();
            layer = layers[i];
            layerImg = layerImages[i];

            if (layer.opacity !== 1) {
                ctx.globalAlpha = layer.opacity;
            }
            if (layer.blendmode !== "normal") {
                ctx.globalCompositeOperation = layer.blendmode;
            }
            x = (canvas.width - layerImg.width) / 2;
            y = (canvas.height - layerImg.height) / 2;
            ctx.drawImage(layerImg, x, y);
            ctx.restore();
        }
        callback(dCanvas);
    };

    CanvasRenderer.render = function (canvas, callback) {
        async.map(canvas.layers,
              processLayers(canvas), function (err, layerImages) {
                if (callback) {
                    CanvasRenderer.composite(canvas, layerImages, callback);
                }
            });
    };

    CanvasRenderer.renderBW = function (canvas, callback) {
        CanvasRenderer.render(canvas, function (dCanvas) {
            var data = dCanvas.getContext('2d').getImageData(0, 0, dCanvas.width, dCanvas.height).data,
                bwFilter = {name: "luminancebw"},
                fn = CanvasRenderer.processImage([bwFilter]);
            fn(dCanvas, function (err, c) {
                callback(c);
            });
        });
    };

    img = {};
    img.Layer = Layer;
    img.Canvas = Canvas;

    // MODULE SUPPORT ///////////////////////////////////////////////////////

    if (typeof module !== 'undefined') {
        module.exports = img;
    } else if (typeof define !== 'undefined') {
        define('img', ['underscore'], function () {
            return img;
        });
    } else {
        window.img = img;
    }

}());
