/*jslint nomen:true */
/*global _, async, console, Image, document, module, define, require, window, process */

(function () {
    'use strict';

    var Canvas, CanvasRenderer, Layer, img,
        DEFAULT_WIDTH = 800,
        DEFAULT_HEIGHT = 800;

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

    Canvas = function (width, height) {
        if (!width) { width = DEFAULT_WIDTH; }
        if (!height) { height = DEFAULT_HEIGHT; }

        this.width = width;
        this.height = height;
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

    CanvasRenderer.processLayer = function (layer, callback) {
        async.compose(
            CanvasRenderer.processImage(layer.filters),
            CanvasRenderer.processMask(layer.mask),
            CanvasRenderer.load(layer.img)
        )(null, callback);
    };

    CanvasRenderer.merge = function (width, height, layerData) {
        var i, layer, baseData, blendData, outData, tmpData, layerOptions,
            dCanvas = document.createElement('canvas'),
            ctx = dCanvas.getContext('2d');
        dCanvas.width = width;
        dCanvas.height = height;

        if (layerData.length > 0) {
            layer = layerData[0];
            if (layer.opacity !== 1) {
                ctx.globalAlpha = layer.opacity;
            }
            ctx.drawImage(layer.img, layer.x, layer.y);
        }
        baseData = ctx.getImageData(0, 0, width, height);
        outData = createImageData(ctx, width, height);

        for (i = 1; i < layerData.length; i += 1) {
            if (i > 1) {
                tmpData = baseData;
                baseData = outData;
                outData = tmpData;
            }
            layer = layerData[i];
            blendData = layer.img.getContext('2d').getImageData(0, 0, layer.img.width, layer.img.height);
            layerOptions = {data: blendData.data, width: layer.img.width, height: layer.img.height, amount: layer.opacity, dx: layer.x, dy: layer.y};
            blend[layer.blendmode](baseData.data, outData.data, width, height, layerOptions);
        }

        return outData;
    }

    CanvasRenderer.composite = function (canvas, layerImages, callback) {
        if (!layerImages) { callback(null); }
        if (layerImages.length === 0) { callback(null); }

        var i, x, y, layer, layerImg, mergedData,
            dCanvas = document.createElement('canvas'),
            ctx = dCanvas.getContext('2d'),
            layers = canvas.layers,
            layerData = [];

        dCanvas.width = canvas.width;
        dCanvas.height = canvas.height;

        for (i = 0; i < layerImages.length; i += 1) {
            layer = layers[i];
            layerImg = layerImages[i];
            x = (canvas.width - layerImg.width) / 2;
            y = (canvas.height - layerImg.height) / 2;

            if (layerImages.length === 1) {
                if (layer.opacity !== 1) {
                    ctx.globalAlpha = layer.opacity;
                }
                ctx.drawImage(layerImg, x, y);
            } else {
                layerData.push({
                    opacity: layer.opacity,
                    blendmode: layer.blendmode,
                    img: layerImg,
                    x: x,
                    y: y,
                });
            }
        }

        if (layerImages.length > 1) {
            mergedData = CanvasRenderer.merge(canvas.width, canvas.height, layerData);
            ctx.putImageData(mergedData, 0, 0);
        }

        callback(dCanvas);
    };

    CanvasRenderer.render = function (canvas, callback) {
        async.map(canvas.layers,
              CanvasRenderer.processLayer, function (err, layerImages) {
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
