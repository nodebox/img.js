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

    CanvasRenderer.load = function (layer) {
        var src = layer.img;
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

    CanvasRenderer._processNoWorker = function (layer) {
        if (layer.filters.length === 0) { return passThrough; }

        return function (canvas, callback) {
            var i, filter, tmpData,
                ctx = canvas.getContext('2d'),
                width = canvas.width,
                height = canvas.height,
                inData = ctx.getImageData(0, 0, width, height),
                outData = createImageData(ctx, width, height);

            for (i = 0; i < layer.filters.length; i += 1) {
                if (i > 0) {
                    tmpData = inData;
                    inData = outData;
                    outData = tmpData;
                }
                filter = layer.filters[i];
                process[filter.name](inData.data, outData.data, width, height, filter.options);
            }

            ctx.putImageData(outData, 0, 0);
            callback(null, canvas);
        };
    };

    CanvasRenderer._processWithWorker = function (layer) {
        if (layer.filters.length === 0) { return passThrough; }

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
                                 filters: layer.filters });
        };
    };

    if (!window.Worker) {
        CanvasRenderer.processImage = CanvasRenderer._processNoWorker;
    } else {
        CanvasRenderer.processImage = CanvasRenderer._processWithWorker;
    }

    CanvasRenderer.processLayer = function (layer, callback) {
        async.compose(
            CanvasRenderer.processImage(layer),
            CanvasRenderer.load(layer)
        )(null, callback);
    };

    CanvasRenderer.render = function (canvas, callback) {
        async.map(canvas.layers,
              CanvasRenderer.processLayer, function (err, result) {
                if (callback) {
                    callback(result);
                }
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
