/*jslint nomen:true */
/*global _, async, console, Image, document, module, define, require, window, process */

(function () {
    'use strict';

    var Canvas, CanvasRenderer, Layer, img;

    function clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

    function passThrough(canvas, callback) {
        callback(null, canvas);
    }

    function createImageData(ctx, width, height) {
        if (ctx.createImageData) {
            return ctx.createImageData(width, height);
        } else {
            return ctx.getImageData(0, 0, width, height);
        }
    }

    Layer = function (img) {
        this.img = img;
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

    Canvas = function () {
        this.layers = [];
    };

    Canvas.prototype.addLayer = function (filename) {
        var layer = new Layer(filename);
        this.layers.push(layer);
        return layer;
    };

    Canvas.prototype.render = function (callback) {
        CanvasRenderer.render(this, callback);
    };

    CanvasRenderer = {};

    CanvasRenderer.load = function (src) {
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

    CanvasRenderer._processNoWorker = function (filters) {
        if (filters.length === 0) { return passThrough; }

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

    CanvasRenderer._processWithWorker = function (filters) {
        if (filters.length === 0) { return passThrough; }

        return function (canvas, callback) {
            var ctx = canvas.getContext('2d'),
                width = canvas.width,
                height = canvas.height,
                canvasInData = ctx.getImageData(0, 0, width, height),
                canvasOutData = createImageData(ctx, width, height),
                worker = new window.Worker('img.worker.control.js');

            worker.onmessage = function (e) {
                canvasOutData = e.data.result;
                ctx.putImageData(canvasOutData, 0, 0);
                callback(null, canvas);
            };

            worker.postMessage({ inData: canvasInData,
                                 outData: canvasOutData,
                                 width: width,
                                 height: height,
                                 filters: filters });
        };
    };

    CanvasRenderer.toImage = function () {
        return function (canvas, callback) {
            var img = new Image();
            img.width = canvas.width;
            img.height = canvas.height;
            img.src = canvas.toDataURL();
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
        return function (canvas, callback) {
            CanvasRenderer.renderBW(mask, function (c) {
                var data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
                    maskFilter = {name: "mask", options: {data: data, x: 0, y: 0, width: c.width, height: c.height} },
                    fn = CanvasRenderer.processImage([maskFilter]);
                fn(canvas, callback);
            });
        };
    };

    CanvasRenderer.processLayer = function (layer, callback) {
        async.compose(
            CanvasRenderer.processImage(layer.filters),
            CanvasRenderer.processMask(layer.mask),
            CanvasRenderer.load(layer.img)
        )(null, callback);
    };

    CanvasRenderer.composite = function (layers, layerImages, callback) {
        if (!layerImages) { callback(null); }
        if (layerImages.length === 0) { callback(null); }

        var i,
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d');

        canvas.width = layerImages[0].width;
        canvas.height = layerImages[0].height;

        for (i = 0; i < layerImages.length; i += 1) {
            ctx.save();
            if (layers[i].opacity !== 1) {
                ctx.globalAlpha = layers[i].opacity;
            }
            if (layers[i].blendmode !== "normal") {
                ctx.globalCompositeOperation = layers[i].blendmode;
            }
            ctx.drawImage(layerImages[i], 0, 0);
            ctx.restore();
        }
        callback(canvas);
    };

    CanvasRenderer.render = function (canvas, callback) {
        async.map(canvas.layers,
              CanvasRenderer.processLayer, function (err, layerImages) {
                if (callback) {
                    CanvasRenderer.composite(canvas.layers, layerImages, callback);
                }
            });
    };

    CanvasRenderer.renderBW = function (canvas, callback) {
        CanvasRenderer.render(canvas, function (c) {
            var data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
                bwFilter = {name: "luminancebw"},
                fn = CanvasRenderer.processImage([bwFilter]);
            fn(c, function (err, c) {
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
