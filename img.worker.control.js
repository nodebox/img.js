/*global importScripts, self, process */

importScripts("process.js");

self.onmessage = function (e) {
    'use strict';
    
    var canvasInData = e.data.inData,
        canvasOutData = e.data.outData,
        inData = canvasInData.data,
        outData = canvasOutData.data,
        filter = e.data.filter,
        width = e.data.width,
        height = e.data.height;

    process[filter.name](inData, outData, width, height, filter.options);

    self.postMessage({ result: canvasOutData });
};
