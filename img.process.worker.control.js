/*global importScripts, self, process */

importScripts("process.js");

self.onmessage = function (e) {
    'use strict';

    var i, filter, tmpData,
        inData = e.data.inData,
        outData = e.data.outData,
        filters = e.data.filters,
        width = e.data.width,
        height = e.data.height;

    for (i = 0; i < filters.length; i += 1) {
        if (i > 0) {
            tmpData = inData;
            inData = outData;
            outData = tmpData;
        }
        filter = filters[i];
        process[filter.name](inData.data, outData.data, width, height, filter.options);
    }

    self.postMessage({ result: outData });
};
