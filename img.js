/*jslint nomen:true */
/*global _, async, console, Image, HTMLCanvasElement, document, module, define, require, window, process, blend */

(function () {
    'use strict';

    var Canvas, CanvasRenderer, Layer, img, colors,
        DEFAULT_WIDTH = 800,
        DEFAULT_HEIGHT = 800,

        TYPE_PATH = "path",
        TYPE_IMAGE = "image",
        TYPE_HTML_CANVAS = "htmlcanvas",
        TYPE_CANVAS = "canvas",
        TYPE_FILL = "fill",
        TYPE_GRADIENT = "gradient";

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

    function toGradientData(v1, v2, v3, v4, v5) {
        var startColor, endColor, type, rotation, spread, d,
            data = {};

        if (arguments.length === 1) {
            d = v1 || {};
            startColor = d.startColor;
            endColor = d.endColor;
            type = d.type;
            rotation = d.rotation;
            spread = d.spread;
        } else if (arguments.length >= 2) {
            startColor = v1;
            endColor = v2;
            type = "linear";
            rotation = 0;
            spread = 0;
            if (arguments.length === 3) {
                if (typeof v3 === "string") {
                    type = v3;
                } else if (typeof v3 === "number") {
                    rotation = v3;
                }
            } else if (arguments.length === 4) {
                if (typeof v3 === "number") {
                    rotation = v3;
                    spread = v4;
                } else if (v3 === "linear") {
                    rotation = v4;
                } else if (v3 === "radial") {
                    type = v3;
                    spread = v4;
                } else {
                    throw new Error("Wrong argument provided: " + v3);
                }
            } else if (arguments.length === 5) {
                type = v3;
                rotation = v4;
                spread = v5;
            }
        }

        if (!startColor && startColor !== 0) { throw new Error("No startColor was given."); }
        if (!endColor && endColor !== 0) { throw new Error("No endColor was given."); }

        try {
            data.startColor = toColor(startColor);
        } catch (e1) {
            throw new Error("startColor is not a valid color: " + startColor);
        }

        try {
            data.endColor = toColor(endColor);
        } catch (e2) {
            throw new Error("endColor is not a valid color: " + endColor);
        }

        if (type === undefined) { type = "linear"; }
        if (type !== "linear" && type !== "radial") {
            throw new Error("Unknown gradient type: " + type);
        }

        data.type = type;

        if (spread === undefined) { spread = 0; }
        if (typeof spread !== "number") {
            throw new Error("Spread value is not a number: " + spread);
        }

        if (type === "linear") {
            if (rotation === undefined) { rotation = 0; }
            if (typeof rotation !== "number") {
                throw new Error("Rotation value is not a number: " + rotation);
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
        } else if (data instanceof Canvas) {
            return TYPE_CANVAS;
        } else if (data.r !== undefined && data.g !== undefined && data.b !== undefined && data.a !== undefined) {
            return TYPE_FILL;
        } else if (data.startColor !== undefined && data.endColor !== undefined) {
            return TYPE_GRADIENT;
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
            return new Layer(canvas, TYPE_HTML_CANVAS);
        }
        return new Layer(canvas, TYPE_CANVAS);
    };

    Layer.fromColor = function (color) {
        return new Layer(toColor(color), TYPE_FILL);
    };

    Layer.fromGradient = function () {
        return new Layer(toGradientData.apply(null, arguments), TYPE_GRADIENT);
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
            return this.addGradientLayer.apply(this, arguments);
        } catch (e1) {
        }

        try {
            return this.addColorLayer.apply(this, arguments);
        } catch (e2) {
        }

        if (arguments.length === 1) {
            if (typeof arg0 === "string") {
                layer = new Layer(arg0, TYPE_PATH);
            } else if (arg0 instanceof HTMLCanvasElement) {
                layer = new Layer(arg0, TYPE_HTML_CANVAS);
            } else if (arg0 instanceof Image) {
                layer = new Layer(arg0, TYPE_IMAGE);
            } else if (arg0 instanceof Canvas) {
                layer = new Layer(arg0, TYPE_CANVAS);
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

    Canvas.prototype.addGradientLayer = function () {
        var c = toGradientData.apply(null, arguments),
            layer = new Layer(c, TYPE_GRADIENT);
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

    CanvasRenderer.loadHtmlCanvas = function (dCanvas) {
        return function (_, callback) {
            callback(null, dCanvas);
        };
    };

    CanvasRenderer.loadCanvas = function (canvas) {
        return function (_, callback) {
            canvas.render(function (dCanvas) {
                callback(null, dCanvas);
            });
        };
    };

    CanvasRenderer.loadImage = function (img) {
        return function (_, callback) {
            var dCanvas = document.createElement('canvas'),
                ctx = dCanvas.getContext('2d');

            dCanvas.width = img.width;
            dCanvas.height = img.height;
            ctx.drawImage(img, 0, 0, dCanvas.width, dCanvas.height);
            callback(null, dCanvas);
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

    CanvasRenderer.generateGradient = function (canvas, layer) {
        return function (_, callback) {
            var grd, x1, y1, x2, y2,
                width = layer.width !== undefined ? layer.width : canvas.width,
                height = layer.height !== undefined ? layer.height : canvas.height,
                cx = width / 2,
                cy = height / 2,
                dCanvas = document.createElement('canvas'),
                ctx = dCanvas.getContext('2d'),
                data = layer.data,
                type = data.type || "linear",
                rotateDegrees = data.rotation || 0;

            if (type === "radial") {
                grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) / 2);
            } else {
                // Rotation code taken from html5-canvas-gradient-creator:
                // Website: http://victorblog.com/html5-canvas-gradient-creator/
                // Code: https://github.com/evictor/html5-canvas-gradient-creator/blob/master/js/src/directive/previewCanvas.coffee
                if (rotateDegrees < 0) { rotateDegrees += 360; }
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
        } else if (layer.type === TYPE_GRADIENT) {
            return CanvasRenderer.generateGradient(canvas, layer);
        } else if (layer.type === TYPE_HTML_CANVAS) {
            return CanvasRenderer.loadHtmlCanvas(layer.data);
        } else if (layer.type === TYPE_IMAGE) {
            return CanvasRenderer.loadImage(layer.data);
        } else if (layer.type === TYPE_CANVAS) {
            return CanvasRenderer.loadCanvas(layer.data);
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

    CanvasRenderer.mergeManualBlend = function (width, height, layerData) {
        return function (dCanvas, callback) {
            var i, d, blendData, tmpData, layerOptions,
                ctx = dCanvas.getContext('2d'),
                baseData = ctx.getImageData(0, 0, width, height),
                outData = createImageData(ctx, width, height);
            for (i = 0; i < layerData.length; i += 1) {
                if (i > 0) {
                    tmpData = baseData;
                    baseData = outData;
                    outData = tmpData;
                }
                d = layerData[i];
                blendData = d.img.getContext('2d').getImageData(0, 0, d.img.width, d.img.height);
                layerOptions = {data: blendData.data, width: d.img.width, height: d.img.height, opacity: d.opacity, dx: d.x, dy: d.y};
                blend[d.blendmode](baseData.data, outData.data, width, height, layerOptions);
            }
            ctx.putImageData(outData, 0, 0);
            callback(null, dCanvas);
        };
    };

    CanvasRenderer.singleLayerWithOpacity = function (canvas, layerImg, x, y, opacity) {
        var dCanvas = document.createElement('canvas'),
            ctx = dCanvas.getContext('2d');

        dCanvas.width = canvas.width;
        dCanvas.height = canvas.height;

        if (opacity !== 1) {
            ctx.globalAlpha = opacity;
        }
        ctx.drawImage(layerImg, x, y);
        return dCanvas;
    };

    CanvasRenderer.merge = function (canvas, layerData, callback) {
        var d = layerData[0],
            dCanvas = CanvasRenderer.singleLayerWithOpacity(canvas, d.img, d.x, d.y, d.opacity);

        async.compose(
            CanvasRenderer.mergeManualBlend(canvas.width, canvas.height, layerData.slice(1)),
            function (_, cb) { cb(null, dCanvas); }
        )(null, function () {
            callback(dCanvas);
        });
    };

    CanvasRenderer.composite = function (canvas, layerData, callback) {
        if (!layerData || layerData.length === 0) {
            callback(null);
            return;
        }

        if (layerData.length === 1) {
            var d = layerData[0];
            callback(CanvasRenderer.singleLayerWithOpacity(canvas, d.img, d.x, d.y, d.opacity));
            return;
        }

        CanvasRenderer.merge(canvas, layerData, callback);
    };

    function getLayerData(canvas, layerImages) {
        var i, x, y, layer, layerImg, layerData = [];
        for (i = 0; i < layerImages.length; i += 1) {
            layer = canvas.layers[i];
            layerImg = layerImages[i];
            x = (canvas.width - layerImg.width) / 2;
            y = (canvas.height - layerImg.height) / 2;
            layerData.push({img: layerImg, opacity: layer.opacity, blendmode: layer.blendmode, x: x, y: y});
        }
        return layerData;
    }

    CanvasRenderer.render = function (canvas, callback) {
        async.map(canvas.layers,
              processLayers(canvas), function (err, layerImages) {
                if (callback) {
                    CanvasRenderer.composite(canvas, getLayerData(canvas, layerImages), callback);
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
