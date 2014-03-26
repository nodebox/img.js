/*global importScripts, self, blend */

importScripts("blend.js");

self.onmessage = function (e) {
    'use strict';

    var i, d, filter, tmpData,
        inData = e.data.inData,
        outData = e.data.outData,
        layerData = e.data.layerData,
        width = e.data.width,
        height = e.data.height;

    for (i = 0; i < layerData.length; i += 1) {
        if (i > 0) {
            tmpData = inData;
            inData = outData;
            outData = tmpData;
        }
        d = layerData[i];
        if (blend[d.blendmode] === undefined) {
            throw new Error('No blend mode named \'' + d.blendmode + '\'');
        }
        blend[d.blendmode](inData.data, outData.data, width, height, d);
    }

    self.postMessage({ result: outData });
};
