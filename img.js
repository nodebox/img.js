/*jslint nomen:true */
/*global _, async, console, Image, document, module, define, require, window, process */

(function () {
    'use strict';

    var Canvas, CanvasRenderer, Layer, img;

    function passThrough(canvas, callback) {
        callback(null, canvas);
    }

    Layer = function (img) {
        this.img = img;
        this.filter = null;
    };

    Layer.prototype.setFilter = function (filter) {
        this.filter = filter;
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
        var filter = layer.filter;
        if (filter === null) { return passThrough; }

        return function (canvas, callback) {
            var ctx = canvas.getContext('2d'),
                width = canvas.width,
                height = canvas.height,
                canvasInData = ctx.getImageData(0, 0, width, height),
                canvasOutData = ctx.createImageData(width, height);

            process[filter.name](canvasInData.data, canvasOutData.data, width, height, filter.options);
            ctx.putImageData(canvasOutData, 0, 0);
            callback(null, canvas);
        };
    };

    CanvasRenderer._processWithWorker = function (layer) {
        var filter = layer.filter;
        if (filter === null) { return passThrough; }

        return function (canvas, callback) {
            var ctx = canvas.getContext('2d'),
                width = canvas.width,
                height = canvas.height,
                canvasInData = ctx.getImageData(0, 0, width, height),
                canvasOutData = ctx.createImageData(width, height),
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
                                 filter: filter });
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
