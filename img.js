/*jslint nomen:true */
/*global _, async, Image, document, window, process */

(function () {
    'use strict';

    var Canvas, Layer;

    function passThrough(canvas, callback) {
        callback(null, canvas);
    }

    Layer = function (img) {
        this.img = img;
        this.filter = null;
    };

    Layer.prototype.load = function () {
        var src = this.img;
        return function (_, callback) {
            var source = new Image(),
                canvas = document.createElement("canvas"),
                ctx = canvas.getContext("2d");

            source.onload = function () {
                canvas.width = source.width;
                canvas.height = source.height;
                ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
                callback(null, canvas);
            };
            source.src = src;
        };
    };

    Layer.prototype.setFilter = function (filter) {
        this.filter = filter;
    };

    Layer.prototype._processNoWorker = function () {
        var filter = this.filter;
        if (filter === null) { return passThrough; }

        return function (canvas, callback) {
            var ctx = canvas.getContext("2d"),
                width = canvas.width,
                height = canvas.height,
                canvasInData = ctx.getImageData(0, 0, width, height),
                canvasOutData = ctx.createImageData(width, height);

            process[filter.name](canvasInData.data, canvasOutData.data, width, height, filter.options);
            ctx.putImageData(canvasOutData, 0, 0);
            callback(null, canvas);
        };
    };

    Layer.prototype._processWithWorker = function () {
        var filter = this.filter;
        if (filter === null) { return passThrough; }

        return function (canvas, callback) {
            var ctx = canvas.getContext("2d"),
                width = canvas.width,
                height = canvas.height,
                canvasInData = ctx.getImageData(0, 0, width, height),
                canvasOutData = ctx.createImageData(width, height),
                worker = new window.Worker("img.worker.control.js");

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
        Layer.prototype.processImage = Layer.prototype._processNoWorker;
    } else {
        Layer.prototype.processImage = Layer.prototype._processWithWorker;
    }

    Canvas = function () {
        this.layers = [];
    };

    Canvas.prototype.addLayer = function (filename) {
        var layer = new Layer(filename);
        this.layers.push(layer);
        return layer;
    };

    Canvas.prototype.processLayer = function (layer, callback) {
        async.compose(
            layer.processImage(),
            layer.load()
        )(null, callback);
    };

    Canvas.prototype.render = function (callback) {
        async.map(this.layers,
              this.processLayer, function (err, result) {
                if (callback) {
                    callback(result);
                }
            });
    };

}());
