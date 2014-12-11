'use strict';

var util = require('./util');
var CanvasRenderer = require('./canvasrenderer');
var AsyncRenderer = require('./asyncrenderer');

var img, ImageCanvas, Layer;

var DEFAULT_WIDTH = 800;
var DEFAULT_HEIGHT = 800;

// Different layer types.
var TYPE_PATH = 'path';
var TYPE_IMAGE = 'image';
var TYPE_HTML_CANVAS = 'htmlCanvas';
var TYPE_IMAGE_CANVAS = 'iCanvas';
var TYPE_FILL = 'fill';
var TYPE_GRADIENT = 'gradient';

var IDENTITY_TRANSFORM = util.transform();
var Transform = IDENTITY_TRANSFORM;

var clamp = util.clamp;

// Named colors supported by all browsers.
// See: http://www.w3schools.com/html/html_colornames.asp
var colors = ['aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'transparent', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen'];


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
    var startColor, endColor, type, rotation, spread, d;
    var data = {};

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

    if (type === TYPE_HTML_CANVAS || type === TYPE_IMAGE_CANVAS || type === TYPE_IMAGE) {
        this.width = data.width;
        this.height = data.height;
    }

    // Compositing.
    this.opacity = 1.0;
    this.blendmode = 'source-over';

    // Transformations.
    this.transform = IDENTITY_TRANSFORM;
    this.flip_h = false;
    this.flip_v = false;

    // An alpha mask hides parts of the masked layer where the mask is darker.
    this.mask = new ImageCanvas();

    this.filters = [];
};

Layer.Transform = Layer.IDENTITY_TRANSFORM = IDENTITY_TRANSFORM;

// Copies the layer object.
Layer.prototype.clone = function () {
    function cloneFilter(filter) {
        var key, value;
        var f = {};
        f.name = filter.name;
        if (filter.options !== undefined) {
            f.options = {};
            var optionsKeys = Object.keys(filter.options);
            for (var i = 0; i < optionsKeys.length; i += 1) {
                key = optionsKeys[i];
                value = filter.options[key];
                if (Array.isArray(value)) {
                    f.options[key] = value.slice(0);
                } else {
                    f.options[key] = value;
                }
            }
        }
        return f;
    }

    var d = {
        data: this.data,
        type: this.type,
        width: this.width,
        height: this.height,
        opacity: this.opacity,
        blendmode: this.blendmode,
        transform: this.transform,
        flip_h: this.flip_h,
        flip_v: this.flip_v,
        mask: this.mask.clone(),
        filters: []
    };

    if (this.type === TYPE_IMAGE_CANVAS) {
        d.data = this.data.clone();
    } else if (this.type === TYPE_GRADIENT) {
        d.data = {
            startColor: this.data.startColor,
            endColor: this.data.endColor,
            type: this.data.type,
            rotation: this.data.rotation,
            spread: this.data.spread
        };
    }

    for (var i = 0; i < this.filters.length; i += 1) {
        d.filters.push(cloneFilter(this.filters[i]));
    }

    d.__proto__ = this.__proto__;

    return d;
};

// Sets the opacity of the layer (requires a number in the range 0.0-1.0).
Layer.prototype.setOpacity = function (opacity) {
    this.opacity = clamp(opacity, 0, 1);
};

// Within an image canvas, a layer is by default positioned in the center.
// Translating moves the layer away from this center.
// Each successive call to the translate function performs an additional translation on top of the current transformation matrix.
Layer.prototype.translate = function (tx, ty) {
    ty = ty === undefined ? 0 : ty;
    var t = Transform.translate(tx, ty);
    this.transform = this.transform.prepend(t);
};

// Scaling happens relatively in a 0.0-1.0 based range where 1.0 stands for 100%.
// Each successive call to the scale function performs an additional scaling operation on top of the current transformation matrix.
// If only one parameter is supplied, the layer is scaled proportionally.
Layer.prototype.scale = function (sx, sy) {
    sy = sy === undefined ? sx : sy;
    var t = Transform.scale(sx, sy);
    this.transform = this.transform.prepend(t);
};

// The supplied parameter should be in degrees (not radians).
// Each successive call to the rotation function performs an additional rotation on top of the current transformation matrix.
Layer.prototype.rotate = function (rot) {
    var t = Transform.rotate(rot);
    this.transform = this.transform.prepend(t);
};

// Each successive call to the skew function performs an additional skewing operation on top of the current transformation matrix.
Layer.prototype.skew = function (kx, ky) {
    ky = ky === undefined ? kx : ky;
    var t = Transform.skew(kx, ky);
    this.transform = this.transform.prepend(t);
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

// Renders the layer to a new canvas.
Layer.prototype.draw = function (ctx) {
    var width = this.width === undefined ? DEFAULT_WIDTH : this.width;
    var height = this.height === undefined ? DEFAULT_HEIGHT : this.height;
    var canvas = new ImageCanvas(width, height);
    canvas.addLayer(this);
    canvas.draw(ctx);
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

Layer.prototype.isPath = function () {
    return this.type === TYPE_PATH;
};

Layer.prototype.isFill = function () {
    return this.type === TYPE_FILL;
};

Layer.prototype.isGradient = function () {
    return this.type === TYPE_GRADIENT;
};

Layer.prototype.isHtmlCanvas = function () {
    return this.type === TYPE_HTML_CANVAS;
};

Layer.prototype.isImage = function () {
    return this.type === TYPE_IMAGE;
};

Layer.prototype.isImageCanvas = function () {
    return this.type === TYPE_IMAGE_CANVAS;
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

// Copies the ImageCanvas.
ImageCanvas.prototype.clone = function () {
    var c = new ImageCanvas(this.width, this.height);
    for (var i = 0; i < this.layers.length; i += 1) {
        c.layers.push(this.layers[i].clone());
    }
    return c;
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
        } else if (arg0 instanceof Layer) {
            layer = arg0;
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
    var c = toColor.apply(null, arguments);
    var layer = new Layer(c, TYPE_FILL);
    this.layers.push(layer);
    return layer;
};

// Adds a new gradient layer to the canvas.
ImageCanvas.prototype.addGradientLayer = function () {
    var c = toGradientData.apply(null, arguments);
    var layer = new Layer(c, TYPE_GRADIENT);
    this.layers.push(layer);
    return layer;
};

// Renders the canvas and passes the result (a html canvas) to the given callback function.
ImageCanvas.prototype.render = function (callback) {
    var renderer = callback ? AsyncRenderer : CanvasRenderer;
    return renderer.render(this, callback);
};

// Renders the canvas on another canvas.
ImageCanvas.prototype.draw = function (ctx, callback) {
    if (callback) {
        this.render(function (canvas) {
            ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
        });
    } else {
        var canvas = this.render();
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
    }
};

img = {};
img.Layer = Layer;
img.ImageCanvas = ImageCanvas;

// MODULE SUPPORT ///////////////////////////////////////////////////////

var async = require('async');

function loadImage(image, callback) {
    var img = new Image();
    img.onload = function () {
        callback(null, [image, this]);
    };
    img.src = image;
}

function loadImages(images, callback) {
    async.map(images,
        loadImage, function (err, loadedImages) {
            if (callback) {
                var name, image;
                var d = {};
                for (var i = 0; i < loadedImages.length; i += 1) {
                    name = loadedImages[i][0];
                    image = loadedImages[i][1];
                    d[name] = image;
                }
                callback(d);
            }
        });
}

img.loadImages = loadImages;

module.exports = img;
